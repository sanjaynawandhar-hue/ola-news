import { clamp, matchesTerm } from '@/lib/utils';

export { matchesTerm };
import { RISK_DIMENSIONS, type RiskDimension, type RiskLevel } from '@/lib/constants';

/**
 * Rule-based risk estimator. Every driver is an explicit, auditable keyword
 * group mapped to a business risk dimension and a weight. The output is always
 * presented as an estimate with confidence, never as a determination.
 */

interface RiskDriver {
  key: string;
  label: string;
  dimension: RiskDimension;
  weight: number;
  terms: string[];
}

export const RISK_DRIVERS: RiskDriver[] = [
  { key: 'recall', label: 'Product recall', dimension: 'operational', weight: 36,
    terms: ['recall', 'recalls', 'recalled', 'safety defect', 'battery fire', 'catches fire'] },
  { key: 'safety', label: 'Safety incident', dimension: 'operational', weight: 32,
    terms: ['fatal', 'death', 'died', 'injury', 'injured', 'accident', 'explosion', 'blaze', 'unsafe'] },
  { key: 'regulatory-action', label: 'Regulatory action', dimension: 'regulatory', weight: 30,
    terms: ['show cause', 'show-cause', 'regulatory notice', 'summons', 'penalty', 'penalised', 'penalized',
      'fined', 'sanction', 'non-compliance', 'noncompliance', 'violation', 'contravention', 'directive'] },
  { key: 'investigation', label: 'Investigation or probe', dimension: 'legal', weight: 28,
    terms: ['probe', 'investigation', 'investigating', 'inquiry', 'raid', 'search and seizure', 'summoned'] },
  { key: 'litigation', label: 'Litigation', dimension: 'legal', weight: 24,
    terms: ['lawsuit', 'sued', 'litigation', 'court', 'tribunal', 'petition', 'plea', 'arbitration',
      'class action', 'injunction', 'contempt'] },
  { key: 'financial-stress', label: 'Financial stress', dimension: 'financial', weight: 22,
    terms: ['loss', 'losses', 'net loss', 'writedown', 'write-down', 'impairment', 'default',
      'insolvency', 'bankruptcy', 'cash burn', 'liquidity', 'downgrade', 'shortfall', 'miss estimates'] },
  { key: 'market-reaction', label: 'Adverse market reaction', dimension: 'financial', weight: 16,
    terms: ['plunge', 'plunges', 'slump', 'tumble', 'crash', 'sell-off', 'selloff', 'hits lower circuit',
      'all-time low', '52-week low', 'stock falls'] },
  { key: 'governance', label: 'Governance concern', dimension: 'reputation', weight: 26,
    terms: ['resign', 'resignation', 'steps down', 'quits', 'ouster', 'board exit', 'auditor',
      'whistleblower', 'governance', 'conflict of interest', 'related party'] },
  { key: 'fraud', label: 'Fraud or misconduct allegation', dimension: 'reputation', weight: 34,
    terms: ['fraud', 'scam', 'misconduct', 'embezzlement', 'bribery', 'corruption', 'misleading',
      'misrepresentation', 'falsified'] },
  { key: 'consumer', label: 'Consumer harm or complaints', dimension: 'reputation', weight: 18,
    terms: ['complaint', 'complaints', 'grievance', 'consumer court', 'refund', 'overcharg',
      'service failure', 'customer backlash', 'poor service'] },
  { key: 'workforce', label: 'Workforce disruption', dimension: 'operational', weight: 18,
    terms: ['layoff', 'layoffs', 'job cuts', 'retrenchment', 'strike', 'protest', 'union', 'attrition', 'walkout'] },
  { key: 'supply', label: 'Supply chain disruption', dimension: 'operational', weight: 16,
    terms: ['supply chain', 'shortage', 'production halt', 'plant shutdown', 'supplier dispute',
      'component shortage', 'delivery delay'] },
  { key: 'data', label: 'Data or privacy incident', dimension: 'legal', weight: 26,
    terms: ['data breach', 'data leak', 'privacy violation', 'cyberattack', 'cyber attack',
      'ransomware', 'hacked', 'data theft', 'leaked user data'] },
  { key: 'competition', label: 'Competitive pressure', dimension: 'financial', weight: 10,
    terms: ['market share loss', 'losing share', 'price war', 'undercut', 'overtaken', 'dethroned'] },
  { key: 'esg', label: 'ESG or environmental concern', dimension: 'reputation', weight: 12,
    terms: ['pollution', 'emissions violation', 'environmental clearance', 'greenwash', 'waste disposal'] },
];

export interface RiskEstimate {
  level: RiskLevel;
  score: number;
  confidence: number;
  drivers: string[];
  driverLabels: string[];
  dimensions: Record<RiskDimension, number>;
}

export interface RiskContext {
  /** Negative sentiment amplifies risk; positive sentiment dampens it. */
  sentimentScore?: number;
  /** Official regulatory documents start from an elevated baseline. */
  isRegulatory?: boolean;
  /** Relevance gates risk: a low-relevance story cannot be a critical company risk. */
  relevance?: number;
}

export function estimateRisk(text: string, ctx: RiskContext = {}): RiskEstimate {
  const haystack = ` ${(text || '').toLowerCase()} `;
  const dimensions = Object.fromEntries(
    RISK_DIMENSIONS.map((d) => [d, 0]),
  ) as Record<RiskDimension, number>;

  const drivers: string[] = [];
  const driverLabels: string[] = [];
  let raw = 0;

  for (const driver of RISK_DRIVERS) {
    const hits = driver.terms.filter((term) => matchesTerm(haystack, term)).length;
    if (hits === 0) continue;
    const contribution = driver.weight * Math.min(1.5, 1 + (hits - 1) * 0.25);
    raw += contribution;
    dimensions[driver.dimension] = clamp(dimensions[driver.dimension] + contribution, 0, 100);
    drivers.push(driver.key);
    driverLabels.push(driver.label);
  }

  if (ctx.isRegulatory) raw += 12;

  const sentiment = ctx.sentimentScore ?? 0;
  if (sentiment < -0.2) raw *= 1 + Math.min(0.35, Math.abs(sentiment) * 0.35);
  else if (sentiment > 0.35) raw *= 0.75;

  // A story that barely mentions the tracked companies cannot be a top company risk.
  const relevance = ctx.relevance ?? 100;
  if (relevance < 40) raw *= 0.5;
  else if (relevance < 60) raw *= 0.8;

  const score = clamp(Math.round(raw), 0, 100);
  const level = riskLevelFromScore(score);
  const confidence =
    drivers.length === 0 ? 45 : clamp(50 + drivers.length * 9 + (ctx.isRegulatory ? 10 : 0), 0, 90);

  return { level, score, confidence, drivers, driverLabels, dimensions };
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'CRITICAL';
  if (score >= 48) return 'HIGH';
  if (score >= 26) return 'MEDIUM';
  if (score >= 8) return 'LOW';
  return 'NONE';
}
