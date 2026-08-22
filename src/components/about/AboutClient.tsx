'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2, CalendarDays, ExternalLink, Factory, Globe, Info, MapPin, Package,
  ShieldQuestion, Sparkles, Tag, Users,
} from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, EmptyState, ErrorState, Skeleton, Tabs, InfoTip } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/lib/utils';

interface Fact {
  id: string;
  category: 'FACILITY' | 'OFFICE' | 'SCALE' | 'CULTURE' | 'MILESTONE' | string;
  label: string;
  value: string | null;
  location: string | null;
  detail: string | null;
  sourceUrl: string | null;
  verified: boolean;
}

interface Person {
  id: string;
  name: string;
  role: string | null;
  kind: string;
  since: string | null;
  bio: string | null;
  profileUrl: string | null;
  sourceUrl: string | null;
  verified: boolean;
}

interface Profile {
  key: string;
  name: string;
  legalName: string | null;
  group: string;
  groupLabel: string;
  ticker: string | null;
  colorHex: string | null;
  profile: {
    about: string | null;
    foundedYear: number | null;
    headquarters: string | null;
    website: string | null;
    employeeRange: string | null;
    listingStatus: string | null;
    sourceUrl: string | null;
    verifiedAt: string | null;
  } | null;
  facts: Fact[];
  people: Person[];
  brands: string[];
  products: Array<{ name: string; kind: string | null }>;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  FACILITY: { label: 'Factories & facilities', icon: <Factory className="h-3.5 w-3.5" aria-hidden="true" /> },
  OFFICE: { label: 'Offices', icon: <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> },
  SCALE: { label: 'Scale', icon: <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> },
  CULTURE: { label: 'Culture', icon: <Users className="h-3.5 w-3.5" aria-hidden="true" /> },
  MILESTONE: { label: 'Milestones', icon: <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> },
};

/**
 * Marks anything a human has not yet checked against a primary source. The
 * dashboard would rather show a gap than assert a company fact it cannot back.
 */
function UnverifiedBadge() {
  return (
    <Badge
      tone="warning"
      title="Seeded from general knowledge and not yet checked against a primary source. Confirm it against the company's own filings or website, then record the source."
    >
      needs verification
    </Badge>
  );
}

export function AboutClient() {
  const { data, loading, error, reload } = useApi<{ items: Profile[] }>('/api/profiles', []);
  const [selected, setSelected] = React.useState('all');

  const companies = data?.items ?? [];
  const visible = selected === 'all' ? companies : companies.filter((c) => c.key === selected);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Info className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          About the tracked companies
        </h1>
        <p className="mt-0.5 max-w-3xl text-xs text-subtle">
          Founders, leadership, offices, facilities and scale for ANI Technologies / Ola Cabs, Ola
          Electric and Krutrim — the context behind the coverage in the feed.
        </p>
      </div>

      {/* ------------------------------------------------ Provenance note -- */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Company details are entered, not collected.</strong> Unlike the news feed, nothing
          on this page comes from a live source. What is seeded here is limited to long-standing,
          widely documented facts — founding years, founders, headquarters city, listing status.
          Headcount, addresses, capacities and leadership rosters are deliberately left blank rather
          than guessed, because a wrong figure on an executive briefing is worse than a gap. Fill
          them in from the company&apos;s own filings or website, attach the source, and mark the
          entry verified in{' '}
          <Link href="/settings" className="underline">Settings</Link>.
        </p>
      </div>

      <Tabs
        value={selected}
        onChange={setSelected}
        tabs={[
          { value: 'all', label: 'All companies', count: companies.length },
          ...companies.map((c) => ({ value: c.key, label: c.name })),
        ]}
        className="max-w-3xl"
      />

      {error ? <ErrorState title="Could not load company profiles" message={error} onRetry={reload} /> : null}

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title="No company profiles yet"
          description="Profiles are created by the seed. Run npm run db:seed, or add them from Settings."
        />
      ) : (
        visible.map((company) => <CompanyCard key={company.key} company={company} />)
      )}
    </div>
  );
}

function CompanyCard({ company }: { company: Profile }) {
  const profile = company.profile;
  const founders = company.people.filter((p) => p.kind === 'FOUNDER');
  const others = company.people.filter((p) => p.kind !== 'FOUNDER');

  const factsByCategory = company.facts.reduce<Record<string, Fact[]>>((acc, fact) => {
    (acc[fact.category] ??= []).push(fact);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: company.colorHex ?? 'var(--accent)' }}
              aria-hidden="true"
            />
            {company.name}
            {company.ticker ? <Badge tone="info">{company.ticker}</Badge> : null}
            {profile?.listingStatus ? (
              <Badge tone={profile.listingStatus === 'LISTED' ? 'positive' : 'neutral'}>
                {profile.listingStatus.toLowerCase()}
              </Badge>
            ) : null}
            {profile && !profile.verifiedAt ? <UnverifiedBadge /> : null}
          </span>
        }
        description={company.legalName ?? company.groupLabel}
        action={
          profile?.website ? (
            <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow"
               className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">
              Official site <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          ) : null
        }
      />

      <CardBody className="space-y-5">
        {/* --- About --------------------------------------------------- */}
        {profile?.about ? (
          <p className="max-w-4xl text-[13px] leading-relaxed text-muted">{profile.about}</p>
        ) : (
          <MissingNote what="A description of what this company does" />
        )}

        {/* --- At a glance --------------------------------------------- */}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Founded"
            value={profile?.foundedYear ? String(profile.foundedYear) : null}
          />
          <Stat
            icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Headquarters"
            value={profile?.headquarters ?? null}
          />
          <Stat
            icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Employees"
            value={profile?.employeeRange ?? null}
            hint="Left blank on purpose — headcount changes constantly and is rarely published. Add a range from the annual report."
          />
          <Stat
            icon={<Globe className="h-3.5 w-3.5" aria-hidden="true" />}
            label="Status"
            value={profile?.listingStatus ?? null}
          />
        </dl>

        {/* --- Founders and leadership --------------------------------- */}
        <section>
          <SectionTitle icon={<Users className="h-3.5 w-3.5" aria-hidden="true" />}>
            Founders {others.length > 0 ? '& leadership' : ''}
          </SectionTitle>
          {founders.length === 0 && others.length === 0 ? (
            <MissingNote what="Founder and leadership details" />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[...founders, ...others].map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </div>
          )}
          {others.length === 0 ? (
            <p className="mt-2 text-[11px] text-subtle">
              Wider leadership is not seeded — titles change often enough that a stale roster would
              mislead. Add them from the company&apos;s leadership page in Settings.
            </p>
          ) : null}
        </section>

        {/* --- Offices, facilities, scale, culture --------------------- */}
        {Object.keys(CATEGORY_META).map((category) => {
          const facts = factsByCategory[category];
          if (!facts?.length) return null;
          return (
            <section key={category}>
              <SectionTitle icon={CATEGORY_META[category].icon}>
                {CATEGORY_META[category].label}
              </SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                {facts.map((fact) => (
                  <FactCard key={fact.id} fact={fact} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Categories with nothing recorded are named rather than hidden, so
            the gap is visible instead of looking like the company has none. */}
        {(() => {
          const empty = Object.entries(CATEGORY_META)
            .filter(([key]) => !factsByCategory[key]?.length)
            .map(([, meta]) => meta.label.toLowerCase());
          return empty.length ? (
            <p className="text-[11px] text-subtle">
              Not yet recorded for this company: {empty.join(', ')}. Add entries in Settings with a
              source link.
            </p>
          ) : null;
        })()}

        {/* --- Brands and products ------------------------------------- */}
        {company.brands.length > 0 || company.products.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2">
            {company.brands.length > 0 ? (
              <div>
                <SectionTitle icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}>Brands</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {company.brands.map((brand) => (
                    <Badge key={brand} tone="accent">{brand}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {company.products.length > 0 ? (
              <div>
                <SectionTitle icon={<Package className="h-3.5 w-3.5" aria-hidden="true" />}>Products</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {company.products.map((product) => (
                    <Badge key={product.name}>{product.name}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* --- Provenance footer --------------------------------------- */}
        <p className="border-t border-[var(--border)] pt-3 text-[11px] text-subtle">
          {profile?.sourceUrl ? (
            <>
              Source:{' '}
              <a href={profile.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
                 className="text-[var(--accent)] hover:underline">
                {profile.sourceUrl}
              </a>
              {profile.verifiedAt ? ` · verified ${profile.verifiedAt.slice(0, 10)}` : ' · not yet verified'}
            </>
          ) : (
            'No source recorded for this profile. Add one in Settings and mark it verified.'
          )}
        </p>

        <Link
          href={`/feed?groups=${company.group}&sort=recent`}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"
        >
          See the latest coverage of {company.name}
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </CardBody>
    </Card>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">
      {icon}
      {children}
    </p>
  );
}

function Stat({
  icon, label, value, hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5">
      <dt className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-subtle">
        {icon}
        {label}
        {hint && !value ? <InfoTip label={hint} /> : null}
      </dt>
      <dd className={cn('mt-1 text-sm font-medium', !value && 'text-subtle')}>
        {value ?? 'Not recorded'}
      </dd>
    </div>
  );
}

function PersonCard({ person }: { person: Person }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold">{person.name}</span>
        {person.kind === 'FOUNDER' ? <Badge tone="accent">founder</Badge> : null}
        {!person.verified ? <UnverifiedBadge /> : null}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {person.role ?? 'Role not recorded'}
        {person.since ? ` · since ${person.since}` : ''}
      </p>
      {person.bio ? <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{person.bio}</p> : null}
      {person.profileUrl ? (
        <a href={person.profileUrl} target="_blank" rel="noopener noreferrer nofollow"
           className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline">
          Profile <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function FactCard({ fact }: { fact: Fact }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold">{fact.label}</span>
        {!fact.verified ? <UnverifiedBadge /> : null}
      </div>
      {fact.value ? <p className="mt-1 text-sm font-medium">{fact.value}</p> : null}
      {fact.location ? (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
          {fact.location}
        </p>
      ) : null}
      {fact.detail ? <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{fact.detail}</p> : null}
      {fact.sourceUrl ? (
        <a href={fact.sourceUrl} target="_blank" rel="noopener noreferrer nofollow"
           className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline">
          Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  );
}

function MissingNote({ what }: { what: string }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-3 text-xs text-subtle">
      {what} has not been recorded. Add it in Settings with a source link — the dashboard leaves
      this blank rather than asserting something it cannot back.
    </p>
  );
}
