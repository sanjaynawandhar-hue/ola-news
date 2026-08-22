import { z } from 'zod';
import { withApi, ok, fail, parseBody } from '@/lib/api';
import { companySchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { parseJson, stringifyJson } from '@/lib/utils';
import { invalidateTrackingConfig } from '@/lib/intelligence/config';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const companies = await prisma.company.findMany({
    include: { brands: true, executives: true, products: true },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });
  return ok({
    items: companies.map((company) => ({
      id: company.id,
      key: company.key,
      name: company.name,
      legalName: company.legalName,
      group: company.group,
      relation: company.relation,
      ticker: company.ticker,
      description: company.description,
      colorHex: company.colorHex,
      active: company.active,
      aliases: parseJson<string[]>(company.aliases, []),
      brands: company.brands.map((b) => ({ id: b.id, name: b.name, aliases: parseJson<string[]>(b.aliases, []), active: b.active })),
      executives: company.executives.map((e) => ({ id: e.id, name: e.name, role: e.role, aliases: parseJson<string[]>(e.aliases, []), active: e.active })),
      products: company.products.map((p) => ({ id: p.id, name: p.name, kind: p.kind, aliases: parseJson<string[]>(p.aliases, []), active: p.active })),
    })),
  });
});

export const POST = withApi(async (request) => {
  const data = await parseBody(request, companySchema);
  const existing = await prisma.company.findUnique({ where: { key: data.key } });
  if (existing) return fail('A company with that key already exists.', 'CONFLICT', 409);
  const created = await prisma.company.create({
    data: { ...data, aliases: stringifyJson(data.aliases) },
  });
  invalidateTrackingConfig();
  return ok({ id: created.id, key: created.key }, { status: 201 });
});

const patchSchema = companySchema.partial().extend({ key: z.string().min(1).max(60) });

export const PATCH = withApi(async (request) => {
  const { key, aliases, ...patch } = await parseBody(request, patchSchema);
  const company = await prisma.company.findUnique({ where: { key } });
  if (!company) return fail('Company not found.', 'NOT_FOUND', 404);
  await prisma.company.update({
    where: { key },
    data: {
      ...patch,
      ...(aliases !== undefined ? { aliases: stringifyJson(aliases) } : {}),
    },
  });
  invalidateTrackingConfig();
  return ok({ key });
});

export const DELETE = withApi(async (request) => {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return fail('key is required.', 'BAD_REQUEST', 400);
  await prisma.company.deleteMany({ where: { key } });
  invalidateTrackingConfig();
  return ok({ deleted: true });
});
