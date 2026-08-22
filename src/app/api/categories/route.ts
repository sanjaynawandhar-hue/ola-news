import { z } from 'zod';
import { withApi, ok, fail, parseBody } from '@/lib/api';
import { categorySchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { parseJson, stringifyJson } from '@/lib/utils';
import { invalidateTrackingConfig } from '@/lib/intelligence/config';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const categories = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  return ok({
    items: categories.map((c) => ({
      id: c.id, key: c.key, label: c.label, description: c.description,
      colorHex: c.colorHex, sortOrder: c.sortOrder, active: c.active,
      keywords: parseJson<string[]>(c.keywords, []),
    })),
  });
});

export const POST = withApi(async (request) => {
  const data = await parseBody(request, categorySchema);
  const created = await prisma.category.upsert({
    where: { key: data.key },
    create: { ...data, keywords: stringifyJson(data.keywords) },
    update: { ...data, keywords: stringifyJson(data.keywords) },
  });
  invalidateTrackingConfig();
  return ok({ id: created.id, key: created.key }, { status: 201 });
});

const patchSchema = categorySchema.partial().extend({ key: z.string().min(1).max(60) });

export const PATCH = withApi(async (request) => {
  const { key, keywords, ...patch } = await parseBody(request, patchSchema);
  const category = await prisma.category.findUnique({ where: { key } });
  if (!category) return fail('Category not found.', 'NOT_FOUND', 404);
  await prisma.category.update({
    where: { key },
    data: {
      ...patch,
      ...(keywords !== undefined ? { keywords: stringifyJson(keywords) } : {}),
    },
  });
  invalidateTrackingConfig();
  return ok({ key });
});

export const DELETE = withApi(async (request) => {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return fail('key is required.', 'BAD_REQUEST', 400);
  await prisma.category.deleteMany({ where: { key } });
  invalidateTrackingConfig();
  return ok({ deleted: true });
});
