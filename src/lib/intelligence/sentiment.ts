import { clamp, tokenize } from '@/lib/utils';
import type { Sentiment } from '@/lib/constants';

/**
 * Transparent lexicon sentiment estimator tuned for corporate/financial news
 * headlines. It is deliberately explainable: every score can be traced to the
 * matched terms, and the result is always surfaced as an estimate with a
 * confidence value — never as a fact.
 */

const POSITIVE: Record<string, number> = {
  surge: 2, surges: 2, jump: 1.8, jumps: 1.8, rally: 1.8, rallies: 1.8, soar: 2.2, soars: 2.2,
  gain: 1.4, gains: 1.4, rise: 1.2, rises: 1.2, rising: 1.2, growth: 1.5, grew: 1.5, grow: 1.2,
  profit: 1.8, profitable: 2, profitability: 1.6, beat: 1.8, beats: 1.8,
  outperform: 2, upgrade: 2, upgraded: 2, expansion: 1.4, expands: 1.4, expanding: 1.4,
  launch: 1.2, launches: 1.2, unveils: 1.2, partnership: 1.4, partners: 1.2, collaboration: 1.2,
  wins: 1.8, win: 1.6, award: 1.4, awarded: 1.4, milestone: 1.5, breakthrough: 2,
  approval: 1.6, approved: 1.6, cleared: 1.4, funding: 1.3, raises: 1.2, investment: 1.2,
  strong: 1.5, robust: 1.5, improved: 1.5, improvement: 1.5, improves: 1.5, boost: 1.5,
  leading: 1.2, leader: 1.2, success: 1.8, successful: 1.8, positive: 1.5, optimistic: 1.4,
  recovery: 1.5, rebound: 1.6, turnaround: 1.6, upbeat: 1.5, momentum: 1.2, demand: 0.8,
  innovation: 1.2, sustainable: 1, efficiency: 1.1, accelerate: 1.2, ramp: 0.9, adoption: 1,
};

const NEGATIVE: Record<string, number> = {
  fall: 1.4, falls: 1.4, falling: 1.4, drop: 1.5, drops: 1.5, plunge: 2.4, plunges: 2.4,
  slump: 2.2, slumps: 2.2, crash: 2.6, tumble: 2.2, tumbles: 2.2, decline: 1.6, declines: 1.6,
  loss: 2, losses: 2, lossmaking: 2.4, deficit: 1.8, downgrade: 2.2, downgraded: 2.2,
  probe: 2.2, probes: 2.2, investigation: 2.2, investigating: 2, inquiry: 1.8,
  penalty: 2.6, penalised: 2.6, penalized: 2.6, fine: 2.2, fined: 2.4, notice: 1.4,
  lawsuit: 2.4, sued: 2.4, litigation: 2, dispute: 1.8, breach: 2.4, violation: 2.4,
  recall: 2.6, recalls: 2.6, defect: 2.4, defective: 2.4, faulty: 2.4, fire: 2.4, fires: 1.6,
  accident: 2.2, injury: 2.4, death: 3, fatal: 3, crashes: 2,
  complaint: 1.8, complaints: 1.8, grievance: 1.6, backlash: 2.2, criticism: 1.8, criticised: 1.8,
  layoff: 2.4, layoffs: 2.4, sacked: 2.2, resign: 1.8, resigns: 2, resignation: 2, exits: 1.6,
  attrition: 1.6, shutdown: 2.2, shut: 1.4, halt: 1.8, halts: 1.8, suspended: 2.2, suspension: 2.2,
  delay: 1.6, delays: 1.6, delayed: 1.6, postponed: 1.4, misses: 1.8, missed: 1.6, shortfall: 2,
  weak: 1.6, weakness: 1.6, sluggish: 1.6, concern: 1.4, concerns: 1.4, risk: 1.2, risks: 1.2,
  fraud: 3, scam: 3, misleading: 2.2, allegation: 2.2, allegations: 2.2, alleged: 1.8,
  warning: 1.8, warns: 1.8, crisis: 2.6, protest: 2, strike: 2.2, boycott: 2.2,
  slashed: 1.8, pressure: 1.2, scrutiny: 1.8, controversy: 2.2,
  // Understated negatives that corporate headlines favour over explicit words.
  slower: 1.4, slow: 1.2, slowdown: 1.8, lag: 1.4, lags: 1.4, lagging: 1.4,
  deferred: 1.5, deferral: 1.5, subdued: 1.5, muted: 1.4,
  narrowing: 1.2, contraction: 1.8, erosion: 1.8, erodes: 1.8, softening: 1.4,
  persists: 1.2, persist: 1.2, unresolved: 1.6, stalled: 1.8, stalls: 1.8,
  curtailed: 1.6, withdrawn: 1.6, rejected: 1.8, denied: 1.4,
};

/**
 * Multi-word phrases carry a polarity that their individual words do not.
 * "record" alone is ambiguous ("record profit" vs "a court record"), so
 * ambiguous unigrams were removed from the lexicons above and handled here.
 */
const POSITIVE_PHRASES: Record<string, number> = {
  'record profit': 2.6, 'record revenue': 2.4, 'record sales': 2.4, 'record high': 2.2,
  'record quarter': 2.2, 'all-time high': 2.2, 'beats estimates': 2.4, 'ahead of schedule': 2,
  'market leader': 1.8, 'price cut': 1.2, 'cuts prices': 1.2, 'back to profit': 2.6,
};

const NEGATIVE_PHRASES: Record<string, number> = {
  'net loss': 2.6, 'widening loss': 2.8, 'job cuts': 2.6, 'show cause': 2.4,
  'all-time low': 2.4, '52-week low': 2.2, 'misses estimates': 2.2, 'below estimates': 2,
  'behind schedule': 1.8, 'pushed back': 1.6, 'scaled back': 1.8, 'cost overrun': 2.2,
  'market share loss': 2.2, 'losing share': 2, 'under scrutiny': 1.8, 'class action': 2.4,
};

/**
 * Directional verbs are sign-neutral on their own — "complaints rise" is bad
 * news while "revenue rises" is good news. When a directional term appears in
 * text that also names a negative subject, its contribution is flipped.
 */
const DIRECTIONAL = new Set([
  'rise', 'rises', 'rising', 'rose', 'surge', 'surges', 'jump', 'jumps', 'climb', 'climbs',
  'grew', 'grow', 'growth', 'soar', 'soars', 'boost', 'gain', 'gains',
]);

const NEGATIVE_SUBJECTS = new Set([
  'complaint', 'complaints', 'grievance', 'grievances', 'loss', 'losses', 'risk', 'risks',
  'concern', 'concerns', 'delay', 'delays', 'defect', 'defects', 'attrition', 'layoff',
  'layoffs', 'cost', 'costs', 'debt', 'penalty', 'penalties', 'litigation', 'churn',
  'cancellation', 'cancellations', 'downtime', 'recall', 'recalls', 'deficit', 'provision',
  'provisions', 'provisioning', 'backlog', 'shortfall', 'accidents', 'incidents', 'fires',
]);

/** Weight of the implicit neutral prior in the smoothed polarity score. */
export const SMOOTHING = 2.0;
/** Minimum |score| before a story is called positive or negative. */
export const POLARITY_THRESHOLD = 0.15;
/** Minimum charge before polarity is trusted at all. */
export const MAGNITUDE_THRESHOLD = 0.18;

const NEGATORS = new Set(['not', 'no', 'never', 'without', 'denies', 'denied', 'rejects', 'rejected']);
const INTENSIFIERS: Record<string, number> = {
  sharply: 1.5, significantly: 1.4, heavily: 1.4, massive: 1.6, steep: 1.5,
  slightly: 0.6, marginally: 0.6, modest: 0.7, slight: 0.6,
};

export interface SentimentEstimate {
  label: Sentiment;
  /** -1 (very negative) .. +1 (very positive) */
  score: number;
  /** 0..1 — how strongly the text is charged either way. */
  magnitude: number;
  confidence: number;
  rationale: string;
  matched: { positive: string[]; negative: string[] };
}

export function estimateSentiment(text: string): SentimentEstimate {
  const tokens = tokenize(text);
  const lower = (text || '').toLowerCase();
  const rawWords = lower.split(/\s+/);
  let positive = 0;
  let negative = 0;
  const matchedPositive: string[] = [];
  const matchedNegative: string[] = [];

  // Phrases are scored first and are not double-counted as unigrams because
  // the ambiguous unigrams they contain were removed from the lexicons.
  for (const [phrase, weight] of Object.entries(POSITIVE_PHRASES)) {
    if (lower.includes(phrase)) {
      positive += weight;
      matchedPositive.push(phrase);
    }
  }
  for (const [phrase, weight] of Object.entries(NEGATIVE_PHRASES)) {
    if (lower.includes(phrase)) {
      negative += weight;
      matchedNegative.push(phrase);
    }
  }

  // A directional verb inherits the polarity of what it is describing.
  const hasNegativeSubject = tokens.some((t) => NEGATIVE_SUBJECTS.has(t));

  tokens.forEach((token) => {
    const index = rawWords.indexOf(token);
    const previous = index > 0 ? rawWords[index - 1].replace(/[^a-z]/g, '') : '';
    const negated = NEGATORS.has(previous);
    const multiplier = INTENSIFIERS[previous] ?? 1;

    if (POSITIVE[token]) {
      const value = POSITIVE[token] * multiplier;
      const flipped = !negated && hasNegativeSubject && DIRECTIONAL.has(token);
      if (negated || flipped) {
        negative += value;
        matchedNegative.push(flipped ? `${token} (of a negative subject)` : `not ${token}`);
      } else {
        positive += value;
        matchedPositive.push(token);
      }
    } else if (NEGATIVE[token]) {
      const value = NEGATIVE[token] * multiplier;
      if (negated) {
        positive += value * 0.6;
        matchedPositive.push(`not ${token}`);
      } else {
        negative += value;
        matchedNegative.push(token);
      }
    }
  });

  const total = positive + negative;
  // Additive smoothing: a single weak indicator must not produce a maximal
  // score. `SMOOTHING` is the weight of an implicit neutral prior.
  const score = total === 0 ? 0 : (positive - negative) / (total + SMOOTHING);
  const magnitude = Math.min(1, total / 8);
  const hits = matchedPositive.length + matchedNegative.length;

  let label: Sentiment = 'NEUTRAL';
  if (score > POLARITY_THRESHOLD && magnitude >= MAGNITUDE_THRESHOLD) label = 'POSITIVE';
  else if (score < -POLARITY_THRESHOLD && magnitude >= MAGNITUDE_THRESHOLD) label = 'NEGATIVE';

  const confidence =
    hits === 0
      ? 40
      : clamp(Math.round(40 + Math.abs(score) * 34 + Math.min(18, hits * 4)), 0, 90);

  const rationale =
    hits === 0
      ? 'No sentiment-bearing terms detected; defaulted to neutral.'
      : `Matched ${matchedPositive.length} positive and ${matchedNegative.length} negative indicator(s).`;

  return {
    label,
    score: Number(score.toFixed(3)),
    magnitude: Number(magnitude.toFixed(3)),
    confidence,
    rationale,
    matched: { positive: matchedPositive.slice(0, 8), negative: matchedNegative.slice(0, 8) },
  };
}

/** Maps a numeric score to a label using the same thresholds as the estimator. */
export function sentimentFromScore(score: number, magnitude = 1): Sentiment {
  if (magnitude < MAGNITUDE_THRESHOLD) return 'NEUTRAL';
  if (score > POLARITY_THRESHOLD) return 'POSITIVE';
  if (score < -POLARITY_THRESHOLD) return 'NEGATIVE';
  return 'NEUTRAL';
}
