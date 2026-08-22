/**
 * Shared visual tokens for generated assets (PNG cards and PPTX slides) so an
 * exported card and an exported slide look like the same product.
 *
 * The green accent is an Ola-inspired brand green chosen for this dashboard —
 * it is not sampled from, and does not reproduce, any protected brand asset.
 */
export const EXPORT_THEME = {
  ola: {
    green: '#0BA860',
    greenDark: '#087A45',
    greenDeep: '#0B3D2C',
    greenSoft: '#E8F7F0',
    charcoal: '#1A1D21',
    slate: '#3F464E',
    muted: '#6B7280',
    line: '#E3E7EA',
    white: '#FFFFFF',
    offWhite: '#F7F9F8',
  },
  sentiment: {
    POSITIVE: '#0F9D58',
    NEUTRAL: '#6B7280',
    NEGATIVE: '#D93025',
  } as Record<string, string>,
  risk: {
    NONE: '#6B7280',
    LOW: '#0F9D58',
    MEDIUM: '#E8A33D',
    HIGH: '#EE6C1F',
    CRITICAL: '#D93025',
  } as Record<string, string>,
  dark: {
    background: '#0F1512',
    surface: '#161D19',
    text: '#F2F5F3',
    muted: '#9AA5A0',
    line: '#26312B',
  },
};

export const PPTX_THEMES = {
  'ola-light': {
    key: 'ola-light',
    label: 'Ola Light',
    background: 'FFFFFF',
    surface: 'F7F9F8',
    text: '1A1D21',
    muted: '6B7280',
    accent: '0BA860',
    accentDark: '087A45',
    line: 'E3E7EA',
  },
  'ola-dark': {
    key: 'ola-dark',
    label: 'Ola Dark',
    background: '0F1512',
    surface: '161D19',
    text: 'F2F5F3',
    muted: '9AA5A0',
    accent: '18C878',
    accentDark: '0BA860',
    line: '26312B',
  },
  'executive-mono': {
    key: 'executive-mono',
    label: 'Executive Mono',
    background: 'FFFFFF',
    surface: 'F2F3F5',
    text: '15181C',
    muted: '5C636B',
    accent: '0B3D2C',
    accentDark: '062418',
    line: 'DDE1E5',
  },
} as const;

export type PptxThemeKey = keyof typeof PPTX_THEMES;
