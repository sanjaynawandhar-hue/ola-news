'use client';

import * as React from 'react';
import { ChevronDown, FilterX } from 'lucide-react';
import { Badge, Button, Checkbox, Input } from '@/components/ui';
import { RISK_LEVELS, SENTIMENTS, SOURCE_TYPE_LABELS, VERIFICATION_LABELS, VERIFICATION_STATUSES, type SourceType } from '@/lib/constants';
import { COUNTRY_NAMES, LANGUAGE_NAMES } from './labels';
import { cn } from '@/lib/utils';
import type { FeedQuery } from '@/types';

export interface FilterOptions {
  companies: Array<{ key: string; name: string; group: string; relation: string }>;
  groups: Array<{ key: string; label: string }>;
  categories: Array<{ key: string; label: string; colorHex: string }>;
  sources: Array<{ key: string; name: string; sourceType: string; mode: string; enabled: boolean }>;
  brands: string[];
  countries: Array<{ code: string; count: number }>;
  languages: Array<{ code: string; count: number }>;
  authorities: Array<{ key: string; count: number }>;
}

type ArrayFilterKey =
  | 'groups' | 'companies' | 'brands' | 'sources' | 'sourceTypes' | 'countries'
  | 'languages' | 'categories' | 'sentiments' | 'riskLevels' | 'verification';

export function FilterPanel({
  options, query, onChange, onReset, resultCount,
}: {
  options: FilterOptions | null;
  query: FeedQuery;
  onChange: (patch: Partial<FeedQuery>) => void;
  onReset: () => void;
  resultCount?: number;
}) {
  const toggle = (key: ArrayFilterKey, value: string) => {
    const current = (query[key] as string[] | undefined) ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ [key]: next.length ? next : undefined } as Partial<FeedQuery>);
  };

  const activeCount = ([
    'groups', 'companies', 'brands', 'sources', 'sourceTypes', 'countries',
    'languages', 'categories', 'sentiments', 'riskLevels', 'verification',
  ] as ArrayFilterKey[]).reduce((sum, key) => sum + ((query[key] as string[] | undefined)?.length ?? 0), 0)
    + (query.from ? 1 : 0) + (query.to ? 1 : 0)
    + (query.bookmarkedOnly ? 1 : 0) + (query.importantOnly ? 1 : 0)
    + (query.includeDemo === false ? 1 : 0);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          Filters
          {activeCount > 0 ? <Badge tone="accent">{activeCount}</Badge> : null}
        </h2>
        {activeCount > 0 ? (
          <Button size="sm" variant="ghost" onClick={onReset}>
            <FilterX className="h-3 w-3" aria-hidden="true" />
            Clear
          </Button>
        ) : null}
      </div>

      {resultCount !== undefined ? (
        <p className="px-1 pb-2 text-[11px] text-subtle">
          {resultCount.toLocaleString('en-IN')} matching {resultCount === 1 ? 'story' : 'stories'}
        </p>
      ) : null}

      <Section title="Company group" defaultOpen>
        {(options?.groups ?? []).map((group) => (
          <Checkbox
            key={group.key}
            label={group.label}
            checked={(query.groups ?? []).includes(group.key)}
            onChange={() => toggle('groups', group.key)}
          />
        ))}
      </Section>

      <Section title="Company" count={(query.companies ?? []).length}>
        <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
          {(options?.companies ?? []).map((company) => (
            <Checkbox
              key={company.key}
              label={
                <span className="flex items-center gap-1.5">
                  {company.name}
                  {company.relation !== 'SELF' ? (
                    <span className="text-[10px] uppercase text-subtle">{company.relation.toLowerCase()}</span>
                  ) : null}
                </span>
              }
              checked={(query.companies ?? []).includes(company.key)}
              onChange={() => toggle('companies', company.key)}
            />
          ))}
        </div>
      </Section>

      <Section title="Brand" count={(query.brands ?? []).length}>
        <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto pr-1">
          {(options?.brands ?? []).map((brand) => (
            <Checkbox
              key={brand}
              label={brand}
              checked={(query.brands ?? []).includes(brand)}
              onChange={() => toggle('brands', brand)}
            />
          ))}
        </div>
      </Section>

      <Section title="Category" count={(query.categories ?? []).length} defaultOpen>
        <div className="scroll-thin max-h-56 space-y-1 overflow-y-auto pr-1">
          {(options?.categories ?? []).map((category) => (
            <Checkbox
              key={category.key}
              label={
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: category.colorHex }}
                    aria-hidden="true"
                  />
                  {category.label}
                </span>
              }
              checked={(query.categories ?? []).includes(category.key)}
              onChange={() => toggle('categories', category.key)}
            />
          ))}
        </div>
      </Section>

      <Section title="Sentiment" count={(query.sentiments ?? []).length} defaultOpen>
        {SENTIMENTS.map((sentiment) => (
          <Checkbox
            key={sentiment}
            label={sentiment.charAt(0) + sentiment.slice(1).toLowerCase()}
            checked={(query.sentiments ?? []).includes(sentiment)}
            onChange={() => toggle('sentiments', sentiment)}
          />
        ))}
      </Section>

      <Section title="Risk level" count={(query.riskLevels ?? []).length} defaultOpen>
        {RISK_LEVELS.map((level) => (
          <Checkbox
            key={level}
            label={level.charAt(0) + level.slice(1).toLowerCase()}
            checked={(query.riskLevels ?? []).includes(level)}
            onChange={() => toggle('riskLevels', level)}
          />
        ))}
      </Section>

      <Section title="Verification" count={(query.verification ?? []).length}>
        {VERIFICATION_STATUSES.map((status) => (
          <Checkbox
            key={status}
            label={VERIFICATION_LABELS[status]}
            checked={(query.verification ?? []).includes(status)}
            onChange={() => toggle('verification', status)}
          />
        ))}
      </Section>

      <Section title="Source" count={(query.sources ?? []).length}>
        <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
          {(options?.sources ?? []).map((source) => (
            <Checkbox
              key={source.key}
              label={
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{source.name}</span>
                  {source.mode === 'DEMO' ? (
                    <span className="shrink-0 text-[9px] uppercase text-amber-600">demo</span>
                  ) : null}
                </span>
              }
              checked={(query.sources ?? []).includes(source.key)}
              onChange={() => toggle('sources', source.key)}
            />
          ))}
        </div>
      </Section>

      <Section title="Source type" count={(query.sourceTypes ?? []).length}>
        <div className="scroll-thin max-h-52 space-y-1 overflow-y-auto pr-1">
          {(Object.keys(SOURCE_TYPE_LABELS) as SourceType[]).map((type) => (
            <Checkbox
              key={type}
              label={SOURCE_TYPE_LABELS[type]}
              checked={(query.sourceTypes ?? []).includes(type)}
              onChange={() => toggle('sourceTypes', type)}
            />
          ))}
        </div>
      </Section>

      <Section title="Country" count={(query.countries ?? []).length}>
        <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto pr-1">
          {(options?.countries ?? []).map((country) => (
            <Checkbox
              key={country.code}
              label={`${COUNTRY_NAMES[country.code] ?? country.code} (${country.count})`}
              checked={(query.countries ?? []).includes(country.code)}
              onChange={() => toggle('countries', country.code)}
            />
          ))}
        </div>
      </Section>

      <Section title="Language" count={(query.languages ?? []).length}>
        <div className="scroll-thin max-h-44 space-y-1 overflow-y-auto pr-1">
          {(options?.languages ?? []).map((language) => (
            <Checkbox
              key={language.code}
              label={`${LANGUAGE_NAMES[language.code] ?? language.code} (${language.count})`}
              checked={(query.languages ?? []).includes(language.code)}
              onChange={() => toggle('languages', language.code)}
            />
          ))}
        </div>
      </Section>

      <Section title="Date range" defaultOpen>
        <div className="space-y-2">
          <label className="block text-[11px] text-subtle">
            Published from
            <Input
              type="date"
              value={query.from?.slice(0, 10) ?? ''}
              onChange={(event) =>
                onChange({ from: event.target.value ? new Date(event.target.value).toISOString() : undefined })
              }
              className="mt-1"
            />
          </label>
          <label className="block text-[11px] text-subtle">
            Published to
            <Input
              type="date"
              value={query.to?.slice(0, 10) ?? ''}
              onChange={(event) => {
                if (!event.target.value) return onChange({ to: undefined });
                // Include the whole selected day.
                const end = new Date(event.target.value);
                end.setHours(23, 59, 59, 999);
                onChange({ to: end.toISOString() });
              }}
              className="mt-1"
            />
          </label>
        </div>
      </Section>

      <Section title="Other" defaultOpen>
        <Checkbox
          label="Bookmarked only"
          checked={!!query.bookmarkedOnly}
          onChange={(event) => onChange({ bookmarkedOnly: event.target.checked || undefined })}
        />
        <Checkbox
          label="Briefing shortlist only"
          checked={!!query.importantOnly}
          onChange={(event) => onChange({ importantOnly: event.target.checked || undefined })}
        />
        <Checkbox
          label="Hide demo data"
          checked={query.includeDemo === false}
          onChange={(event) => onChange({ includeDemo: event.target.checked ? false : undefined })}
        />
      </Section>
    </div>
  );
}

function Section({
  title, children, defaultOpen, count,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  return (
    <div className="border-b border-[var(--border)] pb-1 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md px-1 py-2 text-xs font-medium hover:bg-[var(--bg-subtle)]"
      >
        <span className="flex items-center gap-1.5">
          {title}
          {count ? <Badge tone="accent">{count}</Badge> : null}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open ? <div className="space-y-1 px-1 pb-2">{children}</div> : null}
    </div>
  );
}
