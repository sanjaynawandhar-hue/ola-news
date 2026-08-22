/**
 * Server-only environment access. Nothing in this module may be imported from a
 * client component — every value here is a secret or a server-side default.
 */
import 'server-only';

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export const serverEnv = {
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /** Personal-branding default. Overridable from Settings at runtime. */
  brandName: process.env.OLA_NEWS_BRAND_NAME ?? '[YOUR NAME]',
  logoPath: process.env.OLA_NEWS_LOGO_PATH ?? '/branding/ola-logo.svg',
  defaultTimezone: process.env.OLA_NEWS_TIMEZONE ?? 'Asia/Kolkata',

  /** Ingestion behaviour. */
  userAgent:
    process.env.OLA_NEWS_USER_AGENT ??
    'OlaNewsBot/1.0 (executive news intelligence dashboard; respects robots.txt)',
  fetchTimeoutMs: Number(process.env.OLA_NEWS_FETCH_TIMEOUT_MS ?? 15000),
  maxConcurrentSources: Number(process.env.OLA_NEWS_MAX_CONCURRENCY ?? 4),
  enableDemoData: (process.env.OLA_NEWS_ENABLE_DEMO_DATA ?? 'true') !== 'false',

  /** Optional API credentials — each unlocks the matching source adapter. */
  credentials: {
    NEWSAPI_KEY: optional('NEWSAPI_KEY'),
    NEWSDATA_API_KEY: optional('NEWSDATA_API_KEY'),
    GNEWS_API_KEY: optional('GNEWS_API_KEY'),
    BING_NEWS_API_KEY: optional('BING_NEWS_API_KEY'),
    ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),
  } as Record<string, string | undefined>,

  /** Optional LLM enrichment. Falls back to the local heuristic engine. */
  llm: {
    enabled: !!optional('ANTHROPIC_API_KEY'),
    model: process.env.OLA_NEWS_LLM_MODEL ?? 'claude-sonnet-5',
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
  },

  /** API rate limiting. */
  rateLimit: {
    windowMs: Number(process.env.OLA_NEWS_RATE_WINDOW_MS ?? 60000),
    max: Number(process.env.OLA_NEWS_RATE_MAX ?? 120),
    refreshMax: Number(process.env.OLA_NEWS_REFRESH_RATE_MAX ?? 6),
  },
};

export function hasCredential(envVar?: string | null): boolean {
  if (!envVar) return true;
  return !!serverEnv.credentials[envVar];
}
