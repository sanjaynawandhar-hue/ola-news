import { matchesTerm } from '@/lib/utils';
import type { RegulatoryDocType } from '@/lib/constants';

/**
 * Decides whether a regulatory document belongs in the tracker at all.
 *
 * A regulator's feed is dominated by enforcement against unrelated parties —
 * recovery certificates, demat attachments, appeals filed by named
 * individuals, adjudication orders against other companies. None of that
 * concerns the tracked portfolio, and listing it buries the items that do.
 *
 * Two things earn a place:
 *
 *   1. COMPANY  — the document names a tracked company, brand or executive.
 *   2. SECTOR   — the document is a general instrument that binds the tracked
 *                 companies by virtue of what they are: a listed issuer, an
 *                 EV manufacturer, a ride-hailing aggregator.
 *
 * Everything else is rejected. The underlying article is still stored, so the
 * audit trail is complete — this only governs the curated tracker.
 */

export type RegulatoryScope = 'company' | 'sector';

export interface RegulatoryRelevance {
  relevant: boolean;
  scope: RegulatoryScope | null;
  reason: string;
}

/**
 * Wording that marks a document as action against a *specific named party*.
 * These are the enforcement notices that flood a regulator feed.
 */
const ENFORCEMENT_AGAINST_PARTY = [
  'recovery certificate',
  'rc no',
  'notice of attachment',
  'notice of demand',
  'attachment of demat',
  'attachment of bank',
  'remittance order',
  'remittance advice',
  'general remittance',
  'defaulter',
  'appeal no',
  'in the matter of front running',
  'adjudication order in respect of',
  'final order in respect of',
  'release order for',
  'completion of rc',
  'certificate of sale',
  'auction notice',
];

/**
 * Instruments that bind a listed issuer regardless of whether it is named.
 * A change to disclosure timelines genuinely affects Ola Electric.
 */
const BINDS_LISTED_ISSUER = [
  'listed entities',
  'listed companies',
  'listing obligations',
  'lodr',
  'listing regulations',
  'disclosure requirements',
  'continuous disclosure',
  'corporate governance',
  'related party transactions',
  'insider trading',
  'prohibition of insider trading',
  'buyback',
  'delisting',
  'rights issue',
  'preferential issue',
  'shareholding pattern',
  'annual secretarial',
  'issuers of listed',
  'equity shares',
];

/**
 * Instruments that bind the tracked companies because of the sectors they
 * operate in — electric vehicles, ride-hailing, and AI/data.
 */
const BINDS_SECTOR = [
  'electric vehicle',
  'electric two-wheeler',
  'battery',
  'charging infrastructure',
  'fame',
  'pm e-drive',
  'aggregator guidelines',
  'motor vehicle',
  'type approval',
  'homologation',
  'automotive',
  'ride-hailing',
  'bike taxi',
  'gig worker',
  'consumer protection',
  'data protection',
  'artificial intelligence',
];

/**
 * Instruments aimed at market intermediaries. Ola is an issuer, not a broker,
 * research analyst, investment adviser, FPI or KRA — so these do not apply
 * unless the document names a tracked entity outright.
 */
const INTERMEDIARY_ONLY = [
  'investment adviser',
  'research analyst',
  'portfolio manager',
  'mutual fund',
  'alternative investment fund',
  'foreign portfolio investor',
  'fpi',
  'kyc registration agenc',
  'kra',
  'depository participant',
  'stock broker',
  'merchant banker',
  'debenture trustee',
  'credit rating agenc',
  'clearing corporation',
  'custodian',
];

export function assessRegulatoryRelevance(
  title: string,
  description: string | null | undefined,
  docType: RegulatoryDocType,
  namedCompanies: string[],
): RegulatoryRelevance {
  const haystack = ` ${title} ${description ?? ''} `.toLowerCase();

  // 1. A tracked entity is named — always relevant, whatever the document is.
  if (namedCompanies.length > 0) {
    return {
      relevant: true,
      scope: 'company',
      reason: `Names ${namedCompanies.slice(0, 3).join(', ')}.`,
    };
  }

  // 2. Enforcement against some other named party. This is the bulk of a
  //    regulator's feed and none of it concerns the portfolio.
  const enforcementHit = ENFORCEMENT_AGAINST_PARTY.find((term) => matchesTerm(haystack, term));
  if (enforcementHit) {
    return {
      relevant: false,
      scope: null,
      reason: `Enforcement against a third party ("${enforcementHit}"); no tracked entity involved.`,
    };
  }

  // 3. Aimed at market intermediaries rather than issuers.
  const intermediaryHit = INTERMEDIARY_ONLY.find((term) => matchesTerm(haystack, term));
  if (intermediaryHit) {
    return {
      relevant: false,
      scope: null,
      reason: `Applies to ${intermediaryHit}s, a category none of the tracked companies fall into.`,
    };
  }

  // 4. A general instrument that binds a listed issuer.
  const issuerHit = BINDS_LISTED_ISSUER.find((term) => matchesTerm(haystack, term));
  if (issuerHit) {
    return {
      relevant: true,
      scope: 'sector',
      reason: `General obligation for listed entities ("${issuerHit}") — applies to Ola Electric as a listed issuer.`,
    };
  }

  // 5. A general instrument that binds one of the sectors involved.
  const sectorHit = BINDS_SECTOR.find((term) => matchesTerm(haystack, term));
  if (sectorHit) {
    return {
      relevant: true,
      scope: 'sector',
      reason: `Sector-wide instrument ("${sectorHit}") covering an activity the portfolio operates in.`,
    };
  }

  // 6. Nothing connects it to the portfolio.
  return {
    relevant: false,
    scope: null,
    reason: 'No tracked entity named and no general obligation that reaches the portfolio.',
  };
}
