/**
 * Tracked portfolio.
 *
 * Company, brand, product and executive names below are limited to widely and
 * publicly documented entities. Administrators should review and extend this
 * list from Settings — the dashboard reads the database, not this file, at
 * runtime, so nothing here is hard-coded into the product.
 */
export interface CompanySeed {
  key: string;
  name: string;
  legalName?: string;
  group: 'ani' | 'olaelectric' | 'krutrim' | 'market';
  relation: 'SELF' | 'COMPETITOR' | 'PARTNER' | 'INDUSTRY';
  ticker?: string;
  description?: string;
  aliases: string[];
  colorHex?: string;
  brands?: Array<{ name: string; aliases: string[] }>;
  products?: Array<{ name: string; kind: string; aliases: string[] }>;
  executives?: Array<{ name: string; role: string; aliases: string[] }>;
}

export const COMPANY_SEEDS: CompanySeed[] = [
  {
    key: 'ani-technologies',
    name: 'ANI Technologies',
    legalName: 'ANI Technologies Private Limited',
    group: 'ani',
    relation: 'SELF',
    colorHex: '#0BA860',
    description: 'Parent entity of the Ola ride-hailing and consumer businesses.',
    aliases: [
      'ANI Technologies Private Limited', 'ANI Technologies Pvt Ltd', 'ANI Technologies Pvt. Ltd.',
      'ANI Tech',
    ],
    brands: [
      { name: 'Ola Cabs', aliases: ['Ola Cab', 'olacabs'] },
      { name: 'Ola Consumer', aliases: ['Ola Consumer app'] },
      { name: 'Ola Mobility', aliases: ['Ola Mobility Institute'] },
      { name: 'Ola', aliases: [] },
    ],
    products: [
      { name: 'Ola app', kind: 'APP', aliases: ['Ola application'] },
      { name: 'Ola Maps', kind: 'PLATFORM', aliases: ['Ola Maps API'] },
      { name: 'Ola Auto', kind: 'SERVICE', aliases: ['Ola auto-rickshaw'] },
      { name: 'Ola Bike', kind: 'SERVICE', aliases: ['Ola bike taxi'] },
      { name: 'Ola Rentals', kind: 'SERVICE', aliases: [] },
      { name: 'Ola Outstation', kind: 'SERVICE', aliases: ['Ola intercity'] },
    ],
    executives: [
      { name: 'Bhavish Aggarwal', role: 'Co-founder & Chairman', aliases: ['Bhavish Agarwal'] },
      { name: 'Ankit Bhati', role: 'Co-founder', aliases: [] },
    ],
  },
  {
    key: 'ola-electric',
    name: 'Ola Electric',
    legalName: 'Ola Electric Mobility Limited',
    group: 'olaelectric',
    relation: 'SELF',
    ticker: 'OLAELEC',
    colorHex: '#087A45',
    description: 'Listed electric two-wheeler manufacturer and cell manufacturing business.',
    aliases: [
      'Ola Electric Mobility', 'Ola Electric Mobility Limited', 'Ola Electric Mobility Ltd',
      'Ola Electric Technologies', 'OLAELEC',
    ],
    brands: [
      { name: 'Ola Electric', aliases: [] },
      { name: 'Ola Gigafactory', aliases: ['Ola Futurefactory', 'Ola Future Factory'] },
    ],
    products: [
      { name: 'Ola S1', kind: 'VEHICLE', aliases: ['S1 scooter'] },
      { name: 'Ola S1 Pro', kind: 'VEHICLE', aliases: ['S1 Pro'] },
      { name: 'Ola S1 Air', kind: 'VEHICLE', aliases: ['S1 Air'] },
      { name: 'Ola S1 X', kind: 'VEHICLE', aliases: ['S1 X'] },
      { name: 'Ola Roadster', kind: 'VEHICLE', aliases: ['Roadster X', 'Roadster Pro'] },
      { name: 'Bharat Cell', kind: 'PLATFORM', aliases: ['4680 cell'] },
      { name: 'Ola Hypercharger', kind: 'SERVICE', aliases: ['Hypercharger network'] },
      { name: 'MoveOS', kind: 'PLATFORM', aliases: ['Move OS'] },
    ],
    executives: [
      { name: 'Bhavish Aggarwal', role: 'Founder, Chairman & Managing Director', aliases: ['Bhavish Agarwal'] },
    ],
  },
  {
    key: 'krutrim',
    name: 'Krutrim',
    legalName: 'Krutrim SI Designs',
    group: 'krutrim',
    relation: 'SELF',
    colorHex: '#0F766E',
    description: 'Artificial-intelligence business covering language models, cloud and silicon.',
    aliases: ['Ola Krutrim', 'Krutrim SI Designs', 'Krutrim AI', 'Krutrim SI'],
    brands: [
      { name: 'Krutrim Cloud', aliases: ['Krutrim cloud platform'] },
      { name: 'Kruti', aliases: ['Kruti assistant'] },
    ],
    products: [
      { name: 'Krutrim LLM', kind: 'MODEL', aliases: ['Krutrim model'] },
      { name: 'Krutrim Cloud', kind: 'PLATFORM', aliases: [] },
      { name: 'Bodhi', kind: 'PLATFORM', aliases: [] },
    ],
    executives: [
      { name: 'Bhavish Aggarwal', role: 'Founder', aliases: ['Bhavish Agarwal'] },
    ],
  },

  // ---- Competitors and industry context -----------------------------------
  { key: 'uber', name: 'Uber', group: 'market', relation: 'COMPETITOR', aliases: ['Uber India', 'Uber Technologies'], colorHex: '#111827' },
  { key: 'rapido', name: 'Rapido', group: 'market', relation: 'COMPETITOR', aliases: ['Roppen Transportation'], colorHex: '#F59E0B' },
  { key: 'namma-yatri', name: 'Namma Yatri', group: 'market', relation: 'COMPETITOR', aliases: ['Nammayatri'], colorHex: '#2563EB' },
  { key: 'blusmart', name: 'BluSmart', group: 'market', relation: 'COMPETITOR', aliases: ['Blu Smart'], colorHex: '#1D4ED8' },
  { key: 'ather', name: 'Ather Energy', group: 'market', relation: 'COMPETITOR', aliases: ['Ather 450'], colorHex: '#16A34A' },
  { key: 'tvs', name: 'TVS Motor', group: 'market', relation: 'COMPETITOR', aliases: ['TVS Motor Company', 'TVS iQube'], colorHex: '#DC2626' },
  { key: 'bajaj', name: 'Bajaj Auto', group: 'market', relation: 'COMPETITOR', aliases: ['Bajaj Chetak'], colorHex: '#1E40AF' },
  { key: 'hero-motocorp', name: 'Hero MotoCorp', group: 'market', relation: 'COMPETITOR', aliases: ['Hero Vida'], colorHex: '#B91C1C' },
  { key: 'greaves', name: 'Greaves Electric Mobility', group: 'market', relation: 'COMPETITOR', aliases: ['Greaves Cotton'], colorHex: '#065F46' },
  { key: 'sarvam-ai', name: 'Sarvam AI', group: 'market', relation: 'COMPETITOR', aliases: [], colorHex: '#7C3AED' },
  { key: 'openai', name: 'OpenAI', group: 'market', relation: 'INDUSTRY', aliases: ['ChatGPT'], colorHex: '#0F172A' },
  { key: 'anthropic', name: 'Anthropic', group: 'market', relation: 'INDUSTRY', aliases: [], colorHex: '#B45309' },
  { key: 'nvidia', name: 'Nvidia', group: 'market', relation: 'PARTNER', aliases: ['NVIDIA'], colorHex: '#16A34A' },
  { key: 'reliance-jio', name: 'Reliance Jio', group: 'market', relation: 'INDUSTRY', aliases: ['JioBrain'], colorHex: '#1D4ED8' },
];

/** Free-form tracking terms and false-positive suppressors. */
export const KEYWORD_SEEDS: Array<{ term: string; type: 'TRACK' | 'EXCLUDE'; weight?: number; companyKey?: string }> = [
  { term: 'Ola Electric', type: 'TRACK', weight: 1.5, companyKey: 'ola-electric' },
  { term: 'Ola Cabs', type: 'TRACK', weight: 1.5, companyKey: 'ani-technologies' },
  { term: 'ANI Technologies', type: 'TRACK', weight: 1.5, companyKey: 'ani-technologies' },
  { term: 'Krutrim', type: 'TRACK', weight: 1.5, companyKey: 'krutrim' },
  { term: 'Bhavish Aggarwal', type: 'TRACK', weight: 1.4 },
  { term: 'electric two-wheeler', type: 'TRACK', weight: 0.7 },
  { term: 'ride-hailing', type: 'TRACK', weight: 0.7 },
  { term: 'EV subsidy', type: 'TRACK', weight: 0.8 },
  { term: 'PM E-DRIVE', type: 'TRACK', weight: 0.8 },
  { term: 'aggregator guidelines', type: 'TRACK', weight: 0.9 },
  { term: 'battery cell manufacturing', type: 'TRACK', weight: 0.7 },
  { term: 'Indic language model', type: 'TRACK', weight: 0.7 },
  // Suppress common false positives for the short token "Ola".
  { term: 'Ola Bini', type: 'EXCLUDE' },
  { term: 'Hola', type: 'EXCLUDE' },
  { term: 'Granola', type: 'EXCLUDE' },
];
