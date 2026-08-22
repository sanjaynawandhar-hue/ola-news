import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { parseJson, truncate } from '@/lib/utils';
import { RISK_RANK, type RiskLevel } from '@/lib/constants';
import { detectVolumeSpike } from '@/lib/intelligence/trends';
import type { AlertCriteria } from '@/types';

const log = createLogger('alerts');

/**
 * In-app alert engine.
 *
 * Notification delivery is deliberately abstracted behind `Notifier` so email
 * and Slack channels can be added later without touching the matching logic —
 * only a new notifier needs registering.
 */
export interface AlertNotification {
  alertId: string;
  alertName: string;
  articleId?: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface Notifier {
  channel: string;
  enabled: boolean;
  send(notification: AlertNotification): Promise<void>;
}

/** The in-app channel writes an AlertEvent row that the header bell reads. */
const inAppNotifier: Notifier = {
  channel: 'inapp',
  enabled: true,
  async send(notification) {
    await prisma.alertEvent.create({
      data: {
        alertId: notification.alertId,
        articleId: notification.articleId,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
      },
    });
  },
};

/** Placeholder channels: registered, disabled, and never silently "succeed". */
const emailNotifier: Notifier = {
  channel: 'email',
  enabled: false,
  async send() {
    throw new Error('Email delivery is not configured. Add an SMTP/provider adapter to enable it.');
  },
};

const slackNotifier: Notifier = {
  channel: 'slack',
  enabled: false,
  async send() {
    throw new Error('Slack delivery is not configured. Add a Slack webhook adapter to enable it.');
  },
};

export const NOTIFIERS: Notifier[] = [inAppNotifier, emailNotifier, slackNotifier];

async function dispatch(channels: string[], notification: AlertNotification) {
  for (const channel of channels) {
    const notifier = NOTIFIERS.find((n) => n.channel === channel);
    if (!notifier || !notifier.enabled) continue;
    try {
      await notifier.send(notification);
    } catch (error) {
      log.warn('notifier failed', {
        channel,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}

interface ArticleForMatching {
  id: string;
  title: string;
  description: string | null;
  publisher: string;
  publishedAt: Date;
  analysis: {
    categoryKey: string;
    primaryCompanyKey: string | null;
    companyKeys: string;
    relevance: number;
    importanceScore: number;
  } | null;
  sentiment: { label: string } | null;
  risk: { level: string } | null;
  entities: Array<{ type: string; value: string }>;
}

/** Pure matcher — exported so alert rules can be unit tested. */
export function matchesCriteria(article: ArticleForMatching, criteria: AlertCriteria): string[] {
  const reasons: string[] = [];
  const haystack = `${article.title} ${article.description ?? ''}`.toLowerCase();
  const companyKeys = parseJson<string[]>(article.analysis?.companyKeys, []);

  let hasPositiveRule = false;

  if (criteria.keywords?.length) {
    hasPositiveRule = true;
    const hit = criteria.keywords.find((k) => k && haystack.includes(k.toLowerCase()));
    if (!hit) return [];
    reasons.push(`keyword "${hit}"`);
  }

  if (criteria.companyKeys?.length) {
    hasPositiveRule = true;
    const hit = criteria.companyKeys.find(
      (key) => companyKeys.includes(key) || article.analysis?.primaryCompanyKey === key,
    );
    if (!hit) return [];
    reasons.push(`company ${hit}`);
  }

  for (const [field, type, label] of [
    ['executives', 'PERSON', 'executive'],
    ['products', 'PRODUCT', 'product'],
    ['competitors', 'COMPANY', 'competitor'],
  ] as const) {
    const values = criteria[field];
    if (values?.length) {
      hasPositiveRule = true;
      const hit = values.find((value) =>
        article.entities.some(
          (e) => e.type === type && e.value.toLowerCase() === value.toLowerCase(),
        ),
      );
      if (!hit) return [];
      reasons.push(`${label} ${hit}`);
    }
  }

  if (criteria.categories?.length) {
    hasPositiveRule = true;
    if (!criteria.categories.includes(article.analysis?.categoryKey ?? '')) return [];
    reasons.push(`category ${article.analysis?.categoryKey}`);
  }

  if (criteria.sentiments?.length) {
    hasPositiveRule = true;
    if (!criteria.sentiments.includes((article.sentiment?.label ?? 'NEUTRAL') as never)) return [];
    reasons.push(`sentiment ${article.sentiment?.label}`);
  }

  if (criteria.minRiskLevel) {
    hasPositiveRule = true;
    const level = (article.risk?.level ?? 'NONE') as RiskLevel;
    if (RISK_RANK[level] < RISK_RANK[criteria.minRiskLevel]) return [];
    reasons.push(`risk ${level}`);
  }

  if (criteria.authorities?.length) {
    hasPositiveRule = true;
    const hit = criteria.authorities.find((authority) =>
      article.entities.some((e) => e.type === 'REGULATOR' && e.value === authority),
    );
    if (!hit) return [];
    reasons.push(`authority ${hit}`);
  }

  // An alert with no positive rule (only a volume-spike rule) never matches
  // individual articles; it is evaluated separately.
  if (!hasPositiveRule) return [];
  return reasons;
}

/** Evaluates all enabled alerts against a set of freshly stored articles. */
export async function evaluateAlerts(articleIds: string[]): Promise<number> {
  if (articleIds.length === 0) return 0;

  const [alerts, articles] = await Promise.all([
    prisma.alert.findMany({ where: { enabled: true } }),
    prisma.article.findMany({
      where: { id: { in: articleIds } },
      select: {
        id: true, title: true, description: true, publisher: true, publishedAt: true,
        analysis: { select: { categoryKey: true, primaryCompanyKey: true, companyKeys: true, relevance: true, importanceScore: true } },
        sentiment: { select: { label: true } },
        risk: { select: { level: true } },
        entities: { select: { type: true, value: true } },
      },
    }),
  ]);

  let raised = 0;
  const now = Date.now();

  for (const alert of alerts) {
    const criteria = parseJson<AlertCriteria>(alert.criteria, {});
    const channels = parseJson<string[]>(alert.channels, ['inapp']);

    if (alert.lastTriggeredAt && now - alert.lastTriggeredAt.getTime() < alert.throttleMins * 60000) {
      continue;
    }

    let triggered = false;

    for (const article of articles) {
      const reasons = matchesCriteria(article as ArticleForMatching, criteria);
      if (reasons.length === 0) continue;
      const severity: AlertNotification['severity'] =
        article.risk?.level === 'CRITICAL' ? 'CRITICAL' : article.risk?.level === 'HIGH' ? 'WARNING' : 'INFO';
      await dispatch(channels, {
        alertId: alert.id,
        alertName: alert.name,
        articleId: article.id,
        title: truncate(article.title, 160),
        message: `Matched ${alert.name} — ${reasons.join(', ')}. Published by ${article.publisher}.`,
        severity,
      });
      raised += 1;
      triggered = true;
    }

    // Volume-spike rules look at the whole recent window, not a single article.
    if (criteria.volumeSpike) {
      const windowHours = criteria.volumeSpike.windowHours || 24;
      const rows = await prisma.article.findMany({
        where: {
          publishedAt: { gte: new Date(now - windowHours * 3600000 * 9) },
          processingStatus: 'PROCESSED',
          ...(criteria.companyKeys?.length
            ? { analysis: { is: { primaryCompanyKey: { in: criteria.companyKeys } } } }
            : {}),
        },
        select: { publishedAt: true },
        take: 5000,
      });
      const spike = detectVolumeSpike(rows, {
        windowHours,
        threshold: criteria.volumeSpike.multiplier || 2,
      });
      if (spike.isSpike) {
        await dispatch(channels, {
          alertId: alert.id,
          alertName: alert.name,
          title: `Coverage volume spike detected (${spike.ratio}× baseline)`,
          message:
            `${spike.recentCount} stories in the last ${windowHours}h against a baseline of ` +
            `${spike.baselinePerWindow}. Review the feed for an emerging issue.`,
          severity: spike.ratio >= 3 ? 'CRITICAL' : 'WARNING',
        });
        raised += 1;
        triggered = true;
      }
    }

    if (triggered) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { lastTriggeredAt: new Date() },
      });
    }
  }

  return raised;
}
