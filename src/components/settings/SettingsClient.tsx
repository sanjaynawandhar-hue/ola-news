'use client';

import * as React from 'react';
import { Building2, Palette, Plus, Settings2, Tag, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, CardBody, CardHeader, ErrorState, Input, InfoTip, Modal, Select,
  Skeleton, Tabs, Textarea, Toggle,
} from '@/components/ui';
import { Logo } from '@/components/layout/Logo';
import { useApi, mutate } from '@/hooks/useApi';
import { useSettings, useToast } from '@/components/providers';
import { SUPPORTED_TIMEZONES } from '@/lib/time';
import { REFRESH_INTERVALS, COMPANY_GROUP_LABELS, type CompanyGroup } from '@/lib/constants';

interface CompanyRow {
  id: string; key: string; name: string; legalName: string | null; group: string;
  relation: string; ticker: string | null; description: string | null; colorHex: string | null;
  active: boolean; aliases: string[];
  brands: Array<{ id: string; name: string; aliases: string[] }>;
  executives: Array<{ id: string; name: string; role: string | null; aliases: string[] }>;
  products: Array<{ id: string; name: string; kind: string | null; aliases: string[] }>;
}

export function SettingsClient() {
  const [tab, setTab] = React.useState('branding');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
          <Settings2 className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
          Settings
        </h1>
        <p className="mt-0.5 text-xs text-subtle">
          Branding, tracked entities, keywords, categories and dashboard behaviour. Changes take
          effect on the next refresh.
        </p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'branding', label: 'Branding & display' },
          { value: 'companies', label: 'Companies & entities' },
          { value: 'keywords', label: 'Keywords' },
          { value: 'categories', label: 'Categories' },
        ]}
        className="max-w-2xl"
      />

      {tab === 'branding' ? <BrandingSettings /> : null}
      {tab === 'companies' ? <CompanySettings /> : null}
      {tab === 'keywords' ? <KeywordSettings /> : null}
      {tab === 'categories' ? <CategorySettings /> : null}
    </div>
  );
}

/* ------------------------------------------------------------- Branding -- */

function BrandingSettings() {
  const { settings, save, saving } = useSettings();
  const { push } = useToast();
  const [form, setForm] = React.useState(settings);

  // Re-seed the form whenever the saved settings change (for example after a
  // successful save), adjusting state during render rather than in an effect.
  const [lastSaved, setLastSaved] = React.useState(settings);
  if (settings !== lastSaved) {
    setLastSaved(settings);
    setForm(settings);
  }

  const submit = async () => {
    try {
      await save({
        personalName: form.personalName,
        showPersonalBranding: form.showPersonalBranding,
        logoPath: form.logoPath,
        logoAttribution: form.logoAttribution,
        timezone: form.timezone,
        autoRefreshMinutes: form.autoRefreshMinutes,
        relevanceThreshold: form.relevanceThreshold,
        demoDataEnabled: form.demoDataEnabled,
      });
      push({ tone: 'success', title: 'Settings saved' });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not save settings',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Company branding"
          description="The logo used in the header and in every export"
          tooltip="Supply the official Ola logo from the brand owner, or an authorised source. Never stretch, redraw or recolour it — the app always preserves its aspect ratio."
        />
        <CardBody className="space-y-3.5">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3">
            <Logo size={44} />
            <div className="min-w-0 text-xs">
              <p className="font-medium">Current mark</p>
              <p className="text-subtle">{settings.logoPath}</p>
            </div>
          </div>

          <label className="block text-xs font-medium">
            Logo path
            <Input
              value={form.logoPath}
              onChange={(event) => setForm({ ...form, logoPath: event.target.value })}
              placeholder="/branding/ola-logo.svg"
              className="mt-1"
            />
            <span className="mt-1 block text-[10.5px] text-subtle">
              Place the file in <code className="font-mono">public/branding/</code> and enter its path
              here (for example <code className="font-mono">/branding/ola-logo.png</code>). SVG, PNG
              and JPEG are supported; SVG is rasterised for PowerPoint.
            </span>
          </label>

          <label className="block text-xs font-medium">
            Logo attribution / usage note
            <Textarea
              rows={2}
              value={form.logoAttribution}
              onChange={(event) => setForm({ ...form, logoAttribution: event.target.value })}
              className="mt-1"
            />
            <span className="mt-1 block text-[10.5px] text-subtle">
              Shown as the logo tooltip. Record here where the asset came from and that its use is
              permitted.
            </span>
          </label>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            The bundled mark is a <strong>placeholder</strong>, not the Ola logo. Replace it only with
            an official asset supplied by the brand owner or obtained from an authorised official
            source, and confirm that your use is permitted.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Personal branding"
          description="“Prepared for …” in the footer and in exports"
          tooltip="Kept deliberately smaller than the company mark, and never placed over news content."
        />
        <CardBody className="space-y-3.5">
          <label className="block text-xs font-medium">
            Your name
            <Input
              value={form.personalName}
              onChange={(event) => setForm({ ...form, personalName: event.target.value })}
              placeholder="[YOUR NAME]"
              className="mt-1"
            />
            <span className="mt-1 block text-[10.5px] text-subtle">
              Can also be set with the <code className="font-mono">OLA_NEWS_BRAND_NAME</code>{' '}
              environment variable; this setting overrides it.
            </span>
          </label>

          <Toggle
            label="Show personal branding in exports"
            description="Hides “Prepared for …” from PNG cards and PPTX footers when off."
            checked={form.showPersonalBranding}
            onChange={(next) => setForm({ ...form, showPersonalBranding: next })}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Display" description="Timezone and theme" />
        <CardBody className="space-y-3.5">
          <label className="block text-xs font-medium">
            <span className="flex items-center gap-1">
              Display timezone
              <InfoTip label="All publication and fetch times across the dashboard, PNG cards and PPTX decks are rendered in this timezone. Indian Standard Time is the default." />
            </span>
            <Select
              value={form.timezone}
              onChange={(event) => setForm({ ...form, timezone: event.target.value })}
              className="mt-1 w-full"
            >
              {SUPPORTED_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                  {zone === 'Asia/Kolkata' ? ' (IST — default)' : ''}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-xs font-medium">
            <span className="flex items-center gap-1">
              Automatic refresh
              <InfoTip label="When set, the dashboard starts a refresh on this interval while a tab is open. Manual refresh is always available." />
            </span>
            <Select
              value={String(form.autoRefreshMinutes)}
              onChange={(event) =>
                setForm({ ...form, autoRefreshMinutes: Number(event.target.value) })
              }
              className="mt-1 w-full"
            >
              {REFRESH_INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>{interval.label}</option>
              ))}
            </Select>
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Data & intelligence" description="Ingestion behaviour" />
        <CardBody className="space-y-3.5">
          <label className="block text-xs font-medium">
            <span className="flex items-center gap-1">
              Relevance threshold
              <InfoTip label="Items scoring below this are still stored for the audit trail but are suppressed from the feed and all metrics. Raise it to reduce noise; lower it to catch weaker mentions." />
            </span>
            <Input
              type="number" min={0} max={100}
              value={form.relevanceThreshold}
              onChange={(event) =>
                setForm({ ...form, relevanceThreshold: Number(event.target.value) })
              }
              className="mt-1"
            />
          </label>

          <Toggle
            label="Include demo data"
            description="The built-in labelled sample dataset. Turn off to run on live sources only."
            checked={form.demoDataEnabled}
            onChange={(next) => setForm({ ...form, demoDataEnabled: next })}
          />
        </CardBody>
      </Card>

      <div className="lg:col-span-2">
        <Button variant="primary" onClick={() => void submit()} loading={saving}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Companies -- */

function CompanySettings() {
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{ items: CompanyRow[] }>('/api/companies', []);
  const [childModal, setChildModal] = React.useState<{
    companyKey: string; companyName: string; kind: 'brand' | 'executive' | 'product';
  } | null>(null);
  const [childName, setChildName] = React.useState('');
  const [childAliases, setChildAliases] = React.useState('');
  const [childRole, setChildRole] = React.useState('');

  const addChild = async () => {
    if (!childModal || !childName.trim()) return;
    try {
      await mutate(`/api/companies/children?kind=${childModal.kind}`, {
        body: {
          companyKey: childModal.companyKey,
          name: childName.trim(),
          role: childRole.trim() || null,
          kind: childModal.kind === 'product' ? childRole.trim() || null : null,
          aliases: childAliases.split(',').map((a) => a.trim()).filter(Boolean),
        },
      });
      setChildModal(null);
      setChildName(''); setChildAliases(''); setChildRole('');
      reload();
      push({ tone: 'success', title: `${childModal.kind} added` });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not add this entry',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const removeChild = async (kind: string, id: string) => {
    try {
      await mutate(`/api/companies/children?kind=${kind}&id=${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not remove this entry',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (error) return <ErrorState title="Could not load companies" message={error} onRetry={reload} />;
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  const grouped = (data?.items ?? []).reduce<Record<string, CompanyRow[]>>((acc, company) => {
    (acc[company.group] ??= []).push(company);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <p className="max-w-3xl text-xs text-subtle">
        Entity matching runs against these names and their aliases. A longer, more specific alias
        scores higher confidence than a short ambiguous one, so prefer full names (for example
        “Ola Electric Mobility Limited”) over bare tokens.
      </p>

      {Object.entries(grouped).map(([group, companies]) => (
        <section key={group} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-subtle">
            {COMPANY_GROUP_LABELS[group as CompanyGroup] ?? group}
          </h2>
          {companies.map((company) => (
            <Card key={company.key} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />
                    {company.name}
                    <Badge tone={company.relation === 'SELF' ? 'accent' : 'neutral'}>
                      {company.relation.toLowerCase()}
                    </Badge>
                    {company.ticker ? <Badge tone="info">{company.ticker}</Badge> : null}
                  </h3>
                  {company.legalName ? (
                    <p className="mt-0.5 text-[11px] text-subtle">{company.legalName}</p>
                  ) : null}
                  {company.aliases.length ? (
                    <p className="mt-1 text-[11px] text-muted">
                      <span className="text-subtle">Aliases:</span> {company.aliases.join(' · ')}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <ChildList
                  title="Brands"
                  items={company.brands.map((b) => ({ id: b.id, label: b.name, sub: b.aliases.join(', ') }))}
                  onAdd={() => setChildModal({ companyKey: company.key, companyName: company.name, kind: 'brand' })}
                  onRemove={(id) => void removeChild('brand', id)}
                />
                <ChildList
                  title="Executives"
                  items={company.executives.map((e) => ({ id: e.id, label: e.name, sub: e.role ?? '' }))}
                  onAdd={() => setChildModal({ companyKey: company.key, companyName: company.name, kind: 'executive' })}
                  onRemove={(id) => void removeChild('executive', id)}
                />
                <ChildList
                  title="Products"
                  items={company.products.map((p) => ({ id: p.id, label: p.name, sub: p.kind ?? '' }))}
                  onAdd={() => setChildModal({ companyKey: company.key, companyName: company.name, kind: 'product' })}
                  onRemove={(id) => void removeChild('product', id)}
                />
              </div>
            </Card>
          ))}
        </section>
      ))}

      <Modal
        open={!!childModal}
        onClose={() => setChildModal(null)}
        title={`Add ${childModal?.kind ?? ''}`}
        description={childModal ? `Tracked under ${childModal.companyName}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChildModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={() => void addChild()} disabled={!childName.trim()}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-medium">
            Name
            <Input
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              className="mt-1"
              autoFocus
            />
          </label>
          {childModal?.kind !== 'brand' ? (
            <label className="block text-xs font-medium">
              {childModal?.kind === 'executive' ? 'Role' : 'Product kind'}
              <Input
                value={childRole}
                onChange={(event) => setChildRole(event.target.value)}
                placeholder={childModal?.kind === 'executive' ? 'Chief Executive Officer' : 'VEHICLE'}
                className="mt-1"
              />
            </label>
          ) : null}
          <label className="block text-xs font-medium">
            Aliases
            <Input
              value={childAliases}
              onChange={(event) => setChildAliases(event.target.value)}
              placeholder="Comma-separated alternative spellings"
              className="mt-1"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}

function ChildList({
  title, items, onAdd, onRemove,
}: {
  title: string;
  items: Array<{ id: string; label: string; sub: string }>;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-subtle">{title}</h4>
        <Button size="sm" variant="ghost" onClick={onAdd} aria-label={`Add ${title.toLowerCase()}`}>
          <Plus className="h-3 w-3" aria-hidden="true" />
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-subtle">None configured.</p>
      ) : (
        <ul className="scroll-thin max-h-40 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate" title={item.sub || item.label}>
                {item.label}
                {item.sub ? <span className="text-subtle"> · {item.sub}</span> : null}
              </span>
              <button
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.label}`}
                className="shrink-0 text-[var(--fg-subtle)] hover:text-[var(--color-negative)]"
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Keywords -- */

function KeywordSettings() {
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{
    items: Array<{ id: string; term: string; type: string; weight: number; companyName: string | null }>;
  }>('/api/keywords', []);
  const [term, setTerm] = React.useState('');
  const [type, setType] = React.useState<'TRACK' | 'EXCLUDE'>('TRACK');
  const [weight, setWeight] = React.useState(1);

  const add = async () => {
    if (!term.trim()) return;
    try {
      await mutate('/api/keywords', { body: { term: term.trim(), type, weight } });
      setTerm('');
      reload();
      push({ tone: 'success', title: 'Keyword added' });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not add this keyword',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const remove = async (id: string) => {
    await mutate(`/api/keywords?id=${id}`, { method: 'DELETE' });
    reload();
  };

  if (error) return <ErrorState title="Could not load keywords" message={error} onRetry={reload} />;

  const tracked = (data?.items ?? []).filter((k) => k.type === 'TRACK');
  const excluded = (data?.items ?? []).filter((k) => k.type === 'EXCLUDE');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Add a keyword"
          description="Tracked terms raise relevance; excluded terms suppress a story entirely"
          tooltip="Excluded keywords are the fix for false positives from short ambiguous tokens — for example excluding “Hola” or “Granola” so they never match “Ola”."
        />
        <CardBody>
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-52 flex-1 text-xs font-medium">
              Term
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="e.g. battery cell manufacturing"
                className="mt-1"
              />
            </label>
            <label className="text-xs font-medium">
              Type
              <Select
                value={type}
                onChange={(event) => setType(event.target.value as 'TRACK' | 'EXCLUDE')}
                className="mt-1 w-36"
              >
                <option value="TRACK">Track</option>
                <option value="EXCLUDE">Exclude</option>
              </Select>
            </label>
            {type === 'TRACK' ? (
              <label className="text-xs font-medium">
                Weight
                <Input
                  type="number" min={0} max={3} step={0.1}
                  value={weight}
                  onChange={(event) => setWeight(Number(event.target.value))}
                  className="mt-1 w-24"
                />
              </label>
            ) : null}
            <Button variant="primary" onClick={() => void add()} disabled={!term.trim()}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <KeywordList title={`Tracked keywords (${tracked.length})`} items={tracked} onRemove={(id) => void remove(id)} />
          <KeywordList title={`Excluded keywords (${excluded.length})`} items={excluded} onRemove={(id) => void remove(id)} tone="negative" />
        </div>
      )}
    </div>
  );
}

function KeywordList({
  title, items, onRemove, tone = 'accent',
}: {
  title: string;
  items: Array<{ id: string; term: string; weight: number; companyName: string | null }>;
  onRemove: (id: string) => void;
  tone?: 'accent' | 'negative';
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {items.length === 0 ? (
          <p className="text-xs text-subtle">None configured.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map((keyword) => (
              <span
                key={keyword.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px]"
              >
                <Tag className="h-3 w-3 text-[var(--fg-subtle)]" aria-hidden="true" />
                {keyword.term}
                {tone === 'accent' && keyword.weight !== 1 ? (
                  <Badge tone="accent">×{keyword.weight}</Badge>
                ) : null}
                {keyword.companyName ? (
                  <span className="text-subtle">· {keyword.companyName}</span>
                ) : null}
                <button
                  onClick={() => onRemove(keyword.id)}
                  aria-label={`Remove keyword ${keyword.term}`}
                  className="text-[var(--fg-subtle)] hover:text-[var(--color-negative)]"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ----------------------------------------------------------- Categories -- */

function CategorySettings() {
  const { push } = useToast();
  const { data, loading, error, reload } = useApi<{
    items: Array<{
      id: string; key: string; label: string; description: string | null;
      colorHex: string; keywords: string[]; sortOrder: number; active: boolean;
    }>;
  }>('/api/categories', []);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');

  const saveKeywords = async (key: string) => {
    try {
      await mutate('/api/categories', {
        method: 'PATCH',
        body: { key, keywords: draft.split(',').map((k) => k.trim()).filter(Boolean) },
      });
      setEditing(null);
      reload();
      push({ tone: 'success', title: 'Category updated' });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not update this category',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const toggleActive = async (key: string, active: boolean) => {
    await mutate('/api/categories', { method: 'PATCH', body: { key, active } });
    reload();
  };

  if (error) return <ErrorState title="Could not load categories" message={error} onRetry={reload} />;
  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-xs text-subtle">
        Stories are classified by weighted keyword match — a hit in the headline counts double a hit
        in the description. Editing a category&apos;s keywords changes how future refreshes classify
        stories; existing stories keep their original classification.
      </p>

      {(data?.items ?? []).map((category) => (
        <Card key={category.key} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: category.colorHex }}
                  aria-hidden="true"
                />
                {category.label}
                <code className="font-mono text-[10px] text-subtle">{category.key}</code>
              </h3>
              {category.description ? (
                <p className="mt-0.5 text-[11px] text-subtle">{category.description}</p>
              ) : null}

              {editing === category.key ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    rows={3}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Comma-separated keywords"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => void saveKeywords(category.key)}>
                      Save keywords
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {category.keywords.slice(0, 12).map((keyword) => (
                    <span
                      key={keyword}
                      className="rounded border border-[var(--border)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10.5px]"
                    >
                      {keyword}
                    </span>
                  ))}
                  {category.keywords.length > 12 ? (
                    <span className="text-[10.5px] text-subtle">
                      +{category.keywords.length - 12} more
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(category.key);
                      setDraft(category.keywords.join(', '));
                    }}
                  >
                    <Palette className="h-3 w-3" aria-hidden="true" />
                    Edit keywords
                  </Button>
                </div>
              )}
            </div>

            <Toggle
              label="Active"
              checked={category.active}
              onChange={(next) => void toggleActive(category.key, next)}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
