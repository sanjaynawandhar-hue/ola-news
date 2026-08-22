import { withApi, ok, fail, parseBody } from '@/lib/api';
import { savedViewSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { parseJson, stringifyJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const views = await prisma.savedView.findMany({ orderBy: { createdAt: 'desc' } });
  return ok({
    items: views.map((view) => ({
      id: view.id,
      name: view.name,
      query: parseJson<Record<string, unknown>>(view.query, {}),
      createdAt: view.createdAt.toISOString(),
    })),
  });
});

export const POST = withApi(async (request) => {
  const { name, query } = await parseBody(request, savedViewSchema);
  const view = await prisma.savedView.upsert({
    where: { name },
    create: { name, query: stringifyJson(query) },
    update: { query: stringifyJson(query) },
  });
  return ok({ id: view.id, name: view.name }, { status: 201 });
});

export const DELETE = withApi(async (request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('id is required.', 'BAD_REQUEST', 400);
  await prisma.savedView.deleteMany({ where: { id } });
  return ok({ deleted: true });
});
