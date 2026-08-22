/**
 * Clearly-labelled demo dataset.
 *
 * These records are SAMPLE DATA, not news. They exist so the dashboard can be
 * evaluated without paid API credentials. To keep the distinction unambiguous:
 *   - every record is stored with `isDemo: true` and rendered with a DEMO badge;
 *   - publishers are fictional ("Demo Business Wire"), never real outlets;
 *   - links point at example.com, the IANA-reserved documentation domain;
 *   - no real quotation, filing number or regulatory notice is reproduced.
 * Disable the whole set from Settings → Sources, or with
 * OLA_NEWS_ENABLE_DEMO_DATA=false.
 */

export interface DemoArticle {
  title: string;
  description: string;
  publisher: string;
  slug: string;
  daysAgo: number;
  hourOffset?: number;
  language?: string;
  country?: string;
}

const D = (
  title: string,
  description: string,
  publisher: string,
  slug: string,
  daysAgo: number,
  hourOffset = 9,
  language = 'en',
  country = 'IN',
): DemoArticle => ({ title, description, publisher, slug, daysAgo, hourOffset, language, country });

export const DEMO_ARTICLES: DemoArticle[] = [
  // --- Ola Electric ---------------------------------------------------------
  D('Ola Electric reports sequential improvement in quarterly deliveries, margin pressure persists',
    'Sample record. The illustrative company reports higher unit deliveries quarter on quarter while gross margin remains below the guided range.',
    'Demo Business Wire', 'oe-q-deliveries', 0, 8),
  D('Ola Electric expands service network to 120 additional cities',
    'Sample record describing an expansion of owned and franchise service touchpoints across tier-2 and tier-3 markets.',
    'Demo Auto Review', 'oe-service-network', 0, 14),
  D('Ola Electric battery cell localisation timeline pushed to next fiscal, says illustrative filing',
    'Sample record. Ola Electric in-house cell production ramp is described as slower than the earlier stated schedule.',
    'Demo EV Monitor', 'oe-cell-timeline', 1, 11),
  D('Consumer complaints about Ola Electric delivery timelines rise, demo consumer forum data shows',
    'Sample record summarising an increase in registered grievances against Ola Electric relating to vehicle delivery and after-sales response times.',
    'Demo Consumer Watch', 'oe-complaints', 2, 16),
  D('Ola Electric announces price revision across scooter portfolio',
    'Sample record covering an announced revision in ex-showroom pricing following a change in input costs.',
    'Demo Business Wire', 'oe-pricing', 3, 10),
  D('Analyst note: EV two-wheeler share shifts as competition intensifies for Ola Electric',
    'Sample analyst commentary on shifting market share among electric two-wheeler manufacturers including Ola Electric, Ather Energy and TVS Motor.',
    'Demo Market Intelligence', 'oe-share-shift', 4, 9),
  D('Ola Electric announces illustrative recall of a scooter sub-assembly as a precautionary measure',
    'Sample record describing a voluntary precautionary recall and replacement programme by Ola Electric for a component batch with a reported safety defect.',
    'Demo Auto Review', 'oe-recall', 5, 12),
  D('Ola Electric commissions additional automated line at its manufacturing facility',
    'Sample record on incremental capacity addition at the illustrative manufacturing plant.',
    'Demo Manufacturing Digest', 'oe-line', 6, 10),
  D('Employee attrition in Ola Electric engineering teams draws attention in demo workforce survey',
    'Sample record summarising a workforce survey covering attrition and layoffs in Ola Electric product engineering functions.',
    'Demo Workforce Journal', 'oe-attrition', 7, 15),
  D('Ola Electric publishes sustainability disclosure covering energy and water intensity',
    'Sample record on an annual environmental disclosure containing energy, water and waste intensity metrics.',
    'Demo ESG Review', 'oe-esg', 9, 11),
  D('Ola Electric stock falls after illustrative quarterly update',
    'Sample record describing a share price decline for Ola Electric after a quarterly business update missed estimates.',
    'Demo Market Intelligence', 'oe-stock', 10, 10),
  D('Ola Electric announces fast-charging network partnership with a demo infrastructure operator',
    'Sample record covering an Ola Electric charging infrastructure partnership across highway corridors.',
    'Demo Infrastructure Times', 'oe-charging', 12, 13),
  D('Warranty provisioning increases in illustrative Ola Electric annual accounts',
    'Sample record noting a higher warranty provision by Ola Electric compared with the prior period, contributing to a wider net loss.',
    'Demo Financial Chronicle', 'oe-warranty', 14, 9),
  D('Demo court matter listed relating to an Ola Electric supplier payment dispute',
    'Sample record describing a commercial dispute and litigation between Ola Electric and a component supplier before a tribunal.',
    'Demo Legal Reporter', 'oe-supplier-dispute', 16, 11),

  // --- ANI Technologies / Ola Cabs -----------------------------------------
  D('Ola Cabs pilots a new driver earnings structure in three metros',
    'Sample record on a pilot programme revising driver incentive and commission structures.',
    'Demo Mobility Weekly', 'ani-driver-earnings', 0, 12),
  D('Ride-hailing aggregator rules trigger compliance updates at Ola Cabs and other operators',
    'Sample record summarising compliance changes at Ola Cabs and other operators following updated MoRTH aggregator guidelines.',
    'Demo Policy Brief', 'ani-aggregator-rules', 1, 9),
  D('ANI Technologies restructures a business unit, demo filing indicates',
    'Sample record on an internal reorganisation of a business vertical.',
    'Demo Corporate Register', 'ani-restructure', 2, 14),
  D('Surge pricing complaints against Ola Cabs feature in a demo consumer grievance summary',
    'Sample record covering consumer complaints against Ola Cabs relating to fare transparency, referred to a consumer protection authority.',
    'Demo Consumer Watch', 'ani-surge', 3, 17),
  D('Ola Consumer expands quick-commerce pilot to additional pin codes',
    'Sample record about a geographic expansion of a quick-commerce pilot.',
    'Demo Retail Digest', 'ani-quick-commerce', 4, 10),
  D('Driver association raises Ola Cabs operating cost concerns in demo consultation',
    'Sample record on a driver association submission to a state transport authority regarding Ola Cabs operating economics, including a threatened strike.',
    'Demo Workforce Journal', 'ani-driver-assoc', 5, 16),
  D('Ola Cabs partners with a demo insurance provider for in-trip cover',
    'Sample record describing an in-trip insurance partnership.',
    'Demo Financial Chronicle', 'ani-insurance', 7, 11),
  D('Mobility market share data for Ola Cabs and Uber published by a demo research firm',
    'Sample record with illustrative ride-hailing market share estimates covering Ola Cabs, Uber and Rapido.',
    'Demo Market Intelligence', 'ani-market-share', 8, 9),
  D('Safety feature rollout announced for the illustrative ride-hailing app',
    'Sample record on new in-app safety features for riders and drivers.',
    'Demo Mobility Weekly', 'ani-safety', 11, 13),
  D('Data-protection compliance readiness at Ola Cabs reviewed across mobility platforms',
    'Sample record summarising a review of Ola Cabs and peer platform readiness for personal data protection obligations.',
    'Demo Policy Brief', 'ani-dpdp', 13, 10),
  D('Illustrative funding discussion reported for an ANI Technologies mobility subsidiary',
    'Sample record describing early-stage discussions on subsidiary-level capital raising at ANI Technologies.',
    'Demo Venture Ledger', 'ani-funding', 18, 12),

  // --- Krutrim --------------------------------------------------------------
  D('Krutrim releases an updated multilingual model checkpoint',
    'Sample record on the release of an updated language model checkpoint with expanded Indic language coverage.',
    'Demo AI Observer', 'kr-model-release', 0, 16),
  D('Krutrim cloud platform adds inference endpoints in an additional region',
    'Sample record on regional availability expansion for an AI inference platform.',
    'Demo Cloud Report', 'kr-cloud-region', 1, 15),
  D('Benchmark comparison of Krutrim and peer Indic language models published by a demo lab',
    'Sample record comparing published benchmark results across Krutrim and other Indic language models.',
    'Demo AI Observer', 'kr-benchmarks', 3, 11),
  D('Enterprise pilot announced between Krutrim and a demo financial services firm',
    'Sample record covering an enterprise AI pilot in financial services.',
    'Demo Enterprise Tech', 'kr-enterprise-pilot', 5, 10),
  D('AI talent hiring accelerates at Krutrim and illustrative Indian AI startups',
    'Sample record on hiring trends at Krutrim and across the domestic AI sector.',
    'Demo Workforce Journal', 'kr-hiring', 6, 14),
  D('Krutrim silicon roadmap discussion features in a demo semiconductor briefing',
    'Sample record summarising a briefing on Krutrim domestic AI silicon plans.',
    'Demo Semiconductor Brief', 'kr-silicon', 9, 9),
  D('Responsible-AI disclosure framework debated at a demo industry forum attended by Krutrim',
    'Sample record on an industry discussion of AI transparency and evaluation disclosures involving Krutrim and peers.',
    'Demo Policy Brief', 'kr-responsible-ai', 12, 11),
  D('Krutrim developer platform reports growth in registered developers',
    'Sample record covering developer adoption metrics for an AI platform.',
    'Demo Enterprise Tech', 'kr-developers', 15, 13),

  // --- Competitors / industry ----------------------------------------------
  D('Competing electric two-wheeler maker announces a new platform',
    'Sample record on a competitor product platform announcement relevant to the EV two-wheeler segment.',
    'Demo EV Monitor', 'comp-ev-platform', 1, 10),
  D('Rival ride-hailing operator expands intercity service',
    'Sample record on a competitor expanding intercity ride services.',
    'Demo Mobility Weekly', 'comp-intercity', 2, 12),
  D('Global AI infrastructure spending outlook revised by a demo research firm',
    'Sample record with an illustrative outlook for AI infrastructure capital spending.',
    'Demo Market Intelligence', 'comp-ai-capex', 4, 9, 'en', 'US'),
  D('EV subsidy framework discussion continues at a demo policy roundtable',
    'Sample record summarising a policy roundtable on electric vehicle demand incentives.',
    'Demo Policy Brief', 'ind-subsidy', 6, 11),
  D('Battery raw material prices ease, according to demo commodity tracking',
    'Sample record on movement in battery raw material price indices.',
    'Demo Commodity Tracker', 'ind-raw-material', 8, 10, 'en', 'SG'),
  D('Charging infrastructure standards consultation opens at a demo authority',
    'Sample record on a public consultation covering charging interoperability standards.',
    'Demo Policy Brief', 'ind-charging-standard', 10, 9),
];

/**
 * Resolves a demo record's publication time.
 * The offsets are relative to "now", so a same-day record with a late hour
 * offset could otherwise land in the future and render as "in 3 hours".
 * Anything at or after the current time is pulled back to a plausible
 * just-published timestamp.
 */
export function demoPublishedAt(article: DemoArticle, now = new Date()): Date {
  const published = new Date(now.getTime() - article.daysAgo * 86400000);
  published.setHours(article.hourOffset ?? 9, (article.slug.length * 7) % 60, 0, 0);
  if (published.getTime() >= now.getTime()) {
    // Spread same-day records back over the preceding few hours.
    const minutesBack = 20 + ((article.slug.length * 37) % 400);
    return new Date(now.getTime() - minutesBack * 60000);
  }
  return published;
}

export interface DemoRegulatory {
  authority: string;
  companyKeys: string[];
  docType: string;
  title: string;
  summary: string;
  whyItMatters: string;
  daysAgo: number;
  effectiveInDays?: number | null;
  deadlineInDays?: number | null;
  severity: string;
  status: string;
  slug: string;
}

export const DEMO_REGULATORY: DemoRegulatory[] = [
  {
    authority: 'SEBI', companyKeys: ['ola-electric'], docType: 'CIRCULAR',
    title: 'Illustrative circular on continuous disclosure timelines for listed entities',
    summary: 'Sample record describing revised timelines for disclosing material events under listing obligations.',
    whyItMatters: 'Shorter disclosure windows would tighten the internal turnaround for board-approved announcements.',
    daysAgo: 2, effectiveInDays: 28, deadlineInDays: 21, severity: 'MEDIUM', status: 'OPEN', slug: 'sebi-disclosure',
  },
  {
    authority: 'SEBI', companyKeys: ['ola-electric'], docType: 'FILING',
    title: 'Illustrative shareholding pattern filing for the quarter',
    summary: 'Sample record covering a routine quarterly shareholding pattern submission.',
    whyItMatters: 'Routine filing. Tracked to confirm no compliance gap in the periodic submission calendar.',
    daysAgo: 5, effectiveInDays: null, deadlineInDays: null, severity: 'LOW', status: 'CLOSED', slug: 'sebi-shp',
  },
  {
    authority: 'MoRTH', companyKeys: ['ola-electric'], docType: 'POLICY',
    title: 'Illustrative notification on electric two-wheeler safety testing requirements',
    summary: 'Sample record describing additional type-approval test requirements for electric two-wheelers.',
    whyItMatters: 'Additional homologation steps could affect launch timelines for new variants.',
    daysAgo: 6, effectiveInDays: 90, deadlineInDays: 45, severity: 'HIGH', status: 'IN_PROGRESS', slug: 'morth-safety',
  },
  {
    authority: 'MoRTH', companyKeys: ['ola-cabs'], docType: 'POLICY',
    title: 'Illustrative amendment to aggregator operating guidelines',
    summary: 'Sample record on proposed amendments covering fare bands and driver welfare obligations.',
    whyItMatters: 'Fare band changes would directly affect take-rate assumptions in the ride-hailing business.',
    daysAgo: 9, effectiveInDays: 60, deadlineInDays: 30, severity: 'HIGH', status: 'OPEN', slug: 'morth-aggregator',
  },
  {
    authority: 'BSE', companyKeys: ['ola-electric'], docType: 'FILING',
    title: 'Illustrative intimation of board meeting for financial results',
    summary: 'Sample record covering an intimation of a scheduled board meeting to consider financial results.',
    whyItMatters: 'Sets the date around which results-related coverage and market reaction should be monitored.',
    daysAgo: 3, effectiveInDays: 12, deadlineInDays: null, severity: 'LOW', status: 'MONITORING', slug: 'bse-board',
  },
  {
    authority: 'NSE', companyKeys: ['ola-electric'], docType: 'NOTICE',
    title: 'Illustrative clarification sought on a price movement',
    summary: 'Sample record describing an exchange clarification request following unusual price movement.',
    whyItMatters: 'Clarification requests carry a short response window and attract secondary media coverage.',
    daysAgo: 4, effectiveInDays: null, deadlineInDays: 2, severity: 'MEDIUM', status: 'RESPONDED', slug: 'nse-clarification',
  },
  {
    authority: 'MCA', companyKeys: ['ani-technologies'], docType: 'FILING',
    title: 'Illustrative annual return filing for a group entity',
    summary: 'Sample record covering an annual return submission for a private group entity.',
    whyItMatters: 'Group-entity filings are the earliest public signal of structural or shareholding changes.',
    daysAgo: 11, effectiveInDays: null, deadlineInDays: null, severity: 'LOW', status: 'CLOSED', slug: 'mca-annual',
  },
  {
    authority: 'CCPA', companyKeys: ['ola-cabs', 'ola-electric'], docType: 'NOTICE',
    title: 'Illustrative notice on service-quality grievance redressal timelines',
    summary: 'Sample record describing a consumer-authority notice on grievance closure timelines.',
    whyItMatters: 'Consumer-authority action tends to generate rapid, negatively framed coverage.',
    daysAgo: 7, effectiveInDays: null, deadlineInDays: 14, severity: 'HIGH', status: 'IN_PROGRESS', slug: 'ccpa-grievance',
  },
  {
    authority: 'CCI', companyKeys: ['ola-cabs'], docType: 'INVESTIGATION',
    title: 'Illustrative preliminary review of platform pricing practices',
    summary: 'Sample record describing a preliminary competition review of platform pricing practices.',
    whyItMatters: 'Competition reviews carry long tails and elevated reputational risk even before findings.',
    daysAgo: 15, effectiveInDays: null, deadlineInDays: 25, severity: 'CRITICAL', status: 'OPEN', slug: 'cci-review',
  },
  {
    authority: 'PIB', companyKeys: ['ola-electric', 'krutrim'], docType: 'POLICY',
    title: 'Illustrative press release on electric mobility and AI capability programmes',
    summary: 'Sample record summarising a government press release on mobility electrification and AI capability building.',
    whyItMatters: 'Scheme design determines eligibility for incentives across both the EV and AI businesses.',
    daysAgo: 8, effectiveInDays: 30, deadlineInDays: null, severity: 'MEDIUM', status: 'MONITORING', slug: 'pib-programme',
  },
  {
    authority: 'NCLT', companyKeys: ['ani-technologies'], docType: 'COURT',
    title: 'Illustrative matter listed before a tribunal concerning a contractual claim',
    summary: 'Sample record describing a tribunal listing relating to a commercial contractual claim.',
    whyItMatters: 'Listed matters set hearing dates that typically drive coverage spikes.',
    daysAgo: 13, effectiveInDays: null, deadlineInDays: 18, severity: 'MEDIUM', status: 'OPEN', slug: 'nclt-matter',
  },
];
