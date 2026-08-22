import { describe, expect, it } from 'vitest';
import { assessRegulatoryRelevance } from '@/lib/intelligence/regulatory-relevance';

const assess = (title: string, named: string[] = [], description: string | null = null) =>
  assessRegulatoryRelevance(title, description, 'NOTICE', named);

describe('enforcement against unrelated parties is rejected', () => {
  // Every one of these was collected from SEBI's real feed and shown in the
  // tracker, where none of it concerned the tracked portfolio.
  it.each([
    'Notice of Attachment of Demat account dated 19.08.2026 in RC No. 9248 of 2026',
    'Notice of Attachment of Bank and Post Office Accounts 15715 of 2026',
    'Notice of Demand dated 19.08.2026 in RC No. 9287 of 2026',
    'Remittance order in Recovery Certificate No. 9166 of 2026 issued against Manoj Rameshbhai',
    'General Remittance Advice against: Madhu Gupta (PAN: ABUPG9329D) [Defaulter]',
    'Completion of RC 7522 of 2024 against Kapil Kumar Wadhawan',
    'Appeal No. 6997 of 2026 filed by Rajeev Bakshi',
    'Adjudication Order in respect of National Steel and Agro Industries Limited',
    'Final Order in respect of Trade Nexa Research Investment Advisor Prop-Minakshi Asavani',
    'Release Order for RC 7522 of 2024 against Kapil Kumar Wadhawan',
  ])('rejects %s', (title) => {
    const result = assess(title);
    expect(result.relevant).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe('intermediary-only instruments are rejected', () => {
  it.each([
    'Order in the matter of certain Investment Advisers',
    'Order in the matter of certain Research Analysts',
    'Enabling sharing of information by KYC Registration Agencies (KRAs)',
    'Guidelines for Portfolio Managers on fee disclosure',
  ])('rejects %s', (title) => {
    // Ola is an issuer, not a broker, adviser or KRA.
    expect(assess(title).relevant).toBe(false);
  });
});

describe('documents naming a tracked entity are always kept', () => {
  it('keeps an enforcement action against a tracked company', () => {
    const result = assess(
      'Adjudication Order in respect of Ola Electric Mobility Limited',
      ['Ola Electric'],
    );
    expect(result.relevant).toBe(true);
    expect(result.scope).toBe('company');
    expect(result.reason).toContain('Ola Electric');
  });

  it('keeps a document naming a tracked executive', () => {
    const result = assess('Summons issued to Bhavish Aggarwal', ['Bhavish Aggarwal']);
    expect(result.relevant).toBe(true);
    expect(result.scope).toBe('company');
  });

  it('a named tracked entity overrides the enforcement rejection', () => {
    // "Recovery certificate" would normally reject, but not when it names us.
    const result = assess(
      'Recovery Certificate No. 1234 of 2026 against Ola Electric Mobility Limited',
      ['Ola Electric'],
    );
    expect(result.relevant).toBe(true);
    expect(result.scope).toBe('company');
  });
});

describe('general obligations that bind a listed issuer are kept', () => {
  it.each([
    'Circular on continuous disclosure timelines for listed entities',
    'Amendment to LODR regulations on related party transactions',
    'Revised framework for corporate governance at listed companies',
    'Prohibition of Insider Trading Regulations amendment',
  ])('keeps %s', (title) => {
    const result = assess(title);
    expect(result.relevant).toBe(true);
    expect(result.scope).toBe('sector');
  });
});

describe('sector instruments covering the portfolio are kept', () => {
  it.each([
    'Notification on electric two-wheeler type approval requirements',
    'Amendment to aggregator guidelines on fare bands',
    'Revised battery safety standards for electric vehicles',
    'Consumer protection rules for e-commerce and platform services',
    'Draft rules under the data protection framework',
  ])('keeps %s', (title) => {
    const result = assess(title);
    expect(result.relevant).toBe(true);
    expect(result.scope).toBe('sector');
  });
});

describe('anything unconnected is rejected', () => {
  it.each([
    'SEBI Studies Indicate Key Trends in Retail Participation and Trading Behaviour',
    'Ease of onboarding for FPIs – Acceptance of digitally signed Power of Attorney',
    'Monsoon session parliamentary calendar published',
  ])('rejects %s', (title) => {
    expect(assess(title).relevant).toBe(false);
  });

  it('always gives a reason, so a rejection can be audited', () => {
    const result = assess('Something entirely unrelated');
    expect(result.relevant).toBe(false);
    expect(result.scope).toBeNull();
    expect(result.reason.length).toBeGreaterThan(10);
  });
});

describe('word-boundary safety', () => {
  it('does not reject on a coincidental substring', () => {
    // "appeal" inside "appealing" must not trigger the "appeal no" rule, and
    // an unrelated word must not match "rc no".
    const result = assess('Circular on appealing design standards for listed entities');
    expect(result.relevant).toBe(true);
  });
});
