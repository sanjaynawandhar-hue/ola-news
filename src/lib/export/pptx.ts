import PptxGenJS from 'pptxgenjs';
import { PPTX_THEMES, type PptxThemeKey } from './theme';
import { qrDataUrl } from './qr';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COMPANY_GROUP_LABELS,
  VERIFICATION_LABELS,
  type CompanyGroup,
  type VerificationStatus,
} from '@/lib/constants';
import { formatDate, formatDateTime, formatTimeZoneAbbr } from '@/lib/time';
import { linkAttribution, truncate } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import type { FeedArticle, RegulatoryItem } from '@/types';
import type { OverviewMetrics } from '@/lib/queries';

const log = createLogger('pptx');

/**
 * Generates a real .pptx file with native, editable PowerPoint elements —
 * text boxes, shapes, tables and native charts. Nothing is a screenshot, and
 * every source link stays clickable in the deck.
 */

export interface BriefingOptions {
  title: string;
  subtitle?: string;
  type: string;
  theme: PptxThemeKey;
  template: string;
  personalName: string;
  showPersonalBranding: boolean;
  logoPath: string;
  timezone: string;
  includeTrendSlide?: boolean;
  includeComparisonSlide?: boolean;
  includeExecutiveSummary?: boolean;
}

export interface BriefingInput {
  articles: FeedArticle[];
  regulatory?: RegulatoryItem[];
  overview?: OverviewMetrics | null;
  options: BriefingOptions;
}

const W = 13.333; // 16:9 slide width in inches
const H = 7.5;
const MARGIN = 0.55;

export async function buildBriefing(input: BriefingInput): Promise<{ buffer: Buffer; slideCount: number }> {
  const { articles, regulatory = [], overview = null, options } = input;
  const theme = PPTX_THEMES[options.theme] ?? PPTX_THEMES['ola-light'];

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Ola News';
  pptx.company = 'Ola News — executive news intelligence';
  pptx.title = options.title;
  pptx.subject = options.subtitle ?? 'News intelligence briefing';

  const logo = await loadLogoDataUrl(options.logoPath);
  let slideCount = 0;

  addCoverSlide(pptx, theme, options, logo, articles.length, regulatory.length);
  slideCount++;

  // The executive summary is built from the story list, so it is skipped for a
  // regulatory-only deck rather than rendering empty tiles and a blank table.
  if (options.includeExecutiveSummary !== false && articles.length > 0) {
    addExecutiveSummarySlide(pptx, theme, options, logo, articles, overview);
    slideCount++;
  }

  if (options.includeTrendSlide !== false && overview?.volumeTrend?.length) {
    addTrendSlide(pptx, theme, options, logo, overview);
    slideCount++;
  }

  if (options.includeComparisonSlide !== false && overview?.byGroup?.length) {
    addComparisonSlide(pptx, theme, options, logo, overview);
    slideCount++;
  }

  for (const article of articles) {
    await addStorySlide(pptx, theme, options, logo, article);
    slideCount++;
  }

  for (const document of regulatory) {
    await addRegulatorySlide(pptx, theme, options, logo, document);
    slideCount++;
  }

  addClosingSlide(pptx, theme, options, logo, articles, regulatory);
  slideCount++;

  const data = (await pptx.write({ outputType: 'nodebuffer' })) as Buffer;
  return { buffer: Buffer.from(data), slideCount };
}

type Theme = (typeof PPTX_THEMES)[PptxThemeKey];

// --------------------------------------------------------------------------
// Slide templates
// --------------------------------------------------------------------------

function addCoverSlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, storyCount: number, regulatoryCount: number,
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  slide.addShape('rect', { x: 0, y: 0, w: 0.16, h: H, fill: { color: theme.accent } });
  slide.addShape('rect', { x: W - 4.4, y: 0, w: 4.4, h: H, fill: { color: theme.surface } });

  if (logo) slide.addImage({ data: logo, x: MARGIN, y: 0.5, w: 0.85, h: 0.85 });

  slide.addText('OLA NEWS', {
    x: logo ? MARGIN + 1.05 : MARGIN, y: 0.6, w: 4, h: 0.4,
    fontSize: 20, bold: true, color: theme.accent, charSpacing: 2,
  });
  slide.addText('Executive news intelligence', {
    x: logo ? MARGIN + 1.05 : MARGIN, y: 1.0, w: 5, h: 0.3,
    fontSize: 11, color: theme.muted,
  });

  slide.addText(options.title, {
    x: MARGIN, y: 2.35, w: W - 5.4, h: 1.6,
    fontSize: 40, bold: true, color: theme.text, lineSpacingMultiple: 0.92,
  });

  if (options.subtitle) {
    slide.addText(options.subtitle, {
      x: MARGIN, y: 4.05, w: W - 5.4, h: 0.8, fontSize: 15, color: theme.muted,
    });
  }

  slide.addShape('rect', { x: MARGIN, y: 5.05, w: 2.2, h: 0.05, fill: { color: theme.accent } });

  slide.addText(
    `${formatDateTime(new Date(), options.timezone)} ${formatTimeZoneAbbr(options.timezone)}`,
    { x: MARGIN, y: 5.35, w: 5, h: 0.35, fontSize: 12, color: theme.muted },
  );

  const stats: Array<[string, string]> = [
    [String(storyCount), 'Stories in this briefing'],
    [String(regulatoryCount), 'Regulatory items'],
  ];
  stats.forEach(([value, label], index) => {
    const y = 2.4 + index * 1.5;
    slide.addText(value, {
      x: W - 3.9, y, w: 3.2, h: 0.8, fontSize: 44, bold: true, color: theme.accent,
    });
    slide.addText(label, {
      x: W - 3.9, y: y + 0.82, w: 3.2, h: 0.4, fontSize: 11, color: theme.muted,
    });
  });

  addFooter(slide, theme, options, 'Cover');
}

function addExecutiveSummarySlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, articles: FeedArticle[], overview: OverviewMetrics | null,
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addSlideHeader(slide, theme, options, logo, 'Executive summary');

  const highRisk = articles.filter((a) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL');
  const negative = articles.filter((a) => a.sentiment === 'NEGATIVE');
  const positive = articles.filter((a) => a.sentiment === 'POSITIVE');

  const tiles: Array<{ value: string; label: string; color: string }> = [
    { value: String(overview?.totals.last24h ?? articles.length), label: 'Stories · last 24h', color: theme.accent },
    { value: String(highRisk.length), label: 'High / critical risk', color: 'D93025' },
    { value: String(positive.length), label: 'Positive stories', color: '0F9D58' },
    { value: String(negative.length), label: 'Negative stories', color: 'EE6C1F' },
  ];

  tiles.forEach((tile, index) => {
    const x = MARGIN + index * 3.07;
    slide.addShape('roundRect', {
      x, y: 1.35, w: 2.85, h: 1.35,
      fill: { color: theme.surface }, line: { color: theme.line, width: 0.75 }, rectRadius: 0.08,
    });
    slide.addText(tile.value, { x: x + 0.2, y: 1.5, w: 2.4, h: 0.6, fontSize: 30, bold: true, color: tile.color });
    slide.addText(tile.label, { x: x + 0.2, y: 2.1, w: 2.5, h: 0.4, fontSize: 10, color: theme.muted });
  });

  slide.addText('Leading stories', {
    x: MARGIN, y: 2.95, w: 6, h: 0.35, fontSize: 14, bold: true, color: theme.text,
  });

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: 'Headline', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
      { text: 'Company', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
      { text: 'Risk', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
      { text: 'Sentiment', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
    ],
    ...articles.slice(0, 8).map((article) => [
      { text: truncate(article.title, 96), options: { color: theme.text } },
      { text: article.companyLabel ?? '—', options: { color: theme.muted } },
      { text: article.riskLevel, options: { color: riskColor(article.riskLevel) } },
      { text: article.sentiment, options: { color: sentimentColor(article.sentiment) } },
    ]),
  ];

  slide.addTable(rows, {
    x: MARGIN, y: 3.35, w: W - MARGIN * 2,
    colW: [7.0, 2.5, 1.35, 1.37],
    fontSize: 10, border: { type: 'solid', color: theme.line, pt: 0.5 },
    rowH: 0.32, valign: 'middle', autoPage: false,
  });

  addFooter(slide, theme, options, 'Executive summary');
}

function addTrendSlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, overview: OverviewMetrics,
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addSlideHeader(slide, theme, options, logo, 'News volume & sentiment trend');

  const points = overview.volumeTrend.slice(-30);
  const labels = points.map((p) => p.date.slice(5));

  // Native PowerPoint chart — fully editable in the deck, not an image.
  slide.addChart(
    'line',
    [
      { name: 'Total stories', labels, values: points.map((p) => p.total) },
      { name: 'Negative', labels, values: points.map((p) => p.negative) },
      { name: 'Positive', labels, values: points.map((p) => p.positive) },
    ],
    {
      x: MARGIN, y: 1.35, w: W - MARGIN * 2, h: 4.6,
      chartColors: [theme.accent, 'D93025', '0F9D58'],
      showLegend: true, legendPos: 'b', legendColor: theme.muted,
      catAxisLabelColor: theme.muted, valAxisLabelColor: theme.muted,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      lineSmooth: true, lineDataSymbol: 'none', lineSize: 2,
      valGridLine: { color: theme.line, style: 'solid', size: 0.5 },
      catGridLine: { style: 'none' },
      plotArea: { fill: { color: theme.background } },
    },
  );

  slide.addText(
    overview.volumeSpike.isSpike
      ? `Coverage volume is ${overview.volumeSpike.ratio}× the recent baseline (${overview.volumeSpike.recentCount} stories in the last 24h vs a baseline of ${overview.volumeSpike.baselinePerWindow}).`
      : `Coverage volume is within the normal range (${overview.volumeSpike.ratio}× baseline).`,
    { x: MARGIN, y: 6.05, w: W - MARGIN * 2, h: 0.4, fontSize: 11, color: theme.muted, italic: true },
  );

  addFooter(slide, theme, options, 'Trend');
}

function addComparisonSlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, overview: OverviewMetrics,
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addSlideHeader(slide, theme, options, logo, 'Company comparison');

  const groups = overview.byGroup.filter((g) => g.group !== 'market');
  const labels = groups.map((g) => COMPANY_GROUP_LABELS[g.group as CompanyGroup]);

  slide.addChart(
    'bar',
    [
      { name: 'Positive', labels, values: groups.map((g) => g.positive) },
      { name: 'Negative', labels, values: groups.map((g) => g.negative) },
      { name: 'High / critical risk', labels, values: groups.map((g) => g.highRisk) },
    ],
    {
      x: MARGIN, y: 1.35, w: 7.6, h: 4.7,
      barDir: 'col', barGrouping: 'clustered',
      chartColors: ['0F9D58', 'D93025', 'EE6C1F'],
      showLegend: true, legendPos: 'b', legendColor: theme.muted,
      catAxisLabelColor: theme.muted, valAxisLabelColor: theme.muted,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 9,
      valGridLine: { color: theme.line, style: 'solid', size: 0.5 },
      plotArea: { fill: { color: theme.background } },
    },
  );

  const rows: PptxGenJS.TableRow[] = [
    [
      { text: 'Group', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
      { text: 'Stories', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
      { text: '24h', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
      { text: 'Avg sentiment', options: { bold: true, color: theme.background, fill: { color: theme.accent } } },
    ],
    ...overview.byGroup.map((group) => [
      { text: COMPANY_GROUP_LABELS[group.group as CompanyGroup], options: { color: theme.text } },
      { text: String(group.total), options: { color: theme.muted } },
      { text: String(group.last24h), options: { color: theme.muted } },
      { text: group.avgSentiment.toFixed(2), options: { color: group.avgSentiment < 0 ? 'D93025' : '0F9D58' } },
    ]),
  ];

  slide.addTable(rows, {
    x: 8.4, y: 1.35, w: W - 8.4 - MARGIN,
    colW: [1.85, 0.85, 0.65, 1.05],
    fontSize: 9.5, border: { type: 'solid', color: theme.line, pt: 0.5 },
    rowH: 0.34, valign: 'middle',
  });

  addFooter(slide, theme, options, 'Company comparison');
}

/**
 * Story slide. The template is selected from the story's own risk and sentiment
 * so a crisis item reads differently from a positive announcement.
 */
async function addStorySlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, article: FeedArticle,
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };

  const isRisk = article.riskLevel === 'HIGH' || article.riskLevel === 'CRITICAL';
  const isPositive = !isRisk && article.sentiment === 'POSITIVE';
  const accent = isRisk ? riskColor(article.riskLevel) : isPositive ? '0F9D58' : theme.accent;
  const templateLabel = isRisk ? 'Risk alert' : isPositive ? 'Positive announcement' : 'News';

  slide.addShape('rect', { x: 0, y: 0, w: W, h: 0.09, fill: { color: accent } });
  addSlideHeader(slide, theme, options, logo, templateLabel, accent);

  if (article.isDemo) {
    slide.addShape('roundRect', {
      x: W - 3.1, y: 0.42, w: 2.55, h: 0.34,
      fill: { color: 'FEF3C7' }, line: { color: 'B45309', width: 0.75 }, rectRadius: 0.05,
    });
    slide.addText('DEMO DATA — NOT LIVE NEWS', {
      x: W - 3.1, y: 0.42, w: 2.55, h: 0.34, fontSize: 8.5, bold: true, color: 'B45309', align: 'center', valign: 'middle',
    });
  }

  // Metadata chips.
  const chips = [
    { text: article.companyLabel ?? 'Ola portfolio', color: theme.accent },
    { text: article.categoryLabel, color: theme.muted },
    { text: `Sentiment: ${article.sentiment}`, color: sentimentColor(article.sentiment) },
    { text: `Risk: ${article.riskLevel}`, color: riskColor(article.riskLevel) },
  ];
  let chipX = MARGIN;
  for (const chip of chips) {
    const width = Math.min(3.2, 0.16 + chip.text.length * 0.078);
    slide.addShape('roundRect', {
      x: chipX, y: 1.2, w: width, h: 0.32,
      fill: { color: theme.surface }, line: { color: theme.line, width: 0.5 }, rectRadius: 0.06,
    });
    slide.addText(chip.text, {
      x: chipX, y: 1.2, w: width, h: 0.32,
      fontSize: 9, bold: true, color: chip.color, align: 'center', valign: 'middle',
    });
    chipX += width + 0.12;
  }

  // Original publisher headline, verbatim.
  slide.addText(article.title, {
    x: MARGIN, y: 1.72, w: W - MARGIN * 2 - 2.5, h: 1.15,
    fontSize: article.title.length > 110 ? 20 : 24, bold: true, color: theme.text,
    lineSpacingMultiple: 0.95, valign: 'top',
  });

  slide.addText('AI SUMMARY · MACHINE-GENERATED', {
    x: MARGIN, y: 3.0, w: 5, h: 0.25, fontSize: 8.5, bold: true, color: theme.accent, charSpacing: 1,
  });
  slide.addText(truncate(article.aiSummary || article.description || '—', 520), {
    x: MARGIN, y: 3.26, w: W - MARGIN * 2 - 2.5, h: 1.25,
    fontSize: 12, color: theme.text, lineSpacingMultiple: 1.0, valign: 'top',
  });

  slide.addShape('roundRect', {
    x: MARGIN, y: 4.6, w: W - MARGIN * 2 - 2.5, h: 1.5,
    fill: { color: theme.surface }, line: { color: theme.line, width: 0.5 }, rectRadius: 0.08,
  });
  slide.addText('WHY THIS MATTERS · ANALYST VIEW', {
    x: MARGIN + 0.18, y: 4.72, w: 5, h: 0.25, fontSize: 8.5, bold: true, color: accent, charSpacing: 1,
  });
  slide.addText(truncate(article.whyItMatters || '—', 480), {
    x: MARGIN + 0.18, y: 4.98, w: W - MARGIN * 2 - 2.9, h: 1.05,
    fontSize: 11, color: theme.text, valign: 'top',
  });

  // Right rail: QR + provenance.
  const railX = W - MARGIN - 2.2;
  try {
    const qr = await qrDataUrl(article.canonicalUrl || article.url, 512);
    slide.addImage({ data: qr, x: railX + 0.55, y: 1.72, w: 1.1, h: 1.1 });
    slide.addText('Scan for original', {
      x: railX, y: 2.85, w: 2.2, h: 0.24, fontSize: 8, color: theme.muted, align: 'center',
    });
  } catch (error) {
    log.warn('qr failed for slide', { error: error instanceof Error ? error.message : 'unknown' });
  }

  const meta: Array<[string, string]> = [
    ['Publisher', article.publisher],
    ['Published', formatDate(article.publishedAt, options.timezone)],
    ['Verification', VERIFICATION_LABELS[article.verification as VerificationStatus] ?? article.verification],
    ['Confidence', `${article.confidence}%`],
    ['Relevance', `${article.relevance}%`],
    ['Related stories', String(article.relatedCount)],
  ];
  meta.forEach(([label, value], index) => {
    const y = 3.2 + index * 0.42;
    slide.addText(label.toUpperCase(), {
      x: railX, y, w: 2.2, h: 0.18, fontSize: 7.5, color: theme.muted, charSpacing: 0.8,
    });
    slide.addText(truncate(value, 34), {
      x: railX, y: y + 0.17, w: 2.2, h: 0.22, fontSize: 9.5, bold: true, color: theme.text,
    });
  });

  // Clickable original-source link, preserved in the exported deck.
  slide.addText(
    [{ text: `Open original source · ${linkAttribution(article.canonicalUrl || article.url)}`, options: { hyperlink: { url: article.canonicalUrl || article.url, tooltip: article.title } } }],
    { x: MARGIN, y: 6.25, w: W - MARGIN * 2 - 2.5, h: 0.3, fontSize: 10, color: theme.accent, underline: { style: 'sng' } },
  );

  addFooter(slide, theme, options, templateLabel);
}

async function addRegulatorySlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, document: RegulatoryItem,
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  const accent = severityColor(document.severity);

  slide.addShape('rect', { x: 0, y: 0, w: W, h: 0.09, fill: { color: accent } });
  addSlideHeader(slide, theme, options, logo, 'Regulatory update', accent);

  slide.addShape('roundRect', {
    x: MARGIN, y: 1.2, w: 1.7, h: 0.38,
    fill: { color: accent }, rectRadius: 0.06,
  });
  slide.addText(document.authority, {
    x: MARGIN, y: 1.2, w: 1.7, h: 0.38,
    fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
  });
  slide.addText(`${document.docTypeLabel} · Severity ${document.severity} · Status ${document.status}`, {
    x: MARGIN + 1.85, y: 1.2, w: 6, h: 0.38, fontSize: 10.5, color: theme.muted, valign: 'middle',
  });

  slide.addText(document.title, {
    x: MARGIN, y: 1.75, w: W - MARGIN * 2 - 2.5, h: 1.0,
    fontSize: 22, bold: true, color: theme.text, lineSpacingMultiple: 0.95,
  });

  slide.addText('SUMMARY', {
    x: MARGIN, y: 2.9, w: 4, h: 0.24, fontSize: 8.5, bold: true, color: accent, charSpacing: 1,
  });
  slide.addText(truncate(document.summary, 520), {
    x: MARGIN, y: 3.15, w: W - MARGIN * 2 - 2.5, h: 1.2, fontSize: 12, color: theme.text, valign: 'top',
  });

  slide.addShape('roundRect', {
    x: MARGIN, y: 4.45, w: W - MARGIN * 2 - 2.5, h: 1.35,
    fill: { color: theme.surface }, line: { color: theme.line, width: 0.5 }, rectRadius: 0.08,
  });
  slide.addText('WHY THIS MATTERS · ANALYST VIEW', {
    x: MARGIN + 0.18, y: 4.57, w: 5, h: 0.24, fontSize: 8.5, bold: true, color: accent, charSpacing: 1,
  });
  slide.addText(truncate(document.whyItMatters ?? '—', 420), {
    x: MARGIN + 0.18, y: 4.82, w: W - MARGIN * 2 - 2.9, h: 0.9, fontSize: 11, color: theme.text, valign: 'top',
  });

  const railX = W - MARGIN - 2.2;
  try {
    const qr = await qrDataUrl(document.documentUrl, 512);
    slide.addImage({ data: qr, x: railX + 0.55, y: 1.75, w: 1.1, h: 1.1 });
    slide.addText('Scan for official document', {
      x: railX, y: 2.88, w: 2.2, h: 0.3, fontSize: 8, color: theme.muted, align: 'center',
    });
  } catch {
    /* QR is optional; the link below is always present. */
  }

  const dates: Array<[string, string]> = [
    ['Issue date', formatDate(document.issueDate, options.timezone)],
    ['Effective date', document.effectiveDate ? formatDate(document.effectiveDate, options.timezone) : '—'],
    ['Response deadline', document.responseDeadline ? formatDate(document.responseDeadline, options.timezone) : '—'],
    ['Document type', document.isPrimaryDocument ? 'Official primary document' : 'Secondary reporting'],
  ];
  dates.forEach(([label, value], index) => {
    const y = 3.3 + index * 0.5;
    slide.addText(label.toUpperCase(), { x: railX, y, w: 2.2, h: 0.2, fontSize: 7.5, color: theme.muted, charSpacing: 0.8 });
    slide.addText(value, { x: railX, y: y + 0.19, w: 2.2, h: 0.24, fontSize: 9.5, bold: true, color: theme.text });
  });

  slide.addText(
    [{ text: `Open official document · ${linkAttribution(document.documentUrl)}`, options: { hyperlink: { url: document.documentUrl, tooltip: document.title } } }],
    { x: MARGIN, y: 5.95, w: W - MARGIN * 2 - 2.5, h: 0.3, fontSize: 10, color: accent, underline: { style: 'sng' } },
  );

  addFooter(slide, theme, options, 'Regulatory update');
}

function addClosingSlide(
  pptx: PptxGenJS, theme: Theme, options: BriefingOptions,
  logo: string | null, articles: FeedArticle[], regulatory: RegulatoryItem[],
) {
  const slide = pptx.addSlide();
  slide.background = { color: theme.background };
  addSlideHeader(slide, theme, options, logo, 'Sources & method');

  slide.addText('Sources cited in this briefing', {
    x: MARGIN, y: 1.2, w: 6, h: 0.35, fontSize: 15, bold: true, color: theme.text,
  });

  const links = [
    ...articles.map((a) => ({ label: `${a.publisher} — ${truncate(a.title, 72)}`, url: a.canonicalUrl || a.url, demo: a.isDemo })),
    ...regulatory.map((r) => ({ label: `${r.authority} — ${truncate(r.title, 72)}`, url: r.documentUrl, demo: r.isDemo })),
  ].slice(0, 14);

  links.forEach((link, index) => {
    slide.addText(
      [
        { text: `${index + 1}. `, options: { color: theme.muted } },
        { text: link.label, options: { hyperlink: { url: link.url }, color: theme.accent, underline: { style: 'sng' } } },
        ...(link.demo ? [{ text: '  [DEMO DATA]', options: { color: 'B45309', bold: true } }] : []),
      ],
      { x: MARGIN, y: 1.65 + index * 0.3, w: W - MARGIN * 2, h: 0.28, fontSize: 9.5 },
    );
  });

  slide.addShape('rect', { x: MARGIN, y: H - 1.5, w: W - MARGIN * 2, h: 0.02, fill: { color: theme.line } });
  slide.addText(
    'Method: headlines and publisher-provided descriptions are collected from the configured sources, de-duplicated, ' +
      'clustered and scored. Summaries, sentiment, risk levels and relevance are automated estimates with stated ' +
      'confidence — they are not verified facts. Always consult the original source before acting.',
    { x: MARGIN, y: H - 1.4, w: W - MARGIN * 2, h: 0.75, fontSize: 9, color: theme.muted, italic: true },
  );

  addFooter(slide, theme, options, 'Sources');
}

// --------------------------------------------------------------------------
// Shared chrome
// --------------------------------------------------------------------------

function addSlideHeader(
  slide: PptxGenJS.Slide, theme: Theme, options: BriefingOptions,
  logo: string | null, label: string, accent?: string,
) {
  if (logo) slide.addImage({ data: logo, x: MARGIN, y: 0.38, w: 0.42, h: 0.42 });
  slide.addText('OLA NEWS', {
    x: logo ? MARGIN + 0.55 : MARGIN, y: 0.38, w: 2.2, h: 0.24,
    fontSize: 11, bold: true, color: accent ?? theme.accent, charSpacing: 1.4,
  });
  slide.addText(label, {
    x: logo ? MARGIN + 0.55 : MARGIN, y: 0.61, w: 4, h: 0.22,
    fontSize: 9, color: theme.muted,
  });
  slide.addShape('rect', { x: MARGIN, y: 1.02, w: W - MARGIN * 2, h: 0.015, fill: { color: theme.line } });
}

function addFooter(slide: PptxGenJS.Slide, theme: Theme, options: BriefingOptions, section: string) {
  slide.addText(section, {
    x: MARGIN, y: H - 0.42, w: 4, h: 0.24, fontSize: 8, color: theme.muted,
  });
  if (options.showPersonalBranding && options.personalName) {
    // Personal branding is intentionally smaller than the Ola News mark.
    slide.addText(`Prepared for ${options.personalName}`, {
      x: W - MARGIN - 4, y: H - 0.42, w: 4, h: 0.24,
      fontSize: 8, color: theme.muted, align: 'right',
    });
  }
}

async function loadLogoDataUrl(logoPath: string): Promise<string | null> {
  try {
    const relative = logoPath.replace(/^\//, '');
    const absolute = path.join(process.cwd(), 'public', relative);
    const buffer = await readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    const mime =
      ext === '.png' ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.gif' ? 'image/gif'
            : ext === '.svg' ? 'image/svg+xml'
              : null;
    // PowerPoint does not render SVG reliably; rasterise SVG logos before use.
    if (!mime || mime === 'image/svg+xml') return await rasterizeSvg(buffer);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Converts an SVG logo to PNG so PowerPoint renders it identically everywhere. */
async function rasterizeSvg(buffer: Buffer): Promise<string | null> {
  try {
    const { createCanvas, loadImage } = await import('@napi-rs/canvas');
    const image = await loadImage(buffer);
    const size = 256;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const ratio = image.width / image.height;
    const w = ratio >= 1 ? size : size * ratio;
    const h = ratio >= 1 ? size / ratio : size;
    ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
    return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
  } catch {
    return null;
  }
}

function riskColor(level: string): string {
  return { NONE: '6B7280', LOW: '0F9D58', MEDIUM: 'E8A33D', HIGH: 'EE6C1F', CRITICAL: 'D93025' }[level] ?? '6B7280';
}

function sentimentColor(label: string): string {
  return { POSITIVE: '0F9D58', NEUTRAL: '6B7280', NEGATIVE: 'D93025' }[label] ?? '6B7280';
}

function severityColor(severity: string): string {
  return { LOW: '0F9D58', MEDIUM: 'E8A33D', HIGH: 'EE6C1F', CRITICAL: 'D93025' }[severity] ?? '6B7280';
}

