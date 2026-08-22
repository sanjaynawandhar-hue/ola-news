import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EXPORT_THEME } from './theme';
import { qrPngBuffer } from './qr';
import { PNG_PRESETS, VERIFICATION_LABELS, type PngPresetKey, type VerificationStatus } from '@/lib/constants';
import { formatDate, formatDateTime, formatTimeZoneAbbr } from '@/lib/time';
import { linkAttribution } from '@/lib/utils';
import { createLogger } from '@/lib/logger';
import type { FeedArticle } from '@/types';

const log = createLogger('png-card');

/** Font stack resolved against whatever the host provides. */
const SANS = GlobalFonts.families.some((f) => f.family === 'Inter')
  ? 'Inter'
  : GlobalFonts.families.some((f) => f.family === 'Helvetica')
    ? 'Helvetica'
    : 'sans-serif';

export interface CardOptions {
  preset: PngPresetKey;
  personalName: string;
  showPersonalBranding: boolean;
  logoPath: string;
  timezone: string;
  /** Rendering scale multiplier on top of the preset (1 = preset size). */
  scale?: number;
}

/**
 * Renders a high-resolution branded news card.
 *
 * Copyright note: only the publisher's headline, a machine-generated short
 * summary and metadata are drawn. The full article body is never rendered into
 * the image, and a QR code plus the publisher name always point the reader back
 * to the original source.
 */
export async function renderNewsCard(article: FeedArticle, options: CardOptions): Promise<Buffer> {
  const preset = PNG_PRESETS[options.preset] ?? PNG_PRESETS.email;
  const scale = options.scale ?? preset.scale;
  const width = preset.width;
  const height = preset.height;

  const canvas = createCanvas(width * scale, height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'top';

  const t = EXPORT_THEME.ola;
  const portrait = height > width * 1.1;
  const pad = Math.round(width * (portrait ? 0.065 : 0.05));
  const contentWidth = width - pad * 2;

  // --- Background -----------------------------------------------------------
  ctx.fillStyle = t.white;
  ctx.fillRect(0, 0, width, height);

  const riskColor = EXPORT_THEME.risk[article.riskLevel] ?? t.muted;
  // Accent rail keyed to risk level.
  ctx.fillStyle = riskColor;
  ctx.fillRect(0, 0, Math.max(8, width * 0.008), height);

  // Soft brand wash behind the header.
  const headerHeight = Math.round(height * (portrait ? 0.10 : 0.13));
  const gradient = ctx.createLinearGradient(0, 0, width, headerHeight);
  gradient.addColorStop(0, t.greenSoft);
  gradient.addColorStop(1, t.white);
  ctx.fillStyle = gradient;
  ctx.fillRect(Math.max(8, width * 0.008), 0, width, headerHeight);

  // --- Header ---------------------------------------------------------------
  let y = Math.round(headerHeight * 0.28);
  const logoSize = Math.round(headerHeight * 0.44);
  const logo = await loadLogo(options.logoPath);
  drawLogo(ctx, logo, pad, y, logoSize, t);

  const titleX = pad + logoSize + Math.round(width * 0.018);
  const wordmarkSize = Math.round(width * 0.026);
  const taglineSize = Math.round(width * 0.0125);
  ctx.fillStyle = t.greenDeep;
  ctx.font = `bold ${wordmarkSize}px ${SANS}`;
  ctx.fillText('Ola News', titleX, y);
  ctx.fillStyle = t.muted;
  ctx.font = `${taglineSize}px ${SANS}`;
  ctx.fillText('Executive news intelligence', titleX, y + wordmarkSize * 1.22);

  // Generation stamp, right aligned.
  ctx.textAlign = 'right';
  ctx.fillStyle = t.muted;
  ctx.font = `${Math.round(width * 0.0125)}px ${SANS}`;
  ctx.fillText(
    `Generated ${formatDateTime(new Date(), options.timezone)} ${formatTimeZoneAbbr(options.timezone)}`,
    width - pad,
    y + 2,
  );
  if (article.isDemo) {
    ctx.fillStyle = '#B45309';
    ctx.font = `bold ${Math.round(width * 0.013)}px ${SANS}`;
    ctx.fillText('DEMO DATA — NOT LIVE NEWS', width - pad, y + wordmarkSize * 1.22);
  }
  ctx.textAlign = 'left';

  // Vertical budget: the footer band and the branding strip are reserved before
  // any body content is drawn, so blocks can never collide with them.
  const brandingBand = Math.max(26, Math.round(height * 0.055));
  const footerHeight = Math.round(height * (portrait ? 0.19 : 0.235));
  const footerTop = height - footerHeight;
  const contentBottom = footerTop - Math.round(height * 0.018);

  y = headerHeight + Math.round(height * 0.035);

  // --- Badges ---------------------------------------------------------------
  const badgeFont = Math.round(width * 0.0135);
  const badges: Array<{ label: string; bg: string; fg: string }> = [
    { label: (article.companyLabel ?? 'Ola portfolio').toUpperCase(), bg: t.greenDeep, fg: t.white },
    { label: article.categoryLabel.toUpperCase(), bg: t.greenSoft, fg: t.greenDark },
    { label: `SENTIMENT: ${article.sentiment}`, bg: hexAlpha(EXPORT_THEME.sentiment[article.sentiment] ?? t.muted, 0.12), fg: EXPORT_THEME.sentiment[article.sentiment] ?? t.muted },
    { label: `RISK: ${article.riskLevel}`, bg: hexAlpha(riskColor, 0.12), fg: riskColor },
  ];
  y = drawBadges(ctx, badges, pad, y, contentWidth, badgeFont, width);

  y += Math.round(height * 0.022);

  // --- Headline (verbatim publisher headline) -------------------------------
  ctx.fillStyle = t.charcoal;
  const headlineSize = Math.round(width * (portrait ? 0.048 : 0.038));
  const headlineLines = wrapText(ctx, article.title, contentWidth, `bold ${headlineSize}px ${SANS}`, portrait ? 5 : 3);
  ctx.font = `bold ${headlineSize}px ${SANS}`;
  for (const line of headlineLines) {
    ctx.fillText(line, pad, y);
    y += headlineSize * 1.24;
  }

  y += Math.round(height * 0.02);

  // --- AI summary -----------------------------------------------------------
  const labelSize = Math.round(width * 0.0125);
  const bodySize = Math.round(width * (portrait ? 0.022 : 0.017));

  y = drawLabelledBlock(ctx, {
    label: 'AI SUMMARY · MACHINE-GENERATED',
    body: article.aiSummary || article.description || 'No summary available for this item.',
    x: pad, y, width: contentWidth,
    labelSize, bodySize, labelColor: t.greenDark, bodyColor: t.slate,
    maxLines: portrait ? 7 : 4, font: SANS,
  });

  y += Math.round(height * 0.018);

  // --- Why this matters -----------------------------------------------------
  const blockPad = Math.round(width * 0.018);
  const whyAvailable = contentBottom - y - blockPad * 2 - labelSize * 1.9;
  const whyMaxLines = Math.max(1, Math.min(portrait ? 6 : 4, Math.floor(whyAvailable / (bodySize * 1.42))));
  const whyLines = wrapText(ctx, article.whyItMatters || '—', contentWidth - blockPad * 2, `${bodySize}px ${SANS}`, whyMaxLines);
  const whyHeight = blockPad * 2 + labelSize * 1.9 + whyLines.length * bodySize * 1.42;
  roundRect(ctx, pad, y, contentWidth, whyHeight, Math.round(width * 0.012));
  ctx.fillStyle = t.greenSoft;
  ctx.fill();
  ctx.fillStyle = t.greenDeep;
  ctx.font = `bold ${labelSize}px ${SANS}`;
  ctx.fillText('WHY THIS MATTERS · ANALYST VIEW', pad + blockPad, y + blockPad);
  ctx.fillStyle = t.slate;
  ctx.font = `${bodySize}px ${SANS}`;
  let whyY = y + blockPad + labelSize * 1.9;
  for (const line of whyLines) {
    ctx.fillText(line, pad + blockPad, whyY);
    whyY += bodySize * 1.42;
  }
  y += whyHeight;

  // --- Signal panel (tall formats only) -------------------------------------
  // Portrait and square cards leave vertical room below the analysis blocks.
  // Rather than ship dead space, fill it with the scores that drive the card's
  // own badges, each shown as a labelled bar so the reader can see the basis
  // for the sentiment and risk calls above.
  const spare = contentBottom - y;
  const panelMin = Math.round(height * 0.14);
  if (spare >= panelMin) {
    const panelTop = y + Math.round(height * 0.025);
    const rowGap = Math.min(Math.round(height * 0.052), Math.floor((contentBottom - panelTop) / 4));
    const barHeight = Math.max(6, Math.round(height * 0.008));
    const labelFont = Math.round(width * 0.0125);
    const valueFont = Math.round(width * 0.015);

    ctx.fillStyle = t.greenDark;
    ctx.font = `bold ${labelFont}px ${SANS}`;
    ctx.fillText('SIGNAL BREAKDOWN · AUTOMATED SCORES', pad, panelTop - Math.round(height * 0.018));

    const signals: Array<{ label: string; value: number; suffix: string; color: string }> = [
      { label: 'Relevance to tracked portfolio', value: article.relevance, suffix: '%', color: t.greenDark },
      { label: 'Automatic importance', value: article.importanceScore, suffix: '/100', color: t.green },
      { label: 'Risk score', value: article.riskScore, suffix: '/100', color: riskColor },
      { label: 'Analysis confidence', value: article.confidence, suffix: '%', color: t.slate },
    ];

    signals.forEach((signal, index) => {
      const rowY = panelTop + index * rowGap;
      if (rowY + barHeight + labelFont * 1.6 > contentBottom) return;

      ctx.fillStyle = t.slate;
      ctx.font = `${labelFont}px ${SANS}`;
      ctx.fillText(signal.label, pad, rowY);

      ctx.textAlign = 'right';
      ctx.fillStyle = signal.color;
      ctx.font = `bold ${valueFont}px ${SANS}`;
      ctx.fillText(`${Math.round(signal.value)}${signal.suffix}`, pad + contentWidth, rowY - 2);
      ctx.textAlign = 'left';

      const trackY = rowY + labelFont * 1.5;
      roundRect(ctx, pad, trackY, contentWidth, barHeight, barHeight / 2);
      ctx.fillStyle = t.line;
      ctx.fill();
      const filled = Math.max(barHeight, (contentWidth * clampPercent(signal.value)) / 100);
      roundRect(ctx, pad, trackY, filled, barHeight, barHeight / 2);
      ctx.fillStyle = signal.color;
      ctx.fill();
    });
  }

  // --- Footer ---------------------------------------------------------------
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, footerTop);
  ctx.lineTo(width - pad, footerTop);
  ctx.stroke();

  // The QR block must fit between the footer rule and the branding strip.
  const qrCaptionSize = Math.round(width * 0.0105);
  const qrTop = footerTop + Math.round(footerHeight * 0.12);
  const qrAvailable = height - brandingBand - qrTop - qrCaptionSize * 1.5;
  const qrSize = Math.max(48, Math.round(Math.min(qrAvailable, width * 0.115)));
  try {
    const qrBuffer = await qrPngBuffer(article.canonicalUrl || article.url, qrSize * 3);
    const qrImage = await loadImage(qrBuffer);
    ctx.drawImage(qrImage, width - pad - qrSize, qrTop, qrSize, qrSize);
    ctx.fillStyle = t.muted;
    ctx.font = `${qrCaptionSize}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('Scan for original', width - pad - qrSize / 2, qrTop + qrSize + qrCaptionSize * 0.35);
    ctx.textAlign = 'left';
  } catch (error) {
    log.warn('qr render failed', { error: error instanceof Error ? error.message : 'unknown' });
  }

  const metaWidth = contentWidth - qrSize - Math.round(width * 0.04);
  let metaY = footerTop + Math.round(footerHeight * 0.16);
  const metaSize = Math.round(width * 0.0145);

  ctx.fillStyle = t.charcoal;
  ctx.font = `bold ${metaSize}px ${SANS}`;
  ctx.fillText(truncateToWidth(ctx, article.publisher, metaWidth), pad, metaY);
  metaY += metaSize * 1.55;

  ctx.fillStyle = t.muted;
  ctx.font = `${Math.round(metaSize * 0.92)}px ${SANS}`;
  ctx.fillText(
    `Published ${formatDate(article.publishedAt, options.timezone)} · ${formatTimeZoneAbbr(options.timezone)}`,
    pad, metaY,
  );
  metaY += metaSize * 1.4;

  const verification = VERIFICATION_LABELS[article.verification as VerificationStatus] ?? article.verification;
  ctx.fillText(
    `${verification} · Confidence ${article.confidence}% · Relevance ${article.relevance}%`,
    pad, metaY,
  );
  metaY += metaSize * 1.4;

  ctx.fillStyle = t.muted;
  ctx.font = `${Math.round(metaSize * 0.85)}px ${SANS}`;
  ctx.fillText(
    truncateToWidth(ctx, `Source: ${linkAttribution(article.canonicalUrl || article.url)}`, metaWidth),
    pad, metaY,
  );

  // Branding strip. Personal branding stays deliberately small and sits below
  // the company mark; the disclaimer is right-aligned on the same baseline.
  const brandingSize = Math.round(width * 0.0105);
  const brandingBaseline = height - Math.round(brandingBand * 0.62);

  if (options.showPersonalBranding && options.personalName) {
    ctx.fillStyle = t.muted;
    ctx.font = `${brandingSize}px ${SANS}`;
    ctx.fillText(`Prepared for ${options.personalName}`, pad, brandingBaseline);
  }

  ctx.fillStyle = t.muted;
  ctx.font = `${Math.round(width * 0.0092)}px ${SANS}`;
  ctx.textAlign = 'right';
  const disclaimer = 'Sentiment, risk and summary are automated estimates, not verified facts.';
  const disclaimerRight = width - pad;
  // Never let the disclaimer run under the QR caption on narrow portrait cards.
  const disclaimerMax = contentWidth - (portrait ? 0 : qrSize + Math.round(width * 0.03));
  ctx.fillText(truncateToWidth(ctx, disclaimer, disclaimerMax), disclaimerRight, brandingBaseline);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

// --------------------------------------------------------------------------
// Drawing helpers
// --------------------------------------------------------------------------

async function loadLogo(logoPath: string): Promise<Image | null> {
  try {
    const relative = logoPath.replace(/^\//, '');
    const absolute = path.join(process.cwd(), 'public', relative);
    const buffer = await readFile(absolute);
    return await loadImage(buffer);
  } catch {
    // Falls back to the drawn placeholder mark.
    return null;
  }
}

function drawLogo(
  ctx: SKRSContext2D,
  logo: Image | null,
  x: number,
  y: number,
  size: number,
  t: typeof EXPORT_THEME.ola,
) {
  if (logo) {
    // Preserve aspect ratio — the logo is never stretched.
    const ratio = logo.width / logo.height;
    const drawHeight = size;
    const drawWidth = size * ratio;
    ctx.drawImage(logo, x, y, drawWidth, drawHeight);
    return;
  }
  // Placeholder mark. Replace public/branding/ola-logo.svg with the official
  // logo supplied by the brand owner to use the real mark.
  roundRect(ctx, x, y, size, size, size * 0.24);
  ctx.fillStyle = t.greenDeep;
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(size * 0.4)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ON', x + size / 2, y + size / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function drawBadges(
  ctx: SKRSContext2D,
  badges: Array<{ label: string; bg: string; fg: string }>,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  canvasWidth: number,
): number {
  ctx.font = `bold ${fontSize}px ${SANS}`;
  const padX = Math.round(canvasWidth * 0.012);
  const padY = Math.round(fontSize * 0.6);
  const gap = Math.round(canvasWidth * 0.009);
  const rowHeight = fontSize + padY * 2 + gap;

  let cursorX = x;
  let cursorY = y;
  for (const badge of badges) {
    const textWidth = ctx.measureText(badge.label).width;
    const boxWidth = textWidth + padX * 2;
    if (cursorX + boxWidth > x + maxWidth) {
      cursorX = x;
      cursorY += rowHeight;
    }
    roundRect(ctx, cursorX, cursorY, boxWidth, fontSize + padY * 2, (fontSize + padY * 2) / 2);
    ctx.fillStyle = badge.bg;
    ctx.fill();
    ctx.fillStyle = badge.fg;
    ctx.fillText(badge.label, cursorX + padX, cursorY + padY);
    cursorX += boxWidth + gap;
  }
  return cursorY + fontSize + padY * 2;
}

interface LabelledBlock {
  label: string; body: string; x: number; y: number; width: number;
  labelSize: number; bodySize: number; labelColor: string; bodyColor: string;
  maxLines: number; font: string;
}

function drawLabelledBlock(ctx: SKRSContext2D, block: LabelledBlock): number {
  ctx.fillStyle = block.labelColor;
  ctx.font = `bold ${block.labelSize}px ${block.font}`;
  ctx.fillText(block.label, block.x, block.y);
  let y = block.y + block.labelSize * 1.9;

  const lines = wrapText(ctx, block.body, block.width, `${block.bodySize}px ${block.font}`, block.maxLines);
  ctx.fillStyle = block.bodyColor;
  ctx.font = `${block.bodySize}px ${block.font}`;
  for (const line of lines) {
    ctx.fillText(line, block.x, y);
    y += block.bodySize * 1.42;
  }
  return y;
}

/** Greedy word wrap with a hard line cap and ellipsis on overflow. */
export function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  font: string,
  maxLines: number,
): string[] {
  ctx.font = font;
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.length > 0) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last.trimEnd()}…`;
    }
  }
  return lines;
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateToWidth(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function hexAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
