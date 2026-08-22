import { uniq } from '@/lib/utils';

export type EntityType = 'COMPANY' | 'BRAND' | 'PERSON' | 'PRODUCT' | 'LOCATION' | 'REGULATOR';

export interface EntityDefinition {
  type: EntityType;
  value: string;
  /** Stable key used to link back to the Company/Product/etc. row. */
  refKey: string;
  aliases: string[];
  /** Company group this entity belongs to, when applicable. */
  group?: string;
  companyKey?: string;
  weight?: number;
}

export interface EntityMatch {
  type: EntityType;
  value: string;
  refKey: string;
  companyKey?: string;
  group?: string;
  mentions: number;
  confidence: number;
  matchedAlias: string;
}

/** Regulators and authorities recognised without database configuration. */
export const REGULATOR_PATTERNS: Array<{ value: string; aliases: string[] }> = [
  { value: 'SEBI', aliases: ['sebi', 'securities and exchange board of india'] },
  { value: 'MoRTH', aliases: ['morth', 'ministry of road transport', 'road transport and highways'] },
  { value: 'BSE', aliases: ['bse', 'bombay stock exchange'] },
  { value: 'NSE', aliases: ['nse', 'national stock exchange'] },
  { value: 'MCA', aliases: ['mca', 'ministry of corporate affairs', 'registrar of companies', 'roc'] },
  { value: 'PIB', aliases: ['pib', 'press information bureau'] },
  { value: 'CCI', aliases: ['cci', 'competition commission of india'] },
  { value: 'CCPA', aliases: ['ccpa', 'central consumer protection authority', 'consumer protection authority'] },
  { value: 'ARAI', aliases: ['arai', 'automotive research association of india'] },
  { value: 'MHI', aliases: ['ministry of heavy industries', 'heavy industries ministry', 'fame', 'pm e-drive'] },
  { value: 'MeitY', aliases: ['meity', 'ministry of electronics and information technology'] },
  { value: 'RBI', aliases: ['rbi', 'reserve bank of india'] },
  { value: 'NCLT', aliases: ['nclt', 'national company law tribunal'] },
  { value: 'NCLAT', aliases: ['nclat', 'national company law appellate tribunal'] },
  { value: 'Supreme Court', aliases: ['supreme court'] },
  { value: 'High Court', aliases: ['high court'] },
  { value: 'CDSCO/Consumer Court', aliases: ['consumer court', 'consumer forum', 'consumer commission'] },
  { value: 'Income Tax Department', aliases: ['income tax department', 'i-t department', 'cbdt'] },
  { value: 'GST Authority', aliases: ['gst council', 'dgst', 'gst authority', 'dggi'] },
  { value: 'State Transport Authority', aliases: ['state transport authority', 'rto', 'transport department'] },
];

export const LOCATION_PATTERNS: string[] = [
  'India', 'Bengaluru', 'Bangalore', 'Mumbai', 'Delhi', 'New Delhi', 'Chennai', 'Hyderabad',
  'Pune', 'Kolkata', 'Ahmedabad', 'Gurugram', 'Noida', 'Tamil Nadu', 'Karnataka', 'Maharashtra',
  'Krishnagiri', 'United States', 'United Kingdom', 'Singapore', 'Japan', 'China', 'Europe',
  'United Arab Emirates', 'Australia',
];

/** Word-boundary-safe alias match. Aliases may contain spaces, dots and hyphens. */
export function countMentions(haystack: string, alias: string): number {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
  return (haystack.match(pattern) ?? []).length;
}

/**
 * Extracts configured entities plus built-in regulators and locations from a
 * headline + description. Confidence reflects how specific the matched alias is
 * — a short ambiguous alias such as "Ola" scores lower than "Ola Electric".
 */
export function extractEntities(text: string, definitions: EntityDefinition[]): EntityMatch[] {
  const haystack = ` ${text} `;
  const matches = new Map<string, EntityMatch>();

  const record = (match: EntityMatch) => {
    const key = `${match.type}:${match.refKey}`;
    const existing = matches.get(key);
    if (!existing || match.confidence > existing.confidence) {
      matches.set(key, {
        ...match,
        mentions: (existing?.mentions ?? 0) + match.mentions,
      });
    } else {
      existing.mentions += match.mentions;
    }
  };

  for (const definition of definitions) {
    const aliases = uniq([definition.value, ...definition.aliases].filter(Boolean));
    let total = 0;
    let bestAlias = '';
    let bestSpecificity = 0;
    for (const alias of aliases) {
      if (alias.length < 3) continue;
      const count = countMentions(haystack, alias);
      if (count === 0) continue;
      total += count;
      const specificity = aliasSpecificity(alias);
      if (specificity > bestSpecificity) {
        bestSpecificity = specificity;
        bestAlias = alias;
      }
    }
    if (total > 0) {
      record({
        type: definition.type,
        value: definition.value,
        refKey: definition.refKey,
        companyKey: definition.companyKey,
        group: definition.group,
        mentions: total,
        confidence: Math.min(97, 45 + bestSpecificity + Math.min(15, total * 4)),
        matchedAlias: bestAlias,
      });
    }
  }

  for (const regulator of REGULATOR_PATTERNS) {
    let total = 0;
    let bestAlias = '';
    for (const alias of regulator.aliases) {
      const count = countMentions(haystack, alias);
      if (count > 0) {
        total += count;
        if (alias.length > bestAlias.length) bestAlias = alias;
      }
    }
    if (total > 0) {
      record({
        type: 'REGULATOR',
        value: regulator.value,
        refKey: regulator.value,
        mentions: total,
        confidence: Math.min(95, 60 + total * 6),
        matchedAlias: bestAlias,
      });
    }
  }

  for (const location of LOCATION_PATTERNS) {
    const count = countMentions(haystack, location);
    if (count > 0) {
      record({
        type: 'LOCATION',
        value: location,
        refKey: location,
        mentions: count,
        confidence: 70,
        matchedAlias: location,
      });
    }
  }

  return Array.from(matches.values()).sort((a, b) => b.mentions - a.mentions);
}

/** Longer, multi-word aliases are far less likely to be a coincidental match. */
function aliasSpecificity(alias: string): number {
  const words = alias.trim().split(/\s+/).length;
  return Math.min(45, words * 12 + Math.min(12, Math.floor(alias.length / 4)));
}
