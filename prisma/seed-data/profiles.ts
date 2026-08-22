/**
 * Company profiles.
 *
 * IMPORTANT — how to read the `verified` flag.
 *
 * This file seeds only facts that are long-standing and widely documented:
 * founding years, founders, headquarters city, listing status, and the
 * existence of the named manufacturing site. Every one carries `verified:
 * false` and an empty `sourceUrl`, because a fact is only verified once a
 * human has checked it against a primary source (the company's own filings or
 * website) and recorded that source.
 *
 * Deliberately absent, because a wrong number here would be worse than none:
 *   · employee headcount        — changes constantly and is rarely published
 *   · street addresses          — availability and accuracy vary
 *   · revenue and unit volumes  — belong in the filings, not a seed file
 *   · executives beyond founders — leadership turns over frequently
 *   · culture statements        — these are a company's own words and should
 *                                 be quoted from its site, not paraphrased
 *
 * Fill those in from Settings, attach the source URL, and mark them verified.
 * The UI shows an explicit "needs verification" state until you do.
 */

export interface ProfileSeed {
  companyKey: string;
  about: string;
  foundedYear?: number;
  headquarters?: string;
  website?: string;
  listingStatus?: 'LISTED' | 'PRIVATE' | 'SUBSIDIARY';
}

export const PROFILE_SEEDS: ProfileSeed[] = [
  {
    companyKey: 'ani-technologies',
    about:
      'ANI Technologies Private Limited is the parent entity behind the Ola ride-hailing '
      + 'business and its consumer services. It operates the Ola mobility platform in India, '
      + 'covering cabs, auto-rickshaws and bike taxis, alongside adjacent consumer offerings.',
    foundedYear: 2010,
    headquarters: 'Bengaluru, Karnataka, India',
    website: 'https://www.olacabs.com',
    listingStatus: 'PRIVATE',
  },
  {
    companyKey: 'ola-electric',
    about:
      'Ola Electric Mobility Limited designs and manufactures electric two-wheelers for the '
      + 'Indian market and is building in-house battery cell capability. It listed on the '
      + 'Indian exchanges in 2024 and is the only publicly traded company in the tracked group.',
    foundedYear: 2017,
    headquarters: 'Bengaluru, Karnataka, India',
    website: 'https://www.olaelectric.com',
    listingStatus: 'LISTED',
  },
  {
    companyKey: 'krutrim',
    about:
      'Krutrim is the group\'s artificial-intelligence business, working on large language '
      + 'models with Indic language coverage, cloud infrastructure for AI workloads, and '
      + 'silicon design. It is privately held.',
    foundedYear: 2023,
    headquarters: 'Bengaluru, Karnataka, India',
    website: 'https://www.olakrutrim.com',
    listingStatus: 'PRIVATE',
  },
];

export interface FactSeed {
  companyKey: string;
  category: 'FACILITY' | 'OFFICE' | 'SCALE' | 'CULTURE' | 'MILESTONE';
  label: string;
  value?: string;
  location?: string;
  detail?: string;
  sortOrder: number;
}

/**
 * Only structural facts whose *existence* is well established. Capacities,
 * headcounts and output figures are left out on purpose — those are the
 * numbers most likely to be quoted wrongly, and they belong to the company's
 * own disclosures.
 */
export const FACT_SEEDS: FactSeed[] = [
  {
    companyKey: 'ola-electric',
    category: 'FACILITY',
    label: 'Manufacturing facility',
    value: 'Ola Futurefactory',
    location: 'Krishnagiri district, Tamil Nadu, India',
    detail:
      'The company\'s electric two-wheeler manufacturing site. Add the stated capacity and '
      + 'commissioning dates from the company\'s own filings before relying on this entry.',
    sortOrder: 10,
  },
  {
    companyKey: 'ola-electric',
    category: 'OFFICE',
    label: 'Registered and corporate office',
    location: 'Bengaluru, Karnataka, India',
    detail:
      'Add the full registered address from the latest annual report or MCA filing, and link '
      + 'it as the source.',
    sortOrder: 20,
  },
  {
    companyKey: 'ani-technologies',
    category: 'OFFICE',
    label: 'Registered and corporate office',
    location: 'Bengaluru, Karnataka, India',
    detail: 'Add the full registered address from the latest MCA filing, and link it as the source.',
    sortOrder: 10,
  },
  {
    companyKey: 'krutrim',
    category: 'OFFICE',
    label: 'Corporate office',
    location: 'Bengaluru, Karnataka, India',
    detail: 'Add the full address from the company website, and link it as the source.',
    sortOrder: 10,
  },
];

/**
 * Founders only. Wider leadership is left for an administrator to add from the
 * company's own leadership page or annual report — role titles change often
 * enough that a stale seeded roster would mislead.
 */
export interface ExecutiveSeed {
  companyKey: string;
  name: string;
  role: string;
  kind: 'FOUNDER' | 'BOARD' | 'EXECUTIVE';
  since?: string;
  sortOrder: number;
}

export const EXECUTIVE_SEEDS: ExecutiveSeed[] = [
  {
    companyKey: 'ani-technologies',
    name: 'Bhavish Aggarwal',
    role: 'Co-founder',
    kind: 'FOUNDER',
    since: '2010',
    sortOrder: 10,
  },
  {
    companyKey: 'ani-technologies',
    name: 'Ankit Bhati',
    role: 'Co-founder',
    kind: 'FOUNDER',
    since: '2010',
    sortOrder: 20,
  },
  {
    companyKey: 'ola-electric',
    name: 'Bhavish Aggarwal',
    role: 'Founder',
    kind: 'FOUNDER',
    since: '2017',
    sortOrder: 10,
  },
  {
    companyKey: 'krutrim',
    name: 'Bhavish Aggarwal',
    role: 'Founder',
    kind: 'FOUNDER',
    since: '2023',
    sortOrder: 10,
  },
];
