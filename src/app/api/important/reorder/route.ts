import { withApi, ok, parseBody } from '@/lib/api';
import { reorderSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const PUT = withApi(async (request) => {
  const { articleIds } = await parseBody(request, reorderSchema);
  await prisma.$transaction(
    articleIds.map((articleId, index) =>
      prisma.importantStory.updateMany({ where: { articleId }, data: { position: index + 1 } }),
    ),
  );
  return ok({ reordered: articleIds.length });
});
