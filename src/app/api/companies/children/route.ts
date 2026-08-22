import { z } from 'zod';
import { withApi, ok, fail, parseBody } from '@/lib/api';
import { childEntitySchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { stringifyJson } from '@/lib/utils';
import { invalidateTrackingConfig } from '@/lib/intelligence/config';

export const dynamic = 'force-dynamic';

const kindParam = z.enum(['brand', 'executive', 'product']);

/** Adds a brand, executive or product to a tracked company. */
export const POST = withApi(async (request) => {
  const kind = kindParam.parse(new URL(request.url).searchParams.get('kind'));
  const data = await parseBody(request, childEntitySchema);

  const company = await prisma.company.findUnique({ where: { key: data.companyKey } });
  if (!company) return fail('Company not found.', 'NOT_FOUND', 404);

  const aliases = stringifyJson(data.aliases);
  if (kind === 'brand') {
    await prisma.brand.upsert({
      where: { companyId_name: { companyId: company.id, name: data.name } },
      create: { companyId: company.id, name: data.name, aliases },
      update: { aliases, active: true },
    });
  } else if (kind === 'executive') {
    await prisma.executive.upsert({
      where: { companyId_name: { companyId: company.id, name: data.name } },
      create: { companyId: company.id, name: data.name, role: data.role ?? null, aliases },
      update: { role: data.role ?? null, aliases, active: true },
    });
  } else {
    await prisma.product.upsert({
      where: { companyId_name: { companyId: company.id, name: data.name } },
      create: { companyId: company.id, name: data.name, kind: data.kind ?? null, aliases },
      update: { kind: data.kind ?? null, aliases, active: true },
    });
  }

  invalidateTrackingConfig();
  return ok({ created: true }, { status: 201 });
});

export const DELETE = withApi(async (request) => {
  const url = new URL(request.url);
  const kind = kindParam.parse(url.searchParams.get('kind'));
  const id = url.searchParams.get('id');
  if (!id) return fail('id is required.', 'BAD_REQUEST', 400);

  if (kind === 'brand') await prisma.brand.deleteMany({ where: { id } });
  else if (kind === 'executive') await prisma.executive.deleteMany({ where: { id } });
  else await prisma.product.deleteMany({ where: { id } });

  invalidateTrackingConfig();
  return ok({ deleted: true });
});
