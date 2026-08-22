import { describe, expect, it } from 'vitest';
import { dedupeBatch, filterAgainstExisting, type Fingerprint } from '@/lib/ingest/dedupe';
import { clusterScore, groupBatch, matchCluster } from '@/lib/ingest/cluster';
import { normalizeItem } from '@/lib/ingest/normalize';
import { simhash } from '@/lib/utils';
import type { NormalizedItem } from '@/types';

const BASE = {
  sourceId: 'src1', sourceKey: 'test', sourceName: 'Test',
  defaultLanguage: 'en', defaultCountry: 'IN', isDemo: false,
};

function item(title: string, url: string, publisher: string, publishedAt = '2026-08-01T10:00:00Z'): NormalizedItem {
  const result = normalizeItem({ title, url, publisher, publishedAt }, BASE);
  if (!result) throw new Error(`Fixture failed to normalise: ${title}`);
  return result;
}

describe('duplicate detection', () => {
  it('removes the same canonical URL seen twice', () => {
    const { unique, duplicates } = dedupeBatch([
      item('Ola Electric announces a recall', 'https://example.com/a', 'Wire One'),
      item('Different headline entirely here', 'https://example.com/a?utm_source=x', 'Wire Two'),
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates[0].reason).toBe('url');
  });

  it('removes the same headline from the same publisher', () => {
    const { unique, duplicates } = dedupeBatch([
      item('Ola Electric announces a recall', 'https://example.com/a', 'Wire One'),
      item('Ola Electric announces a recall', 'https://example.com/b', 'Wire One'),
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates[0].reason).toBe('title');
  });

  it('removes a syndicated rewrite from the same publisher', () => {
    const { unique, duplicates } = dedupeBatch([
      item('Ola Electric announces recall of scooters after safety defect reports', 'https://example.com/a', 'Wire One'),
      item('Ola Electric announces recall of scooters after reports of safety defect', 'https://example.com/b', 'Wire One'),
    ]);
    expect(unique).toHaveLength(1);
    expect(duplicates[0].reason).toBe('syndicated');
  });

  it('KEEPS a near-identical story from a different publisher', () => {
    // Independent coverage is the corroboration signal, so it must survive
    // de-duplication and be merged into one cluster instead.
    const { unique, duplicates } = dedupeBatch([
      item('Ola Electric announces recall of scooters after safety defect reports', 'https://a.com/a', 'Publisher A'),
      item('Ola Electric announces recall of scooters after reports of safety defect', 'https://b.com/b', 'Publisher B'),
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it('keeps the earliest published copy', () => {
    const { unique } = dedupeBatch([
      item('Ola Electric announces a recall', 'https://example.com/late', 'Wire One', '2026-08-01T12:00:00Z'),
      item('Ola Electric announces a recall', 'https://example.com/early', 'Wire One', '2026-08-01T06:00:00Z'),
    ]);
    expect(unique).toHaveLength(1);
    expect(unique[0].canonicalUrl).toContain('early');
  });

  it('filters against rows already in the database', () => {
    const fresh = item('Ola Electric announces a recall', 'https://example.com/new', 'Wire One');
    const existing: Fingerprint[] = [
      {
        urlHash: fresh.urlHash, contentHash: 'other', simhash: '0'.repeat(16),
        title: 'unrelated', publisher: 'Wire One',
      },
    ];
    const { unique, duplicates } = filterAgainstExisting([fresh], existing);
    expect(unique).toHaveLength(0);
    expect(duplicates[0].reason).toBe('url');
  });

  it('lets a genuinely new story through', () => {
    const fresh = item('Krutrim releases a new multilingual model', 'https://example.com/kr', 'Wire One');
    const existing: Fingerprint[] = [
      {
        urlHash: 'someotherhash', contentHash: 'other',
        simhash: simhash('completely unrelated cricket match report'),
        title: 'completely unrelated cricket match report', publisher: 'Wire Two',
      },
    ];
    expect(filterAgainstExisting([fresh], existing).unique).toHaveLength(1);
  });

  it('handles an empty batch', () => {
    expect(dedupeBatch([]).unique).toEqual([]);
    expect(filterAgainstExisting([], []).unique).toEqual([]);
  });
});

describe('story clustering', () => {
  const candidate = (title: string, publishedAt: string, publisher = 'A') => ({
    id: title, title, simhash: simhash(title), publishedAt: new Date(publishedAt), publisher,
  });

  it('scores related headlines above zero and unrelated ones at zero', () => {
    const a = candidate('Ola Electric announces recall of scooters after safety defect', '2026-08-01T10:00:00Z');
    const related = { title: 'Ola Electric recalls scooters over safety defect reports', simhash: simhash('Ola Electric recalls scooters over safety defect reports') };
    const unrelated = { title: 'Monsoon rainfall exceeds seasonal average in Kerala', simhash: simhash('Monsoon rainfall exceeds seasonal average in Kerala') };

    expect(clusterScore(a, related)).toBeGreaterThan(0);
    expect(clusterScore(a, unrelated)).toBe(0);
  });

  it('matches a candidate to the best existing cluster', () => {
    const match = matchCluster(
      candidate('Ola Electric recalls scooters over a safety defect', '2026-08-01T12:00:00Z'),
      [
        { id: 'c1', title: 'Ola Electric announces recall of scooters after safety defect', simhash: simhash('Ola Electric announces recall of scooters after safety defect'), lastSeenAt: new Date('2026-08-01T10:00:00Z') },
        { id: 'c2', title: 'Krutrim launches a new cloud region', simhash: simhash('Krutrim launches a new cloud region'), lastSeenAt: new Date('2026-08-01T10:00:00Z') },
      ],
    );
    expect(match?.clusterId).toBe('c1');
  });

  it('does not cluster across the time window', () => {
    const match = matchCluster(
      candidate('Ola Electric recalls scooters over a safety defect', '2026-09-01T12:00:00Z'),
      [{ id: 'c1', title: 'Ola Electric announces recall of scooters after safety defect', simhash: simhash('Ola Electric announces recall of scooters after safety defect'), lastSeenAt: new Date('2026-08-01T10:00:00Z') }],
    );
    expect(match).toBeNull();
  });

  it('returns null when nothing is similar enough', () => {
    const match = matchCluster(
      candidate('Krutrim launches a new cloud region', '2026-08-01T12:00:00Z'),
      [{ id: 'c1', title: 'Monsoon rainfall exceeds seasonal average', simhash: simhash('Monsoon rainfall exceeds seasonal average'), lastSeenAt: new Date('2026-08-01T10:00:00Z') }],
    );
    expect(match).toBeNull();
  });

  it('groups a fresh batch into distinct stories', () => {
    const groups = groupBatch([
      candidate('Ola Electric announces recall of scooters after safety defect', '2026-08-01T10:00:00Z', 'A'),
      candidate('Ola Electric recalls scooters over safety defect reports', '2026-08-01T11:00:00Z', 'B'),
      candidate('Krutrim launches a new cloud region in India', '2026-08-01T12:00:00Z', 'C'),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });
});
