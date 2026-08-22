import { clamp } from '@/lib/utils';
import type { EntityMatch } from './entities';
import type { ContentType } from '@/lib/constants';

export interface RelevanceInput {
  title: string;
  description?: string | null;
  entities: EntityMatch[];
  /** Terms from Keyword rows with type = TRACK. */
  trackedKeywords: Array<{ term: string; weight: number }>;
  /** Terms from Keyword rows with type = EXCLUDE. */
  excludedKeywords: string[];
  /** 0-100 credibility of the originating source. */
  sourceCredibility: number;
  /** True when the source is an official regulator/exchange/company channel. */
  isOfficialSource?: boolean;
}

export interface RelevanceResult {
  score: number;
  primaryCompanyKey: string | null;
  companyKeys: string[];
  groups: string[];
  excluded: boolean;
  reasons: string[];
}

/**
 * Relevance answers "how much does this story concern the tracked portfolio?".
 * It is driven by which tracked entities appear, how specific the alias match
 * was, and whether a tracked entity appears in the headline rather than only in
 * the body.
 */
export function scoreRelevance(input: RelevanceInput): RelevanceResult {
  const title = (input.title || '').toLowerCase();
  const haystack = `${title} ${(input.description || '').toLowerCase()}`;
  const reasons: string[] = [];

  for (const excluded of input.excludedKeywords) {
    if (excluded && haystack.includes(excluded.toLowerCase())) {
      return {
        score: 0,
        primaryCompanyKey: null,
        companyKeys: [],
        groups: [],
        excluded: true,
        reasons: [`Excluded by keyword "${excluded}"`],
      };
    }
  }

  const companyMatches = input.entities.filter(
    (e) => e.type === 'COMPANY' || e.type === 'BRAND' || e.type === 'PRODUCT' || e.type === 'PERSON',
  );

  let score = 0;

  // Direct company mentions dominate the score.
  const selfCompanies = companyMatches.filter((m) => m.group && m.group !== 'market');
  const marketCompanies = companyMatches.filter((m) => !m.group || m.group === 'market');

  for (const match of selfCompanies) {
    const inTitle = title.includes(match.matchedAlias.toLowerCase());
    const base = match.type === 'COMPANY' ? 40 : match.type === 'BRAND' ? 32 : 26;
    const specificity = match.confidence / 100;
    score += base * specificity * (inTitle ? 1.35 : 0.8);
    if (inTitle) reasons.push(`"${match.value}" appears in the headline`);
  }

  // Competitor/industry stories matter, but less.
  for (const match of marketCompanies) {
    const inTitle = title.includes(match.matchedAlias.toLowerCase());
    score += (inTitle ? 16 : 9) * (match.confidence / 100);
    if (inTitle) reasons.push(`Competitor/industry mention: ${match.value}`);
  }

  // Tracked free-form keywords.
  for (const keyword of input.trackedKeywords) {
    const needle = keyword.term.toLowerCase();
    if (!needle) continue;
    if (title.includes(needle)) {
      score += 10 * keyword.weight;
      reasons.push(`Tracked keyword "${keyword.term}" in headline`);
    } else if (haystack.includes(needle)) {
      score += 5 * keyword.weight;
    }
  }

  // Regulator mentions raise relevance only when a tracked company is present.
  const regulators = input.entities.filter((e) => e.type === 'REGULATOR');
  if (regulators.length > 0 && selfCompanies.length > 0) {
    score += Math.min(14, regulators.length * 7);
    reasons.push(`Regulatory authority mentioned: ${regulators.map((r) => r.value).join(', ')}`);
  }

  if (input.isOfficialSource && selfCompanies.length > 0) {
    score += 10;
    reasons.push('Published on an official/primary source');
  }

  // Source credibility nudges an already-relevant story by up to ±6 points.
  // It must never lift a story that matched nothing above zero: an unrelated
  // article from a highly credible publisher is still unrelated.
  if (score > 0) {
    score += (input.sourceCredibility - 70) * 0.08;
  }

  const groups = Array.from(
    new Set(selfCompanies.map((m) => m.group).filter((g): g is string => !!g)),
  );
  const companyKeys = Array.from(
    new Set(companyMatches.map((m) => m.companyKey).filter((k): k is string => !!k)),
  );

  const primary =
    selfCompanies
      .slice()
      .sort((a, b) => b.confidence * b.mentions - a.confidence * a.mentions)[0]?.companyKey ??
    marketCompanies[0]?.companyKey ??
    null;

  return {
    score: clamp(Math.round(score), 0, 100),
    primaryCompanyKey: primary,
    companyKeys,
    groups,
    excluded: false,
    reasons: reasons.slice(0, 6),
  };
}

const OPINION_MARKERS = ['opinion', 'view:', 'viewpoint', 'editorial', 'column', 'comment:', 'why i ', 'perspective'];
const ANALYSIS_MARKERS = ['analysis', 'explained', 'deep dive', 'explainer', 'what it means', 'decoded', 'outlook', 'takeaways'];
const PRESS_MARKERS = ['press release', 'announces', 'announced today', 'statement', 'newsroom', 'media release'];

/** Distinguishes straight reporting from opinion, analysis and press material. */
export function detectContentType(
  title: string,
  description: string | null | undefined,
  sourceType: string,
): ContentType {
  const text = `${title} ${description ?? ''}`.toLowerCase();
  if (sourceType === 'COMPANY' || sourceType === 'REGULATOR' || sourceType === 'EXCHANGE') {
    return 'PRESS_RELEASE';
  }
  if (OPINION_MARKERS.some((m) => text.includes(m))) return 'OPINION';
  if (ANALYSIS_MARKERS.some((m) => text.includes(m))) return 'ANALYSIS';
  if (PRESS_MARKERS.some((m) => text.includes(m))) return 'PRESS_RELEASE';
  return 'REPORTING';
}
