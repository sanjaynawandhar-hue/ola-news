import { matchesTerm } from '@/lib/utils';

/**
 * Default category taxonomy. Categories are seeded into the database and are
 * fully configurable from Settings — the classifier always reads the live rows,
 * so adding a category with keywords immediately changes classification.
 */
export interface CategorySeed {
  key: string;
  label: string;
  description: string;
  colorHex: string;
  keywords: string[];
  sortOrder: number;
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { key: 'corporate', label: 'Corporate', colorHex: '#475569', sortOrder: 10,
    description: 'Company structure, strategy, corporate announcements and general business news.',
    keywords: ['board', 'subsidiary', 'restructure', 'merger', 'demerger', 'acquisition', 'strategy', 'annual report', 'agm', 'incorporate'] },
  { key: 'financial-performance', label: 'Financial performance', colorHex: '#0f766e', sortOrder: 20,
    description: 'Results, revenue, margins, profitability and guidance.',
    keywords: ['revenue', 'profit', 'loss', 'ebitda', 'margin', 'quarterly results', 'q1', 'q2', 'q3', 'q4', 'earnings', 'guidance', 'topline', 'bottom line'] },
  { key: 'funding-investment', label: 'Funding & investment', colorHex: '#7c3aed', sortOrder: 30,
    description: 'Capital raises, IPO, investor activity, valuation and stake changes.',
    keywords: ['funding', 'raises', 'ipo', 'valuation', 'investor', 'stake', 'series', 'capital', 'fundraise', 'anchor', 'placement', 'qip'] },
  { key: 'products-launches', label: 'Products & launches', colorHex: '#0284c7', sortOrder: 40,
    description: 'New products, variants, features and launch announcements.',
    keywords: ['launch', 'unveil', 'introduce', 'new model', 'variant', 'rollout', 'release', 'debut', 'feature'] },
  { key: 'electric-vehicles', label: 'Electric vehicles', colorHex: '#16a34a', sortOrder: 50,
    description: 'EV products, batteries, charging, registrations and EV market dynamics.',
    keywords: ['electric vehicle', 'ev', 'scooter', 'motorcycle', 'battery', 'cell', 'charging', 'range', 'vahan', 'registration', 'gigafactory', 'two-wheeler'] },
  { key: 'artificial-intelligence', label: 'Artificial intelligence', colorHex: '#db2777', sortOrder: 60,
    description: 'AI models, datasets, compute, benchmarks and AI product news.',
    keywords: ['artificial intelligence', 'ai', 'llm', 'large language model', 'model', 'gpu', 'inference', 'training', 'dataset', 'benchmark', 'chatbot', 'foundation model', 'multilingual'] },
  { key: 'mobility-ride-hailing', label: 'Mobility & ride-hailing', colorHex: '#ea580c', sortOrder: 70,
    description: 'Ride-hailing operations, drivers, fares, aggregator rules and mobility services.',
    keywords: ['ride-hailing', 'ride hailing', 'cab', 'taxi', 'driver', 'fare', 'aggregator', 'trip', 'booking', 'auto-rickshaw', 'bike taxi', 'mobility'] },
  { key: 'technology', label: 'Technology', colorHex: '#2563eb', sortOrder: 80,
    description: 'Platform engineering, cloud, apps, semiconductors and general technology.',
    keywords: ['platform', 'cloud', 'app', 'software', 'engineering', 'semiconductor', 'silicon', 'chip', 'data centre', 'data center', 'api'] },
  { key: 'leadership', label: 'Leadership', colorHex: '#9333ea', sortOrder: 90,
    description: 'Executive appointments, departures, founders and board changes.',
    keywords: ['ceo', 'cfo', 'coo', 'cto', 'founder', 'chairman', 'managing director', 'appoint', 'resign', 'steps down', 'quits', 'joins', 'elevated'] },
  { key: 'partnerships', label: 'Partnerships', colorHex: '#0891b2', sortOrder: 100,
    description: 'Alliances, tie-ups, joint ventures and commercial agreements.',
    keywords: ['partnership', 'partners with', 'tie-up', 'tieup', 'joint venture', 'collaborate', 'mou', 'alliance', 'agreement with'] },
  { key: 'competition', label: 'Competition', colorHex: '#c026d3', sortOrder: 110,
    description: 'Competitor moves, market share and comparative positioning.',
    keywords: ['market share', 'rival', 'competitor', 'competition', 'versus', 'outsell', 'overtake', 'price war', 'leaderboard'] },
  { key: 'regulation-compliance', label: 'Regulation & compliance', colorHex: '#b45309', sortOrder: 120,
    description: 'Regulatory notices, circulars, policy changes and compliance obligations.',
    keywords: ['sebi', 'morth', 'regulator', 'compliance', 'circular', 'notification', 'policy', 'ministry', 'guideline', 'norms', 'rules', 'licence', 'license', 'approval', 'subsidy', 'fame', 'pm e-drive'] },
  { key: 'legal-disputes', label: 'Legal disputes', colorHex: '#dc2626', sortOrder: 130,
    description: 'Court matters, tribunals, arbitration and legal claims.',
    keywords: ['court', 'tribunal', 'lawsuit', 'sued', 'litigation', 'nclt', 'petition', 'arbitration', 'verdict', 'judgment', 'plea', 'appeal'] },
  { key: 'safety-recalls', label: 'Safety & recalls', colorHex: '#e11d48', sortOrder: 140,
    description: 'Product safety, defects, recalls and incident reports.',
    keywords: ['recall', 'safety', 'defect', 'fire', 'accident', 'malfunction', 'hazard', 'faulty', 'breakdown'] },
  { key: 'customer-experience', label: 'Customer experience', colorHex: '#f59e0b', sortOrder: 150,
    description: 'Service quality, complaints, delivery experience and support.',
    keywords: ['customer', 'complaint', 'grievance', 'service centre', 'service center', 'after-sales', 'refund', 'waiting period', 'delivery delay', 'support'] },
  { key: 'workforce', label: 'Workforce', colorHex: '#65a30d', sortOrder: 160,
    description: 'Hiring, attrition, layoffs, labour relations and workplace matters.',
    keywords: ['hiring', 'layoff', 'employee', 'workforce', 'attrition', 'staff', 'union', 'salary', 'appraisal', 'headcount', 'gig worker'] },
  { key: 'esg-sustainability', label: 'ESG & sustainability', colorHex: '#059669', sortOrder: 170,
    description: 'Environmental, social and governance disclosures and initiatives.',
    keywords: ['sustainability', 'esg', 'carbon', 'emission', 'renewable', 'recycling', 'circular economy', 'brsr', 'green'] },
  { key: 'reputation-risk', label: 'Reputation risk', colorHex: '#7f1d1d', sortOrder: 180,
    description: 'Controversies, allegations, backlash and brand-damaging coverage.',
    keywords: ['controversy', 'backlash', 'allegation', 'criticism', 'boycott', 'viral', 'apology', 'trolled', 'outrage', 'misleading'] },
];

export interface CategoryRule {
  key: string;
  label: string;
  keywords: string[];
}

/**
 * Tie-break order, highest priority first.
 *
 * A headline like "Ola Electric recalled 10,000 scooters" scores equally for
 * "electric vehicles" (scooter) and "safety & recalls" (recall). Failing to
 * surface a recall is a worse outcome than mislabelling a product story, so
 * categories that carry risk or a compliance obligation win an exact tie.
 */
const TIE_BREAK_PRIORITY: string[] = [
  'safety-recalls',
  'legal-disputes',
  'regulation-compliance',
  'reputation-risk',
  'financial-performance',
  'leadership',
  'funding-investment',
  'customer-experience',
  'workforce',
  'competition',
  'products-launches',
];

function priorityOf(key: string): number {
  const index = TIE_BREAK_PRIORITY.indexOf(key);
  return index === -1 ? -1 : TIE_BREAK_PRIORITY.length - index;
}

export interface CategoryClassification {
  key: string;
  label: string;
  confidence: number;
  scores: Array<{ key: string; score: number }>;
}

/**
 * Weighted keyword classifier. Headline matches count double because feed
 * descriptions are frequently boilerplate.
 */
export function classifyCategory(
  title: string,
  description: string | null | undefined,
  rules: CategoryRule[],
  fallbackKey = 'corporate',
): CategoryClassification {
  const head = ` ${(title || '').toLowerCase()} `;
  const body = ` ${(description || '').toLowerCase()} `;
  const scores: Array<{ key: string; score: number }> = [];

  for (const rule of rules) {
    let score = 0;
    for (const keyword of rule.keywords) {
      // Word-boundary matching: "happened" must not match the keyword "app".
      if (matchesTerm(head, keyword)) score += 2;
      if (matchesTerm(body, keyword)) score += 1;
    }
    if (score > 0) scores.push({ key: rule.key, score });
  }

  scores.sort((a, b) => b.score - a.score || priorityOf(b.key) - priorityOf(a.key));
  if (scores.length === 0) {
    const fallback = rules.find((r) => r.key === fallbackKey) ?? rules[0];
    return {
      key: fallback?.key ?? fallbackKey,
      label: fallback?.label ?? 'Corporate',
      confidence: 35,
      scores: [],
    };
  }

  const top = scores[0];
  const runnerUp = scores[1]?.score ?? 0;
  const separation = (top.score - runnerUp) / top.score;
  const rule = rules.find((r) => r.key === top.key)!;
  const confidence = Math.min(92, Math.round(48 + separation * 30 + Math.min(14, top.score * 3)));

  return { key: rule.key, label: rule.label, confidence, scores: scores.slice(0, 4) };
}
