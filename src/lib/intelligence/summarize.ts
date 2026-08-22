import { isRedundantDescription, truncate } from '@/lib/utils';
import { COMPANY_GROUP_LABELS, type CompanyGroup, type RiskLevel, type Sentiment } from '@/lib/constants';

/**
 * Machine-generated summary + "why this matters".
 *
 * The heuristic engine is strictly *extractive*: it only reuses the publisher's
 * own headline and the short description the publisher chose to syndicate, then
 * adds an explicitly derived framing sentence. It never asserts facts that are
 * not present in the source, and never fabricates quotations or figures.
 */

export interface SummaryInput {
  title: string;
  description?: string | null;
  publisher: string;
  categoryLabel: string;
  sentiment: Sentiment;
  riskLevel: RiskLevel;
  riskDriverLabels: string[];
  group: CompanyGroup | null;
  companyNames: string[];
  isRegulatory?: boolean;
  authority?: string | null;
  corroboration?: number;
}

export interface SummaryOutput {
  aiSummary: string;
  whyItMatters: string;
}

export function buildSummary(input: SummaryInput): SummaryOutput {
  return {
    aiSummary: buildExtractiveSummary(input),
    whyItMatters: buildWhyItMatters(input),
  };
}

function buildExtractiveSummary(input: SummaryInput): string {
  const description = (input.description ?? '').trim();
  // Guard again here: some adapters bypass normalisation.
  if (description.length >= 60 && !isRedundantDescription(input.title, description)) {
    // Take the leading sentences the publisher already syndicated.
    const sentences = splitSentences(description);
    let out = '';
    for (const sentence of sentences) {
      if ((out + ' ' + sentence).trim().length > 340) break;
      out = `${out} ${sentence}`.trim();
      if (out.length >= 160) break;
    }
    if (out.length >= 60) return truncate(out, 360);
    return truncate(description, 360);
  }

  // No usable description. Many aggregator feeds carry the headline only, so
  // rather than restating it, report what is actually known about the item and
  // send the reader to the source. Nothing here is invented.
  const parts: string[] = [];

  const subject = input.companyNames.length
    ? input.companyNames.slice(0, 2).join(' and ')
    : 'the tracked portfolio';
  parts.push(`${input.categoryLabel} coverage of ${subject}, reported by ${input.publisher}`);

  const corroboration = input.corroboration ?? 1;
  if (corroboration > 1) {
    parts.push(`and ${corroboration - 1} other publisher${corroboration > 2 ? 's' : ''}`);
  }

  const signal =
    input.riskLevel === 'CRITICAL' || input.riskLevel === 'HIGH'
      ? `Carries a ${input.riskLevel.toLowerCase()} risk signal${
          input.riskDriverLabels.length ? ` (${input.riskDriverLabels[0].toLowerCase()})` : ''
        }.`
      : input.sentiment !== 'NEUTRAL'
        ? `Framed ${input.sentiment.toLowerCase()}ly.`
        : null;

  return truncate(
    `${parts.join(' ')}. ${signal ? `${signal} ` : ''}` +
      'This feed supplies the headline only — open the original for the full report.',
    360,
  );
}

function buildWhyItMatters(input: SummaryInput): string {
  const parts: string[] = [];
  const groupLabel = input.group ? COMPANY_GROUP_LABELS[input.group] : null;

  if (input.isRegulatory && input.authority) {
    parts.push(
      `This is a ${input.authority} item affecting ${groupLabel ?? 'the tracked portfolio'}, so it carries a compliance obligation rather than only reputational exposure.`,
    );
  } else if (groupLabel) {
    parts.push(`Directly concerns ${groupLabel}.`);
  } else {
    parts.push('Concerns the competitive or regulatory environment around the tracked portfolio.');
  }

  if (input.riskLevel === 'CRITICAL' || input.riskLevel === 'HIGH') {
    const drivers = input.riskDriverLabels.slice(0, 3).join(', ').toLowerCase();
    parts.push(
      `Flagged ${input.riskLevel.toLowerCase()} risk${drivers ? ` on ${drivers}` : ''}; this warrants a same-day view from the responsible function.`,
    );
  } else if (input.riskLevel === 'MEDIUM') {
    const drivers = input.riskDriverLabels.slice(0, 2).join(' and ').toLowerCase();
    parts.push(`Medium risk signal${drivers ? ` (${drivers})` : ''} — worth monitoring for escalation.`);
  } else if (input.sentiment === 'POSITIVE') {
    parts.push('Positively framed coverage that can be reused in investor and customer communication.');
  } else {
    parts.push(`Adds to the ${input.categoryLabel.toLowerCase()} coverage baseline used for trend tracking.`);
  }

  if ((input.corroboration ?? 1) > 1) {
    parts.push(`Reported by ${input.corroboration} independent publishers.`);
  }

  return truncate(parts.join(' '), 420);
}

export function splitSentences(text: string): string[] {
  return (text || '')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Short topic phrases used by the trending-topics panel. */
export function extractTopics(title: string, description: string | null | undefined, limit = 5): string[] {
  const text = `${title} ${description ?? ''}`;
  const stop = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'says', 'said', 'after', 'over', 'into',
    'amid', 'will', 'has', 'have', 'its', 'new', 'more', 'than', 'been', 'were', 'was', 'are',
    'may', 'can', 'not', 'but', 'you', 'all', 'out', 'about', 'their', 'they',
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));

  const counts = new Map<string, number>();
  for (let i = 0; i < words.length; i++) {
    counts.set(words[i], (counts.get(words[i]) ?? 0) + 1);
    if (i < words.length - 1) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      counts.set(bigram, (counts.get(bigram) ?? 0) + 2);
    }
  }
  return Array.from(counts.entries())
    .filter(([phrase, count]) => count > 1 || phrase.includes(' '))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase]) => phrase);
}
