import { z } from 'zod';
import { withApi, ok, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/db';
import { getArticlesByIds } from '@/lib/queries';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  articleId: z.string().min(1).max(60),
  note: z.string().max(400).optional().nullable(),
});

export const GET = withApi(async () => {
  const bookmarks = await prisma.bookmark.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  const articles = await getArticlesByIds(bookmarks.map((b) => b.articleId));
  return ok({ items: articles, total: bookmarks.length });
});

export const POST = withApi(async (request) => {
  const { articleId, note } = await parseBody(request, bodySchema);
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) return fail('Story not found.', 'NOT_FOUND', 404);

  const existing = await prisma.bookmark.findUnique({ where: { articleId } });
  if (existing) {
    await prisma.bookmark.delete({ where: { articleId } });
    return ok({ bookmarked: false });
  }
  await prisma.bookmark.create({ data: { articleId, note: note ?? null } });
  return ok({ bookmarked: true }, { status: 201 });
});

export const DELETE = withApi(async (request) => {
  const articleId = new URL(request.url).searchParams.get('articleId');
  if (!articleId) return fail('articleId is required.', 'BAD_REQUEST', 400);
  await prisma.bookmark.deleteMany({ where: { articleId } });
  return ok({ bookmarked: false });
});
