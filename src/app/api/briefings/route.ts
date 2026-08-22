import { withApi, ok } from '@/lib/api';
import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Export history — every generated card and deck is recorded. */
export const GET = withApi(async () => {
  const [briefings, exports] = await Promise.all([
    prisma.briefing.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
    prisma.exportRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 60 }),
  ]);
  return ok({
    briefings: briefings.map((b) => ({
      id: b.id, title: b.title, type: b.type, theme: b.theme, slideCount: b.slideCount,
      articleIds: parseJson<string[]>(b.articleIds, []), createdAt: b.createdAt.toISOString(),
    })),
    exports: exports.map((e) => ({
      id: e.id, kind: e.kind, filename: e.filename, preset: e.preset,
      sizeBytes: e.sizeBytes, createdAt: e.createdAt.toISOString(),
    })),
  });
});
