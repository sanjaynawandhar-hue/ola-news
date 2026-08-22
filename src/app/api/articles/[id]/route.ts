import { withApi, ok, fail } from '@/lib/api';
import { getArticleById } from '@/lib/queries';
import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (_request, { params }) => {
  const { id } = await params;
  const article = await getArticleById(id);
  if (!article) return fail('Story not found.', 'NOT_FOUND', 404);

  // Related stories in the same cluster, so the reader can see corroboration.
  const related = article.clusterId
    ? await prisma.article.findMany({
        where: { clusterId: article.clusterId, id: { not: article.id } },
        select: { id: true, title: true, publisher: true, publishedAt: true, url: true },
        orderBy: { publishedAt: 'desc' },
        take: 12,
      })
    : [];

  const entities = await prisma.articleEntity.findMany({
    where: { articleId: article.id },
    orderBy: { mentions: 'desc' },
    take: 30,
  });

  return ok({
    article,
    related: related.map((r) => ({ ...r, publishedAt: r.publishedAt.toISOString() })),
    entities: entities.map((e) => ({
      type: e.type, value: e.value, mentions: e.mentions, confidence: e.confidence,
    })),
    riskDimensions: parseJson<Record<string, number>>(
      (await prisma.riskAssessment.findUnique({ where: { articleId: article.id } }))?.dimensions,
      {},
    ),
  });
});
