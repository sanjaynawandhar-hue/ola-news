import { prisma } from '@/lib/db';
import { serverEnv } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { getAdapter } from './adapters';
import { normalizeItem } from './normalize';
import { dedupeBatch, filterAgainstExisting, type Fingerprint } from './dedupe';
import { CLUSTER_WINDOW_HOURS, clusterSlug, matchCluster } from './cluster';
import { analyzeArticle, toAnalysisRows } from '@/lib/intelligence/analyze';
import {
  inferDocType, inferSeverity, regulatorySummary, regulatoryWhyItMatters,
} from '@/lib/intelligence/regulatory';
import { buildSearchQueries, loadTrackingConfig } from '@/lib/intelligence/config';
import { evaluateAlerts } from '@/lib/alerts';
import { getSettings } from '@/lib/settings';
import { chunk, sha1, stringifyJson } from '@/lib/utils';
import type { NormalizedItem, SourceProgress } from '@/types';
import type { Source } from '@/generated/prisma/client';

const log = createLogger('pipeline');

/** How far back an ingested item may be published. */
const MAX_ITEM_AGE_DAYS = 45;

export interface RunRefreshOptions {
  trigger?: 'manual' | 'auto' | 'cron';
  sourceKeys?: string[];
  useLlm?: boolean;
}

/**
 * The full refresh: contact every enabled source, normalise, deduplicate,
 * analyse, cluster, persist and raise alerts. Progress is written to the
 * RefreshJob row after every source so the UI can poll it live.
 *
 * A failing source is recorded and skipped — it never aborts the run.
 */
export async function runRefresh(options: RunRefreshOptions = {}): Promise<string> {
  const trigger = options.trigger ?? 'manual';
  const settings = await getSettings();

  const sources = await prisma.source.findMany({
    where: {
      enabled: true,
      ...(options.sourceKeys?.length ? { key: { in: options.sourceKeys } } : {}),
    },
    orderBy: { sortOrder: 'asc' },
  });

  const runnable = sources.filter((source) => {
    if (source.mode === 'DISABLED') return false;
    // Gate on the adapter as well as the mode, so a source that serves the
    // sample dataset can never run while demo data is switched off.
    const servesDemoData = source.mode === 'DEMO' || source.adapter === 'demo';
    if (servesDemoData && !settings.demoDataEnabled) return false;
    if (source.mode === 'AWAITING_CREDENTIALS') return false;
    return true;
  });

  const progress: SourceProgress[] = sources.map((source) => ({
    sourceKey: source.key,
    sourceName: source.name,
    mode: source.mode as SourceProgress['mode'],
    status: runnable.some((r) => r.id === source.id) ? 'pending' : 'skipped',
    itemsFetched: 0,
    itemsNew: 0,
    duplicates: 0,
    message: runnable.some((r) => r.id === source.id)
      ? undefined
      : source.mode === 'AWAITING_CREDENTIALS'
        ? `Skipped — set ${source.credentialEnvVar ?? 'the API key'} to enable this source.`
        : source.mode === 'DEMO'
          ? 'Skipped — demo data is turned off in Settings.'
          : 'Skipped — source is disabled.',
  }));

  const job = await prisma.refreshJob.create({
    data: {
      trigger,
      status: 'RUNNING',
      sourcesTotal: runnable.length,
      progress: stringifyJson(progress),
    },
  });

  // Run in the background; the caller polls /api/refresh/status.
  void executeRefresh(job.id, runnable, progress, options).catch(async (error) => {
    log.error('refresh crashed', { jobId: job.id, error: String(error) });
    await prisma.refreshJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  });

  return job.id;
}

async function executeRefresh(
  jobId: string,
  sources: Source[],
  progress: SourceProgress[],
  options: RunRefreshOptions,
) {
  const queries = await buildSearchQueries(8);
  let itemsFetched = 0;
  let itemsNew = 0;
  let duplicatesRemoved = 0;
  let sourcesOk = 0;
  let sourcesFailed = 0;
  let sourcesCompleted = 0;
  let alertsRaised = 0;

  const concurrency = Math.max(1, serverEnv.maxConcurrentSources);
  const batches = chunk(sources, concurrency);

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (source) => {
        const entry = progress.find((p) => p.sourceKey === source.key)!;
        entry.status = 'running';
        await persistProgress(jobId, progress, {
          sourcesCompleted, sourcesOk, sourcesFailed, itemsFetched, itemsNew, duplicatesRemoved, alertsRaised,
        });

        const startedAt = Date.now();
        try {
          const result = await ingestSource(source, queries, jobId, options);
          itemsFetched += result.fetched;
          itemsNew += result.stored;
          duplicatesRemoved += result.duplicates;
          alertsRaised += result.alerts;
          sourcesOk += 1;
          entry.status = 'ok';
          entry.itemsFetched = result.fetched;
          entry.itemsNew = result.stored;
          entry.duplicates = result.duplicates;
          entry.durationMs = Date.now() - startedAt;
          entry.message = result.note;

          await prisma.source.update({
            where: { id: source.id },
            data: {
              lastCheckedAt: new Date(),
              lastSuccessAt: new Date(),
              consecutiveFailures: 0,
              lastError: null,
            },
          });
        } catch (error) {
          sourcesFailed += 1;
          const message = error instanceof Error ? error.message : 'Unknown error';
          const statusCode =
            error && typeof error === 'object' && 'statusCode' in error
              ? (error as { statusCode?: number }).statusCode
              : undefined;
          entry.status = 'failed';
          entry.message = message;
          entry.statusCode = statusCode;
          entry.durationMs = Date.now() - startedAt;

          log.warn('source failed', { source: source.key, message });
          await prisma.sourceFailure.create({
            data: { sourceId: source.id, refreshJobId: jobId, stage: 'fetch', message, statusCode },
          });
          await prisma.source.update({
            where: { id: source.id },
            data: {
              lastCheckedAt: new Date(),
              lastErrorAt: new Date(),
              lastError: message.slice(0, 500),
              consecutiveFailures: { increment: 1 },
            },
          });
        } finally {
          sourcesCompleted += 1;
          await persistProgress(jobId, progress, {
            sourcesCompleted, sourcesOk, sourcesFailed, itemsFetched, itemsNew, duplicatesRemoved, alertsRaised,
          });
        }
      }),
    );
  }

  await prisma.refreshJob.update({
    where: { id: jobId },
    data: {
      status: sourcesFailed === 0 ? 'COMPLETED' : sourcesOk > 0 ? 'COMPLETED_WITH_ERRORS' : 'FAILED',
      finishedAt: new Date(),
      sourcesCompleted, sourcesOk, sourcesFailed,
      itemsFetched, itemsNew, duplicatesRemoved, alertsRaised,
      progress: stringifyJson(progress),
      error: sourcesOk === 0 && sourcesFailed > 0 ? 'Every source failed. Check the Sources page for details.' : null,
    },
  });

  log.info('refresh finished', { jobId, itemsNew, duplicatesRemoved, sourcesFailed });
}

async function persistProgress(
  jobId: string,
  progress: SourceProgress[],
  counters: Record<string, number>,
) {
  await prisma.refreshJob.update({
    where: { id: jobId },
    data: { progress: stringifyJson(progress), ...counters },
  });
}

interface IngestResult {
  fetched: number;
  stored: number;
  duplicates: number;
  alerts: number;
  note?: string;
}

async function ingestSource(
  source: Source,
  queries: string[],
  jobId: string,
  options: RunRefreshOptions,
): Promise<IngestResult> {
  const adapter = getAdapter(source.adapter);
  if (!adapter) throw new Error(`No adapter registered for "${source.adapter}"`);

  const credential = source.credentialEnvVar
    ? serverEnv.credentials[source.credentialEnvVar]
    : undefined;
  if (source.requiresCredential && !credential) {
    throw new Error(`Missing credential ${source.credentialEnvVar}. Source cannot be contacted.`);
  }

  const raw = await adapter.fetchItems({
    queries: queries.length ? queries : ['Ola Electric'],
    maxItems: source.maxItems,
    timeoutMs: source.timeoutMs,
    rateLimitMs: source.rateLimitMs,
    credential,
    sourceKey: source.key,
    endpoint: source.endpoint,
    queryTemplate: source.queryTemplate,
  });

  const normalized: NormalizedItem[] = [];
  for (const item of raw) {
    const normal = normalizeItem(item, {
      sourceId: source.id,
      sourceKey: source.key,
      sourceName: source.name,
      defaultLanguage: source.language,
      defaultCountry: source.country,
      // Belt and braces: an item is demo data if EITHER the connector is in
      // demo mode or it is served by the demo adapter. Deriving this from the
      // mode alone would let a mis-configured source (demo adapter, LIVE mode)
      // store sample records as though they were real news.
      isDemo: source.mode === 'DEMO' || source.adapter === 'demo',
      maxAgeDays: MAX_ITEM_AGE_DAYS,
    });
    if (normal) normalized.push(normal);
  }

  const batchDedupe = dedupeBatch(normalized);
  let duplicates = batchDedupe.duplicates.length;

  const existing = await prisma.article.findMany({
    where: {
      OR: [
        { urlHash: { in: batchDedupe.unique.map((i) => i.urlHash) } },
        { contentHash: { in: batchDedupe.unique.map((i) => i.contentHash) } },
        { publishedAt: { gte: new Date(Date.now() - 14 * 86400000) } },
      ],
    },
    select: { urlHash: true, contentHash: true, simhash: true, title: true, publisher: true },
    take: 3000,
  });

  const dbDedupe = filterAgainstExisting(batchDedupe.unique, existing as Fingerprint[]);
  duplicates += dbDedupe.duplicates.length;

  if (dbDedupe.unique.length === 0) {
    return { fetched: raw.length, stored: 0, duplicates, alerts: 0, note: 'No new items.' };
  }

  const config = await loadTrackingConfig();
  const settings = await getSettings();
  const isOfficial = ['REGULATOR', 'EXCHANGE', 'GOVERNMENT', 'COURT', 'COMPANY'].includes(source.sourceType);

  let stored = 0;
  let suppressed = 0;
  let regulatoryStored = 0;
  const storedArticleIds: string[] = [];

  for (const item of dbDedupe.unique) {
    try {
      const corroboration = await countCorroboration(item);
      const analysis = await analyzeArticle(
        {
          title: item.title,
          description: item.description,
          publisher: item.publisher,
          publishedAt: item.publishedAt,
          sourceType: source.sourceType,
          sourceCredibility: source.credibility,
          isRegulatorySource: source.isRegulatory,
          isOfficialSource: isOfficial,
          corroboration,
        },
        config,
        { useLlm: options.useLlm },
      );

      // Below-threshold items are stored but suppressed from the default feed,
      // so the audit trail stays complete without polluting the dashboard.
      const suppressedItem = analysis.excluded || analysis.relevance < settings.relevanceThreshold;
      if (suppressedItem) suppressed += 1;

      const clusterId = await assignCluster(item, analysis.categoryKey, analysis.primaryCompanyKey, analysis);

      const rows = toAnalysisRows('pending', analysis);
      const article = await prisma.article.create({
        data: {
          sourceId: source.id,
          externalId: item.externalId,
          title: item.title,
          description: item.description,
          url: item.url,
          canonicalUrl: item.canonicalUrl,
          urlHash: item.urlHash,
          contentHash: item.contentHash,
          simhash: item.simhash,
          imageUrl: item.imageUrl,
          author: item.author,
          publisher: item.publisher,
          publishedAt: item.publishedAt,
          language: item.language,
          country: item.country,
          isDemo: item.isDemo,
          refreshJobId: jobId,
          clusterId,
          processingStatus: suppressedItem ? 'SUPPRESSED' : 'PROCESSED',
          analysis: { create: { ...rows.analysis, articleId: undefined } as never },
          sentiment: { create: { ...rows.sentiment, articleId: undefined } as never },
          risk: { create: { ...rows.risk, articleId: undefined } as never },
          entities: {
            create: rows.entities.map(({ articleId: _ignored, ...entity }) => entity),
          },
        },
      });
      stored += 1;
      if (!suppressedItem) storedArticleIds.push(article.id);
      await refreshClusterStats(clusterId);

      // Items from a regulator, exchange, court or ministry are also recorded
      // as regulatory documents. This happens regardless of the feed relevance
      // threshold: a SEBI circular that does not name a tracked company is
      // still part of the compliance picture for a listed entity, and the
      // tracker distinguishes the two rather than dropping one.
      if (source.isRegulatory) {
        regulatoryStored += await storeRegulatoryDocument(source, item, article.id, analysis, config);
      }
    } catch (error) {
      log.warn('failed to store item', {
        source: source.key,
        url: item.canonicalUrl,
        error: error instanceof Error ? error.message : String(error),
      });
      await prisma.sourceFailure.create({
        data: {
          sourceId: source.id,
          refreshJobId: jobId,
          stage: 'store',
          message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown storage error',
        },
      });
    }
  }

  const alerts = storedArticleIds.length ? await evaluateAlerts(storedArticleIds) : 0;

  const notes: string[] = [];
  if (regulatoryStored > 0) notes.push(`${regulatoryStored} regulatory document(s) recorded.`);
  if (suppressed > 0) notes.push(`${suppressed} item(s) below the relevance threshold.`);

  return {
    fetched: raw.length,
    stored,
    duplicates,
    alerts,
    note: notes.length ? notes.join(' ') : undefined,
  };
}

/**
 * Records a regulatory-source item in the regulatory tracker.
 * Returns 1 when a document was written, 0 when one already existed.
 */
async function storeRegulatoryDocument(
  source: Source,
  item: NormalizedItem,
  articleId: string,
  analysis: Awaited<ReturnType<typeof analyzeArticle>>,
  config: Awaited<ReturnType<typeof loadTrackingConfig>>,
): Promise<number> {
  const existing = await prisma.regulatoryDocument.findFirst({
    where: { documentUrl: item.canonicalUrl },
    select: { id: true },
  });
  if (existing) return 0;

  const authority =
    source.authority ??
    analysis.entities.find((entity) => entity.type === 'REGULATOR')?.value ??
    source.name;

  const companyNames = analysis.companyKeys
    .map((key) => config.companyIndex.get(key)?.name)
    .filter((name): name is string => !!name);

  const docType = inferDocType(item.title, item.description);
  const severity = inferSeverity(docType, analysis.risk.level, companyNames.length > 0);

  await prisma.regulatoryDocument.create({
    data: {
      articleId,
      sourceId: source.id,
      authority,
      companyKeys: stringifyJson(analysis.companyKeys),
      docType,
      title: item.title,
      summary: regulatorySummary(authority, docType, companyNames, item.publishedAt, item.description),
      whyItMatters: regulatoryWhyItMatters(authority, docType, companyNames),
      issueDate: item.publishedAt,
      severity,
      // Status is a workflow field for the reader to manage; a freshly
      // collected document starts as something to monitor.
      status: companyNames.length > 0 ? 'OPEN' : 'MONITORING',
      documentUrl: item.canonicalUrl,
      // Collected directly from the issuing authority's own feed.
      isPrimaryDocument: true,
      isDemo: item.isDemo,
    },
  });
  return 1;
}

/** Counts distinct publishers already carrying a near-identical headline. */
async function countCorroboration(item: NormalizedItem): Promise<number> {
  const since = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 3600000);
  const rows = await prisma.article.findMany({
    where: { contentHash: item.contentHash, publishedAt: { gte: since } },
    select: { publisher: true },
    take: 50,
  });
  const publishers = new Set(rows.map((r) => r.publisher.toLowerCase()));
  publishers.add(item.publisher.toLowerCase());
  return publishers.size;
}

async function assignCluster(
  item: NormalizedItem,
  categoryKey: string,
  companyKey: string | null,
  analysis: { sentiment: { label: string }; risk: { level: string }; importanceScore: number },
): Promise<string> {
  const since = new Date(item.publishedAt.getTime() - CLUSTER_WINDOW_HOURS * 3600000);
  const candidates = await prisma.storyCluster.findMany({
    where: { lastSeenAt: { gte: since } },
    select: { id: true, title: true, simhash: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
    take: 400,
  });

  const match = matchCluster(
    { id: '', title: item.title, simhash: item.simhash, publishedAt: item.publishedAt, publisher: item.publisher },
    candidates,
  );

  if (match) {
    await prisma.storyCluster.update({
      where: { id: match.clusterId },
      data: { lastSeenAt: new Date(Math.max(item.publishedAt.getTime(), Date.now() - 86400000)) },
    });
    return match.clusterId;
  }

  const created = await prisma.storyCluster.create({
    data: {
      slug: clusterSlug(item.title, sha1(item.canonicalUrl)),
      title: item.title,
      simhash: item.simhash,
      firstSeenAt: item.publishedAt,
      lastSeenAt: item.publishedAt,
      topCompanyKey: companyKey,
      categoryKey,
      sentimentLabel: analysis.sentiment.label,
      riskLevel: analysis.risk.level,
      importanceScore: analysis.importanceScore,
    },
  });
  return created.id;
}

/** Recomputes cluster aggregates after an article joins it. */
export async function refreshClusterStats(clusterId: string) {
  const articles = await prisma.article.findMany({
    where: { clusterId },
    select: {
      publisher: true,
      publishedAt: true,
      analysis: { select: { importanceScore: true, categoryKey: true, primaryCompanyKey: true } },
      sentiment: { select: { label: true, score: true } },
      risk: { select: { level: true, score: true } },
    },
  });
  if (articles.length === 0) return;

  const publishers = new Set(articles.map((a) => a.publisher.toLowerCase()));
  const topRisk = articles.reduce(
    (worst, a) => ((a.risk?.score ?? 0) > worst.score ? { level: a.risk?.level ?? 'LOW', score: a.risk?.score ?? 0 } : worst),
    { level: 'LOW', score: -1 },
  );
  const avgSentiment =
    articles.reduce((sum, a) => sum + (a.sentiment?.score ?? 0), 0) / articles.length;

  await prisma.storyCluster.update({
    where: { id: clusterId },
    data: {
      articleCount: articles.length,
      publisherCount: publishers.size,
      lastSeenAt: new Date(Math.max(...articles.map((a) => a.publishedAt.getTime()))),
      importanceScore: Math.max(...articles.map((a) => a.analysis?.importanceScore ?? 0)),
      riskLevel: topRisk.level,
      sentimentLabel: avgSentiment > 0.2 ? 'POSITIVE' : avgSentiment < -0.2 ? 'NEGATIVE' : 'NEUTRAL',
    },
  });
}
