import { hammingDistance, jaccard, slugify, tokenize } from '@/lib/utils';

/** Clustering is looser than deduplication: related coverage, not identical copy. */
export const CLUSTER_SIMHASH_THRESHOLD = 14;
export const CLUSTER_JACCARD_THRESHOLD = 0.32;
/** Stories more than this far apart in time are treated as separate events. */
export const CLUSTER_WINDOW_HOURS = 96;

export interface ClusterCandidate {
  id: string;
  title: string;
  simhash: string;
  publishedAt: Date;
  publisher: string;
}

export interface ClusterTarget {
  id: string;
  title: string;
  simhash: string;
  lastSeenAt: Date;
}

export function clusterScore(a: ClusterCandidate, b: { title: string; simhash: string }): number {
  const distance = hammingDistance(a.simhash, b.simhash);
  if (distance > CLUSTER_SIMHASH_THRESHOLD) return 0;
  const overlap = jaccard(tokenize(a.title), tokenize(b.title));
  if (overlap < CLUSTER_JACCARD_THRESHOLD) return 0;
  // Blend fingerprint proximity with lexical overlap into a 0..1 score.
  return 0.5 * (1 - distance / 64) * 2 + 0.5 * overlap;
}

/** Picks the best existing cluster for an article, or null to start a new one. */
export function matchCluster(
  candidate: ClusterCandidate,
  clusters: ClusterTarget[],
): { clusterId: string; score: number } | null {
  let best: { clusterId: string; score: number } | null = null;
  for (const cluster of clusters) {
    const ageHours =
      Math.abs(candidate.publishedAt.getTime() - cluster.lastSeenAt.getTime()) / 3600000;
    if (ageHours > CLUSTER_WINDOW_HOURS) continue;
    const score = clusterScore(candidate, cluster);
    if (score > 0 && (!best || score > best.score)) {
      best = { clusterId: cluster.id, score };
    }
  }
  return best;
}

/** Groups a fresh batch among themselves before hitting the database. */
export function groupBatch(candidates: ClusterCandidate[]): ClusterCandidate[][] {
  const groups: ClusterCandidate[][] = [];
  for (const candidate of candidates) {
    const target = groups.find((group) =>
      group.some(
        (member) =>
          Math.abs(member.publishedAt.getTime() - candidate.publishedAt.getTime()) / 3600000 <=
            CLUSTER_WINDOW_HOURS && clusterScore(candidate, member) > 0,
      ),
    );
    if (target) target.push(candidate);
    else groups.push([candidate]);
  }
  return groups;
}

export function clusterSlug(title: string, seed: string): string {
  return `${slugify(title).slice(0, 60)}-${seed.slice(0, 6)}`;
}
