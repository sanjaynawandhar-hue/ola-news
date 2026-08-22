import type {
  ContentType,
  RegulatoryDocType,
  RiskLevel,
  Sentiment,
  Severity,
  SourceMode,
  SourceType,
  VerificationStatus,
} from '@/lib/constants';

/** Shape every source adapter must return, before normalisation. */
export interface RawItem {
  title: string;
  description?: string | null;
  url: string;
  publishedAt?: string | Date | null;
  author?: string | null;
  imageUrl?: string | null;
  publisher?: string | null;
  externalId?: string | null;
  language?: string | null;
  country?: string | null;
  /** Adapter-specific extras (e.g. SEBI document type). */
  meta?: Record<string, string | number | null | undefined>;
}

/** A fully normalised item ready to be persisted. */
export interface NormalizedItem {
  sourceId: string;
  sourceKey: string;
  publisher: string;
  externalId: string | null;
  title: string;
  description: string | null;
  url: string;
  canonicalUrl: string;
  urlHash: string;
  contentHash: string;
  simhash: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date;
  language: string;
  country: string;
  isDemo: boolean;
  meta: Record<string, unknown>;
}

export interface SourceProgress {
  sourceKey: string;
  sourceName: string;
  mode: SourceMode;
  status: 'pending' | 'running' | 'ok' | 'failed' | 'skipped';
  itemsFetched: number;
  itemsNew: number;
  duplicates: number;
  durationMs?: number;
  message?: string;
  statusCode?: number;
}

export interface RefreshSummary {
  jobId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  sourcesTotal: number;
  sourcesCompleted: number;
  sourcesOk: number;
  sourcesFailed: number;
  itemsFetched: number;
  itemsNew: number;
  duplicatesRemoved: number;
  alertsRaised: number;
  progress: SourceProgress[];
  error?: string | null;
}

/** The article shape used across the UI. */
export interface FeedArticle {
  id: string;
  title: string;
  description: string | null;
  aiSummary: string;
  whyItMatters: string;
  url: string;
  canonicalUrl: string;
  publisher: string;
  sourceKey: string;
  sourceName: string;
  sourceType: SourceType;
  sourceMode: SourceMode;
  sourceCredibility: number;
  publishedAt: string;
  fetchedAt: string;
  language: string;
  country: string;
  isDemo: boolean;
  companyKeys: string[];
  primaryCompanyKey: string | null;
  companyGroup: string | null;
  companyLabel: string | null;
  categoryKey: string;
  categoryLabel: string;
  topics: string[];
  sentiment: Sentiment;
  sentimentScore: number;
  sentimentConfidence: number;
  riskLevel: RiskLevel;
  riskScore: number;
  riskDrivers: string[];
  riskDimensions: Record<string, number>;
  relevance: number;
  confidence: number;
  contentType: ContentType;
  verification: VerificationStatus;
  corroboration: number;
  importanceScore: number;
  relatedCount: number;
  clusterId: string | null;
  bookmarked: boolean;
  important: boolean;
  engine: string;
  imageUrl: string | null;
}

export interface RegulatoryItem {
  id: string;
  authority: string;
  companyKeys: string[];
  docType: RegulatoryDocType;
  docTypeLabel: string;
  title: string;
  summary: string;
  whyItMatters: string | null;
  issueDate: string;
  effectiveDate: string | null;
  responseDeadline: string | null;
  severity: Severity;
  status: string;
  documentUrl: string;
  isPrimaryDocument: boolean;
  isDemo: boolean;
  sourceName: string;
  sourceMode: SourceMode;
}

export interface FeedQuery {
  q?: string;
  companies?: string[];
  groups?: string[];
  brands?: string[];
  sources?: string[];
  sourceTypes?: string[];
  countries?: string[];
  languages?: string[];
  categories?: string[];
  topics?: string[];
  sentiments?: string[];
  riskLevels?: string[];
  verification?: string[];
  from?: string;
  to?: string;
  /**
   * Relative window in days, resolved server-side. Preferred over `from` for
   * links: an absolute timestamp differs between the server and client render
   * (a hydration mismatch) and goes stale the moment the link is shared.
   */
  withinDays?: number;
  minRelevance?: number;
  bookmarkedOnly?: boolean;
  importantOnly?: boolean;
  includeDemo?: boolean;
  sort?: 'recent' | 'relevance' | 'importance' | 'risk' | 'sentiment';
  page?: number;
  pageSize?: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AlertCriteria {
  keywords?: string[];
  companyKeys?: string[];
  executives?: string[];
  products?: string[];
  competitors?: string[];
  categories?: string[];
  sentiments?: Sentiment[];
  minRiskLevel?: RiskLevel;
  authorities?: string[];
  regulatoryDocTypes?: RegulatoryDocType[];
  volumeSpike?: { multiplier: number; windowHours: number } | null;
}

export interface BrandingConfig {
  personalName: string;
  showPersonalBranding: boolean;
  logoPath: string;
  logoAttribution: string;
  timezone: string;
  autoRefreshMinutes: number;
  theme: string;
  relevanceThreshold: number;
  demoDataEnabled: boolean;
}
