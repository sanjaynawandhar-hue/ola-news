import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/utils';
import type { EntityDefinition } from './entities';
import type { CategoryRule } from './categories';

/**
 * Loads the live tracking configuration (companies, brands, executives,
 * products, keywords, categories) from the database. Cached briefly so a
 * refresh run does not re-query per article, but short enough that Settings
 * changes take effect almost immediately.
 */
export interface TrackingConfig {
  entities: EntityDefinition[];
  categoryRules: CategoryRule[];
  trackedKeywords: Array<{ term: string; weight: number }>;
  excludedKeywords: string[];
  companyIndex: Map<string, { key: string; name: string; group: string; relation: string }>;
  loadedAt: number;
}

let cache: TrackingConfig | null = null;
const TTL_MS = 15000;

export function invalidateTrackingConfig() {
  cache = null;
}

export async function loadTrackingConfig(force = false): Promise<TrackingConfig> {
  if (!force && cache && Date.now() - cache.loadedAt < TTL_MS) return cache;

  const [companies, categories, keywords] = await Promise.all([
    prisma.company.findMany({
      where: { active: true },
      include: {
        brands: { where: { active: true } },
        executives: { where: { active: true } },
        products: { where: { active: true } },
      },
    }),
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.keyword.findMany({ where: { active: true } }),
  ]);

  const entities: EntityDefinition[] = [];
  const companyIndex = new Map<string, { key: string; name: string; group: string; relation: string }>();

  for (const company of companies) {
    companyIndex.set(company.key, {
      key: company.key,
      name: company.name,
      group: company.group,
      relation: company.relation,
    });
    entities.push({
      type: 'COMPANY',
      value: company.name,
      refKey: company.key,
      companyKey: company.key,
      group: company.group,
      aliases: parseJson<string[]>(company.aliases, []),
    });
    for (const brand of company.brands) {
      entities.push({
        type: 'BRAND', value: brand.name, refKey: `${company.key}:brand:${brand.name}`,
        companyKey: company.key, group: company.group,
        aliases: parseJson<string[]>(brand.aliases, []),
      });
    }
    for (const executive of company.executives) {
      entities.push({
        type: 'PERSON', value: executive.name, refKey: `${company.key}:person:${executive.name}`,
        companyKey: company.key, group: company.group,
        aliases: parseJson<string[]>(executive.aliases, []),
      });
    }
    for (const product of company.products) {
      entities.push({
        type: 'PRODUCT', value: product.name, refKey: `${company.key}:product:${product.name}`,
        companyKey: company.key, group: company.group,
        aliases: parseJson<string[]>(product.aliases, []),
      });
    }
  }

  cache = {
    entities,
    categoryRules: categories.map((c) => ({
      key: c.key,
      label: c.label,
      keywords: parseJson<string[]>(c.keywords, []),
    })),
    trackedKeywords: keywords
      .filter((k) => k.type === 'TRACK')
      .map((k) => ({ term: k.term, weight: k.weight })),
    excludedKeywords: keywords.filter((k) => k.type === 'EXCLUDE').map((k) => k.term),
    companyIndex,
    loadedAt: Date.now(),
  };
  return cache;
}

/** Search terms handed to query-driven adapters (Google News, GDELT, paid APIs). */
export async function buildSearchQueries(limit = 10): Promise<string[]> {
  const config = await loadTrackingConfig();
  const primary = config.entities
    .filter((e) => e.type === 'COMPANY' && e.group && e.group !== 'market')
    .map((e) => e.value);
  const brands = config.entities
    .filter((e) => e.type === 'BRAND' && e.group && e.group !== 'market')
    .map((e) => e.value);
  const keywords = config.trackedKeywords
    .slice()
    .sort((a, b) => b.weight - a.weight)
    .map((k) => k.term);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of [...primary, ...brands, ...keywords]) {
    const key = term.toLowerCase();
    if (term.length < 3 || seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= limit) break;
  }
  return out;
}
