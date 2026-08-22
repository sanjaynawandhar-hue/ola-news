/**
 * Re-runs the analysis pipeline over stored articles.
 *
 *   npx tsx scripts/reanalyse.ts            # all articles
 *   npx tsx scripts/reanalyse.ts --live     # skip demo records
 *
 * Use after changing the lexicons, category keywords, tracked entities or the
 * summariser: existing rows keep whatever they were scored with at ingestion
 * time, so this brings them in line with the current configuration.
 *
 * It also re-applies normalisation rules that affect stored fields — notably
 * dropping a feed description that merely echoes the headline.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { loadTrackingConfig } from '../src/lib/intelligence/config';
import { analyzeArticle, toAnalysisRows } from '../src/lib/intelligence/analyze';
import { isRedundantDescription, stringifyJson } from '../src/lib/utils';
import {
  inferDocType,
  inferSeverity,
  regulatorySummary,
  regulatoryWhyItMatters,
} from '../src/lib/intelligence/regulatory';

async function main() {
  const liveOnly = process.argv.includes('--live');
  const config = await loadTrackingConfig(true);

  const articles = await prisma.article.findMany({
    where: liveOnly ? { isDemo: false } : {},
    include: { source: true, cluster: { select: { articleCount: true } } },
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`Re-analysing ${articles.length} article(s)…`);

  let updated = 0;
  let descriptionsCleared = 0;
  let statusChanged = 0;

  const relevanceThresholdRow = await prisma.setting.findUnique({
    where: { key: 'intelligence.relevanceThreshold' },
  });
  const relevanceThreshold = relevanceThresholdRow
    ? (JSON.parse(relevanceThresholdRow.value) as number)
    : 25;

  for (const article of articles) {
    // Re-apply the normalisation rule for headline-echo descriptions.
    const description = isRedundantDescription(article.title, article.description)
      ? null
      : article.description;
    if (description !== article.description) descriptionsCleared += 1;

    const isOfficial = ['REGULATOR', 'EXCHANGE', 'GOVERNMENT', 'COURT', 'COMPANY'].includes(
      article.source.sourceType,
    );

    const analysis = await analyzeArticle(
      {
        title: article.title,
        description,
        publisher: article.publisher,
        publishedAt: article.publishedAt,
        sourceType: article.source.sourceType,
        sourceCredibility: article.source.credibility,
        isRegulatorySource: article.source.isRegulatory,
        isOfficialSource: isOfficial,
        corroboration: article.cluster?.articleCount ?? 1,
      },
      config,
      { useLlm: false },
    );

    const rows = toAnalysisRows(article.id, analysis);
    const suppressed = analysis.excluded || analysis.relevance < relevanceThreshold;
    const nextStatus = suppressed ? 'SUPPRESSED' : 'PROCESSED';
    if (nextStatus !== article.processingStatus) statusChanged += 1;

    await prisma.$transaction([
      prisma.article.update({
        where: { id: article.id },
        data: { description, processingStatus: nextStatus },
      }),
      prisma.analysis.upsert({
        where: { articleId: article.id },
        create: rows.analysis,
        update: { ...rows.analysis, articleId: undefined },
      }),
      prisma.sentimentResult.upsert({
        where: { articleId: article.id },
        create: rows.sentiment,
        update: { ...rows.sentiment, articleId: undefined },
      }),
      prisma.riskAssessment.upsert({
        where: { articleId: article.id },
        create: rows.risk,
        update: { ...rows.risk, articleId: undefined },
      }),
      prisma.articleEntity.deleteMany({ where: { articleId: article.id } }),
      prisma.articleEntity.createMany({ data: rows.entities }),
    ]);

    // Keep the regulatory tracker aligned. Regulatory documents get their own
    // summary style, not the news one.
    if (article.source.isRegulatory) {
      const companyNames = analysis.companyKeys
        .map((key) => config.companyIndex.get(key)?.name)
        .filter((name): name is string => !!name);
      const authority =
        article.source.authority ??
        analysis.entities.find((e) => e.type === 'REGULATOR')?.value ??
        article.source.name;
      const docType = inferDocType(article.title, description);
      await prisma.regulatoryDocument.updateMany({
        where: { articleId: article.id },
        data: {
          summary: regulatorySummary(authority, docType, companyNames, article.publishedAt, description),
          whyItMatters: regulatoryWhyItMatters(authority, docType, companyNames),
          docType,
          severity: inferSeverity(docType, analysis.risk.level, companyNames.length > 0),
          companyKeys: stringifyJson(analysis.companyKeys),
        },
      });
    }

    updated += 1;
    if (updated % 100 === 0) console.log(`  …${updated}/${articles.length}`);
  }

  console.log('');
  console.log(`Re-analysed            : ${updated}`);
  console.log(`Echo descriptions clear: ${descriptionsCleared}`);
  console.log(`Feed visibility changed: ${statusChanged}`);
  console.log(`Now in the feed        : ${await prisma.article.count({ where: { processingStatus: 'PROCESSED' } })}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
