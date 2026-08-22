import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/utils';
import {
  COMPANY_GROUP_LABELS,
  REGULATORY_DOC_TYPE_LABELS,
  RISK_RANK,
  type CompanyGroup,
  type RegulatoryDocType,
} from '@/lib/constants';
import { dayKey } from '@/lib/time';
import { detectVolumeSpike, fillTrendSeries, findEmergingTopics, type TrendPoint } from '@/lib/intelligence/trends';
import type { FeedArticle, FeedQuery, Paged, RegulatoryItem } from '@/types';
import type { Prisma } from '@/generated/prisma/client';

/** Shape shared by every article read so the mapper stays in one place. */
const ARTICLE_SELECT = {
  id: true, title: true, description: true, url: true, canonicalUrl: true,
  publisher: true, publishedAt: true, fetchedAt: true, language: true, country: true,
  isDemo: true, clusterId: true, imageUrl: true,
  source: {
    select: {
      key: true, name: true, sourceType: true, mode: true, credibility: true, isRegulatory: true,
    },
  },
  analysis: true,
  sentiment: true,
  risk: true,
  cluster: { select: { articleCount: true, publisherCount: true } },
  bookmarks: { select: { id: true } },
  important: { select: { id: true } },
} satisfies Prisma.ArticleSelect;

type ArticleRow = Prisma.ArticleGetPayload<{ select: typeof ARTICLE_SELECT }>;

export function mapArticle(
  row: ArticleRow,
  lookups: { categories: Map<string, string>; companies: Map<string, { name: string; group: string }> },
): FeedArticle {
  const companyKey = row.analysis?.primaryCompanyKey ?? null;
  const company = companyKey ? lookups.companies.get(companyKey) : undefined;
  const categoryKey = row.analysis?.categoryKey ?? 'corporate';

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    aiSummary: row.analysis?.aiSummary ?? '',
    whyItMatters: row.analysis?.whyItMatters ?? '',
    url: row.url,
    canonicalUrl: row.canonicalUrl,
    publisher: row.publisher,
    sourceKey: row.source.key,
    sourceName: row.source.name,
    sourceType: row.source.sourceType as FeedArticle['sourceType'],
    sourceMode: row.source.mode as FeedArticle['sourceMode'],
    sourceCredibility: row.source.credibility,
    publishedAt: row.publishedAt.toISOString(),
    fetchedAt: row.fetchedAt.toISOString(),
    language: row.language,
    country: row.country,
    isDemo: row.isDemo,
    companyKeys: parseJson<string[]>(row.analysis?.companyKeys, []),
    primaryCompanyKey: companyKey,
    companyGroup: company?.group ?? null,
    companyLabel: company?.name ?? null,
    categoryKey,
    categoryLabel: lookups.categories.get(categoryKey) ?? categoryKey,
    topics: parseJson<string[]>(row.analysis?.topics, []),
    sentiment: (row.sentiment?.label ?? 'NEUTRAL') as FeedArticle['sentiment'],
    sentimentScore: row.sentiment?.score ?? 0,
    sentimentConfidence: row.sentiment?.confidence ?? 0,
    riskLevel: (row.risk?.level ?? 'NONE') as FeedArticle['riskLevel'],
    riskScore: row.risk?.score ?? 0,
    riskDrivers: parseJson<string[]>(row.risk?.drivers, []),
    riskDimensions: parseJson<Record<string, number>>(row.risk?.dimensions, {}),
    relevance: row.analysis?.relevance ?? 0,
    confidence: row.analysis?.confidence ?? 0,
    contentType: (row.analysis?.contentType ?? 'REPORTING') as FeedArticle['contentType'],
    verification: (row.analysis?.verification ?? 'UNVERIFIED') as FeedArticle['verification'],
    corroboration: row.analysis?.corroboration ?? 1,
    importanceScore: row.analysis?.importanceScore ?? 0,
    relatedCount: Math.max(0, (row.cluster?.articleCount ?? 1) - 1),
    clusterId: row.clusterId,
    bookmarked: row.bookmarks.length > 0,
    important: row.important.length > 0,
    engine: row.analysis?.engine ?? 'heuristic-v1',
    imageUrl: row.imageUrl,
  };
}

export async function getLookups() {
  const [categories, companies] = await Promise.all([
    prisma.category.findMany({ select: { key: true, label: true } }),
    prisma.company.findMany({ select: { key: true, name: true, group: true } }),
  ]);
  return {
    categories: new Map(categories.map((c) => [c.key, c.label])),
    companies: new Map(companies.map((c) => [c.key, { name: c.name, group: c.group }])),
  };
}

/**
 * @param groupPrimaryKeys Company keys resolved from a `groups` filter. These
 *   match the story's PRIMARY company only, mirroring how the overview
 *   attributes each story to exactly one group. An explicit `companies` filter
 *   stays broader (any mention), which is what a reader ticking a single
 *   company in the filter panel expects — but a group tab and its "open in the
 *   feed" link must agree on the count, and attribution is what the tab shows.
 */
function buildWhere(
  query: FeedQuery,
  groupPrimaryKeys?: string[],
): Prisma.ArticleWhereInput {
  const where: Prisma.ArticleWhereInput = {
    processingStatus: 'PROCESSED',
  };
  const and: Prisma.ArticleWhereInput[] = [];

  if (query.includeDemo === false) and.push({ isDemo: false });

  if (query.q) {
    const term = query.q.trim();
    if (term) {
      and.push({
        OR: [
          { title: { contains: term } },
          { description: { contains: term } },
          { publisher: { contains: term } },
          { analysis: { is: { aiSummary: { contains: term } } } },
          { analysis: { is: { whyItMatters: { contains: term } } } },
          { entities: { some: { value: { contains: term } } } },
        ],
      });
    }
  }

  if (query.companies?.length) {
    and.push({
      OR: [
        { analysis: { is: { primaryCompanyKey: { in: query.companies } } } },
        ...query.companies.map((key) => ({
          analysis: { is: { companyKeys: { contains: `"${key}"` } } },
        })),
      ],
    });
  }

  if (groupPrimaryKeys?.length) {
    and.push({ analysis: { is: { primaryCompanyKey: { in: groupPrimaryKeys } } } });
  }

  if (query.brands?.length) {
    and.push({ entities: { some: { type: 'BRAND', value: { in: query.brands } } } });
  }
  if (query.sources?.length) and.push({ source: { key: { in: query.sources } } });
  if (query.sourceTypes?.length) and.push({ source: { sourceType: { in: query.sourceTypes } } });
  if (query.countries?.length) and.push({ country: { in: query.countries } });
  if (query.languages?.length) and.push({ language: { in: query.languages } });
  if (query.categories?.length) and.push({ analysis: { is: { categoryKey: { in: query.categories } } } });
  if (query.topics?.length) {
    and.push({
      OR: query.topics.map((topic) => ({ analysis: { is: { topics: { contains: `"${topic}"` } } } })),
    });
  }
  if (query.sentiments?.length) and.push({ sentiment: { is: { label: { in: query.sentiments } } } });
  if (query.riskLevels?.length) and.push({ risk: { is: { level: { in: query.riskLevels } } } });
  if (query.verification?.length) and.push({ analysis: { is: { verification: { in: query.verification } } } });
  if (query.minRelevance) and.push({ analysis: { is: { relevance: { gte: query.minRelevance } } } });
  if (query.bookmarkedOnly) and.push({ bookmarks: { some: {} } });
  if (query.importantOnly) and.push({ important: { some: {} } });

  const range: Prisma.DateTimeFilter = {};
  // Resolved here rather than in the link, so the window is computed once on
  // the server and a shared link keeps meaning "the last N days".
  if (query.withinDays) range.gte = new Date(Date.now() - query.withinDays * 86400000);
  if (query.from) range.gte = new Date(query.from);
  if (query.to) range.lte = new Date(query.to);
  if (range.gte || range.lte) and.push({ publishedAt: range });

  if (and.length) where.AND = and;
  return where;
}

function buildOrderBy(sort: FeedQuery['sort']): Prisma.ArticleOrderByWithRelationInput[] {
  switch (sort) {
    case 'relevance':
      return [{ analysis: { relevance: 'desc' } }, { publishedAt: 'desc' }];
    case 'importance':
      return [{ analysis: { importanceScore: 'desc' } }, { publishedAt: 'desc' }];
    case 'risk':
      return [{ risk: { score: 'desc' } }, { publishedAt: 'desc' }];
    case 'sentiment':
      return [{ sentiment: { score: 'asc' } }, { publishedAt: 'desc' }];
    default:
      return [{ publishedAt: 'desc' }];
  }
}

/** Resolves company-group filters to the underlying company keys. */
async function resolveGroupKeys(groups?: string[]): Promise<string[] | undefined> {
  if (!groups?.length) return undefined;
  const companies = await prisma.company.findMany({
    where: { group: { in: groups } },
    select: { key: true },
  });
  return companies.map((c) => c.key);
}

export async function getFeed(query: FeedQuery): Promise<Paged<FeedArticle>> {
  const groupPrimaryKeys = await resolveGroupKeys(query.groups);
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 20));
  const where = buildWhere(query, groupPrimaryKeys);

  const [total, rows, lookups] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      select: ARTICLE_SELECT,
      orderBy: buildOrderBy(query.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    getLookups(),
  ]);

  return {
    items: rows.map((row) => mapArticle(row, lookups)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getArticleById(id: string): Promise<FeedArticle | null> {
  const [row, lookups] = await Promise.all([
    prisma.article.findUnique({ where: { id }, select: ARTICLE_SELECT }),
    getLookups(),
  ]);
  return row ? mapArticle(row, lookups) : null;
}

export async function getArticlesByIds(ids: string[]): Promise<FeedArticle[]> {
  if (ids.length === 0) return [];
  const [rows, lookups] = await Promise.all([
    prisma.article.findMany({ where: { id: { in: ids } }, select: ARTICLE_SELECT }),
    getLookups(),
  ]);
  const mapped = new Map(rows.map((row) => [row.id, mapArticle(row, lookups)]));
  return ids.map((id) => mapped.get(id)).filter((a): a is FeedArticle => !!a);
}

export interface OverviewMetrics {
  totals: {
    all: number;
    last24h: number;
    last7d: number;
    last30d: number;
    positive: number;
    neutral: number;
    negative: number;
    criticalAlerts: number;
    highRisk: number;
    regulatory: number;
    demo: number;
  };
  byGroup: Array<{ group: CompanyGroup; label: string; total: number; last24h: number; positive: number; negative: number; highRisk: number; avgSentiment: number }>;
  topPublishers: Array<{ publisher: string; count: number }>;
  trendingTopics: Array<{ topic: string; count: number }>;
  emergingIssues: Array<{ topic: string; recentCount: number; lift: number; isNew: boolean }>;
  topExecutives: Array<{ name: string; count: number; companyKey: string | null }>;
  topProducts: Array<{ name: string; count: number }>;
  geography: Array<{ country: string; count: number }>;
  categories: Array<{ key: string; label: string; count: number }>;
  volumeTrend: TrendPoint[];
  volumeSpike: { ratio: number; isSpike: boolean; recentCount: number; baselinePerWindow: number };
  sourceHealth: { live: number; demo: number; disabled: number; awaitingCredentials: number; failing: number };
  lastRefreshAt: string | null;
}

export async function getOverview(
  { days = 30, timezone = 'Asia/Kolkata', groups }: { days?: number; timezone?: string; groups?: string[] } = {},
): Promise<OverviewMetrics> {
  const now = new Date();
  const since = new Date(now.getTime() - days * 86400000);

  const companyFilter = groups?.length
    ? await prisma.company.findMany({ where: { group: { in: groups } }, select: { key: true } })
    : null;
  const companyKeys = companyFilter?.map((c) => c.key);

  const baseWhere: Prisma.ArticleWhereInput = {
    processingStatus: 'PROCESSED',
    ...(companyKeys
      ? { analysis: { is: { primaryCompanyKey: { in: companyKeys } } } }
      : {}),
  };

  const rows = await prisma.article.findMany({
    where: { ...baseWhere, publishedAt: { gte: since } },
    select: {
      publishedAt: true, publisher: true, country: true, isDemo: true,
      analysis: { select: { categoryKey: true, primaryCompanyKey: true, topics: true, importanceScore: true } },
      sentiment: { select: { label: true, score: true } },
      risk: { select: { level: true } },
      source: { select: { isRegulatory: true } },
    },
    take: 20000,
  });

  const [allTotal, regulatoryTotal, entityRows, categories, companies, sources, lastJob] = await Promise.all([
    prisma.article.count({ where: baseWhere }),
    // Counted from the regulatory tracker itself. Regulatory documents are
    // recorded independently of the feed's relevance threshold — a sector-wide
    // circular is a compliance item even when it names no tracked company — so
    // counting the underlying articles would under-report it.
    prisma.regulatoryDocument.count({ where: { issueDate: { gte: since } } }),
    prisma.articleEntity.findMany({
      where: {
        type: { in: ['PERSON', 'PRODUCT'] },
        article: { ...baseWhere, publishedAt: { gte: since } },
      },
      select: { type: true, value: true, refKey: true },
      take: 20000,
    }),
    prisma.category.findMany({ select: { key: true, label: true } }),
    prisma.company.findMany({ select: { key: true, name: true, group: true } }),
    prisma.source.findMany({ select: { mode: true, consecutiveFailures: true, enabled: true } }),
    prisma.refreshJob.findFirst({
      where: { status: { in: ['COMPLETED', 'COMPLETED_WITH_ERRORS'] } },
      orderBy: { finishedAt: 'desc' },
    }),
  ]);

  const categoryLabels = new Map(categories.map((c) => [c.key, c.label]));
  const companyGroups = new Map(companies.map((c) => [c.key, c.group]));

  const nowMs = now.getTime();
  const count = (predicate: (row: (typeof rows)[number]) => boolean) => rows.filter(predicate).length;

  const trendMap = new Map<string, TrendPoint>();
  const publisherCounts = new Map<string, number>();
  const topicCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const groupStats = new Map<string, { total: number; last24h: number; positive: number; negative: number; highRisk: number; sentimentSum: number }>();

  for (const row of rows) {
    const key = dayKey(row.publishedAt, timezone);
    const point =
      trendMap.get(key) ??
      { date: key, total: 0, positive: 0, neutral: 0, negative: 0, ani: 0, olaelectric: 0, krutrim: 0, market: 0 };
    point.total += 1;
    const label = row.sentiment?.label ?? 'NEUTRAL';
    if (label === 'POSITIVE') point.positive += 1;
    else if (label === 'NEGATIVE') point.negative += 1;
    else point.neutral += 1;

    const group = row.analysis?.primaryCompanyKey
      ? companyGroups.get(row.analysis.primaryCompanyKey)
      : undefined;
    if (group === 'ani') point.ani += 1;
    else if (group === 'olaelectric') point.olaelectric += 1;
    else if (group === 'krutrim') point.krutrim += 1;
    else point.market += 1;
    trendMap.set(key, point);

    publisherCounts.set(row.publisher, (publisherCounts.get(row.publisher) ?? 0) + 1);
    countryCounts.set(row.country, (countryCounts.get(row.country) ?? 0) + 1);
    const categoryKey = row.analysis?.categoryKey ?? 'corporate';
    categoryCounts.set(categoryKey, (categoryCounts.get(categoryKey) ?? 0) + 1);

    for (const topic of parseJson<string[]>(row.analysis?.topics, [])) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }

    const groupKey = group ?? 'market';
    const stats = groupStats.get(groupKey) ?? { total: 0, last24h: 0, positive: 0, negative: 0, highRisk: 0, sentimentSum: 0 };
    stats.total += 1;
    stats.sentimentSum += row.sentiment?.score ?? 0;
    if (nowMs - row.publishedAt.getTime() <= 86400000) stats.last24h += 1;
    if (label === 'POSITIVE') stats.positive += 1;
    if (label === 'NEGATIVE') stats.negative += 1;
    if (RISK_RANK[(row.risk?.level ?? 'NONE') as keyof typeof RISK_RANK] >= RISK_RANK.HIGH) stats.highRisk += 1;
    groupStats.set(groupKey, stats);
  }

  const personCounts = new Map<string, { count: number; companyKey: string | null }>();
  const productCounts = new Map<string, number>();
  for (const entity of entityRows) {
    if (entity.type === 'PERSON') {
      const existing = personCounts.get(entity.value) ?? { count: 0, companyKey: entity.refKey?.split(':')[0] ?? null };
      existing.count += 1;
      personCounts.set(entity.value, existing);
    } else {
      productCounts.set(entity.value, (productCounts.get(entity.value) ?? 0) + 1);
    }
  }

  const emerging = findEmergingTopics(
    rows.map((row) => ({
      publishedAt: row.publishedAt,
      topics: parseJson<string[]>(row.analysis?.topics, []),
    })),
    { now, limit: 8 },
  );

  const spike = detectVolumeSpike(rows.map((row) => ({ publishedAt: row.publishedAt })), { now });

  const groupOrder: CompanyGroup[] = ['ani', 'olaelectric', 'krutrim', 'market'];

  return {
    totals: {
      all: allTotal,
      last24h: count((r) => nowMs - r.publishedAt.getTime() <= 86400000),
      last7d: count((r) => nowMs - r.publishedAt.getTime() <= 7 * 86400000),
      last30d: count((r) => nowMs - r.publishedAt.getTime() <= 30 * 86400000),
      positive: count((r) => r.sentiment?.label === 'POSITIVE'),
      neutral: count((r) => (r.sentiment?.label ?? 'NEUTRAL') === 'NEUTRAL'),
      negative: count((r) => r.sentiment?.label === 'NEGATIVE'),
      criticalAlerts: count((r) => r.risk?.level === 'CRITICAL'),
      highRisk: count((r) => r.risk?.level === 'HIGH' || r.risk?.level === 'CRITICAL'),
      regulatory: regulatoryTotal,
      demo: count((r) => r.isDemo),
    },
    byGroup: groupOrder.map((group) => {
      const stats = groupStats.get(group) ?? { total: 0, last24h: 0, positive: 0, negative: 0, highRisk: 0, sentimentSum: 0 };
      return {
        group,
        label: COMPANY_GROUP_LABELS[group],
        total: stats.total,
        last24h: stats.last24h,
        positive: stats.positive,
        negative: stats.negative,
        highRisk: stats.highRisk,
        avgSentiment: stats.total ? Number((stats.sentimentSum / stats.total).toFixed(3)) : 0,
      };
    }),
    topPublishers: sortedTop(publisherCounts, 10).map(([publisher, count]) => ({ publisher, count })),
    trendingTopics: sortedTop(topicCounts, 14).map(([topic, count]) => ({ topic, count })),
    emergingIssues: emerging.map((e) => ({ topic: e.topic, recentCount: e.recentCount, lift: e.lift, isNew: e.isNew })),
    topExecutives: Array.from(personCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, value]) => ({ name, count: value.count, companyKey: value.companyKey })),
    topProducts: sortedTop(productCounts, 8).map(([name, count]) => ({ name, count })),
    geography: sortedTop(countryCounts, 12).map(([country, count]) => ({ country, count })),
    categories: sortedTop(categoryCounts, 20).map(([key, count]) => ({
      key,
      label: categoryLabels.get(key) ?? key,
      count,
    })),
    volumeTrend: fillTrendSeries(trendMap, Math.min(days, 90), timezone, now),
    volumeSpike: {
      ratio: spike.ratio,
      isSpike: spike.isSpike,
      recentCount: spike.recentCount,
      baselinePerWindow: spike.baselinePerWindow,
    },
    sourceHealth: {
      live: sources.filter((s) => s.mode === 'LIVE' && s.enabled).length,
      demo: sources.filter((s) => s.mode === 'DEMO').length,
      disabled: sources.filter((s) => s.mode === 'DISABLED' || !s.enabled).length,
      awaitingCredentials: sources.filter((s) => s.mode === 'AWAITING_CREDENTIALS').length,
      failing: sources.filter((s) => s.consecutiveFailures > 0).length,
    },
    lastRefreshAt: lastJob?.finishedAt?.toISOString() ?? null,
  };
}

function sortedTop(map: Map<string, number>, limit: number): Array<[string, number]> {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export interface RegulatoryQuery {
  /** Only documents that actually name one of the tracked companies. */
  trackedOnly?: boolean;
  authorities?: string[];
  docTypes?: string[];
  severities?: string[];
  statuses?: string[];
  companies?: string[];
  q?: string;
  from?: string;
  to?: string;
  includeDemo?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getRegulatory(query: RegulatoryQuery): Promise<Paged<RegulatoryItem>> {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, query.pageSize ?? 25));

  const and: Prisma.RegulatoryDocumentWhereInput[] = [];
  if (query.authorities?.length) and.push({ authority: { in: query.authorities } });
  if (query.docTypes?.length) and.push({ docType: { in: query.docTypes } });
  if (query.severities?.length) and.push({ severity: { in: query.severities } });
  if (query.statuses?.length) and.push({ status: { in: query.statuses } });
  if (query.includeDemo === false) and.push({ isDemo: false });
  // companyKeys is a JSON-encoded array; anything other than "[]" names at
  // least one tracked company.
  if (query.trackedOnly) and.push({ NOT: { companyKeys: '[]' } });
  if (query.companies?.length) {
    and.push({ OR: query.companies.map((key) => ({ companyKeys: { contains: `"${key}"` } })) });
  }
  if (query.q?.trim()) {
    and.push({
      OR: [
        { title: { contains: query.q.trim() } },
        { summary: { contains: query.q.trim() } },
        { authority: { contains: query.q.trim() } },
      ],
    });
  }
  const range: Prisma.DateTimeFilter = {};
  if (query.from) range.gte = new Date(query.from);
  if (query.to) range.lte = new Date(query.to);
  if (range.gte || range.lte) and.push({ issueDate: range });

  const where: Prisma.RegulatoryDocumentWhereInput = and.length ? { AND: and } : {};

  const [total, rows] = await Promise.all([
    prisma.regulatoryDocument.count({ where }),
    prisma.regulatoryDocument.findMany({
      where,
      include: { source: { select: { name: true, mode: true } } },
      // Official primary documents rank above secondary reporting.
      orderBy: [{ isPrimaryDocument: 'desc' }, { issueDate: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      authority: row.authority,
      companyKeys: parseJson<string[]>(row.companyKeys, []),
      docType: row.docType as RegulatoryDocType,
      docTypeLabel: REGULATORY_DOC_TYPE_LABELS[row.docType as RegulatoryDocType] ?? row.docType,
      title: row.title,
      summary: row.summary,
      whyItMatters: row.whyItMatters,
      issueDate: row.issueDate.toISOString(),
      effectiveDate: row.effectiveDate?.toISOString() ?? null,
      responseDeadline: row.responseDeadline?.toISOString() ?? null,
      severity: row.severity as RegulatoryItem['severity'],
      status: row.status,
      documentUrl: row.documentUrl,
      isPrimaryDocument: row.isPrimaryDocument,
      isDemo: row.isDemo,
      sourceName: row.source.name,
      sourceMode: row.source.mode as RegulatoryItem['sourceMode'],
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Everything the filter panel needs, in one round trip. */
export async function getFilterOptions() {
  const [companies, categories, sources, countries, languages, brands, authorities] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, select: { key: true, name: true, group: true, relation: true }, orderBy: { name: 'asc' } }),
    prisma.category.findMany({ where: { active: true }, select: { key: true, label: true, colorHex: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.source.findMany({ select: { key: true, name: true, sourceType: true, mode: true, enabled: true }, orderBy: { name: 'asc' } }),
    prisma.article.groupBy({ by: ['country'], _count: { country: true } }),
    prisma.article.groupBy({ by: ['language'], _count: { language: true } }),
    prisma.brand.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.regulatoryDocument.groupBy({ by: ['authority'], _count: { authority: true } }),
  ]);

  return {
    companies,
    groups: (['ani', 'olaelectric', 'krutrim', 'market'] as CompanyGroup[]).map((group) => ({
      key: group,
      label: COMPANY_GROUP_LABELS[group],
    })),
    categories,
    sources,
    brands: brands.map((b) => b.name),
    countries: countries.map((c) => ({ code: c.country, count: c._count.country })).sort((a, b) => b.count - a.count),
    languages: languages.map((l) => ({ code: l.language, count: l._count.language })).sort((a, b) => b.count - a.count),
    authorities: authorities.map((a) => ({ key: a.authority, count: a._count.authority })).sort((a, b) => b.count - a.count),
  };
}
