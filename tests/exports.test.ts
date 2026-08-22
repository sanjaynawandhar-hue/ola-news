import { describe, expect, it } from 'vitest';
import { renderNewsCard } from '@/lib/export/png-card';
import { buildBriefing } from '@/lib/export/pptx';
import { qrPngBuffer, qrDataUrl } from '@/lib/export/qr';
import { PNG_PRESETS, type PngPresetKey } from '@/lib/constants';
import { PPTX_THEMES } from '@/lib/export/theme';
import type { FeedArticle, RegulatoryItem } from '@/types';

const ARTICLE: FeedArticle = {
  id: 'a1',
  title: 'Ola Electric announces a recall of scooters after safety defect reports',
  description: 'The company said the affected batch will be replaced free of charge.',
  aiSummary: 'The manufacturer announced a voluntary recall covering a component batch, with free replacement for affected owners.',
  whyItMatters: 'Directly concerns Ola Electric. Flagged high risk on product recall; this warrants a same-day view from the responsible function.',
  url: 'https://example.com/news/recall',
  canonicalUrl: 'https://example.com/news/recall',
  publisher: 'Example Wire',
  sourceKey: 'example', sourceName: 'Example Wire', sourceType: 'NEWS', sourceMode: 'LIVE',
  sourceCredibility: 80,
  publishedAt: '2026-08-01T10:00:00.000Z',
  fetchedAt: '2026-08-01T11:00:00.000Z',
  language: 'en', country: 'IN', isDemo: false,
  companyKeys: ['ola-electric'], primaryCompanyKey: 'ola-electric',
  companyGroup: 'olaelectric', companyLabel: 'Ola Electric',
  categoryKey: 'safety-recalls', categoryLabel: 'Safety & recalls',
  topics: ['recall', 'safety defect'],
  sentiment: 'NEGATIVE', sentimentScore: -0.7, sentimentConfidence: 82,
  riskLevel: 'HIGH', riskScore: 56, riskDrivers: ['Product recall'],
  riskDimensions: { reputation: 10, financial: 5, operational: 45, legal: 0, regulatory: 0 },
  relevance: 100, confidence: 81, contentType: 'REPORTING',
  verification: 'CORROBORATED', corroboration: 3, importanceScore: 62, relatedCount: 2,
  clusterId: 'c1', bookmarked: false, important: true, engine: 'heuristic-v1', imageUrl: null,
};

const DEMO_ARTICLE: FeedArticle = { ...ARTICLE, id: 'a2', isDemo: true, publisher: 'Demo Business Wire' };

const REGULATORY: RegulatoryItem = {
  id: 'r1', authority: 'SEBI', companyKeys: ['ola-electric'],
  docType: 'CIRCULAR', docTypeLabel: 'Circular',
  title: 'Circular on continuous disclosure timelines for listed entities',
  summary: 'Revised timelines for disclosing material events under listing obligations.',
  whyItMatters: 'Shorter disclosure windows tighten the internal turnaround for board-approved announcements.',
  issueDate: '2026-07-20T00:00:00.000Z',
  effectiveDate: '2026-08-20T00:00:00.000Z',
  responseDeadline: '2026-08-10T00:00:00.000Z',
  severity: 'MEDIUM', status: 'OPEN',
  documentUrl: 'https://example.com/sebi/circular',
  isPrimaryDocument: true, isDemo: false,
  sourceName: 'SEBI', sourceMode: 'LIVE',
};

const BRANDING = {
  personalName: 'Test Executive',
  showPersonalBranding: true,
  logoPath: '/branding/ola-logo.svg',
  timezone: 'Asia/Kolkata',
};

/** PNG magic number. */
function isPng(buffer: Buffer): boolean {
  return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

/** A .pptx is a ZIP archive; "PK" is the local file header signature. */
function isZip(buffer: Buffer): boolean {
  return buffer[0] === 0x50 && buffer[1] === 0x4b;
}

describe('QR generation', () => {
  it('produces a real PNG buffer', async () => {
    const buffer = await qrPngBuffer('https://example.com/news/recall', 256);
    expect(isPng(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(200);
  });

  it('produces a data URL usable in PowerPoint', async () => {
    const dataUrl = await qrDataUrl('https://example.com/news/recall', 256);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('PNG card generation', () => {
  it.each(Object.keys(PNG_PRESETS) as PngPresetKey[])(
    'renders the %s preset at the expected dimensions',
    async (preset) => {
      const buffer = await renderNewsCard(ARTICLE, { ...BRANDING, preset });
      expect(isPng(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(5000);

      // PNG IHDR: width and height are big-endian uint32 at bytes 16 and 20.
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      const spec = PNG_PRESETS[preset];
      expect(width).toBe(spec.width * spec.scale);
      expect(height).toBe(spec.height * spec.scale);
    },
  );

  it('renders a demo article without throwing', async () => {
    const buffer = await renderNewsCard(DEMO_ARTICLE, { ...BRANDING, preset: 'email' });
    expect(isPng(buffer)).toBe(true);
  });

  it('renders when personal branding is hidden', async () => {
    const buffer = await renderNewsCard(ARTICLE, {
      ...BRANDING, preset: 'email', showPersonalBranding: false,
    });
    expect(isPng(buffer)).toBe(true);
  });

  it('falls back to the placeholder mark when the logo file is missing', async () => {
    const buffer = await renderNewsCard(ARTICLE, {
      ...BRANDING, preset: 'email', logoPath: '/branding/does-not-exist.png',
    });
    expect(isPng(buffer)).toBe(true);
  });

  it('handles an unusually long headline and empty analysis text', async () => {
    const buffer = await renderNewsCard(
      {
        ...ARTICLE,
        title: 'A '.repeat(120) + 'very long headline that must be truncated cleanly',
        aiSummary: '',
        whyItMatters: '',
      },
      { ...BRANDING, preset: 'email' },
    );
    expect(isPng(buffer)).toBe(true);
  });
});

describe('PowerPoint generation', () => {
  it('produces a real .pptx archive with the expected slide count', async () => {
    const { buffer, slideCount } = await buildBriefing({
      articles: [ARTICLE, DEMO_ARTICLE],
      regulatory: [REGULATORY],
      overview: null,
      options: {
        ...BRANDING,
        title: 'Daily Executive Briefing',
        subtitle: 'Test run',
        type: 'DAILY',
        theme: 'ola-light',
        template: 'standard',
        includeTrendSlide: false,
        includeComparisonSlide: false,
      },
    });

    expect(isZip(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(10000);
    // cover + executive summary + 2 stories + 1 regulatory + closing
    expect(slideCount).toBe(6);
  });

  it.each(Object.keys(PPTX_THEMES))('builds with the %s theme', async (theme) => {
    const { buffer } = await buildBriefing({
      articles: [ARTICLE],
      regulatory: [],
      overview: null,
      options: {
        ...BRANDING,
        title: 'Themed briefing', type: 'CUSTOM',
        theme: theme as keyof typeof PPTX_THEMES, template: 'standard',
        includeTrendSlide: false, includeComparisonSlide: false,
      },
    });
    expect(isZip(buffer)).toBe(true);
  });

  it('embeds native charts when overview data is supplied', async () => {
    const { buffer, slideCount } = await buildBriefing({
      articles: [ARTICLE],
      regulatory: [],
      overview: {
        totals: {
          all: 10, last24h: 3, last7d: 8, last30d: 10, positive: 4, neutral: 3,
          negative: 3, criticalAlerts: 1, highRisk: 2, regulatory: 1, demo: 0,
        },
        byGroup: [
          { group: 'ani', label: 'ANI', total: 4, last24h: 1, positive: 2, negative: 1, highRisk: 0, avgSentiment: 0.1 },
          { group: 'olaelectric', label: 'OE', total: 4, last24h: 1, positive: 1, negative: 2, highRisk: 2, avgSentiment: -0.2 },
          { group: 'krutrim', label: 'KR', total: 2, last24h: 1, positive: 1, negative: 0, highRisk: 0, avgSentiment: 0.3 },
        ],
        topPublishers: [], trendingTopics: [], emergingIssues: [], topExecutives: [],
        topProducts: [], geography: [], categories: [],
        volumeTrend: [
          { date: '2026-07-30', total: 3, positive: 1, neutral: 1, negative: 1, ani: 1, olaelectric: 1, krutrim: 1, market: 0 },
          { date: '2026-07-31', total: 4, positive: 2, neutral: 1, negative: 1, ani: 2, olaelectric: 1, krutrim: 1, market: 0 },
          { date: '2026-08-01', total: 3, positive: 1, neutral: 1, negative: 1, ani: 1, olaelectric: 2, krutrim: 0, market: 0 },
        ],
        volumeSpike: { ratio: 1.1, isSpike: false, recentCount: 3, baselinePerWindow: 2.7 },
        sourceHealth: { live: 12, demo: 1, disabled: 8, awaitingCredentials: 4, failing: 0 },
        lastRefreshAt: '2026-08-01T11:00:00.000Z',
      },
      options: {
        ...BRANDING,
        title: 'Charted briefing', type: 'WEEKLY', theme: 'ola-light', template: 'standard',
        includeTrendSlide: true, includeComparisonSlide: true,
      },
    });

    expect(isZip(buffer)).toBe(true);
    // cover + summary + trend + comparison + 1 story + closing
    expect(slideCount).toBe(6);

    // Chart parts prove the deck contains real editable charts, not images.
    const text = buffer.toString('latin1');
    expect(text).toContain('charts/chart');
  });

  it('builds a regulatory-only deck and skips the story-based summary slide', async () => {
    const { buffer, slideCount } = await buildBriefing({
      articles: [],
      regulatory: [REGULATORY],
      overview: null,
      options: {
        ...BRANDING,
        title: 'Regulatory briefing', type: 'REGULATORY', theme: 'executive-mono',
        template: 'standard', includeTrendSlide: false, includeComparisonSlide: false,
      },
    });
    expect(isZip(buffer)).toBe(true);
    expect(slideCount).toBe(3);
  });
});
