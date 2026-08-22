/**
 * Enum-like constants. Stored as plain strings in the database so the schema
 * stays portable between SQLite (dev default) and PostgreSQL (production).
 */

export const COMPANY_GROUPS = ['ani', 'olaelectric', 'krutrim', 'market'] as const;
export type CompanyGroup = (typeof COMPANY_GROUPS)[number];

export const COMPANY_GROUP_LABELS: Record<CompanyGroup, string> = {
  ani: 'ANI Technologies / Ola Cabs',
  olaelectric: 'Ola Electric',
  krutrim: 'Krutrim',
  market: 'Competitors & Industry',
};

export const COMPANY_GROUP_SHORT: Record<CompanyGroup, string> = {
  ani: 'Ola Cabs',
  olaelectric: 'Ola Electric',
  krutrim: 'Krutrim',
  market: 'Market',
};

export const COMPANY_RELATIONS = ['SELF', 'COMPETITOR', 'PARTNER', 'INDUSTRY'] as const;
export type CompanyRelation = (typeof COMPANY_RELATIONS)[number];

export const SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const RISK_LEVELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_RANK: Record<RiskLevel, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const RISK_DIMENSIONS = [
  'reputation',
  'financial',
  'operational',
  'legal',
  'regulatory',
] as const;
export type RiskDimension = (typeof RISK_DIMENSIONS)[number];

export const VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'SINGLE_SOURCE',
  'CORROBORATED',
  'OFFICIAL',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Unverified',
  SINGLE_SOURCE: 'Single source',
  CORROBORATED: 'Corroborated',
  OFFICIAL: 'Official document',
};

export const CONTENT_TYPES = ['REPORTING', 'OPINION', 'ANALYSIS', 'PRESS_RELEASE'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const SOURCE_MODES = ['LIVE', 'DEMO', 'DISABLED', 'AWAITING_CREDENTIALS'] as const;
export type SourceMode = (typeof SOURCE_MODES)[number];

export const SOURCE_MODE_LABELS: Record<SourceMode, string> = {
  LIVE: 'Live',
  DEMO: 'Demo data',
  DISABLED: 'Disabled',
  AWAITING_CREDENTIALS: 'Awaiting credentials',
};

export const SOURCE_TYPES = [
  'NEWS',
  'BUSINESS',
  'AUTO_EV',
  'AI_TECH',
  'RESEARCH',
  'COMPANY',
  'REGULATOR',
  'EXCHANGE',
  'COURT',
  'GOVERNMENT',
  'AGGREGATOR',
] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  NEWS: 'News publisher',
  BUSINESS: 'Business & financial',
  AUTO_EV: 'Automotive & EV',
  AI_TECH: 'AI & technology',
  RESEARCH: 'Research & market intelligence',
  COMPANY: 'Official company channel',
  REGULATOR: 'Regulator',
  EXCHANGE: 'Stock exchange',
  COURT: 'Court / tribunal',
  GOVERNMENT: 'Government / ministry',
  AGGREGATOR: 'News aggregator',
};

export const REGULATORY_DOC_TYPES = [
  'NOTICE',
  'CIRCULAR',
  'ORDER',
  'INVESTIGATION',
  'PENALTY',
  'RECALL',
  'COMPLIANCE',
  'FILING',
  'COURT',
  'POLICY',
  'DEADLINE',
] as const;
export type RegulatoryDocType = (typeof REGULATORY_DOC_TYPES)[number];

export const REGULATORY_DOC_TYPE_LABELS: Record<RegulatoryDocType, string> = {
  NOTICE: 'Notice',
  CIRCULAR: 'Circular',
  ORDER: 'Order',
  INVESTIGATION: 'Investigation',
  PENALTY: 'Penalty',
  RECALL: 'Recall',
  COMPLIANCE: 'Compliance change',
  FILING: 'Company filing',
  COURT: 'Court matter',
  POLICY: 'Policy announcement',
  DEADLINE: 'Regulatory deadline',
};

export const REGULATORY_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'RESPONDED',
  'CLOSED',
  'MONITORING',
] as const;
export type RegulatoryStatus = (typeof REGULATORY_STATUSES)[number];

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const PROCESSING_STATUSES = ['PENDING', 'PROCESSED', 'FAILED', 'SUPPRESSED'] as const;

export const REFRESH_INTERVALS = [
  { value: 0, label: 'Off' },
  { value: 5, label: 'Every 5 minutes' },
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every 60 minutes' },
] as const;

export const BRIEFING_TYPES = [
  { value: 'DAILY', label: 'Daily executive briefing' },
  { value: 'WEEKLY', label: 'Weekly executive briefing' },
  { value: 'REGULATORY', label: 'Regulatory briefing' },
  { value: 'RISK', label: 'Risk & crisis briefing' },
  { value: 'CUSTOM', label: 'Custom selection' },
  { value: 'SINGLE', label: 'Single story' },
] as const;

export const SLIDE_TEMPLATES = [
  'cover',
  'executive-summary',
  'news',
  'positive',
  'risk',
  'regulatory',
  'comparison',
  'trend',
  'closing',
] as const;
export type SlideTemplate = (typeof SLIDE_TEMPLATES)[number];

export const PNG_PRESETS = {
  email: { key: 'email', label: 'Email (1200×675)', width: 1200, height: 675, scale: 2 },
  whatsapp: { key: 'whatsapp', label: 'WhatsApp (1080×1350)', width: 1080, height: 1350, scale: 2 },
  report: { key: 'report', label: 'Executive report (1600×2000)', width: 1600, height: 2000, scale: 2 },
  presentation: { key: 'presentation', label: 'Presentation 16:9 (1920×1080)', width: 1920, height: 1080, scale: 2 },
  square: { key: 'square', label: 'Social square (1080×1080)', width: 1080, height: 1080, scale: 2 },
} as const;
export type PngPresetKey = keyof typeof PNG_PRESETS;

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** Settings keys stored in the Setting table. */
export const SETTING_KEYS = {
  brandName: 'branding.personalName',
  showPersonalBranding: 'branding.showPersonal',
  logoPath: 'branding.logoPath',
  logoAttribution: 'branding.logoAttribution',
  timezone: 'display.timezone',
  autoRefreshMinutes: 'refresh.autoIntervalMinutes',
  theme: 'display.theme',
  relevanceThreshold: 'intelligence.relevanceThreshold',
  demoDataEnabled: 'sources.demoDataEnabled',
} as const;
