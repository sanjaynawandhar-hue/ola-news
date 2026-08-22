import { matchesTerm } from '@/lib/utils';
import { RISK_RANK, type RegulatoryDocType, type RiskLevel, type Severity } from '@/lib/constants';

/**
 * Turns an item collected from a regulator, exchange, court or ministry source
 * into a regulatory-tracker record.
 *
 * The document type and severity are *inferred* from the authority's own title
 * and description — nothing is invented. Where the wording gives no signal, the
 * item falls back to a plain NOTICE at LOW severity rather than being guessed
 * upward.
 */

interface DocTypeRule {
  type: RegulatoryDocType;
  terms: string[];
}

/** Ordered most-specific first; the first rule that matches wins. */
const DOC_TYPE_RULES: DocTypeRule[] = [
  { type: 'PENALTY', terms: ['penalty', 'penalties', 'fine', 'fined', 'monetary penalty', 'disgorgement'] },
  { type: 'RECALL', terms: ['recall', 'recalls', 'recalled'] },
  { type: 'INVESTIGATION', terms: ['investigation', 'investigate', 'probe', 'inquiry', 'enquiry', 'inspection'] },
  { type: 'ORDER', terms: ['order', 'orders', 'adjudication order', 'settlement order', 'interim order', 'directions'] },
  { type: 'CIRCULAR', terms: ['circular', 'master circular', 'guidelines', 'framework'] },
  { type: 'COURT', terms: ['court', 'tribunal', 'appellate', 'judgment', 'judgement', 'petition', 'appeal', 'writ'] },
  { type: 'DEADLINE', terms: ['last date', 'due date', 'deadline', 'extension of time', 'timeline for'] },
  { type: 'POLICY', terms: ['policy', 'notification', 'amendment', 'regulations', 'rules', 'scheme', 'consultation paper', 'discussion paper'] },
  { type: 'COMPLIANCE', terms: ['compliance', 'disclosure requirement', 'reporting requirement', 'obligation'] },
  { type: 'FILING', terms: ['filing', 'return', 'shareholding pattern', 'annual report', 'intimation', 'submission'] },
  { type: 'NOTICE', terms: ['notice', 'show cause', 'summons', 'public notice'] },
];

export function inferDocType(title: string, summary?: string | null): RegulatoryDocType {
  const haystack = ` ${title} ${summary ?? ''} `.toLowerCase();
  for (const rule of DOC_TYPE_RULES) {
    if (rule.terms.some((term) => matchesTerm(haystack, term))) return rule.type;
  }
  return 'NOTICE';
}

/** Document types that carry direct consequence for an affected company. */
const HIGH_CONSEQUENCE: RegulatoryDocType[] = ['PENALTY', 'ORDER', 'INVESTIGATION', 'RECALL', 'COURT'];
const MEDIUM_CONSEQUENCE: RegulatoryDocType[] = ['NOTICE', 'DEADLINE', 'COMPLIANCE'];

/**
 * Severity blends the document type with the risk estimate and whether a
 * tracked company is actually named. A high-consequence document that does not
 * name any tracked company is background context, not an escalation.
 */
export function inferSeverity(
  docType: RegulatoryDocType,
  riskLevel: RiskLevel,
  namesTrackedCompany: boolean,
): Severity {
  const riskRank = RISK_RANK[riskLevel];

  if (!namesTrackedCompany) {
    // Sector-wide items still matter, but never as a company-level escalation.
    return HIGH_CONSEQUENCE.includes(docType) || riskRank >= RISK_RANK.HIGH ? 'MEDIUM' : 'LOW';
  }

  if (HIGH_CONSEQUENCE.includes(docType)) {
    return riskRank >= RISK_RANK.HIGH ? 'CRITICAL' : 'HIGH';
  }
  if (MEDIUM_CONSEQUENCE.includes(docType)) {
    return riskRank >= RISK_RANK.HIGH ? 'HIGH' : 'MEDIUM';
  }
  return riskRank >= RISK_RANK.MEDIUM ? 'MEDIUM' : 'LOW';
}

/**
 * Summary for a regulatory document.
 *
 * Where the authority syndicates a real description, that is used verbatim.
 * Most official feeds (SEBI's included) carry titles only — in that case the
 * summary states what the document *is* rather than restating the title that
 * is already displayed directly above it.
 */
export function regulatorySummary(
  authority: string,
  docType: RegulatoryDocType,
  companyNames: string[],
  issueDate: Date,
  description?: string | null,
): string {
  if (description && description.trim().length >= 60) return description.trim();

  const date = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(issueDate);

  const naming = companyNames.length
    ? `It names ${companyNames.slice(0, 3).join(', ')}.`
    : 'No tracked company is named in the document title.';

  return (
    `${authority} ${docType.toLowerCase()} published on ${date}. ${naming} ` +
    `This feed carries document titles only — open the official document for the full text.`
  );
}

/**
 * Explains why a regulatory item is being tracked. Deliberately descriptive —
 * it states what kind of document this is and who it names, and never asserts
 * an outcome the document does not state.
 */
export function regulatoryWhyItMatters(
  authority: string,
  docType: RegulatoryDocType,
  companyNames: string[],
): string {
  const subject = companyNames.length
    ? companyNames.slice(0, 3).join(', ')
    : null;

  const consequence: Record<RegulatoryDocType, string> = {
    PENALTY: 'carries a direct financial and reputational consequence',
    ORDER: 'is binding and typically has a compliance date attached',
    INVESTIGATION: 'has a long tail and elevated reputational exposure even before findings',
    RECALL: 'has immediate operational, warranty and safety-perception consequences',
    COURT: 'sets hearing dates that usually drive coverage spikes',
    NOTICE: 'normally carries a short response window',
    DEADLINE: 'fixes a date the compliance calendar has to meet',
    COMPLIANCE: 'changes an ongoing reporting or disclosure obligation',
    CIRCULAR: 'changes the rules applying to regulated entities',
    POLICY: 'shapes the operating and incentive environment',
    FILING: 'is a routine submission, tracked to confirm no gap in the filing calendar',
  };

  const lead = subject
    ? `A ${authority} ${docType.toLowerCase()} naming ${subject}.`
    : `A ${authority} ${docType.toLowerCase()} affecting the sector this portfolio operates in; no tracked company is named in the document title.`;

  return `${lead} This type of document ${consequence[docType]}. Read the official document before acting — the classification and severity here are automated.`;
}
