/**
 * Source registry.
 *
 * `mode` is the honest status of each connector and is shown on the Sources
 * page and in every export:
 *   LIVE                 — verified reachable, collected on every refresh
 *   AWAITING_CREDENTIALS — adapter implemented, needs an API key
 *   DISABLED             — the publisher blocks automated collection, or no
 *                          machine-readable feed exists; enabling it would
 *                          require written permission or a licensed feed
 *   DEMO                 — the built-in labelled sample dataset
 *
 * Only headline, publisher-provided description, link and metadata are stored.
 * Full article text is never copied, paywalled content is never bypassed, and
 * every request declares an identifying user agent and honours per-host rate
 * limits.
 */
export interface SourceSeed {
  key: string;
  name: string;
  homepage?: string;
  endpoint?: string;
  adapter: string;
  sourceType: string;
  group?: string;
  country?: string;
  language?: string;
  credibility: number;
  mode: 'LIVE' | 'DEMO' | 'DISABLED' | 'AWAITING_CREDENTIALS';
  enabled?: boolean;
  requiresCredential?: boolean;
  credentialEnvVar?: string;
  queryTemplate?: string;
  rateLimitMs?: number;
  maxItems?: number;
  isRegulatory?: boolean;
  authority?: string;
  termsUrl?: string;
  complianceNote?: string;
  sortOrder: number;
}

export const SOURCE_SEEDS: SourceSeed[] = [
  // ---------------------------------------------------------------- LIVE ---
  {
    key: 'google-news', name: 'Google News (search RSS)', adapter: 'google-news',
    homepage: 'https://news.google.com',
    endpoint: 'https://news.google.com/rss/search?q={{q}}&hl=en-IN&gl=IN&ceid=IN:en',
    queryTemplate: '{{q}}', sourceType: 'AGGREGATOR', group: 'Aggregators',
    credibility: 68, mode: 'LIVE', rateLimitMs: 1500, maxItems: 60, sortOrder: 10,
    termsUrl: 'https://news.google.com/',
    complianceNote: 'Public search RSS. Headline, snippet and link to the original publisher only.',
  },
  {
    key: 'gdelt', name: 'GDELT global news index', adapter: 'gdelt',
    homepage: 'https://www.gdeltproject.org',
    endpoint: 'https://api.gdeltproject.org/api/v2/doc/doc',
    sourceType: 'AGGREGATOR', group: 'Aggregators', country: 'US',
    credibility: 60, mode: 'LIVE', rateLimitMs: 6500, maxItems: 30, sortOrder: 20,
    termsUrl: 'https://www.gdeltproject.org/about.html',
    complianceNote: 'Free public API. Rate limited to roughly one request every five seconds; the connector enforces this.',
  },
  {
    key: 'sebi-rss', name: 'SEBI (Securities and Exchange Board of India)', adapter: 'rss',
    homepage: 'https://www.sebi.gov.in',
    endpoint: 'https://www.sebi.gov.in/sebirss.xml',
    sourceType: 'REGULATOR', group: 'Regulators', credibility: 98, mode: 'LIVE',
    rateLimitMs: 2000, maxItems: 40, isRegulatory: true, authority: 'SEBI', sortOrder: 30,
    termsUrl: 'https://www.sebi.gov.in/legal.html',
    complianceNote: 'Official SEBI RSS feed. Primary regulatory documents are always preferred over secondary reporting.',
  },
  {
    key: 'et-auto', name: 'The Economic Times — Auto', adapter: 'rss',
    homepage: 'https://economictimes.indiatimes.com',
    endpoint: 'https://economictimes.indiatimes.com/industry/auto/rssfeeds/13359412.cms',
    sourceType: 'AUTO_EV', group: 'Automotive & EV', credibility: 82, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 40, sortOrder: 40,
    complianceNote: 'Publisher-provided RSS. Headline, syndicated summary and link only.',
  },
  {
    key: 'et-tech', name: 'The Economic Times — Tech', adapter: 'rss',
    endpoint: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms',
    homepage: 'https://economictimes.indiatimes.com',
    sourceType: 'AI_TECH', group: 'AI & technology', credibility: 82, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 40, sortOrder: 50,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'et-markets', name: 'The Economic Times — Markets', adapter: 'rss',
    endpoint: 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms',
    homepage: 'https://economictimes.indiatimes.com',
    sourceType: 'BUSINESS', group: 'Business & financial', credibility: 82, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 40, sortOrder: 60,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'mint-companies', name: 'Mint — Companies', adapter: 'rss',
    endpoint: 'https://www.livemint.com/rss/companies',
    homepage: 'https://www.livemint.com',
    sourceType: 'BUSINESS', group: 'Business & financial', credibility: 84, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 40, sortOrder: 70,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'mint-industry', name: 'Mint — Industry', adapter: 'rss',
    endpoint: 'https://www.livemint.com/rss/industry',
    homepage: 'https://www.livemint.com',
    sourceType: 'BUSINESS', group: 'Business & financial', credibility: 84, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 40, sortOrder: 80,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'mint-markets', name: 'Mint — Markets', adapter: 'rss',
    endpoint: 'https://www.livemint.com/rss/markets',
    homepage: 'https://www.livemint.com',
    sourceType: 'BUSINESS', group: 'Business & financial', credibility: 84, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 30, sortOrder: 90,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'mint-technology', name: 'Mint — Technology', adapter: 'rss',
    endpoint: 'https://www.livemint.com/rss/technology',
    homepage: 'https://www.livemint.com',
    sourceType: 'AI_TECH', group: 'AI & technology', credibility: 84, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 30, sortOrder: 100,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'hindu-bl-companies', name: 'The Hindu BusinessLine — Companies', adapter: 'rss',
    endpoint: 'https://www.thehindubusinessline.com/companies/feeder/default.rss',
    homepage: 'https://www.thehindubusinessline.com',
    sourceType: 'BUSINESS', group: 'Business & financial', credibility: 86, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 40, sortOrder: 110,
    complianceNote: 'Publisher-provided RSS.',
  },
  {
    key: 'hindu-bl-markets', name: 'The Hindu BusinessLine — Markets', adapter: 'rss',
    endpoint: 'https://www.thehindubusinessline.com/markets/feeder/default.rss',
    homepage: 'https://www.thehindubusinessline.com',
    sourceType: 'BUSINESS', group: 'Business & financial', credibility: 86, mode: 'LIVE',
    rateLimitMs: 1500, maxItems: 30, sortOrder: 120,
    complianceNote: 'Publisher-provided RSS.',
  },

  // ------------------------------------------ AWAITING CREDENTIALS ---------
  {
    key: 'newsapi', name: 'NewsAPI.org', adapter: 'newsapi',
    endpoint: 'https://newsapi.org/v2/everything', homepage: 'https://newsapi.org',
    sourceType: 'NEWS', group: 'Licensed news APIs', country: 'US',
    credibility: 75, mode: 'AWAITING_CREDENTIALS', requiresCredential: true,
    credentialEnvVar: 'NEWSAPI_KEY', rateLimitMs: 1200, maxItems: 60, sortOrder: 200,
    termsUrl: 'https://newsapi.org/terms',
    complianceNote: 'Set NEWSAPI_KEY to enable. Free tier is development-only under the provider terms.',
  },
  {
    key: 'newsdata', name: 'NewsData.io', adapter: 'newsdata',
    endpoint: 'https://newsdata.io/api/1/news', homepage: 'https://newsdata.io',
    sourceType: 'NEWS', group: 'Licensed news APIs', country: 'US',
    credibility: 72, mode: 'AWAITING_CREDENTIALS', requiresCredential: true,
    credentialEnvVar: 'NEWSDATA_API_KEY', rateLimitMs: 1200, maxItems: 50, sortOrder: 210,
    termsUrl: 'https://newsdata.io/terms',
    complianceNote: 'Set NEWSDATA_API_KEY to enable.',
  },
  {
    key: 'gnews', name: 'GNews.io', adapter: 'gnews',
    endpoint: 'https://gnews.io/api/v4/search', homepage: 'https://gnews.io',
    sourceType: 'NEWS', group: 'Licensed news APIs', country: 'US',
    credibility: 70, mode: 'AWAITING_CREDENTIALS', requiresCredential: true,
    credentialEnvVar: 'GNEWS_API_KEY', rateLimitMs: 1200, maxItems: 50, sortOrder: 220,
    termsUrl: 'https://gnews.io/terms',
    complianceNote: 'Set GNEWS_API_KEY to enable.',
  },
  {
    key: 'bing-news', name: 'Bing News Search', adapter: 'bing-news',
    endpoint: 'https://api.bing.microsoft.com/v7.0/news/search', homepage: 'https://www.microsoft.com/en-us/bing/apis',
    sourceType: 'NEWS', group: 'Licensed news APIs', country: 'US',
    credibility: 76, mode: 'AWAITING_CREDENTIALS', requiresCredential: true,
    credentialEnvVar: 'BING_NEWS_API_KEY', rateLimitMs: 1200, maxItems: 60, sortOrder: 230,
    complianceNote: 'Set BING_NEWS_API_KEY to enable.',
  },

  // ------------------------------------------------------- DISABLED --------
  {
    key: 'pib', name: 'Press Information Bureau', adapter: 'rss',
    endpoint: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',
    homepage: 'https://pib.gov.in', sourceType: 'GOVERNMENT', group: 'Government & ministries',
    credibility: 96, mode: 'DISABLED', enabled: false, isRegulatory: true, authority: 'PIB',
    rateLimitMs: 3000, maxItems: 40, sortOrder: 300,
    complianceNote: 'The PIB endpoint returns HTTP 403 to automated clients. Enable only after obtaining permitted access; the connector is ready.',
  },
  {
    key: 'morth', name: 'Ministry of Road Transport & Highways', adapter: 'rss',
    homepage: 'https://morth.nic.in', sourceType: 'GOVERNMENT', group: 'Government & ministries',
    credibility: 97, mode: 'DISABLED', enabled: false, isRegulatory: true, authority: 'MoRTH',
    rateLimitMs: 3000, maxItems: 30, sortOrder: 310,
    complianceNote: 'MoRTH publishes notifications as HTML/PDF with no machine-readable feed. Add a licensed feed or a permitted extraction adapter to enable.',
  },
  {
    key: 'bse-announcements', name: 'BSE corporate announcements', adapter: 'rss',
    homepage: 'https://www.bseindia.com', sourceType: 'EXCHANGE', group: 'Exchanges',
    credibility: 97, mode: 'DISABLED', enabled: false, isRegulatory: true, authority: 'BSE',
    rateLimitMs: 3000, maxItems: 40, sortOrder: 320,
    complianceNote: 'The BSE announcement API blocks unauthenticated automated clients (HTTP 403). Requires an exchange data licence.',
  },
  {
    key: 'nse-announcements', name: 'NSE corporate announcements', adapter: 'rss',
    homepage: 'https://www.nseindia.com', sourceType: 'EXCHANGE', group: 'Exchanges',
    credibility: 97, mode: 'DISABLED', enabled: false, isRegulatory: true, authority: 'NSE',
    rateLimitMs: 3000, maxItems: 40, sortOrder: 330,
    complianceNote: 'NSE requires session cookies and prohibits unauthorised automated access. Requires an exchange data licence.',
  },
  {
    key: 'mca', name: 'Ministry of Corporate Affairs', adapter: 'rss',
    homepage: 'https://www.mca.gov.in', sourceType: 'GOVERNMENT', group: 'Government & ministries',
    credibility: 96, mode: 'DISABLED', enabled: false, isRegulatory: true, authority: 'MCA',
    rateLimitMs: 3000, maxItems: 30, sortOrder: 340,
    complianceNote: 'MCA21 filings are behind an authenticated portal with per-document charges. No automated collection is performed.',
  },
  {
    key: 'ecourts', name: 'Courts & tribunals (eCourts / NCLT)', adapter: 'rss',
    homepage: 'https://ecourts.gov.in', sourceType: 'COURT', group: 'Courts & tribunals',
    credibility: 95, mode: 'DISABLED', enabled: false, isRegulatory: true, authority: 'COURT',
    rateLimitMs: 4000, maxItems: 30, sortOrder: 350,
    complianceNote: 'Cause lists and orders require CAPTCHA-protected search. Not collected automatically; add a licensed legal-data feed to enable.',
  },
  {
    key: 'ola-electric-newsroom', name: 'Ola Electric newsroom', adapter: 'rss',
    homepage: 'https://www.olaelectric.com/newsroom', sourceType: 'COMPANY', group: 'Official company channels',
    credibility: 90, mode: 'DISABLED', enabled: false, rateLimitMs: 3000, maxItems: 25, sortOrder: 360,
    complianceNote: 'The newsroom is a client-rendered page with no RSS feed. robots.txt permits crawling, but extraction is left disabled until the site terms are reviewed for this use.',
  },
  {
    key: 'ola-cabs-blog', name: 'Ola Cabs / Ola Consumer blog', adapter: 'rss',
    homepage: 'https://www.olacabs.com', sourceType: 'COMPANY', group: 'Official company channels',
    credibility: 90, mode: 'DISABLED', enabled: false, rateLimitMs: 3000, maxItems: 25, sortOrder: 370,
    complianceNote: 'No machine-readable feed published. Enable after confirming a permitted feed or supplied press-release endpoint.',
  },
  {
    key: 'krutrim-blog', name: 'Krutrim blog', adapter: 'rss',
    homepage: 'https://www.olakrutrim.com', sourceType: 'COMPANY', group: 'Official company channels',
    credibility: 88, mode: 'DISABLED', enabled: false, rateLimitMs: 3000, maxItems: 25, sortOrder: 380,
    complianceNote: 'No machine-readable feed published.',
  },

  // ----------------------------------------------------------- DEMO --------
  {
    key: 'demo-newswire', name: 'Ola News demo dataset', adapter: 'demo',
    sourceType: 'NEWS', group: 'Demo data', credibility: 55, mode: 'DEMO',
    rateLimitMs: 0, maxItems: 60, sortOrder: 900,
    complianceNote: 'Clearly labelled sample records used for evaluation. Never presented as live news. Disable in Settings or set OLA_NEWS_ENABLE_DEMO_DATA=false.',
  },
  {
    key: 'demo-regulatory', name: 'Ola News demo regulatory dataset', adapter: 'demo',
    sourceType: 'REGULATOR', group: 'Demo data', credibility: 55, mode: 'DEMO',
    enabled: false, rateLimitMs: 0, maxItems: 20, isRegulatory: true, authority: 'DEMO',
    sortOrder: 910,
    complianceNote: 'Sample regulatory records for evaluation only. Seeded directly; not fetched during refresh.',
  },
];
