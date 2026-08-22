import { describe, expect, it } from 'vitest';
import {
  EXECUTIVE_SEEDS,
  FACT_SEEDS,
  PROFILE_SEEDS,
  type FactSeed,
  type ProfileSeed,
} from '../prisma/seed-data/profiles';

/**
 * These guard a product rule, not a schema: the dashboard must never assert a
 * company fact it cannot back. A wrong headcount or address on an executive
 * briefing is worse than a visible gap, so the seed deliberately carries only
 * long-standing, widely documented values and no source-backed claims.
 */

describe('company profile seed', () => {
  it('covers the three tracked companies and nothing else', () => {
    expect(PROFILE_SEEDS.map((p) => p.companyKey).sort()).toEqual(
      ['ani-technologies', 'krutrim', 'ola-electric'].sort(),
    );
  });

  it('never seeds a headcount', () => {
    // Employee numbers change constantly and are rarely published; the field
    // exists but must be filled in by a human from a real source.
    for (const profile of PROFILE_SEEDS as Array<ProfileSeed & { employeeRange?: string }>) {
      expect(profile.employeeRange).toBeUndefined();
    }
  });

  it('seeds only a city for headquarters, never a street address', () => {
    for (const profile of PROFILE_SEEDS) {
      if (!profile.headquarters) continue;
      // A real street address would carry a number; a city does not.
      expect(profile.headquarters).not.toMatch(/\d{1,4}[,\s]/);
      expect(profile.headquarters).toMatch(/India$/);
    }
  });

  it('records a listing status consistent with reality', () => {
    const byKey = Object.fromEntries(PROFILE_SEEDS.map((p) => [p.companyKey, p]));
    // Ola Electric is the only listed company in the group.
    expect(byKey['ola-electric'].listingStatus).toBe('LISTED');
    expect(byKey['ani-technologies'].listingStatus).toBe('PRIVATE');
    expect(byKey['krutrim'].listingStatus).toBe('PRIVATE');
  });

  it('gives every company a description', () => {
    for (const profile of PROFILE_SEEDS) {
      expect(profile.about.length).toBeGreaterThan(80);
    }
  });

  it('founding years are plausible and ordered as the group grew', () => {
    const byKey = Object.fromEntries(PROFILE_SEEDS.map((p) => [p.companyKey, p]));
    expect(byKey['ani-technologies'].foundedYear).toBe(2010);
    expect(byKey['ola-electric'].foundedYear).toBe(2017);
    expect(byKey['krutrim'].foundedYear).toBe(2023);
    // The parent must not post-date its own subsidiaries.
    expect(byKey['ani-technologies'].foundedYear!).toBeLessThan(byKey['ola-electric'].foundedYear!);
  });
});

describe('company fact seed', () => {
  it('never seeds a capacity, output or headcount figure', () => {
    // These are the numbers most likely to be quoted wrongly; they belong to
    // the company's own disclosures, not a seed file.
    const numeric = /\b\d[\d,.]*\s*(units|vehicles|employees|people|GWh|MW|crore|lakh|million|billion)\b/i;
    for (const fact of FACT_SEEDS as FactSeed[]) {
      const text = [fact.value, fact.detail, fact.location].filter(Boolean).join(' ');
      expect(text).not.toMatch(numeric);
    }
  });

  it('only records facilities whose existence is well established', () => {
    const facilities = FACT_SEEDS.filter((f) => f.category === 'FACILITY');
    expect(facilities).toHaveLength(1);
    expect(facilities[0].companyKey).toBe('ola-electric');
    expect(facilities[0].location).toContain('Tamil Nadu');
  });

  it('gives every company an office entry to build on', () => {
    const withOffice = new Set(
      FACT_SEEDS.filter((f) => f.category === 'OFFICE').map((f) => f.companyKey),
    );
    for (const profile of PROFILE_SEEDS) {
      expect(withOffice.has(profile.companyKey)).toBe(true);
    }
  });

  it('tells the reader what to do rather than leaving a bare stub', () => {
    for (const fact of FACT_SEEDS) {
      if (!fact.detail) continue;
      expect(fact.detail.toLowerCase()).toMatch(/add|source|filing|website/);
    }
  });
});

describe('executive seed', () => {
  it('seeds founders only', () => {
    for (const person of EXECUTIVE_SEEDS) {
      expect(person.kind).toBe('FOUNDER');
    }
  });

  it('does not invent a leadership roster', () => {
    // Titles turn over often enough that a stale seeded roster would mislead.
    expect(EXECUTIVE_SEEDS.some((p) => p.kind === 'EXECUTIVE')).toBe(false);
    expect(EXECUTIVE_SEEDS.some((p) => p.kind === 'BOARD')).toBe(false);
  });

  it('attaches every founder to a seeded company', () => {
    const keys = new Set(PROFILE_SEEDS.map((p) => p.companyKey));
    for (const person of EXECUTIVE_SEEDS) {
      expect(keys.has(person.companyKey)).toBe(true);
    }
  });

  it('records the founder of each company', () => {
    for (const key of ['ani-technologies', 'ola-electric', 'krutrim']) {
      expect(EXECUTIVE_SEEDS.some((p) => p.companyKey === key)).toBe(true);
    }
  });
});
