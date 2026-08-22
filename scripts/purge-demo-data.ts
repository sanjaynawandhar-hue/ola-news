/**
 * Switches the dashboard to live sources only.
 *
 *   npx tsx scripts/purge-demo-data.ts          # disable + delete demo records
 *   npx tsx scripts/purge-demo-data.ts --keep   # disable only, keep what exists
 *
 * What it does:
 *   1. Sets the `demoDataEnabled` setting to false, so no future refresh
 *      ingests the sample dataset.
 *   2. Disables the demo source connectors.
 *   3. Unless --keep is passed, deletes every record marked `isDemo` and
 *      removes story clusters left without any article.
 *
 * The demo dataset itself stays in the codebase — re-enable it any time from
 * Settings → Data & intelligence, then run a refresh.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { parseJson, stringifyJson } from '../src/lib/utils';
import { SETTING_KEYS } from '../src/lib/constants';

async function main() {
  const keep = process.argv.includes('--keep');

  await prisma.setting.upsert({
    where: { key: SETTING_KEYS.demoDataEnabled },
    create: { key: SETTING_KEYS.demoDataEnabled, value: stringifyJson(false) },
    update: { value: stringifyJson(false) },
  });
  const disabled = await prisma.source.updateMany({
    where: { mode: 'DEMO' },
    data: { enabled: false },
  });
  console.log(`Demo data disabled. ${disabled.count} demo connector(s) turned off.`);

  if (keep) {
    const remaining = await prisma.article.count({ where: { isDemo: true } });
    console.log(`--keep: left ${remaining} existing demo article(s) in place.`);
  } else {
    // Capture the ids first. ExportRecord.articleId is SetNull on delete and
    // Briefing stores ids as JSON, so once the articles are gone there is no
    // way to tell which exports came from demo data.
    const demoArticles = await prisma.article.findMany({
      where: { isDemo: true },
      select: { id: true },
    });
    const demoIds = new Set(demoArticles.map((a) => a.id));

    const regs = await prisma.regulatoryDocument.deleteMany({ where: { isDemo: true } });
    const articles = await prisma.article.deleteMany({ where: { isDemo: true } });
    // Cascades clear analysis, sentiment, risk and entity rows; clusters that
    // are now empty would otherwise linger in the trend and cluster counts.
    const clusters = await prisma.storyCluster.deleteMany({ where: { articles: { none: {} } } });

    // Exports and briefings generated FROM demo data are demo artefacts too —
    // leaving them would show sample-derived filenames in the export history.
    const allBriefings = await prisma.briefing.findMany({ select: { id: true, articleIds: true } });
    // ANY demo story contaminates the briefing: the deck was built from sample
    // records and would render with missing slides once they are gone.
    const demoBriefingIds = allBriefings
      .filter((briefing) => {
        const ids = parseJson<string[]>(briefing.articleIds, []);
        return ids.some((id) => demoIds.has(id));
      })
      .map((briefing) => briefing.id);

    const exports = await prisma.exportRecord.deleteMany({
      where: {
        OR: [
          { articleId: { in: Array.from(demoIds) } },
          { briefingId: { in: demoBriefingIds } },
          // Orphaned by an earlier purge that ran before this cleanup existed.
          { articleId: null, briefingId: null, kind: 'PNG' },
        ],
      },
    });
    // Also drop briefings whose stories no longer resolve at all — including
    // ones left behind by a purge that ran before this cleanup existed.
    const survivingIds = new Set(
      (await prisma.article.findMany({ select: { id: true } })).map((a) => a.id),
    );
    const staleBriefingIds = allBriefings
      .filter((briefing) => {
        const ids = parseJson<string[]>(briefing.articleIds, []);
        return ids.length > 0 && !ids.some((id) => survivingIds.has(id));
      })
      .map((briefing) => briefing.id);

    const briefings = await prisma.briefing.deleteMany({
      where: { id: { in: [...new Set([...demoBriefingIds, ...staleBriefingIds])] } },
    });

    console.log(`Deleted ${articles.count} demo article(s).`);
    console.log(`Deleted ${regs.count} demo regulatory document(s).`);
    console.log(`Removed ${clusters.count} empty story cluster(s).`);
    console.log(`Removed ${exports.count} demo-derived export record(s).`);
    console.log(`Removed ${briefings.count} demo-derived briefing(s).`);
  }

  const [live, demo, regulatory] = await Promise.all([
    prisma.article.count({ where: { isDemo: false, processingStatus: 'PROCESSED' } }),
    prisma.article.count({ where: { isDemo: true } }),
    prisma.regulatoryDocument.count({ where: { isDemo: false } }),
  ]);

  console.log('');
  console.log(`Live stories in the feed     : ${live}`);
  console.log(`Demo records remaining       : ${demo}`);
  console.log(`Live regulatory documents    : ${regulatory}`);
  if (live === 0) {
    console.log('');
    console.log('No live stories yet — press "Refresh news" in the header, or POST /api/refresh.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
