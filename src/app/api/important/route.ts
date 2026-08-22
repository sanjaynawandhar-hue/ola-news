import { withApi, ok, fail, parseBody } from '@/lib/api';
import { importantSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { getArticlesByIds } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/** The curated shortlist that feeds PNG cards and PPTX briefings. */
export const GET = withApi(async () => {
  const rows = await prisma.importantStory.findMany({ orderBy: { position: 'asc' } });
  const articles = await getArticlesByIds(rows.map((r) => r.articleId));
  const notes = new Map(rows.map((r) => [r.articleId, { note: r.note, manual: r.manual }]));
  return ok({
    items: articles.map((article) => ({
      ...article,
      note: notes.get(article.id)?.note ?? null,
      manual: notes.get(article.id)?.manual ?? true,
    })),
    total: rows.length,
  });
});

export const POST = withApi(async (request) => {
  const { articleId, note } = await parseBody(request, importantSchema);
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) return fail('Story not found.', 'NOT_FOUND', 404);

  const existing = await prisma.importantStory.findUnique({ where: { articleId } });
  if (existing) {
    await prisma.importantStory.delete({ where: { articleId } });
    return ok({ important: false });
  }
  const max = await prisma.importantStory.aggregate({ _max: { position: true } });
  await prisma.importantStory.create({
    data: { articleId, note: note ?? null, manual: true, position: (max._max.position ?? 0) + 1 },
  });
  return ok({ important: true }, { status: 201 });
});

export const DELETE = withApi(async (request) => {
  const articleId = new URL(request.url).searchParams.get('articleId');
  if (!articleId) return fail('articleId is required.', 'BAD_REQUEST', 400);
  await prisma.importantStory.deleteMany({ where: { articleId } });
  return ok({ important: false });
});
