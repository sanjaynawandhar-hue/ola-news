'use client';

import * as React from 'react';
import { Download, ImageIcon } from 'lucide-react';
import { Button, Modal, Select, Skeleton } from '@/components/ui';
import { useToast } from '@/components/providers';
import { PNG_PRESETS, type PngPresetKey } from '@/lib/constants';
import type { FeedArticle } from '@/types';

/**
 * PNG card export. The preview is the real renderer output — the same endpoint
 * produces the downloaded file, so what is previewed is exactly what is saved.
 */
export function ExportPngDialog({
  article, open, onClose,
}: {
  article: FeedArticle | null;
  open: boolean;
  onClose: () => void;
}) {
  const [preset, setPreset] = React.useState<PngPresetKey>('email');
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const { push } = useToast();

  // Reset the preview whenever the target story or size changes. Adjusting
  // state during render is React's documented alternative to a reset effect.
  const previewKey = `${article?.id ?? ''}:${preset}`;
  const [lastPreviewKey, setLastPreviewKey] = React.useState(previewKey);
  if (previewKey !== lastPreviewKey) {
    setLastPreviewKey(previewKey);
    setLoading(true);
    setFailed(false);
  }

  if (!article) return null;

  const previewSrc = `/api/export/png?articleId=${encodeURIComponent(article.id)}&preset=${preset}`;
  const dimensions = PNG_PRESETS[preset];

  const download = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${previewSrc}&download=true`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? 'The card could not be generated.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ??
        `ola-news-card-${preset}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      push({ tone: 'success', title: 'PNG card downloaded', description: link.download });
    } catch (error) {
      push({
        tone: 'error',
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error.',
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export news card"
      description="High-resolution branded PNG. Only the headline, the machine-generated summary and metadata are included — never the full article."
      size="lg"
      footer={
        <>
          <p className="mr-auto text-[11px] text-subtle">
            {dimensions.width} × {dimensions.height} px at {dimensions.scale}× ={' '}
            {dimensions.width * dimensions.scale} × {dimensions.height * dimensions.scale} px
          </p>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => void download()} loading={downloading}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download PNG
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="png-preset" className="text-xs font-medium">
            Export size
          </label>
          <Select
            id="png-preset"
            value={preset}
            onChange={(event) => setPreset(event.target.value as PngPresetKey)}
            className="min-w-56"
          >
            {Object.values(PNG_PRESETS).map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex min-h-64 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
          {failed ? (
            <p className="p-6 text-center text-xs text-[var(--color-negative)]">
              The preview could not be rendered. Try a different size, or check the server logs.
            </p>
          ) : (
            <>
              {loading ? <Skeleton className="absolute h-56 w-4/5" /> : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${article.id}-${preset}`}
                src={previewSrc}
                alt={`Preview of the news card for “${article.title}”`}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                className="max-h-[52vh] w-auto max-w-full rounded-lg shadow-lg"
              />
            </>
          )}
        </div>

        <p className="flex items-start gap-2 text-[11px] text-subtle">
          <ImageIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          The card carries a QR code and a short link back to the original publisher, plus the
          verification and confidence indicators. Personal branding can be hidden in Settings.
        </p>
      </div>
    </Modal>
  );
}
