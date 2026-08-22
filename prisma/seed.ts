import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { COMPANY_SEEDS, KEYWORD_SEEDS } from './seed-data/companies';
import { SOURCE_SEEDS } from './seed-data/sources';
import { EXECUTIVE_SEEDS, FACT_SEEDS, PROFILE_SEEDS } from './seed-data/profiles';
import { DEFAULT_CATEGORIES } from '../src/lib/intelligence/categories';
import { DEMO_ARTICLES, DEMO_REGULATORY, demoPublishedAt } from '../src/lib/ingest/demo-data';
import { loadTrackingConfig, invalidateTrackingConfig } from '../src/lib/intelligence/config';
import { analyzeArticle, toAnalysisRows } from '../src/lib/intelligence/analyze';
import { normalizeItem } from '../src/lib/ingest/normalize';
import { clusterSlug } from '../src/lib/ingest/cluster';
import { sha1, stringifyJson } from '../src/lib/utils';
import { SETTING_KEYS } from '../src/lib/constants';

async function main() {
  console.log('Seeding Ola News…');

  // ---- Categories ---------------------------------------------------------
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { key: category.key },
      create: {
        key: category.key, label: category.label, description: category.description,
        colorHex: category.colorHex, keywords: stringifyJson(category.keywords),
        sortOrder: category.sortOrder,
      },
      update: {
        label: category.label, description: category.description, colorHex: category.colorHex,
        keywords: stringifyJson(category.keywords), sortOrder: category.sortOrder,
      },
    });
  }
  console.log(`  categories: ${DEFAULT_CATEGORIES.length}`);

  // ---- Companies, brands, executives, products ----------------------------
  for (const seed of COMPANY_SEEDS) {
    const company = await prisma.company.upsert({
      where: { key: seed.key },
      create: {
        key: seed.key, name: seed.name, legalName: seed.legalName, group: seed.group,
        relation: seed.relation, ticker: seed.ticker, description: seed.description,
        aliases: stringifyJson(seed.aliases), colorHex: seed.colorHex,
      },
      update: {
        name: seed.name, legalName: seed.legalName, group: seed.group, relation: seed.relation,
        ticker: seed.ticker, description: seed.description, aliases: stringifyJson(seed.aliases),
        colorHex: seed.colorHex,
      },
    });

    for (const brand of seed.brands ?? []) {
      await prisma.brand.upsert({
        where: { companyId_name: { companyId: company.id, name: brand.name } },
        create: { companyId: company.id, name: brand.name, aliases: stringifyJson(brand.aliases) },
        update: { aliases: stringifyJson(brand.aliases) },
      });
    }
    for (const executive of seed.executives ?? []) {
      await prisma.executive.upsert({
        where: { companyId_name: { companyId: company.id, name: executive.name } },
        create: { companyId: company.id, name: executive.name, role: executive.role, aliases: stringifyJson(executive.aliases) },
        update: { role: executive.role, aliases: stringifyJson(executive.aliases) },
      });
    }
    for (const product of seed.products ?? []) {
      await prisma.product.upsert({
        where: { companyId_name: { companyId: company.id, name: product.name } },
        create: { companyId: company.id, name: product.name, kind: product.kind, aliases: stringifyJson(product.aliases) },
        update: { kind: product.kind, aliases: stringifyJson(product.aliases) },
      });
    }
  }
  console.log(`  companies: ${COMPANY_SEEDS.length}`);

  // ---- Company profiles, facts and founders -------------------------------
  // Everything here lands unverified with no source: a fact counts as verified
  // only once a human has checked it against a primary source and recorded it.
  for (const profile of PROFILE_SEEDS) {
    const company = await prisma.company.findUnique({ where: { key: profile.companyKey } });
    if (!company) continue;
    const data = {
      about: profile.about,
      foundedYear: profile.foundedYear,
      headquarters: profile.headquarters,
      website: profile.website,
      listingStatus: profile.listingStatus,
    };
    await prisma.companyProfile.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...data },
      // Never overwrite details an administrator has verified and sourced.
      update: {},
    });
  }
  console.log(`  company profiles: ${PROFILE_SEEDS.length}`);

  for (const fact of FACT_SEEDS) {
    const company = await prisma.company.findUnique({ where: { key: fact.companyKey } });
    if (!company) continue;
    const existing = await prisma.companyFact.findFirst({
      where: { companyId: company.id, label: fact.label, category: fact.category },
    });
    if (existing) continue;
    await prisma.companyFact.create({
      data: {
        companyId: company.id,
        category: fact.category,
        label: fact.label,
        value: fact.value,
        location: fact.location,
        detail: fact.detail,
        sortOrder: fact.sortOrder,
      },
    });
  }
  console.log(`  company facts: ${FACT_SEEDS.length}`);

  for (const executive of EXECUTIVE_SEEDS) {
    const company = await prisma.company.findUnique({ where: { key: executive.companyKey } });
    if (!company) continue;
    await prisma.executive.upsert({
      where: { companyId_name: { companyId: company.id, name: executive.name } },
      create: {
        companyId: company.id,
        name: executive.name,
        role: executive.role,
        kind: executive.kind,
        since: executive.since,
        sortOrder: executive.sortOrder,
      },
      update: { kind: executive.kind, since: executive.since, sortOrder: executive.sortOrder },
    });
  }
  console.log(`  founders: ${EXECUTIVE_SEEDS.length}`);

  // ---- Keywords -----------------------------------------------------------
  for (const keyword of KEYWORD_SEEDS) {
    const company = keyword.companyKey
      ? await prisma.company.findUnique({ where: { key: keyword.companyKey } })
      : null;
    await prisma.keyword.upsert({
      where: { term_type: { term: keyword.term, type: keyword.type } },
      create: { term: keyword.term, type: keyword.type, weight: keyword.weight ?? 1, companyId: company?.id },
      update: { weight: keyword.weight ?? 1, companyId: company?.id },
    });
  }
  console.log(`  keywords: ${KEYWORD_SEEDS.length}`);

  // ---- Sources ------------------------------------------------------------
  // Definitional fields (endpoint, adapter, compliance note…) are refreshed on
  // every seed so code changes reach an existing database. Operator-controlled
  // fields are NOT: re-seeding must never silently re-enable a connector an
  // administrator turned off, or reset a tuned credibility or rate limit.
  const OPERATOR_CONTROLLED = ['enabled', 'mode', 'credibility', 'rateLimitMs', 'timeoutMs', 'maxItems'] as const;

  for (const source of SOURCE_SEEDS) {
    const definitional = {
      name: source.name, homepage: source.homepage, endpoint: source.endpoint,
      adapter: source.adapter, sourceType: source.sourceType, group: source.group,
      country: source.country ?? 'IN', language: source.language ?? 'en',
      requiresCredential: source.requiresCredential ?? false,
      credentialEnvVar: source.credentialEnvVar, queryTemplate: source.queryTemplate,
      isRegulatory: source.isRegulatory ?? false, authority: source.authority,
      termsUrl: source.termsUrl, complianceNote: source.complianceNote,
      sortOrder: source.sortOrder,
    };
    const operatorDefaults = {
      credibility: source.credibility,
      mode: source.mode,
      enabled: source.enabled ?? true,
      rateLimitMs: source.rateLimitMs ?? 1000,
      maxItems: source.maxItems ?? 40,
    };

    await prisma.source.upsert({
      where: { key: source.key },
      create: { key: source.key, ...definitional, ...operatorDefaults },
      update: definitional,
    });
  }
  console.log(`  sources: ${SOURCE_SEEDS.length} (operator settings preserved: ${OPERATOR_CONTROLLED.join(', ')})`);

  // ---- Default alerts -----------------------------------------------------
  const alertSeeds = [
    {
      name: 'Critical & high risk — all Ola companies',
      description: 'Any story scored HIGH or CRITICAL risk across the tracked portfolio.',
      criteria: { minRiskLevel: 'HIGH', companyKeys: ['ani-technologies', 'ola-electric', 'krutrim'] },
    },
    {
      name: 'Regulatory activity',
      description: 'Mentions of SEBI, MoRTH, BSE, NSE, MCA, CCI or CCPA alongside a tracked company.',
      criteria: { authorities: ['SEBI', 'MoRTH', 'BSE', 'NSE', 'MCA', 'CCI', 'CCPA'] },
    },
    {
      name: 'Safety, recalls and product defects',
      description: 'Stories in the safety & recalls category.',
      criteria: { categories: ['safety-recalls'] },
    },
    {
      name: 'Founder & leadership coverage',
      description: 'Coverage naming a tracked executive.',
      criteria: { executives: ['Bhavish Aggarwal'] },
    },
    {
      name: 'Coverage volume spike',
      description: 'Fires when 24-hour coverage volume reaches twice the recent baseline.',
      criteria: { volumeSpike: { multiplier: 2, windowHours: 24 } },
    },
  ];
  for (const alert of alertSeeds) {
    const existing = await prisma.alert.findFirst({ where: { name: alert.name } });
    if (existing) continue;
    await prisma.alert.create({
      data: { name: alert.name, description: alert.description, criteria: stringifyJson(alert.criteria) },
    });
  }
  console.log(`  alerts: ${alertSeeds.length}`);

  // ---- Settings -----------------------------------------------------------
  const settingSeeds: Array<[string, unknown]> = [
    [SETTING_KEYS.brandName, process.env.OLA_NEWS_BRAND_NAME ?? '[YOUR NAME]'],
    [SETTING_KEYS.showPersonalBranding, true],
    [SETTING_KEYS.logoPath, process.env.OLA_NEWS_LOGO_PATH ?? '/branding/ola-logo.svg'],
    [SETTING_KEYS.logoAttribution, 'Placeholder mark. Replace with the official Ola logo supplied by the brand owner.'],
    [SETTING_KEYS.timezone, process.env.OLA_NEWS_TIMEZONE ?? 'Asia/Kolkata'],
    [SETTING_KEYS.autoRefreshMinutes, 0],
    [SETTING_KEYS.theme, 'system'],
    [SETTING_KEYS.relevanceThreshold, 25],
    [SETTING_KEYS.demoDataEnabled, (process.env.OLA_NEWS_ENABLE_DEMO_DATA ?? 'true') !== 'false'],
  ];
  for (const [key, value] of settingSeeds) {
    await prisma.setting.upsert({
      where: { key }, create: { key, value: stringifyJson(value) }, update: {},
    });
  }
  console.log(`  settings: ${settingSeeds.length}`);

  // ---- Demo articles ------------------------------------------------------
  // The stored setting wins over the environment default, so a database that
  // has been switched to live-only (Settings, or `npm run demo:off`) is never
  // repopulated with sample records by a later `npm run seed`/`setup`.
  const demoSetting = await prisma.setting.findUnique({
    where: { key: SETTING_KEYS.demoDataEnabled },
  });
  const demoEnabled = demoSetting
    ? (JSON.parse(demoSetting.value) as boolean)
    : (process.env.OLA_NEWS_ENABLE_DEMO_DATA ?? 'true') !== 'false';

  if (!demoEnabled) {
    console.log('  demo articles: skipped (demo data is disabled for this database)');
    console.log('  demo regulatory documents: skipped');
    console.log('Seed complete.');
    return;
  }

  invalidateTrackingConfig();
  const config = await loadTrackingConfig(true);
  const demoSource = await prisma.source.findUniqueOrThrow({ where: { key: 'demo-newswire' } });
  const now = new Date();
  let demoStored = 0;

  for (const demo of DEMO_ARTICLES) {
    const published = demoPublishedAt(demo, now);

    const normalized = normalizeItem(
      {
        title: demo.title,
        description: demo.description,
        url: `https://example.com/ola-news-demo/${demo.slug}`,
        publishedAt: published,
        publisher: demo.publisher,
        externalId: `demo:${demo.slug}`,
        language: demo.language ?? 'en',
        country: demo.country ?? 'IN',
      },
      {
        sourceId: demoSource.id, sourceKey: demoSource.key, sourceName: demoSource.name,
        defaultLanguage: 'en', defaultCountry: 'IN', isDemo: true, now,
      },
    );
    if (!normalized) continue;

    const exists = await prisma.article.findUnique({ where: { urlHash: normalized.urlHash } });
    if (exists) continue;

    const analysis = await analyzeArticle(
      {
        title: normalized.title, description: normalized.description, publisher: normalized.publisher,
        publishedAt: normalized.publishedAt, sourceType: demoSource.sourceType,
        sourceCredibility: demoSource.credibility, isRegulatorySource: false,
        isOfficialSource: false, corroboration: 1, now,
      },
      config,
      { useLlm: false },
    );

    const cluster = await prisma.storyCluster.create({
      data: {
        slug: clusterSlug(normalized.title, sha1(normalized.canonicalUrl)),
        title: normalized.title, simhash: normalized.simhash,
        firstSeenAt: normalized.publishedAt, lastSeenAt: normalized.publishedAt,
        topCompanyKey: analysis.primaryCompanyKey, categoryKey: analysis.categoryKey,
        sentimentLabel: analysis.sentiment.label, riskLevel: analysis.risk.level,
        importanceScore: analysis.importanceScore,
      },
    });

    const rows = toAnalysisRows('pending', analysis);
    await prisma.article.create({
      data: {
        sourceId: demoSource.id, externalId: normalized.externalId, title: normalized.title,
        description: normalized.description, url: normalized.url, canonicalUrl: normalized.canonicalUrl,
        urlHash: normalized.urlHash, contentHash: normalized.contentHash, simhash: normalized.simhash,
        publisher: normalized.publisher, publishedAt: normalized.publishedAt,
        language: normalized.language, country: normalized.country, isDemo: true,
        clusterId: cluster.id, processingStatus: 'PROCESSED',
        analysis: { create: stripId(rows.analysis) },
        sentiment: { create: stripId(rows.sentiment) },
        risk: { create: stripId(rows.risk) },
        entities: { create: rows.entities.map(stripId) },
      },
    });
    demoStored++;
  }
  console.log(`  demo articles: ${demoStored}`);

  // ---- Demo regulatory documents -----------------------------------------
  const demoRegSource = await prisma.source.findUniqueOrThrow({ where: { key: 'demo-regulatory' } });
  let regStored = 0;
  for (const doc of DEMO_REGULATORY) {
    const documentUrl = `https://example.com/ola-news-demo/regulatory/${doc.slug}`;
    const exists = await prisma.regulatoryDocument.findFirst({ where: { documentUrl } });
    if (exists) continue;
    const issueDate = new Date(now.getTime() - doc.daysAgo * 86400000);
    await prisma.regulatoryDocument.create({
      data: {
        sourceId: demoRegSource.id, authority: doc.authority,
        companyKeys: stringifyJson(doc.companyKeys), docType: doc.docType,
        title: doc.title, summary: doc.summary, whyItMatters: doc.whyItMatters,
        issueDate,
        effectiveDate: doc.effectiveInDays != null ? new Date(issueDate.getTime() + doc.effectiveInDays * 86400000) : null,
        responseDeadline: doc.deadlineInDays != null ? new Date(issueDate.getTime() + doc.deadlineInDays * 86400000) : null,
        severity: doc.severity, status: doc.status, documentUrl,
        isPrimaryDocument: true, isDemo: true,
      },
    });
    regStored++;
  }
  console.log(`  demo regulatory documents: ${regStored}`);

  console.log('Seed complete.');
}

/** The relation-create payloads must not carry the placeholder articleId. */
function stripId<T extends { articleId?: string }>(row: T): Omit<T, 'articleId'> {
  const { articleId: _ignored, ...rest } = row;
  return rest;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
