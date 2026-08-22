import { describe, expect, it } from 'vitest';
import { EXPORT_THEME, PPTX_THEMES } from '@/lib/export/theme';
import { PNG_PRESETS, SETTING_KEYS, DEFAULT_TIMEZONE, RISK_RANK } from '@/lib/constants';
import { formatDate, formatDateTime, formatTimeZoneAbbr, dayKey, relativeTime } from '@/lib/time';
import {
  aggregatorOf, canonicalizeUrl, clamp, hammingDistance, jaccard, linkAttribution, slugify, truncate,
} from '@/lib/utils';

describe('branding configuration', () => {
  it('exposes every PNG export size the product promises', () => {
    // Email, WhatsApp, executive report and presentation use are all required.
    expect(Object.keys(PNG_PRESETS).sort()).toEqual(
      ['email', 'presentation', 'report', 'square', 'whatsapp'].sort(),
    );
    for (const preset of Object.values(PNG_PRESETS)) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      // Every preset renders at 2x for a high-resolution export.
      expect(preset.scale).toBeGreaterThanOrEqual(2);
    }
  });

  it('renders WhatsApp and report presets in portrait, presentation in 16:9', () => {
    expect(PNG_PRESETS.whatsapp.height).toBeGreaterThan(PNG_PRESETS.whatsapp.width);
    expect(PNG_PRESETS.report.height).toBeGreaterThan(PNG_PRESETS.report.width);
    expect(PNG_PRESETS.presentation.width / PNG_PRESETS.presentation.height).toBeCloseTo(16 / 9, 2);
  });

  it('defines a consistent accent across PNG and PPTX exports', () => {
    // The PPTX theme stores colours without the leading '#'.
    expect(`#${PPTX_THEMES['ola-light'].accent}`.toUpperCase()).toBe(
      EXPORT_THEME.ola.green.toUpperCase(),
    );
  });

  it('provides a sentiment and risk colour for every level', () => {
    for (const label of ['POSITIVE', 'NEUTRAL', 'NEGATIVE']) {
      expect(EXPORT_THEME.sentiment[label]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    for (const level of Object.keys(RISK_RANK)) {
      expect(EXPORT_THEME.risk[level]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('offers light, dark and mono deck themes with complete palettes', () => {
    expect(Object.keys(PPTX_THEMES)).toEqual(['ola-light', 'ola-dark', 'executive-mono']);
    for (const theme of Object.values(PPTX_THEMES)) {
      for (const key of ['background', 'surface', 'text', 'muted', 'accent', 'line'] as const) {
        expect(theme[key]).toMatch(/^[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('names a settings key for each configurable branding value', () => {
    expect(SETTING_KEYS.brandName).toBeTruthy();
    expect(SETTING_KEYS.showPersonalBranding).toBeTruthy();
    expect(SETTING_KEYS.logoPath).toBeTruthy();
    expect(SETTING_KEYS.timezone).toBeTruthy();
    // Keys must be unique so one setting cannot silently overwrite another.
    const values = Object.values(SETTING_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('timezone handling', () => {
  const instant = '2026-08-01T18:30:00.000Z'; // midnight IST on 2 August

  it('defaults to Indian Standard Time', () => {
    expect(DEFAULT_TIMEZONE).toBe('Asia/Kolkata');
    expect(formatTimeZoneAbbr()).toBe('IST');
  });

  it('renders the same instant differently per timezone', () => {
    const ist = formatDateTime(instant, 'Asia/Kolkata');
    const utc = formatDateTime(instant, 'UTC');
    expect(ist).not.toBe(utc);
    expect(ist).toContain('02 Aug 2026');
    expect(utc).toContain('01 Aug 2026');
  });

  it('buckets trend days in the display timezone', () => {
    expect(dayKey(instant, 'Asia/Kolkata')).toBe('2026-08-02');
    expect(dayKey(instant, 'UTC')).toBe('2026-08-01');
  });

  it('formats a date without a time component', () => {
    expect(formatDate(instant, 'Asia/Kolkata')).toBe('02 Aug 2026');
  });

  it('renders a dash for missing or invalid values instead of throwing', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('nonsense')).toBe('—');
    expect(formatDate(null)).toBe('—');
    expect(relativeTime(null)).toBe('—');
  });

  it('produces sensible relative times', () => {
    const now = new Date('2026-08-01T12:00:00Z');
    expect(relativeTime('2026-08-01T09:00:00Z', now)).toContain('hour');
    expect(relativeTime('2026-07-25T12:00:00Z', now)).toContain('day');
    expect(relativeTime('2026-08-01T11:59:30Z', now)).toBe('just now');
  });

  it('falls back gracefully for an unknown timezone abbreviation', () => {
    expect(formatTimeZoneAbbr('Not/AZone')).toBe('Not/AZone');
  });
});

describe('filtering and display helpers', () => {
  it('slugifies titles for export filenames', () => {
    expect(slugify('Ola Electric: recall & safety!')).toBe('ola-electric-recall-safety');
    expect(slugify('   ')).toBe('');
  });

  it('truncates on a word boundary with an ellipsis', () => {
    const result = truncate('The quick brown fox jumps over the lazy dog', 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
    // Short strings are returned untouched.
    expect(truncate('short', 20)).toBe('short');
  });

  it('clamps scores into range', () => {
    expect(clamp(150)).toBe(100);
    expect(clamp(-10)).toBe(0);
    expect(clamp(42)).toBe(42);
  });

  it('computes Jaccard similarity', () => {
    expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
    expect(jaccard(['a', 'b'], ['c', 'd'])).toBe(0);
    expect(jaccard([], ['a'])).toBe(0);
  });

  it('computes Hamming distance over hex fingerprints', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000001', '0000000000000000')).toBe(1);
    // Mismatched lengths are treated as maximally distant rather than throwing.
    expect(hammingDistance('abc', '0000000000000000')).toBe(64);
  });

  it('canonicalises URLs so the same article de-duplicates across feeds', () => {
    const a = canonicalizeUrl('https://www.example.com/story?utm_source=rss&id=1');
    const b = canonicalizeUrl('http://example.com/story?id=1#section');
    expect(a).toBe(b);
  });

  it('leaves an unparseable URL untouched rather than throwing', () => {
    expect(canonicalizeUrl('not a url')).toBe('not a url');
  });

  it('orders risk levels correctly for threshold filters', () => {
    expect(RISK_RANK.CRITICAL).toBeGreaterThan(RISK_RANK.HIGH);
    expect(RISK_RANK.HIGH).toBeGreaterThan(RISK_RANK.MEDIUM);
    expect(RISK_RANK.MEDIUM).toBeGreaterThan(RISK_RANK.LOW);
    expect(RISK_RANK.LOW).toBeGreaterThan(RISK_RANK.NONE);
  });
});

describe('link attribution', () => {
  it('describes an aggregator redirect by its aggregator, not the blob URL', () => {
    const googleLink =
      'https://news.google.com/rss/articles/CBMiwgFBVV95cUxQcm5GQkRyTkNLMzgwT2ctWHRrMEx';
    expect(aggregatorOf(googleLink)).toBe('Google News');
    expect(linkAttribution(googleLink)).toBe('via Google News');
  });

  it('shows the publisher domain for a direct link', () => {
    expect(aggregatorOf('https://www.cnbctv18.com/auto/story')).toBeNull();
    expect(linkAttribution('https://www.cnbctv18.com/auto/story')).toBe('cnbctv18.com/auto/story');
  });

  it('truncates a long path rather than overflowing the card', () => {
    const long = 'https://example.com/' + 'segment/'.repeat(20);
    expect(linkAttribution(long).length).toBeLessThanOrEqual(50);
  });

  it('does not throw on an unparseable URL', () => {
    expect(() => linkAttribution('not a url')).not.toThrow();
  });
});
