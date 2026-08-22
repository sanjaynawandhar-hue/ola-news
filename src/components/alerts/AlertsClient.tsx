'use client';

import * as React from 'react';
import { BellRing, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, Input, Modal, Select, Skeleton, Textarea, Toggle } from '@/components/ui';
import { useApi, mutate } from '@/hooks/useApi';
import { useToast } from '@/components/providers';
import { useRefresh } from '@/components/refresh/RefreshProvider';
import { relativeTime } from '@/lib/time';
import { RISK_LEVELS, SENTIMENTS } from '@/lib/constants';
import type { AlertCriteria } from '@/types';

interface AlertRow {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  throttleMins: number;
  channels: string[];
  criteria: AlertCriteria;
  lastTriggeredAt: string | null;
  eventCount: number;
}

interface AlertsResponse {
  items: AlertRow[];
  channels: Array<{ channel: string; enabled: boolean }>;
}

const EMPTY_FORM = {
  name: '',
  description: '',
  keywords: '',
  companyKeys: [] as string[],
  executives: '',
  products: '',
  categories: [] as string[],
  sentiments: [] as string[],
  minRiskLevel: '',
  authorities: '',
  volumeSpikeEnabled: false,
  volumeMultiplier: 2,
  volumeWindowHours: 24,
  throttleMins: 30,
};

export function AlertsClient() {
  const { push } = useToast();
  const { dataVersion } = useRefresh();
  const { data, loading, error, reload } = useApi<AlertsResponse>('/api/alerts', [dataVersion]);
  const { data: filters } = useApi<{
    companies: Array<{ key: string; name: string }>;
    categories: Array<{ key: string; label: string }>;
    authorities: Array<{ key: string }>;
  }>('/api/filters', []);

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const splitList = (value: string) =>
    value.split(',').map((v) => v.trim()).filter(Boolean);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const criteria: AlertCriteria = {};
      if (form.keywords.trim()) criteria.keywords = splitList(form.keywords);
      if (form.companyKeys.length) criteria.companyKeys = form.companyKeys;
      if (form.executives.trim()) criteria.executives = splitList(form.executives);
      if (form.products.trim()) criteria.products = splitList(form.products);
      if (form.categories.length) criteria.categories = form.categories;
      if (form.sentiments.length) criteria.sentiments = form.sentiments as AlertCriteria['sentiments'];
      if (form.minRiskLevel) criteria.minRiskLevel = form.minRiskLevel as AlertCriteria['minRiskLevel'];
      if (form.authorities.trim()) criteria.authorities = splitList(form.authorities);
      if (form.volumeSpikeEnabled) {
        criteria.volumeSpike = {
          multiplier: Number(form.volumeMultiplier) || 2,
          windowHours: Number(form.volumeWindowHours) || 24,
        };
      }

      if (Object.keys(criteria).length === 0) {
        throw new Error('Add at least one condition — an alert with no conditions would never fire.');
      }

      await mutate('/api/alerts', {
        body: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          enabled: true,
          throttleMins: Number(form.throttleMins) || 30,
          channels: ['inapp'],
          criteria,
        },
      });
      setOpen(false);
      setForm(EMPTY_FORM);
      reload();
      push({ tone: 'success', title: 'Alert created', description: form.name.trim() });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not create this alert',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAlert = async (alert: AlertRow, enabled: boolean) => {
    try {
      await mutate('/api/alerts', { method: 'PATCH', body: { id: alert.id, enabled } });
      reload();
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not update this alert',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const remove = async (alert: AlertRow) => {
    try {
      await mutate(`/api/alerts?id=${alert.id}`, { method: 'DELETE' });
      reload();
      push({ tone: 'success', title: 'Alert deleted', description: alert.name });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Could not delete this alert',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <BellRing className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            Alerts
          </h1>
          <p className="mt-0.5 max-w-3xl text-xs text-subtle">
            Alerts are evaluated during every refresh. Matches appear in the notification bell.
            Email and Slack channels are wired into the notifier interface but are not configured —
            they are shown as unavailable rather than silently doing nothing.
          </p>
        </div>
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New alert
        </Button>
      </div>

      {data?.channels?.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-subtle">Delivery channels:</span>
          {data.channels.map((channel) => (
            <Badge key={channel.channel} tone={channel.enabled ? 'positive' : 'neutral'}>
              {channel.channel}
              {channel.enabled ? '' : ' — not configured'}
            </Badge>
          ))}
        </div>
      ) : null}

      {error ? <ErrorState title="Could not load alerts" message={error} onRetry={reload} /> : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <EmptyState
          icon={<BellRing className="h-6 w-6" aria-hidden="true" />}
          title="No alerts configured"
          description="Create an alert to be notified when a story matches a keyword, company, executive, category, sentiment, risk level, regulator — or when coverage volume spikes."
          action={<Button variant="primary" size="sm" onClick={() => setOpen(true)}>Create your first alert</Button>}
        />
      ) : (
        <div className="space-y-3">
          {data!.items.map((alert) => (
            <Card key={alert.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{alert.name}</h3>
                  {alert.description ? (
                    <p className="mt-0.5 text-xs text-muted">{alert.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {renderCriteria(alert.criteria)}
                  </div>
                  <p className="mt-2 text-[11px] text-subtle">
                    {alert.eventCount} notification(s) raised ·{' '}
                    {alert.lastTriggeredAt
                      ? `last fired ${relativeTime(alert.lastTriggeredAt)}`
                      : 'never fired'}{' '}
                    · throttled to once every {alert.throttleMins} min
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Toggle
                    label="Enabled"
                    checked={alert.enabled}
                    onChange={(next) => void toggleAlert(alert, next)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => void remove(alert)}
                    aria-label={`Delete alert ${alert.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New alert"
        description="All conditions must match for the alert to fire. Leave a field blank to ignore it."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void create()} loading={saving} disabled={!form.name.trim()}>
              Create alert
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Alert name" required>
            <Input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Ola Electric regulatory action"
            />
          </Field>

          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="What should the reader do when this fires?"
            />
          </Field>

          <Field label="Keywords" hint="Comma-separated. Matched against the headline and description.">
            <Input
              value={form.keywords}
              onChange={(event) => setForm({ ...form, keywords: event.target.value })}
              placeholder="recall, show cause, penalty"
            />
          </Field>

          <Field label="Companies">
            <div className="scroll-thin max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {(filters?.companies ?? []).map((company) => (
                <Checkbox
                  key={company.key}
                  label={company.name}
                  checked={form.companyKeys.includes(company.key)}
                  onChange={() =>
                    setForm({
                      ...form,
                      companyKeys: form.companyKeys.includes(company.key)
                        ? form.companyKeys.filter((k) => k !== company.key)
                        : [...form.companyKeys, company.key],
                    })
                  }
                />
              ))}
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Executives" hint="Comma-separated names.">
              <Input
                value={form.executives}
                onChange={(event) => setForm({ ...form, executives: event.target.value })}
                placeholder="Bhavish Aggarwal"
              />
            </Field>
            <Field label="Products" hint="Comma-separated product names.">
              <Input
                value={form.products}
                onChange={(event) => setForm({ ...form, products: event.target.value })}
                placeholder="Ola S1 Pro"
              />
            </Field>
          </div>

          <Field label="Categories">
            <div className="scroll-thin max-h-36 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {(filters?.categories ?? []).map((category) => (
                <Checkbox
                  key={category.key}
                  label={category.label}
                  checked={form.categories.includes(category.key)}
                  onChange={() =>
                    setForm({
                      ...form,
                      categories: form.categories.includes(category.key)
                        ? form.categories.filter((k) => k !== category.key)
                        : [...form.categories, category.key],
                    })
                  }
                />
              ))}
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sentiment">
              <div className="space-y-1">
                {SENTIMENTS.map((sentiment) => (
                  <Checkbox
                    key={sentiment}
                    label={sentiment.charAt(0) + sentiment.slice(1).toLowerCase()}
                    checked={form.sentiments.includes(sentiment)}
                    onChange={() =>
                      setForm({
                        ...form,
                        sentiments: form.sentiments.includes(sentiment)
                          ? form.sentiments.filter((s) => s !== sentiment)
                          : [...form.sentiments, sentiment],
                      })
                    }
                  />
                ))}
              </div>
            </Field>
            <Field label="Minimum risk level">
              <Select
                value={form.minRiskLevel}
                onChange={(event) => setForm({ ...form, minRiskLevel: event.target.value })}
                className="w-full"
              >
                <option value="">Any risk level</option>
                {RISK_LEVELS.map((level) => (
                  <option key={level} value={level}>{level.toLowerCase()} and above</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Regulatory authorities" hint="Comma-separated, e.g. SEBI, MoRTH, CCI.">
            <Input
              value={form.authorities}
              onChange={(event) => setForm({ ...form, authorities: event.target.value })}
              placeholder="SEBI, MoRTH"
            />
          </Field>

          <div className="rounded-lg border border-[var(--border)] p-3">
            <Toggle
              label="Alert on a coverage volume spike"
              description="Fires when recent coverage volume exceeds its own recent baseline by the chosen multiple."
              checked={form.volumeSpikeEnabled}
              onChange={(next) => setForm({ ...form, volumeSpikeEnabled: next })}
            />
            {form.volumeSpikeEnabled ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Multiplier">
                  <Input
                    type="number" min={1.1} max={20} step={0.1}
                    value={form.volumeMultiplier}
                    onChange={(event) => setForm({ ...form, volumeMultiplier: Number(event.target.value) })}
                  />
                </Field>
                <Field label="Window (hours)">
                  <Input
                    type="number" min={1} max={168}
                    value={form.volumeWindowHours}
                    onChange={(event) => setForm({ ...form, volumeWindowHours: Number(event.target.value) })}
                  />
                </Field>
              </div>
            ) : null}
          </div>

          <Field label="Throttle (minutes)" hint="Minimum gap between notifications from this alert.">
            <Input
              type="number" min={0} max={1440}
              value={form.throttleMins}
              onChange={(event) => setForm({ ...form, throttleMins: Number(event.target.value) })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function renderCriteria(criteria: AlertCriteria) {
  const chips: React.ReactNode[] = [];
  const add = (label: string, values?: string[] | null) => {
    if (values?.length) {
      chips.push(
        <Badge key={label} tone="accent">
          {label}: {values.slice(0, 4).join(', ')}
          {values.length > 4 ? ` +${values.length - 4}` : ''}
        </Badge>,
      );
    }
  };
  add('keywords', criteria.keywords);
  add('companies', criteria.companyKeys);
  add('executives', criteria.executives);
  add('products', criteria.products);
  add('categories', criteria.categories);
  add('sentiment', criteria.sentiments);
  add('authorities', criteria.authorities);
  if (criteria.minRiskLevel) {
    chips.push(<Badge key="risk" tone="warning">risk ≥ {criteria.minRiskLevel.toLowerCase()}</Badge>);
  }
  if (criteria.volumeSpike) {
    chips.push(
      <Badge key="spike" tone="negative">
        volume spike ≥ {criteria.volumeSpike.multiplier}× over {criteria.volumeSpike.windowHours}h
      </Badge>,
    );
  }
  if (chips.length === 0) chips.push(<Badge key="none">no conditions</Badge>);
  return chips;
}

function Field({
  label, children, hint, required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-[var(--color-negative)]">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] text-subtle">{hint}</span> : null}
    </label>
  );
}
