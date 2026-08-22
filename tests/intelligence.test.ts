import { describe, expect, it } from 'vitest';
import { countMentions, extractEntities, type EntityDefinition } from '@/lib/intelligence/entities';
import { classifyCategory } from '@/lib/intelligence/categories';
import { DEFAULT_CATEGORIES } from '@/lib/intelligence/categories';
import { estimateSentiment, sentimentFromScore } from '@/lib/intelligence/sentiment';
import { estimateRisk, matchesTerm, riskLevelFromScore } from '@/lib/intelligence/risk';
import { detectContentType, scoreRelevance } from '@/lib/intelligence/relevance';
import { businessImpactFor, scoreImportance, verificationFor } from '@/lib/intelligence/importance';
import { detectVolumeSpike, fillTrendSeries, findEmergingTopics } from '@/lib/intelligence/trends';

const RULES = DEFAULT_CATEGORIES.map((c) => ({ key: c.key, label: c.label, keywords: c.keywords }));

const DEFS: EntityDefinition[] = [
  { type: 'COMPANY', value: 'Ola Electric', refKey: 'ola-electric', companyKey: 'ola-electric', group: 'olaelectric', aliases: ['Ola Electric Mobility Limited', 'OLAELEC'] },
  { type: 'COMPANY', value: 'ANI Technologies', refKey: 'ani-technologies', companyKey: 'ani-technologies', group: 'ani', aliases: ['ANI Technologies Private Limited'] },
  { type: 'COMPANY', value: 'Krutrim', refKey: 'krutrim', companyKey: 'krutrim', group: 'krutrim', aliases: ['Ola Krutrim'] },
  { type: 'COMPANY', value: 'Ather Energy', refKey: 'ather', companyKey: 'ather', group: 'market', aliases: [] },
  { type: 'BRAND', value: 'Ola Cabs', refKey: 'ani:brand:Ola Cabs', companyKey: 'ani-technologies', group: 'ani', aliases: [] },
  { type: 'PERSON', value: 'Bhavish Aggarwal', refKey: 'ola-electric:person', companyKey: 'ola-electric', group: 'olaelectric', aliases: ['Bhavish Agarwal'] },
  { type: 'PRODUCT', value: 'Ola S1 Pro', refKey: 'ola-electric:product', companyKey: 'ola-electric', group: 'olaelectric', aliases: ['S1 Pro'] },
];

describe('company matching', () => {
  it('matches on word boundaries only', () => {
    expect(countMentions(' Ola Electric raised prices ', 'Ola Electric')).toBe(1);
    // "Granola" must not match "Ola".
    expect(countMentions(' Granola bars are popular ', 'Ola')).toBe(0);
    expect(countMentions(' competition heats up ', 'petition')).toBe(0);
  });

  it('extracts companies, people and products', () => {
    const matches = extractEntities(
      'Bhavish Aggarwal says Ola Electric will expand the Ola S1 Pro line across India',
      DEFS,
    );
    const values = matches.map((m) => m.value);
    expect(values).toContain('Ola Electric');
    expect(values).toContain('Bhavish Aggarwal');
    expect(values).toContain('Ola S1 Pro');
    expect(values).toContain('India');
  });

  it('gives a more specific alias higher confidence', () => {
    const specific = extractEntities('Ola Electric Mobility Limited filed its results', DEFS)
      .find((m) => m.value === 'Ola Electric');
    const vague = extractEntities('Ola Electric filed its results', DEFS)
      .find((m) => m.value === 'Ola Electric');
    expect(specific!.confidence).toBeGreaterThan(vague!.confidence);
  });

  it('recognises regulators without extra configuration', () => {
    const matches = extractEntities('SEBI issued a circular to the company; MoRTH also weighed in', DEFS);
    const regulators = matches.filter((m) => m.type === 'REGULATOR').map((m) => m.value);
    expect(regulators).toContain('SEBI');
    expect(regulators).toContain('MoRTH');
  });

  it('finds nothing in unrelated text', () => {
    expect(extractEntities('Monsoon rainfall exceeded the seasonal average', DEFS)).toHaveLength(0);
  });
});

describe('relevance scoring', () => {
  const base = {
    trackedKeywords: [{ term: 'electric two-wheeler', weight: 0.7 }],
    excludedKeywords: ['Granola'],
    sourceCredibility: 80,
  };

  it('scores a headline mention of a tracked company highly', () => {
    const title = 'Ola Electric reports record quarterly deliveries';
    const result = scoreRelevance({ ...base, title, entities: extractEntities(title, DEFS) });
    expect(result.score).toBeGreaterThan(40);
    expect(result.primaryCompanyKey).toBe('ola-electric');
    expect(result.groups).toContain('olaelectric');
  });

  it('scores a competitor-only story lower than a tracked-company story', () => {
    const own = 'Ola Electric launches a new scooter';
    const rival = 'Ather Energy launches a new scooter';
    const ownScore = scoreRelevance({ ...base, title: own, entities: extractEntities(own, DEFS) }).score;
    const rivalScore = scoreRelevance({ ...base, title: rival, entities: extractEntities(rival, DEFS) }).score;
    expect(ownScore).toBeGreaterThan(rivalScore);
  });

  it('suppresses a story matching an excluded keyword', () => {
    const title = 'Granola brand Ola Electric lookalike launches';
    const result = scoreRelevance({ ...base, title, entities: extractEntities(title, DEFS) });
    expect(result.excluded).toBe(true);
    expect(result.score).toBe(0);
  });

  it('scores an unrelated story at zero', () => {
    const title = 'Monsoon rainfall exceeded the seasonal average';
    expect(scoreRelevance({ ...base, title, entities: extractEntities(title, DEFS) }).score).toBe(0);
  });
});

describe('category classification', () => {
  it.each([
    ['Ola Electric posts a wider net loss as revenue falls', 'financial-performance'],
    ['SEBI issues a circular on disclosure norms for listed entities', 'regulation-compliance'],
    ['Ola Electric recalls scooters after a safety defect', 'safety-recalls'],
    ['Krutrim releases a new large language model benchmark', 'artificial-intelligence'],
    ['Ola Cabs revises driver fare and aggregator commission', 'mobility-ride-hailing'],
    ['Ola Electric CEO steps down, board appoints successor', 'leadership'],
  ])('classifies "%s" as %s', (title, expected) => {
    expect(classifyCategory(title, null, RULES).key).toBe(expected);
  });

  it('falls back to the default category with low confidence', () => {
    const result = classifyCategory('Something entirely unremarkable happened', null, RULES);
    expect(result.key).toBe('corporate');
    expect(result.confidence).toBeLessThan(50);
  });

  it('weights headline matches above description matches', () => {
    const headline = classifyCategory('Recall announced', null, RULES);
    const body = classifyCategory('Company update', 'A recall was announced', RULES);
    expect(headline.confidence).toBeGreaterThanOrEqual(body.confidence);
  });
});

describe('sentiment mapping', () => {
  it('labels clearly negative financial news as negative', () => {
    const result = estimateSentiment('Ola Electric posts net loss as margin pressure persists');
    expect(result.label).toBe('NEGATIVE');
    expect(result.score).toBeLessThan(0);
  });

  it('labels clearly positive news as positive', () => {
    const result = estimateSentiment('Ola Electric reports record profit as revenue rises sharply');
    expect(result.label).toBe('POSITIVE');
    expect(result.score).toBeGreaterThan(0);
  });

  it('does not over-react to a single weak signal', () => {
    // One mildly positive verb must not produce a maximal score.
    const result = estimateSentiment('Ola Electric expands its service network');
    expect(Math.abs(result.score)).toBeLessThan(1);
    expect(result.label).toBe('NEUTRAL');
  });

  it('flips a directional verb applied to a negative subject', () => {
    const result = estimateSentiment('Consumer complaints about delivery timelines rise sharply');
    expect(result.label).toBe('NEGATIVE');
  });

  it('handles negation', () => {
    const plain = estimateSentiment('The company reported a profit and strong growth');
    const negated = estimateSentiment('The company did not report a profit');
    expect(plain.score).toBeGreaterThan(negated.score);
  });

  it('returns neutral with low confidence for text with no sentiment terms', () => {
    const result = estimateSentiment('The meeting is scheduled for Tuesday');
    expect(result.label).toBe('NEUTRAL');
    expect(result.confidence).toBeLessThanOrEqual(45);
  });

  it('maps scores to labels consistently with the estimator', () => {
    expect(sentimentFromScore(0.5, 0.8)).toBe('POSITIVE');
    expect(sentimentFromScore(-0.5, 0.8)).toBe('NEGATIVE');
    expect(sentimentFromScore(0.5, 0.05)).toBe('NEUTRAL');
  });
});

describe('risk mapping', () => {
  it('matches risk terms on word boundaries', () => {
    expect(matchesTerm(' the competition commission ruled ', 'petition')).toBe(false);
    expect(matchesTerm(' a petition was filed ', 'petition')).toBe(true);
    expect(matchesTerm(' show cause notice issued ', 'show cause')).toBe(true);
  });

  it('rates a recall as high risk', () => {
    const result = estimateRisk(
      'Ola Electric recalls 10,000 scooters after safety defect reports',
      { sentimentScore: -0.7, relevance: 100 },
    );
    expect(['HIGH', 'CRITICAL']).toContain(result.level);
    expect(result.drivers).toContain('recall');
    expect(result.dimensions.operational).toBeGreaterThan(0);
  });

  it('rates regulatory action as a regulatory-dimension risk', () => {
    const result = estimateRisk('SEBI issues show cause notice over disclosure lapse', { relevance: 100 });
    expect(result.dimensions.regulatory).toBeGreaterThan(0);
    expect(result.drivers).toContain('regulatory-action');
  });

  it('rates a routine product launch as no risk', () => {
    const result = estimateRisk('Ola Electric launches a new scooter variant', { relevance: 100 });
    expect(result.level).toBe('NONE');
    expect(result.drivers).toHaveLength(0);
  });

  it('damps risk for low-relevance stories', () => {
    const high = estimateRisk('recall and safety defect and investigation', { relevance: 100 }).score;
    const low = estimateRisk('recall and safety defect and investigation', { relevance: 10 }).score;
    expect(low).toBeLessThan(high);
  });

  it('maps scores to levels monotonically', () => {
    expect(riskLevelFromScore(0)).toBe('NONE');
    expect(riskLevelFromScore(10)).toBe('LOW');
    expect(riskLevelFromScore(30)).toBe('MEDIUM');
    expect(riskLevelFromScore(50)).toBe('HIGH');
    expect(riskLevelFromScore(80)).toBe('CRITICAL');
  });
});

describe('content type detection', () => {
  it.each([
    ['Opinion: why the EV push matters', 'NEWS', 'OPINION'],
    ['Analysis: what the results mean', 'NEWS', 'ANALYSIS'],
    ['Company announces record quarter', 'NEWS', 'PRESS_RELEASE'],
    ['Scooter sales fell in July', 'NEWS', 'REPORTING'],
    ['Circular on disclosure norms', 'REGULATOR', 'PRESS_RELEASE'],
  ])('classifies "%s" from a %s source as %s', (title, sourceType, expected) => {
    expect(detectContentType(title, null, sourceType)).toBe(expected);
  });
});

describe('importance and verification', () => {
  const base = {
    relevance: 90, publishedAt: new Date('2026-08-01T10:00:00Z'), sourceCredibility: 85,
    corroboration: 3, isRegulatory: false, riskLevel: 'MEDIUM' as const,
    sentiment: 'NEGATIVE' as const, sentimentMagnitude: 0.6, businessImpact: 70,
    now: new Date('2026-08-01T12:00:00Z'),
  };

  it('produces a bounded score with an explainable breakdown', () => {
    const result = scoreImportance(base);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors.map((f) => f.key)).toContain('recency');
    expect(result.factors).toHaveLength(9);
  });

  it('ranks a fresh story above an identical older one', () => {
    const fresh = scoreImportance(base).score;
    const old = scoreImportance({ ...base, publishedAt: new Date('2026-07-20T10:00:00Z') }).score;
    expect(fresh).toBeGreaterThan(old);
  });

  it('ranks a critical-risk story above a no-risk one', () => {
    const critical = scoreImportance({ ...base, riskLevel: 'CRITICAL' }).score;
    const none = scoreImportance({ ...base, riskLevel: 'NONE' }).score;
    expect(critical).toBeGreaterThan(none);
  });

  it('rewards corroboration', () => {
    const many = scoreImportance({ ...base, corroboration: 8 }).score;
    const one = scoreImportance({ ...base, corroboration: 1 }).score;
    expect(many).toBeGreaterThan(one);
  });

  it('maps corroboration and source type to a verification status', () => {
    expect(verificationFor(1, true, 90)).toBe('OFFICIAL');
    expect(verificationFor(4, false, 80)).toBe('CORROBORATED');
    expect(verificationFor(1, false, 80)).toBe('SINGLE_SOURCE');
    expect(verificationFor(1, false, 30)).toBe('UNVERIFIED');
  });

  it('scores business impact higher for material categories', () => {
    expect(businessImpactFor('safety-recalls', 90, 'HIGH'))
      .toBeGreaterThan(businessImpactFor('esg-sustainability', 90, 'HIGH'));
  });
});

describe('trend detection', () => {
  const rows = (offsetsHours: number[]) =>
    offsetsHours.map((h) => ({ publishedAt: new Date(Date.now() - h * 3600000) }));

  it('detects a genuine volume spike', () => {
    // 8 stories today, roughly 1/day in the preceding week.
    const recent = rows([1, 2, 3, 4, 5, 6, 7, 8]);
    const baseline = rows([30, 54, 78, 102, 126, 150, 174]);
    const spike = detectVolumeSpike([...recent, ...baseline], { threshold: 2 });
    expect(spike.isSpike).toBe(true);
    expect(spike.ratio).toBeGreaterThanOrEqual(2);
  });

  it('does not flag steady coverage as a spike', () => {
    const steady = rows([1, 2, 26, 27, 50, 51, 74, 75, 98, 99, 122, 123, 146, 147, 170, 171]);
    expect(detectVolumeSpike(steady, { threshold: 2 }).isSpike).toBe(false);
  });

  it('requires an absolute floor when there is no history', () => {
    expect(detectVolumeSpike(rows([1, 2]), { threshold: 2 }).isSpike).toBe(false);
  });

  it('finds topics that are new or rising', () => {
    const now = new Date();
    const emerging = findEmergingTopics(
      [
        { publishedAt: new Date(now.getTime() - 3600000), topics: ['battery fire', 'recall'] },
        { publishedAt: new Date(now.getTime() - 7200000), topics: ['battery fire', 'recall'] },
        { publishedAt: new Date(now.getTime() - 10800000), topics: ['battery fire'] },
        { publishedAt: new Date(now.getTime() - 200 * 3600000), topics: ['quarterly results'] },
      ],
      { now },
    );
    expect(emerging.map((e) => e.topic)).toContain('battery fire');
  });

  it('fills gaps in the trend series so charts stay continuous', () => {
    const series = fillTrendSeries(new Map(), 7, 'Asia/Kolkata', new Date('2026-08-07T12:00:00Z'));
    expect(series).toHaveLength(7);
    expect(series.every((point) => point.total === 0)).toBe(true);
    expect(series[0].date < series[6].date).toBe(true);
  });
});

describe('inflected keyword matching', () => {
  it('matches common inflections of a base keyword', () => {
    // Category and risk lists are written in base form.
    expect(classifyCategory('Ola Electric unveils three energy storage products', null, RULES).key)
      .toBe('products-launches');
    expect(classifyCategory('Ola Electric unveiled a new scooter', null, RULES).key)
      .toBe('products-launches');
    expect(classifyCategory('Ola Electric recalled 10,000 scooters', null, RULES).key)
      .toBe('safety-recalls');
  });

  it('still refuses a match that only shares a suffix', () => {
    // The leading boundary is what stops "competition" matching "petition".
    expect(estimateRisk('competition intensifies in the segment', { relevance: 100 }).drivers)
      .not.toContain('litigation');
  });

  it('keeps very short keywords exact', () => {
    // "ai" must not match "aid".
    const result = classifyCategory('Aid workers reached the site', null, RULES);
    expect(result.key).not.toBe('artificial-intelligence');
  });
});
