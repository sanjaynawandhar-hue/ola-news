import { z } from 'zod';
import {
  CONTENT_TYPES, REGULATORY_DOC_TYPES, REGULATORY_STATUSES, RISK_LEVELS, SENTIMENTS,
  SEVERITIES, SOURCE_MODES, SOURCE_TYPES, VERIFICATION_STATUSES,
} from '@/lib/constants';

/** Accepts `a,b` or repeated params and always yields a string[]. */
const list = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const parts = Array.isArray(value) ? value : value.split(',');
    const cleaned = parts.map((p) => p.trim()).filter(Boolean);
    return cleaned.length ? cleaned : undefined;
  });

const numeric = (min: number, max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined || value === '' ? undefined : Number(value)))
    .refine((value) => value === undefined || (Number.isFinite(value) && value >= min && value <= max), {
      message: `Expected a number between ${min} and ${max}`,
    });

const bool = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  });

const isoDate = z
  .string()
  .optional()
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), { message: 'Expected an ISO date' });

export const feedQuerySchema = z.object({
  q: z.string().max(200).optional(),
  companies: list,
  groups: list,
  brands: list,
  sources: list,
  sourceTypes: list,
  countries: list,
  languages: list,
  categories: list,
  topics: list,
  sentiments: list,
  riskLevels: list,
  verification: list,
  from: isoDate,
  to: isoDate,
  minRelevance: numeric(0, 100),
  bookmarkedOnly: bool,
  importantOnly: bool,
  includeDemo: bool,
  sort: z.enum(['recent', 'relevance', 'importance', 'risk', 'sentiment']).optional(),
  page: numeric(1, 10000),
  pageSize: numeric(5, 100),
});

export const regulatoryQuerySchema = z.object({
  q: z.string().max(200).optional(),
  trackedOnly: bool,
  authorities: list,
  docTypes: list,
  severities: list,
  statuses: list,
  companies: list,
  from: isoDate,
  to: isoDate,
  includeDemo: bool,
  page: numeric(1, 10000),
  pageSize: numeric(5, 100),
});

export const overviewQuerySchema = z.object({
  days: numeric(1, 365),
  groups: list,
});

export const refreshRequestSchema = z.object({
  sourceKeys: z.array(z.string().min(1).max(80)).max(50).optional(),
  trigger: z.enum(['manual', 'auto', 'cron']).optional(),
});

export const settingsSchema = z.object({
  personalName: z.string().max(80).optional(),
  showPersonalBranding: z.boolean().optional(),
  logoPath: z
    .string()
    .max(300)
    .regex(/^\/[\w\-./]*$/, 'Logo path must be a path under /public, e.g. /branding/logo.png')
    .optional(),
  logoAttribution: z.string().max(300).optional(),
  timezone: z.string().max(60).optional(),
  autoRefreshMinutes: z.union([z.literal(0), z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  relevanceThreshold: z.number().min(0).max(100).optional(),
  demoDataEnabled: z.boolean().optional(),
});

export const companySchema = z.object({
  key: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens'),
  name: z.string().min(1).max(120),
  legalName: z.string().max(160).optional().nullable(),
  group: z.enum(['ani', 'olaelectric', 'krutrim', 'market']),
  relation: z.enum(['SELF', 'COMPETITOR', 'PARTNER', 'INDUSTRY']),
  ticker: z.string().max(20).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  aliases: z.array(z.string().max(120)).max(50).default([]),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  active: z.boolean().default(true),
});

export const childEntitySchema = z.object({
  companyKey: z.string().min(1).max(60),
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional().nullable(),
  kind: z.string().max(40).optional().nullable(),
  aliases: z.array(z.string().max(120)).max(50).default([]),
});

export const keywordSchema = z.object({
  term: z.string().min(2).max(120),
  type: z.enum(['TRACK', 'EXCLUDE']).default('TRACK'),
  weight: z.number().min(0).max(3).default(1),
  companyKey: z.string().max(60).optional().nullable(),
});

export const categorySchema = z.object({
  key: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(80),
  description: z.string().max(300).optional().nullable(),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6b7280'),
  keywords: z.array(z.string().max(80)).max(80).default([]),
  sortOrder: z.number().int().min(0).max(9999).default(500),
  active: z.boolean().default(true),
});

export const sourceUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(SOURCE_MODES).optional(),
  credibility: z.number().int().min(0).max(100).optional(),
  maxItems: z.number().int().min(1).max(200).optional(),
  rateLimitMs: z.number().int().min(0).max(60000).optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
});

const sourceCreateFields = z.object({
  key: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(140),
  homepage: z.string().url().max(300).optional().nullable(),
  endpoint: z.string().url().max(500).optional().nullable(),
  adapter: z.enum(['rss', 'google-news', 'gdelt', 'newsapi', 'newsdata', 'gnews', 'bing-news', 'demo']),
  sourceType: z.enum(SOURCE_TYPES),
  group: z.string().max(80).optional().nullable(),
  country: z.string().length(2).default('IN'),
  language: z.string().max(5).default('en'),
  credibility: z.number().int().min(0).max(100).default(70),
  mode: z.enum(SOURCE_MODES).default('LIVE'),
  isRegulatory: z.boolean().default(false),
  authority: z.string().max(60).optional().nullable(),
  queryTemplate: z.string().max(300).optional().nullable(),
  termsUrl: z.string().url().max(300).optional().nullable(),
  complianceNote: z.string().max(600).optional().nullable(),
});

/**
 * A connector backed by the built-in sample dataset must declare itself as
 * DEMO. Allowing `adapter: 'demo'` with `mode: 'LIVE'` would let sample records
 * be stored and displayed as real news, which the product must never do.
 */
export const sourceCreateSchema = sourceCreateFields.refine(
  (source) => source.adapter !== 'demo' || source.mode === 'DEMO',
  {
    path: ['mode'],
    message: 'A source using the demo adapter must have mode "DEMO".',
  },
);

export const alertSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(400).optional().nullable(),
  enabled: z.boolean().default(true),
  throttleMins: z.number().int().min(0).max(1440).default(30),
  channels: z.array(z.enum(['inapp', 'email', 'slack'])).min(1).default(['inapp']),
  criteria: z.object({
    keywords: z.array(z.string().max(120)).max(50).optional(),
    companyKeys: z.array(z.string().max(60)).max(50).optional(),
    executives: z.array(z.string().max(120)).max(50).optional(),
    products: z.array(z.string().max(120)).max(50).optional(),
    competitors: z.array(z.string().max(120)).max(50).optional(),
    categories: z.array(z.string().max(60)).max(40).optional(),
    sentiments: z.array(z.enum(SENTIMENTS)).optional(),
    minRiskLevel: z.enum(RISK_LEVELS).optional(),
    authorities: z.array(z.string().max(60)).max(40).optional(),
    regulatoryDocTypes: z.array(z.enum(REGULATORY_DOC_TYPES)).optional(),
    volumeSpike: z
      .object({ multiplier: z.number().min(1.1).max(20), windowHours: z.number().int().min(1).max(168) })
      .nullable()
      .optional(),
  }),
});

export const briefingSchema = z.object({
  title: z.string().min(1).max(160),
  subtitle: z.string().max(240).optional(),
  type: z.enum(['DAILY', 'WEEKLY', 'REGULATORY', 'RISK', 'CUSTOM', 'SINGLE']).default('CUSTOM'),
  template: z.string().max(40).default('standard'),
  theme: z.enum(['ola-light', 'ola-dark', 'executive-mono']).default('ola-light'),
  articleIds: z.array(z.string().min(1).max(60)).max(60).default([]),
  regulatoryIds: z.array(z.string().min(1).max(60)).max(40).default([]),
  includeExecutiveSummary: z.boolean().default(true),
  includeTrendSlide: z.boolean().default(true),
  includeComparisonSlide: z.boolean().default(true),
  autoSelectTop: z.number().int().min(0).max(30).optional(),
});

export const pngExportSchema = z.object({
  articleId: z.string().min(1).max(60),
  preset: z.enum(['email', 'whatsapp', 'report', 'presentation', 'square']).default('email'),
});

export const savedViewSchema = z.object({
  name: z.string().min(1).max(80),
  query: z.record(z.string(), z.unknown()).default({}),
});

export const importantSchema = z.object({
  articleId: z.string().min(1).max(60),
  note: z.string().max(400).optional().nullable(),
});

export const reorderSchema = z.object({
  articleIds: z.array(z.string().min(1).max(60)).max(100),
});

export type FeedQueryInput = z.infer<typeof feedQuerySchema>;
export type RegulatoryQueryInput = z.infer<typeof regulatoryQuerySchema>;
export type BriefingInputBody = z.infer<typeof briefingSchema>;
export const ALL_CONTENT_TYPES = CONTENT_TYPES;
export const ALL_SEVERITIES = SEVERITIES;
export const ALL_REGULATORY_STATUSES = REGULATORY_STATUSES;
export const ALL_VERIFICATION = VERIFICATION_STATUSES;
