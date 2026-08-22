import { createLogger } from '@/lib/logger';
import { sanitizeText } from '@/lib/sanitize';
import { truncate } from '@/lib/utils';

const log = createLogger('llm');

/**
 * Credentials are read lazily from process.env at call time rather than through
 * the shared server-env module, so this file stays importable by the seed script
 * and the unit tests without pulling in the `server-only` guard.
 */
function llmConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  return {
    apiKey: apiKey && apiKey.length > 0 ? apiKey : undefined,
    model: process.env.OLA_NEWS_LLM_MODEL ?? 'claude-sonnet-5',
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
  };
}

/**
 * Optional LLM enrichment adapter.
 *
 * When ANTHROPIC_API_KEY is present the pipeline asks the model to write the
 * short summary and the "why this matters" framing from the headline and the
 * publisher's own syndicated description ONLY — the prompt forbids adding facts
 * that are not in the input. When the key is absent (the default), the local
 * heuristic engine is used and the `engine` field on every record records which
 * one produced the text.
 *
 * The API key never leaves the server: this module is server-only and is called
 * exclusively from the ingestion pipeline and API route handlers.
 */

export interface LlmSummaryRequest {
  title: string;
  description: string | null;
  publisher: string;
  companyNames: string[];
  categoryLabel: string;
}

export interface LlmSummaryResponse {
  aiSummary: string;
  whyItMatters: string;
  engine: string;
}

const SYSTEM_PROMPT = [
  'You summarise news metadata for a corporate news-intelligence dashboard.',
  'You are given only a headline and the short description the publisher syndicated.',
  'Rules you must follow exactly:',
  '1. Use ONLY information present in the provided headline and description.',
  '2. Never invent facts, figures, dates, quotations, sources or links.',
  '3. If the description is missing or uninformative, say so plainly instead of speculating.',
  '4. Do not reproduce the full article; write at most three sentences of summary.',
  '5. "whyItMatters" is your own analytical framing for an executive reader and must be',
  '   clearly interpretive, not presented as reported fact.',
  'Reply with a single JSON object: {"aiSummary": string, "whyItMatters": string}.',
].join('\n');

export function isLlmEnabled(): boolean {
  return !!llmConfig().apiKey;
}

export async function summarizeWithLlm(
  request: LlmSummaryRequest,
): Promise<LlmSummaryResponse | null> {
  const { apiKey, model, baseUrl } = llmConfig();
  if (!apiKey) return null;

  const userContent = [
    `Headline: ${request.title}`,
    `Publisher: ${request.publisher}`,
    `Publisher description: ${request.description ?? '(none syndicated)'}`,
    `Tracked companies mentioned: ${request.companyNames.join(', ') || '(none matched)'}`,
    `Assigned category: ${request.categoryLabel}`,
  ].join('\n');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      log.warn('llm request failed', { status: response.status });
      return null;
    }
    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = payload.content?.find((c) => c.type === 'text')?.text ?? '';
    const parsed = extractJson(text);
    if (!parsed) return null;

    return {
      aiSummary: truncate(sanitizeText(parsed.aiSummary, 800), 400),
      whyItMatters: truncate(sanitizeText(parsed.whyItMatters, 800), 440),
      engine: `llm:${model}`,
    };
  } catch (error) {
    log.warn('llm enrichment skipped', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

function extractJson(text: string): { aiSummary: string; whyItMatters: string } | null {
  const match = /\{[\s\S]*\}/.exec(text);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const aiSummary = typeof parsed.aiSummary === 'string' ? parsed.aiSummary : '';
    const whyItMatters = typeof parsed.whyItMatters === 'string' ? parsed.whyItMatters : '';
    if (!aiSummary || !whyItMatters) return null;
    return { aiSummary, whyItMatters };
  } catch {
    return null;
  }
}
