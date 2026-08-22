import { clamp } from '@/lib/utils';
import { RISK_RANK, type RiskLevel, type Sentiment, type VerificationStatus } from '@/lib/constants';

/**
 * Automatic importance score (0-100). Each contributing factor is weighted
 * explicitly so the number can be explained in a tooltip rather than being an
 * opaque ranking.
 */
export interface ImportanceInput {
  relevance: number;
  publishedAt: Date;
  sourceCredibility: number;
  corroboration: number;
  isRegulatory: boolean;
  regulatorySeverityRank?: number; // 0-3
  riskLevel: RiskLevel;
  sentiment: Sentiment;
  sentimentMagnitude: number;
  /** Ratio of this story's coverage volume to the recent baseline. */
  volumeSpikeRatio?: number;
  /** 0-100 estimate of direct business impact from category + entities. */
  businessImpact: number;
  now?: Date;
}

export interface ImportanceBreakdown {
  score: number;
  factors: Array<{ key: string; label: string; contribution: number; detail: string }>;
}

export const IMPORTANCE_WEIGHTS = {
  relevance: 22,
  recency: 14,
  credibility: 10,
  corroboration: 12,
  regulatory: 12,
  risk: 16,
  sentimentIntensity: 6,
  volumeSpike: 8,
  businessImpact: 10,
};

export function scoreImportance(input: ImportanceInput): ImportanceBreakdown {
  const now = input.now ?? new Date();
  const ageHours = Math.max(0, (now.getTime() - input.publishedAt.getTime()) / 3600000);

  // Half-life of 48 hours: a two-day-old story retains half its recency weight.
  const recency = Math.pow(0.5, ageHours / 48);
  const corroborationScore = Math.min(1, Math.log2(1 + Math.max(0, input.corroboration)) / 3);
  const riskScore = RISK_RANK[input.riskLevel] / 4;
  const regulatoryScore = input.isRegulatory
    ? 0.55 + 0.15 * Math.min(3, input.regulatorySeverityRank ?? 1)
    : 0;
  const spike = input.volumeSpikeRatio ?? 1;
  const spikeScore = clamp((spike - 1) / 2, 0, 1);

  const factors = [
    { key: 'relevance', label: 'Relevance to tracked companies', contribution: (input.relevance / 100) * IMPORTANCE_WEIGHTS.relevance, detail: `${input.relevance}/100` },
    { key: 'recency', label: 'Recency', contribution: recency * IMPORTANCE_WEIGHTS.recency, detail: `${Math.round(ageHours)}h old` },
    { key: 'credibility', label: 'Source credibility', contribution: (input.sourceCredibility / 100) * IMPORTANCE_WEIGHTS.credibility, detail: `${input.sourceCredibility}/100` },
    { key: 'corroboration', label: 'Corroboration', contribution: corroborationScore * IMPORTANCE_WEIGHTS.corroboration, detail: `${input.corroboration} publisher(s)` },
    { key: 'regulatory', label: 'Regulatory significance', contribution: regulatoryScore * IMPORTANCE_WEIGHTS.regulatory, detail: input.isRegulatory ? 'Official regulatory item' : 'Not regulatory' },
    { key: 'risk', label: 'Risk level', contribution: riskScore * IMPORTANCE_WEIGHTS.risk, detail: input.riskLevel },
    { key: 'sentimentIntensity', label: 'Sentiment intensity', contribution: clamp(input.sentimentMagnitude, 0, 1) * IMPORTANCE_WEIGHTS.sentimentIntensity, detail: `${input.sentiment.toLowerCase()} (${input.sentimentMagnitude.toFixed(2)})` },
    { key: 'volumeSpike', label: 'Unusual coverage volume', contribution: spikeScore * IMPORTANCE_WEIGHTS.volumeSpike, detail: `${spike.toFixed(2)}× baseline` },
    { key: 'businessImpact', label: 'Potential business impact', contribution: (clamp(input.businessImpact, 0, 100) / 100) * IMPORTANCE_WEIGHTS.businessImpact, detail: `${Math.round(input.businessImpact)}/100` },
  ];

  const score = clamp(Math.round(factors.reduce((sum, f) => sum + f.contribution, 0)), 0, 100);
  return {
    score,
    factors: factors.map((f) => ({ ...f, contribution: Number(f.contribution.toFixed(2)) })),
  };
}

/** Categories that most directly move revenue, cost or licence-to-operate. */
const IMPACT_BY_CATEGORY: Record<string, number> = {
  'financial-performance': 90,
  'regulation-compliance': 88,
  'safety-recalls': 92,
  'legal-disputes': 82,
  'funding-investment': 78,
  'electric-vehicles': 68,
  'mobility-ride-hailing': 68,
  'leadership': 72,
  'reputation-risk': 76,
  'competition': 60,
  'products-launches': 58,
  'artificial-intelligence': 58,
  'partnerships': 52,
  'customer-experience': 55,
  'workforce': 50,
  'technology': 45,
  'corporate': 48,
  'esg-sustainability': 40,
};

export function businessImpactFor(categoryKey: string, relevance: number, riskLevel: RiskLevel): number {
  const base = IMPACT_BY_CATEGORY[categoryKey] ?? 45;
  const riskBoost = RISK_RANK[riskLevel] * 5;
  return clamp(base * (0.55 + 0.45 * (relevance / 100)) + riskBoost, 0, 100);
}

export function verificationFor(
  corroboration: number,
  isOfficial: boolean,
  sourceCredibility: number,
): VerificationStatus {
  if (isOfficial) return 'OFFICIAL';
  if (corroboration >= 3) return 'CORROBORATED';
  if (corroboration === 2 && sourceCredibility >= 60) return 'CORROBORATED';
  if (sourceCredibility >= 55) return 'SINGLE_SOURCE';
  return 'UNVERIFIED';
}
