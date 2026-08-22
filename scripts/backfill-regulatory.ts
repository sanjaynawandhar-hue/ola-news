/**
 * Backfills the regulatory tracker from articles that were already collected
 * from regulator, exchange, court or ministry sources.
 *
 * The ingestion pipeline now writes a RegulatoryDocument alongside every item
 * from an `isRegulatory` source. Articles collected before that was in place
 * have no matching document, so this script creates them. It is idempotent —
 * an item that already has a document is skipped.
 *
 *   npx tsx scripts/backfill-regulatory.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { loadTrackingConfig } from '../src/lib/intelligence/config';
import { analyzeArticle } from '../src/lib/intelligence/analyze';
import {
  inferDocType,
  inferSeverity,
  regulatorySummary,
  regulatoryWhyItMatters,
} from '../src/lib/intelligence/regulatory';
import { parseJson, stringifyJson } from '../src/lib/utils';

async function main() {
  const config = await loadTrackingConfig(true);

  const articles = await prisma.article.findMany({
    where: {
      source: { isRegulatory: true },
      regulatoryDoc: { is: null },
    },
    include: {
      source: true,
      analysis: true,
      risk: true,
      entities: true,
    },
    orderBy: { publishedAt: 'desc' },
  });

  console.log(`Found ${articles.length} regulatory-source article(s) without a document.`);
  let created = 0;

  for (const article of articles) {
    // Prefer the stored analysis; re-run it only if this article predates it.
    const companyKeys = parseJson<string[]>(article.analysis?.companyKeys, []);
    const riskLevel = (article.risk?.level ?? 'LOW') as 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    let summary = article.analysis?.aiSummary;
    let regulatorEntity = article.entities.find((entity) => entity.type === 'REGULATOR')?.value;

    if (!summary) {
      const analysis = await analyzeArticle(
        {
          title: article.title,
          description: article.description,
          publisher: article.publisher,
          publishedAt: article.publishedAt,
          sourceType: article.source.sourceType,
          sourceCredibility: article.source.credibility,
          isRegulatorySource: true,
          isOfficialSource: true,
        },
        config,
        { useLlm: false },
      );
      summary = analysis.aiSummary;
      regulatorEntity = analysis.entities.find((entity) => entity.type === 'REGULATOR')?.value;
    }

    const authority = article.source.authority ?? regulatorEntity ?? article.source.name;
    const companyNames = companyKeys
      .map((key) => config.companyIndex.get(key)?.name)
      .filter((name): name is string => !!name);

    const docType = inferDocType(article.title, article.description);
    const severity = inferSeverity(docType, riskLevel, companyNames.length > 0);

    const existing = await prisma.regulatoryDocument.findFirst({
      where: { documentUrl: article.canonicalUrl },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.regulatoryDocument.create({
      data: {
        articleId: article.id,
        sourceId: article.sourceId,
        authority,
        companyKeys: stringifyJson(companyKeys),
        docType,
        title: article.title,
        summary: regulatorySummary(
          authority, docType, companyNames, article.publishedAt, article.description,
        ),
        whyItMatters: regulatoryWhyItMatters(authority, docType, companyNames),
        issueDate: article.publishedAt,
        severity,
        status: companyNames.length > 0 ? 'OPEN' : 'MONITORING',
        documentUrl: article.canonicalUrl,
        isPrimaryDocument: true,
        isDemo: article.isDemo,
      },
    });
    created += 1;
  }

  console.log(`Created ${created} regulatory document(s).`);
  console.log(`Regulatory tracker now holds ${await prisma.regulatoryDocument.count()} document(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
