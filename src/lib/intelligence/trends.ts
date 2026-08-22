/**
 * Volume-spike and emerging-issue detection. Both are pure functions over
 * timestamped rows so they can be unit tested and reused by the alert engine.
 */

export interface DatedRow {
  publishedAt: Date;
  topics?: string[];
  categoryKey?: string;
  companyKey?: string | null;
}

export interface VolumeSpike {
  windowHours: number;
  recentCount: number;
  baselinePerWindow: number;
  ratio: number;
  isSpike: boolean;
}

/**
 * Compares the count in the most recent window against the mean of the
 * preceding `baselineWindows` windows of the same length.
 */
export function detectVolumeSpike(
  rows: DatedRow[],
  { windowHours = 24, baselineWindows = 7, threshold = 2, now = new Date() } = {},
): VolumeSpike {
  const windowMs = windowHours * 3600000;
  const nowMs = now.getTime();

  const recentCount = rows.filter(
    (r) => r.publishedAt.getTime() > nowMs - windowMs,
  ).length;

  const baselineCounts: number[] = [];
  for (let i = 1; i <= baselineWindows; i++) {
    const end = nowMs - i * windowMs;
    const start = end - windowMs;
    baselineCounts.push(
      rows.filter((r) => r.publishedAt.getTime() > start && r.publishedAt.getTime() <= end).length,
    );
  }
  const baseline =
    baselineCounts.length > 0
      ? baselineCounts.reduce((a, b) => a + b, 0) / baselineCounts.length
      : 0;

  // With no history, a burst still needs an absolute floor to count as a spike.
  const ratio = baseline > 0 ? recentCount / baseline : recentCount >= 5 ? threshold : 1;

  return {
    windowHours,
    recentCount,
    baselinePerWindow: Number(baseline.toFixed(2)),
    ratio: Number(ratio.toFixed(2)),
    isSpike: ratio >= threshold && recentCount >= 3,
  };
}

export interface EmergingTopic {
  topic: string;
  recentCount: number;
  priorCount: number;
  lift: number;
  isNew: boolean;
}

/**
 * A topic is "emerging" when its share of recent coverage is materially higher
 * than in the prior period, or when it is entirely new with enough volume.
 */
export function findEmergingTopics(
  rows: DatedRow[],
  { windowHours = 72, limit = 10, now = new Date() } = {},
): EmergingTopic[] {
  const windowMs = windowHours * 3600000;
  const nowMs = now.getTime();

  const recent = new Map<string, number>();
  const prior = new Map<string, number>();

  for (const row of rows) {
    const age = nowMs - row.publishedAt.getTime();
    const bucket = age <= windowMs ? recent : age <= windowMs * 3 ? prior : null;
    if (!bucket) continue;
    for (const topic of row.topics ?? []) {
      if (topic.length < 4) continue;
      bucket.set(topic, (bucket.get(topic) ?? 0) + 1);
    }
  }

  const results: EmergingTopic[] = [];
  for (const [topic, recentCount] of recent) {
    if (recentCount < 2) continue;
    const priorCount = prior.get(topic) ?? 0;
    // Prior counts span 2× the recent window, so normalise before comparing.
    const normalisedPrior = priorCount / 2;
    const lift = normalisedPrior > 0 ? recentCount / normalisedPrior : recentCount;
    results.push({
      topic,
      recentCount,
      priorCount,
      lift: Number(lift.toFixed(2)),
      isNew: priorCount === 0,
    });
  }

  return results
    .filter((r) => r.lift >= 1.5 || r.isNew)
    .sort((a, b) => b.lift * b.recentCount - a.lift * a.recentCount)
    .slice(0, limit);
}

export interface TrendPoint {
  date: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
  ani: number;
  olaelectric: number;
  krutrim: number;
  market: number;
}

/** Fills gaps so charts render a continuous axis even on quiet days. */
export function fillTrendSeries(
  points: Map<string, TrendPoint>,
  days: number,
  timeZone: string,
  now = new Date(),
): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    const key = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    out.push(
      points.get(key) ?? {
        date: key,
        total: 0, positive: 0, neutral: 0, negative: 0,
        ani: 0, olaelectric: 0, krutrim: 0, market: 0,
      },
    );
  }
  return out;
}
