import { clamp, stringifyJson } from '@/lib/utils';
import { extractEntities, type EntityMatch } from './entities';
import { classifyCategory } from './categories';
import { estimateSentiment } from './sentiment';
import { estimateRisk } from './risk';
import { detectContentType, scoreRelevance } from './relevance';
import { buildSummary, extractTopics } from './summarize';
import { businessImpactFor, scoreImportance, verificationFor } from './importance';
import { isLlmEnabled, summarizeWithLlm } from './llm';
import type { TrackingConfig } from './config';
import type { CompanyGroup, ContentType, RiskLevel, Sentiment, VerificationStatus } from '@/lib/constants';

export interface AnalyzeInput {
  title: string;
  description: string | null;
  publisher: string;
  publishedAt: Date;
  sourceType: string;
  sourceCredibility: number;
  isRegulatorySource: boolean;
  isOfficialSource: boolean;
  corroboration?: number;
  volumeSpikeRatio?: number;
  now?: Date;
}

export interface AnalysisResult {
  entities: EntityMatch[];
  relevance: number;
  excluded: boolean;
  primaryCompanyKey: string | null;
  companyKeys: string[];
  group: CompanyGroup | null;
  categoryKey: string;
  categoryLabel: string;
  categoryConfidence: number;
  contentType: ContentType;
  topics: string[];
  sentiment: { label: Sentiment; score: number; magnitude: number; confidence: number; rationale: string };
  risk: { level: RiskLevel; score: number; confidence: number; drivers: string[]; driverLabels: string[]; dimensions: Record<string, number> };
  aiSummary: string;
  whyItMatters: string;
  verification: VerificationStatus;
  corroboration: number;
  importanceScore: number;
  importanceFactors: Array<{ key: string; label: string; contribution: number; detail: string }>;
  confidence: number;
  engine: string;
}

/**
 * Runs the full per-article analysis. Every derived field carries its own
 * confidence value; the UI always renders these as estimates, and the source
 * headline/description are stored unmodified alongside them.
 */
export async function analyzeArticle(
  input: AnalyzeInput,
  config: TrackingConfig,
  options: { useLlm?: boolean } = {},
): Promise<AnalysisResult> {
  const text = `${input.title}. ${input.description ?? ''}`;
  const entities = extractEntities(text, config.entities);

  const relevance = scoreRelevance({
    title: input.title,
    description: input.description,
    entities,
    trackedKeywords: config.trackedKeywords,
    excludedKeywords: config.excludedKeywords,
    sourceCredibility: input.sourceCredibility,
    isOfficialSource: input.isOfficialSource,
  });

  const category = classifyCategory(input.title, input.description, config.categoryRules);
  const sentiment = estimateSentiment(text);
  const risk = estimateRisk(text, {
    sentimentScore: sentiment.score,
    isRegulatory: input.isRegulatorySource,
    relevance: relevance.score,
  });

  const corroboration = Math.max(1, input.corroboration ?? 1);
  const verification = verificationFor(corroboration, input.isOfficialSource, input.sourceCredibility);
  const contentType = detectContentType(input.title, input.description, input.sourceType);

  const companyNames = entities
    .filter((e) => e.type === 'COMPANY')
    .map((e) => e.value)
    .slice(0, 3);

  const group = (relevance.primaryCompanyKey
    ? (config.companyIndex.get(relevance.primaryCompanyKey)?.group as CompanyGroup | undefined)
    : undefined) ?? null;

  let { aiSummary, whyItMatters } = buildSummary({
    title: input.title,
    description: input.description,
    publisher: input.publisher,
    categoryLabel: category.label,
    sentiment: sentiment.label,
    riskLevel: risk.level,
    riskDriverLabels: risk.driverLabels,
    group,
    companyNames,
    isRegulatory: input.isRegulatorySource,
    authority: null,
    corroboration,
  });
  let engine = 'heuristic-v1';

  if (options.useLlm !== false && isLlmEnabled()) {
    const enriched = await summarizeWithLlm({
      title: input.title,
      description: input.description,
      publisher: input.publisher,
      companyNames,
      categoryLabel: category.label,
    });
    if (enriched) {
      aiSummary = enriched.aiSummary;
      whyItMatters = enriched.whyItMatters;
      engine = enriched.engine;
    }
  }

  const businessImpact = businessImpactFor(category.key, relevance.score, risk.level);
  const importance = scoreImportance({
    relevance: relevance.score,
    publishedAt: input.publishedAt,
    sourceCredibility: input.sourceCredibility,
    corroboration,
    isRegulatory: input.isRegulatorySource,
    regulatorySeverityRank: input.isRegulatorySource ? 2 : 0,
    riskLevel: risk.level,
    sentiment: sentiment.label,
    sentimentMagnitude: sentiment.magnitude,
    volumeSpikeRatio: input.volumeSpikeRatio,
    businessImpact,
    now: input.now,
  });

  // Overall confidence blends the confidence of each individual estimate.
  const confidence = clamp(
    Math.round(
      0.35 * (relevance.score > 0 ? Math.min(95, 50 + relevance.score / 2) : 40) +
        0.25 * category.confidence +
        0.2 * sentiment.confidence +
        0.2 * risk.confidence,
    ),
    0,
    95,
  );

  return {
    entities,
    relevance: relevance.score,
    excluded: relevance.excluded,
    primaryCompanyKey: relevance.primaryCompanyKey,
    companyKeys: relevance.companyKeys,
    group,
    categoryKey: category.key,
    categoryLabel: category.label,
    categoryConfidence: category.confidence,
    contentType,
    topics: extractTopics(input.title, input.description),
    sentiment: {
      label: sentiment.label,
      score: sentiment.score,
      magnitude: sentiment.magnitude,
      confidence: sentiment.confidence,
      rationale: sentiment.rationale,
    },
    risk: {
      level: risk.level,
      score: risk.score,
      confidence: risk.confidence,
      drivers: risk.drivers,
      driverLabels: risk.driverLabels,
      dimensions: risk.dimensions,
    },
    aiSummary,
    whyItMatters,
    verification,
    corroboration,
    importanceScore: importance.score,
    importanceFactors: importance.factors,
    confidence,
    engine,
  };
}

/** Serialises the analysis into the columns of the Analysis/Sentiment/Risk rows. */
export function toAnalysisRows(articleId: string, result: AnalysisResult) {
  return {
    analysis: {
      articleId,
      aiSummary: result.aiSummary,
      whyItMatters: result.whyItMatters,
      categoryKey: result.categoryKey,
      contentType: result.contentType,
      relevance: result.relevance,
      confidence: result.confidence,
      verification: result.verification,
      corroboration: result.corroboration,
      importanceScore: result.importanceScore,
      primaryCompanyKey: result.primaryCompanyKey,
      companyKeys: stringifyJson(result.companyKeys),
      topics: stringifyJson(result.topics),
      engine: result.engine,
    },
    sentiment: {
      articleId,
      label: result.sentiment.label,
      score: result.sentiment.score,
      magnitude: result.sentiment.magnitude,
      confidence: result.sentiment.confidence,
      rationale: result.sentiment.rationale,
      engine: result.engine === 'heuristic-v1' ? 'heuristic-v1' : result.engine,
    },
    risk: {
      articleId,
      level: result.risk.level,
      score: result.risk.score,
      confidence: result.risk.confidence,
      drivers: stringifyJson(result.risk.driverLabels),
      dimensions: stringifyJson(result.risk.dimensions),
      engine: 'heuristic-v1',
    },
    entities: result.entities.slice(0, 24).map((entity) => ({
      articleId,
      type: entity.type,
      value: entity.value,
      refKey: entity.refKey,
      mentions: entity.mentions,
      confidence: entity.confidence,
    })),
  };
}
