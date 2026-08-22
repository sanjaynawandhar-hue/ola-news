/**
 * Removes regulatory documents that do not concern the tracked portfolio.
 *
 *   npx tsx scripts/prune-regulatory.ts          # show what would go
 *   npx tsx scripts/prune-regulatory.ts --apply  # delete them
 *
 * A regulator's feed is dominated by enforcement against unrelated parties.
 * Those entries were being stored with a "sector-wide" badge, which was
 * misleading — a recovery notice against an unconnected individual is not a
 * sector-wide obligation, it is simply someone else's business.
 *
 * The ingestion pipeline now applies the same test at collection time; this
 * cleans up what was stored before that existed. The underlying articles are
 * left untouched, so the audit trail is unaffected.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { assessRegulatoryRelevance } from '../src/lib/intelligence/regulatory-relevance';
import { parseJson } from '../src/lib/utils';
import { loadTrackingConfig } from '../src/lib/intelligence/config';
import type { RegulatoryDocType } from '../src/lib/constants';

async function main() {
  const apply = process.argv.includes('--apply');
  const config = await loadTrackingConfig(true);

  const documents = await prisma.regulatoryDocument.findMany({
    include: { article: { select: { description: true } } },
    orderBy: { issueDate: 'desc' },
  });

  const keep: typeof documents = [];
  const drop: Array<{ doc: (typeof documents)[number]; reason: string }> = [];

  for (const doc of documents) {
    const companyNames = parseJson<string[]>(doc.companyKeys, [])
      .map((key) => config.companyIndex.get(key)?.name)
      .filter((name): name is string => !!name);

    const relevance = assessRegulatoryRelevance(
      doc.title,
      doc.article?.description ?? doc.summary,
      doc.docType as RegulatoryDocType,
      companyNames,
    );

    if (relevance.relevant) keep.push(doc);
    else drop.push({ doc, reason: relevance.reason });
  }

  console.log(`Reviewed ${documents.length} regulatory document(s).`);
  console.log(`  keep : ${keep.length}`);
  console.log(`  drop : ${drop.length}`);
  console.log('');

  if (drop.length) {
    console.log('Not relevant to the tracked portfolio:');
    for (const { doc, reason } of drop.slice(0, 40)) {
      console.log(`  · ${doc.title.slice(0, 76)}`);
      console.log(`      ${reason.slice(0, 96)}`);
    }
    if (drop.length > 40) console.log(`  … and ${drop.length - 40} more`);
    console.log('');
  }

  if (keep.length) {
    console.log('Kept:');
    for (const doc of keep) {
      const named = parseJson<string[]>(doc.companyKeys, []).length > 0 ? 'company' : 'sector';
      console.log(`  · [${named}] ${doc.title.slice(0, 76)}`);
    }
    console.log('');
  }

  if (!apply) {
    console.log('Dry run. Re-run with --apply to delete the entries listed above.');
    return;
  }

  const result = await prisma.regulatoryDocument.deleteMany({
    where: { id: { in: drop.map((d) => d.doc.id) } },
  });
  console.log(`Deleted ${result.count} document(s).`);
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
