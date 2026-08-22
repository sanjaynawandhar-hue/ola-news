import { z } from 'zod';
import { withApi, ok, fail, parseBody } from '@/lib/api';
import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/utils';
import { COMPANY_GROUP_LABELS, type CompanyGroup } from '@/lib/constants';

export const dynamic = 'force-dynamic';

/**
 * Company profiles: what each business is, who founded it, where it operates
 * from, and its scale. Every fact carries whether a human has verified it
 * against a source — an unverified seeded value is shown as needing
 * confirmation rather than presented as established.
 */
export const GET = withApi(async () => {
  const companies = await prisma.company.findMany({
    where: { active: true, relation: 'SELF' },
    include: {
      companyProfile: true,
      companyFacts: { orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }] },
      executives: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] },
      brands: { where: { active: true }, orderBy: { name: 'asc' } },
      products: { where: { active: true }, orderBy: { name: 'asc' } },
    },
    orderBy: { group: 'asc' },
  });

  return ok({
    items: companies.map((company) => ({
      key: company.key,
      name: company.name,
      legalName: company.legalName,
      group: company.group,
      groupLabel: COMPANY_GROUP_LABELS[company.group as CompanyGroup] ?? company.group,
      ticker: company.ticker,
      colorHex: company.colorHex,
      profile: company.companyProfile
        ? {
            about: company.companyProfile.about,
            foundedYear: company.companyProfile.foundedYear,
            headquarters: company.companyProfile.headquarters,
            website: company.companyProfile.website,
            employeeRange: company.companyProfile.employeeRange,
            listingStatus: company.companyProfile.listingStatus,
            sourceUrl: company.companyProfile.sourceUrl,
            verifiedAt: company.companyProfile.verifiedAt?.toISOString() ?? null,
          }
        : null,
      facts: company.companyFacts.map((fact) => ({
        id: fact.id,
        category: fact.category,
        label: fact.label,
        value: fact.value,
        location: fact.location,
        detail: fact.detail,
        sourceUrl: fact.sourceUrl,
        verified: fact.verified,
      })),
      people: company.executives.map((person) => ({
        id: person.id,
        name: person.name,
        role: person.role,
        kind: person.kind,
        since: person.since,
        bio: person.bio,
        profileUrl: person.profileUrl,
        sourceUrl: person.sourceUrl,
        verified: person.verified,
        aliases: parseJson<string[]>(person.aliases, []),
      })),
      brands: company.brands.map((b) => b.name),
      products: company.products.map((p) => ({ name: p.name, kind: p.kind })),
    })),
  });
});

const profileSchema = z.object({
  companyKey: z.string().min(1).max(60),
  about: z.string().max(2000).optional().nullable(),
  foundedYear: z.number().int().min(1800).max(2100).optional().nullable(),
  headquarters: z.string().max(300).optional().nullable(),
  website: z.string().url().max(300).optional().nullable(),
  employeeRange: z.string().max(60).optional().nullable(),
  listingStatus: z.enum(['LISTED', 'PRIVATE', 'SUBSIDIARY']).optional().nullable(),
  sourceUrl: z.string().url().max(500).optional().nullable(),
  /** Setting this records that a human checked the details against the source. */
  verified: z.boolean().optional(),
});

export const PUT = withApi(async (request) => {
  const { companyKey, verified, ...patch } = await parseBody(request, profileSchema);
  const company = await prisma.company.findUnique({ where: { key: companyKey } });
  if (!company) return fail('Company not found.', 'NOT_FOUND', 404);

  // A profile only counts as verified when a source backs it.
  if (verified && !patch.sourceUrl) {
    return fail(
      'Add the source URL these details were checked against before marking the profile verified.',
      'SOURCE_REQUIRED',
      422,
    );
  }

  const data = {
    ...patch,
    ...(verified === undefined ? {} : { verifiedAt: verified ? new Date() : null }),
  };

  await prisma.companyProfile.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, ...data },
    update: data,
  });
  return ok({ companyKey });
});
