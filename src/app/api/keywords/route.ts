import { withApi, ok, fail, parseBody } from '@/lib/api';
import { keywordSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { invalidateTrackingConfig } from '@/lib/intelligence/config';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const keywords = await prisma.keyword.findMany({
    include: { company: { select: { key: true, name: true } } },
    orderBy: [{ type: 'asc' }, { term: 'asc' }],
  });
  return ok({
    items: keywords.map((k) => ({
      id: k.id, term: k.term, type: k.type, weight: k.weight, active: k.active,
      companyKey: k.company?.key ?? null, companyName: k.company?.name ?? null,
    })),
  });
});

export const POST = withApi(async (request) => {
  const data = await parseBody(request, keywordSchema);
  const company = data.companyKey
    ? await prisma.company.findUnique({ where: { key: data.companyKey } })
    : null;
  const created = await prisma.keyword.upsert({
    where: { term_type: { term: data.term, type: data.type } },
    create: { term: data.term, type: data.type, weight: data.weight, companyId: company?.id ?? null },
    update: { weight: data.weight, companyId: company?.id ?? null, active: true },
  });
  invalidateTrackingConfig();
  return ok({ id: created.id }, { status: 201 });
});

export const DELETE = withApi(async (request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('id is required.', 'BAD_REQUEST', 400);
  await prisma.keyword.deleteMany({ where: { id } });
  invalidateTrackingConfig();
  return ok({ deleted: true });
});
