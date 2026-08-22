# Ola News

An executive news-intelligence dashboard that collects, analyses and presents news,
research and regulatory activity concerning **ANI Technologies / Ola Cabs**,
**Ola Electric** and **Krutrim**, along with the competitors, partners and policy
developments that affect them.

It provides one place to monitor current coverage, track regulatory activity, surface
reputation / financial / operational / legal / regulatory risk, analyse volume and
sentiment, spot emerging issues, and export branded PNG news cards and real editable
PowerPoint briefings.

---

## Table of contents

- [What this is](#what-this-is)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Running the dashboard](#running-the-dashboard)
- [Running on live data only](#running-on-live-data-only)
- [Sources: what is live, what is not](#sources-what-is-live-what-is-not)
- [Adding a source](#adding-a-source)
- [Adding companies and keywords](#adding-companies-and-keywords)
- [Supplying the official logo](#supplying-the-official-logo)
- [Configuring the personal branding name](#configuring-the-personal-branding-name)
- [How live refresh works](#how-live-refresh-works)
- [How the intelligence pipeline works](#how-the-intelligence-pipeline-works)
- [How PNG generation works](#how-png-generation-works)
- [How PowerPoint generation works](#how-powerpoint-generation-works)
- [Alerts](#alerts)
- [Security and compliance](#security-and-compliance)
- [Testing](#testing)
- [Deploy it somewhere shareable](#deploy-it-somewhere-shareable)
- [Known limitations](#known-limitations)

---

## What this is

**Pages**

| Page | Purpose |
| --- | --- |
| `/` Executive overview | KPIs, **market context** (Sensex, Nifty 50, Ola Electric with sparklines and a rebased relative-performance chart), volume/sentiment trends, company comparison, top publishers, trending topics, emerging issues, geography, source health |
| `/feed` Live news feed | Card and table views, full-text search, 12 filter dimensions, sorting, bulk selection, bookmarks, saved views, PNG export |
| `/regulatory` Regulatory tracker | Notices, circulars, orders, investigations, penalties, filings, court matters and policy, with issue/effective/deadline dates and severity |
| `/analytics` | Deeper trend, category and comparison analysis per company group |
| `/about` About the companies | Founders, leadership, offices, factories, scale and culture for each tracked company, with a source and verification state on every entry |
| `/briefing` Briefings & exports | Reorder the shortlist, choose slides and theme, download a real `.pptx`; export history |
| `/alerts` | Create and manage alert rules; see what fired |
| `/saved` | Bookmarks and the briefing shortlist |
| `/sources` | Per-connector health, mode, credibility, last error, compliance notes |
| `/settings` | Branding, timezone, auto-refresh, relevance threshold, companies/brands/executives/products, keywords, categories |

**Demo data is opt-out and unmistakable.** Sample records carry `isDemo`, render with a
`DEMO DATA` badge everywhere including PNG cards and PPTX slides, and are gated at three
levels: the connector's mode, its adapter, and the `demoDataEnabled` setting. A source
backed by the sample dataset cannot be re-labelled `LIVE` through the API.

**Company details are entered, not collected.** The `/about` page is the one place that is
not fed by a live source. The seed carries only long-standing, widely documented facts —
founding years, founders, headquarters city, listing status — and every one of them lands
**unverified with no source**. Headcount, street addresses, plant capacities and wider
leadership rosters are deliberately left blank rather than guessed: a wrong figure on an
executive briefing is worse than a visible gap. Fill them in with a source URL and mark
the entry verified; until then the UI shows a *needs verification* badge and names the
categories that are still empty. Tests enforce this — the seed fails CI if it ever gains
a headcount, a street address or a capacity figure.

**Every number is traceable.** The overview's KPI tiles and company tabs are links: click
*Total stories* and the feed opens filtered to exactly those stories, carrying the same
company-group and date scope. Filters round-trip through the URL, so any view can be
bookmarked or shared. Date-scoped links use a relative window (`withinDays=30`) rather
than a baked-in timestamp, so a shared link still means "the last 30 days" tomorrow.

**A note that runs through the whole product:** summaries, sentiment, risk levels,
relevance and importance are **automated estimates with stated confidence**, not
verified facts. The publisher's original headline and their own syndicated
description are always stored and displayed *separately* from anything the pipeline
generates, and every story links back to the original.

---

## Architecture

```
Browser (React 19 client components)
  │  fetch()
  ▼
Next.js 16 App Router — route handlers under src/app/api/**
  │   · zod validation · in-process rate limiting · uniform error envelope
  ▼
Domain layer (src/lib)
  ├─ ingest/        adapters → normalize → dedupe → cluster → pipeline
  ├─ intelligence/  entities → relevance → categories → sentiment → risk
  │                 → summarize → importance → trends   (+ optional LLM)
  ├─ export/        png-card (canvas) · pptx (pptxgenjs) · qr · theme
  ├─ alerts.ts      rule matching + pluggable notifier channels
  ├─ queries.ts     all dashboard reads and aggregations
  └─ settings.ts    runtime configuration
  ▼
Prisma 7 (driver adapters) → SQLite (dev) or PostgreSQL (production)
```

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS v4 · Prisma 7 · Recharts · `@napi-rs/canvas` · `pptxgenjs` · `qrcode` ·
`fast-xml-parser` · Zod · Vitest.

**Separation of concerns**

- **Adapters** know how to talk to one kind of source and nothing else. They return a
  `RawItem[]` and never touch the database.
- **Normalisation** turns a `RawItem` into the canonical persisted shape (canonical URL,
  hashes, fingerprints) and rejects unusable rows.
- **Deduplication** is publisher-aware. A repeat from the *same* publisher is dropped;
  near-identical coverage from a *different* publisher is kept, because that is the raw
  signal for corroboration — it is merged into one story cluster instead.
- **Intelligence** modules are pure functions over text plus configuration, which is why
  they are directly unit-testable.
- **Route handlers** are thin: validate, call the domain layer, return.

**Data model** (`prisma/schema.prisma`): Company, Brand, Executive, Product, Keyword,
Category, Source, Article, Analysis, SentimentResult, RiskAssessment, ArticleEntity,
StoryCluster, RegulatoryDocument, Alert, AlertEvent, Bookmark, ImportantStory,
SavedView, Briefing, ExportRecord, RefreshJob, SourceFailure, Setting.

Every article records its original URL, canonical URL, publication time, fetch time,
source, processing status and analysis metadata.

> SQLite has no native enum or JSON type, so enum-like columns are `String` (constants
> live in `src/lib/constants.ts`) and structured payloads are JSON-encoded `String`.
> This keeps one schema portable across both providers.

---

## Local setup

**Prerequisites:** Node.js 20+ (developed on 26) and npm.

```bash
npm install
cp .env.example .env
npm run setup      # migrate + generate + seed
npm run dev
```

Open <http://localhost:3000>.

If the native SQLite binding fails to load (`Could not locate the bindings file`),
rebuild it for your Node version:

```bash
npm rebuild better-sqlite3 --build-from-source
```

---

## Environment variables

See [`.env.example`](.env.example) for the annotated list. The essentials:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./dev.db` | SQLite path or PostgreSQL connection string |
| `OLA_NEWS_BRAND_NAME` | `[YOUR NAME]` | "Prepared for …" personal branding |
| `OLA_NEWS_LOGO_PATH` | `/branding/ola-logo.svg` | Logo used in the header and exports |
| `OLA_NEWS_TIMEZONE` | `Asia/Kolkata` | Default display timezone |
| `OLA_NEWS_ENABLE_DEMO_DATA` | `true` | Include the labelled demo dataset |
| `NEWSAPI_KEY`, `NEWSDATA_API_KEY`, `GNEWS_API_KEY`, `BING_NEWS_API_KEY` | — | Unlock the matching commercial connector |
| `ANTHROPIC_API_KEY` | — | Optional LLM summarisation; falls back to the local engine |

All secrets are server-side. This project deliberately defines **no** `NEXT_PUBLIC_*`
variables, and `src/lib/env.ts` carries the `server-only` guard so a client component
importing it fails the build.

---

## Database setup

**SQLite (default).** Nothing to install; `npm run setup` creates `dev.db`.

**PostgreSQL (production).**

```bash
npm run db:use-postgres          # flips the datasource provider, clears old migrations
# set DATABASE_URL in .env
npx prisma migrate dev --name init
npm run db:seed
```

`npm run db:use-sqlite` switches back. The adapter is chosen automatically from the
`DATABASE_URL` scheme at runtime, so no code changes are needed.

| Script | Purpose |
| --- | --- |
| `npm run setup` | migrate + generate + seed |
| `npm run db:migrate` | create/apply a migration |
| `npm run db:deploy` | apply migrations (production) |
| `npm run db:seed` | seed companies, sources, categories, alerts, demo data |
| `npm run db:reset` | drop and rebuild |
| `npm run db:studio` | Prisma Studio |
| `npm run demo:off` | switch to live sources only (disable **and** delete demo records) |
| `npm run demo:disable` | stop ingesting demo data but keep existing records |
| `npm run db:reanalyse` | re-score stored articles after changing keywords, lexicons or tracked entities |
| `npm run db:backfill-regulatory` | create regulatory-tracker entries for already-collected regulator items |

---

## Running the dashboard

```bash
npm run dev        # development
npm run build      # production build (runs prisma generate first)
npm start          # serve the production build
npm test           # unit tests
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

---

## Running on live data only

The seed ships a labelled demo dataset so a fresh install is not an empty screen.
To run on live sources only:

```bash
npm run demo:off     # disables demo ingestion and deletes existing demo records
```

This also removes exports and briefings that were generated *from* demo stories, so the
export history does not keep showing sample-derived filenames. Re-running
`npm run db:seed` or `npm run setup` afterwards will **not** bring demo data back — the
seed reads the stored setting and skips the sample dataset — and it never re-enables a
connector an administrator has turned off.

then press **Refresh news** (or `POST /api/refresh`). You can also just untick
**Include demo data** in Settings → Data & intelligence, which stops future ingestion
without deleting what is already stored.

To go back, re-enable it in Settings and refresh — the dataset stays in the codebase.

> Live coverage depends entirely on what the tracked companies are actually in the news
> for. If the feed looks thin, widen the date range in the header, lower the relevance
> threshold in Settings, or add tracked keywords.

---

## Sources: what is live, what is not

The Sources page reports each connector's **true** status, and so does this table.
The dashboard never fabricates results for a source it cannot reach.

### Live — verified reachable, collected every refresh

| Source | Type | Notes |
| --- | --- | --- |
| Google News search RSS | Aggregator | Query-driven per tracked entity |
| GDELT DOC 2.0 API | Aggregator | Free public API, throttled to ~1 request / 5s; queries capped at 3 per run |
| **SEBI** RSS | Regulator | Official feed. Every item is also written to the regulatory tracker as a primary document |
| Economic Times — Auto, Tech, Markets | Business / Auto / Tech | Publisher RSS |
| Mint — Companies, Industry, Markets, Technology | Business / Tech | Publisher RSS |
| The Hindu BusinessLine — Companies, Markets | Business | Publisher RSS |

### Awaiting credentials — adapter implemented, needs an API key

NewsAPI.org · NewsData.io · GNews.io · Bing News Search.

Set the matching key (see `.env.example`), restart, then enable the source on `/sources`.

### Disabled — blocked by the publisher, or no machine-readable feed

| Source | Why |
| --- | --- |
| Press Information Bureau | Endpoint returns HTTP 403 to automated clients |
| MoRTH | Publishes HTML/PDF notifications only; no feed |
| BSE / NSE announcements | Block unauthenticated automated access; require an exchange data licence |
| MCA21 | Authenticated portal with per-document charges |
| Courts & tribunals (eCourts / NCLT) | CAPTCHA-protected search |
| Ola Electric newsroom, Ola Cabs blog, Krutrim blog | Client-rendered pages with no feed; left disabled pending a review of site terms for this use |
| Business Standard, NDTV Profit, Moneycontrol | Return HTTP 403 to automated clients |

Each carries a compliance note on `/sources` explaining exactly why. Connectors are in
place — enable one only once you have a licensed feed or written permission.

### Demo data

A clearly-labelled sample dataset (39 articles, 11 regulatory records) so the dashboard
is usable without paid credentials. It is unmistakable:

- stored with `isDemo: true` and rendered with a **DEMO DATA** badge everywhere,
  including on PNG cards and PPTX slides;
- publishers are fictional ("Demo Business Wire"), never real outlets;
- links point at `example.com`, the IANA-reserved documentation domain;
- no real quotation, filing number or regulatory notice is reproduced.

Turn it off in **Settings → Data & intelligence**, or set
`OLA_NEWS_ENABLE_DEMO_DATA=false`.

---

## Adding a source

**From the UI:** `/sources` lets you enable, disable and inspect connectors.

**A new feed** — add an entry to `prisma/seed-data/sources.ts` and re-seed, or `POST
/api/sources`:

```jsonc
{
  "key": "example-business",
  "name": "Example Business Daily",
  "endpoint": "https://example.com/feed.xml",
  "adapter": "rss",                 // rss | google-news | gdelt | newsapi | newsdata | gnews | bing-news | demo
  "sourceType": "BUSINESS",
  "credibility": 75,                // 0-100, feeds relevance and importance
  "mode": "LIVE",
  "isRegulatory": false,
  "complianceNote": "Publisher-provided RSS. Headline, summary and link only."
}
```

**A new kind of source** — implement the `SourceAdapter` interface in
`src/lib/ingest/adapters/`, register it in `adapters/index.ts`, and reference its key
as `adapter`. Adapters receive the tracked search queries, rate limit and credential,
and return `RawItem[]`.

Before enabling anything, confirm the publisher permits automated collection.

---

## Adding companies and keywords

**Settings → Companies & entities** manages companies, brands, executives and products.
Entity matching runs against each name plus its aliases, on word boundaries, and a
longer more specific alias scores higher confidence — prefer
"Ola Electric Mobility Limited" over a bare token.

**Settings → Keywords**:

- **Tracked** keywords raise relevance (with a weight);
- **Excluded** keywords suppress a story outright. These are the fix for false
  positives on short ambiguous tokens — the seed excludes `Hola`, `Granola` and
  `Ola Bini` so they never match "Ola".

**Settings → Categories** edits the classifier's keyword lists. Changes affect future
refreshes; already-classified stories keep their original category.

Seed defaults live in `prisma/seed-data/companies.ts`.

---

## Supplying the official logo

The repository ships a **placeholder mark** at `public/branding/ola-logo.svg`. It is
not the Ola logo.

To use the real logo:

1. Obtain it from the brand owner or another **authorised official source**, and
   confirm your use is permitted.
2. Drop the file into `public/branding/` (SVG, PNG or JPEG).
3. Point **Settings → Company branding → Logo path** at it (e.g. `/branding/ola-logo.png`),
   or set `OLA_NEWS_LOGO_PATH`.
4. Record its provenance in the **Logo attribution** field.

The app always preserves the logo's aspect ratio and never redraws, stretches or
recolours it. SVG logos are rasterised before being placed into PowerPoint, which does
not render SVG reliably. If the file is missing or fails to load, a neutral placeholder
is shown rather than a broken image.

---

## Configuring the personal branding name

Set `OLA_NEWS_BRAND_NAME` in `.env`, or edit **Settings → Personal branding → Your name**
(the setting overrides the environment variable). It appears as
*"Prepared for &lt;name&gt;"* in the dashboard footer, on PNG cards and in PPTX slide
footers — always smaller than the company mark and never over news content.

Toggle **Show personal branding in exports** off to omit it from generated files.

---

## How live refresh works

Press **Refresh news** in the header, or set an automatic interval in Settings
(off / 5 / 15 / 30 / 60 minutes).

1. `POST /api/refresh` creates a `RefreshJob` and returns its id immediately. If a job
   is already running, the same id is returned rather than starting a duplicate — the
   button is disabled while it runs and guarded by a ref against double clicks.
2. Enabled sources are contacted in batches (default 4 concurrent), each with its own
   per-host rate limit, timeout, and bounded exponential-backoff retry. A `403` is
   treated as a permissions signal and never retried; `429` and `5xx` are retried.
3. Items are normalised, deduplicated within the batch and against the database,
   analysed, clustered, and stored.
4. Alerts are evaluated against the newly stored stories.
5. Progress is written to the job row after every source; the UI polls
   `GET /api/refresh/status` and shows live per-source state.

The panel reports sources being checked, items fetched, new items stored, duplicates
removed, per-source failures with status codes, completion status and the last
successful refresh time.

**One failed source never stops the run.** Failures are recorded in `SourceFailure`,
surfaced in the refresh panel and on `/sources`, and counted in the job summary. A
source that is unavailable is reported as failed — never quietly replaced with
placeholder results.

---

## How the intelligence pipeline works

| Stage | What it does |
| --- | --- |
| **Entity extraction** | Word-boundary matching of configured companies, brands, executives and products, plus built-in regulators and locations. Confidence scales with alias specificity. |
| **Keyword matching** | Every keyword lookup is inflection-aware and boundary-anchored: `unveil` matches "unveils" and "unveiled", while `petition` never matches "competition" and `ola` never matches "granola". Terms under four characters stay exact so `ai` does not match "aid". |
| **Relevance** | 0–100 from which tracked entities appear, whether in the headline or body, tracked keyword weights, regulator co-mention and source credibility. Excluded keywords force 0. |
| **Category** | Weighted keyword classifier over the configurable taxonomy; headline matches count double. |
| **Sentiment** | Lexicon estimator with additive smoothing (one weak term cannot produce a maximal score), negation handling, intensifiers, multi-word phrases, and a directional-polarity rule so "complaints rise" reads negative while "revenue rises" reads positive. |
| **Risk** | Explicit driver keyword groups (recall, safety, regulatory action, investigation, litigation, financial stress, governance, fraud, consumer, workforce, supply, data, competition, ESG) mapped to five business dimensions, amplified by negative sentiment and gated by relevance. |
| **Content type** | Distinguishes reporting, opinion, analysis and press material. |
| **Deduplication** | Canonical URL → normalised headline → SimHash + Jaccard, publisher-aware. |
| **Clustering** | Looser SimHash/Jaccard match within a 96-hour window groups related coverage into one story. |
| **Corroboration** | Distinct publishers carrying the same story drive the verification status: Official → Corroborated → Single source → Unverified. |
| **Importance** | Nine explicitly weighted factors — relevance, recency (48h half-life), source credibility, corroboration, regulatory significance, risk, sentiment intensity, coverage spike, business impact. Each contribution is inspectable. |
| **Trends** | Volume-spike detection against a rolling baseline; emerging topics by lift against the prior period. |
| **Market context** | Sensex, Nifty 50 and the Ola Electric share price, each with a sparkline, plus a chart rebasing all three to 100 so a ₹38 share and a 77,000-point index compare on one axis. The panel states plainly whether the company out- or under-performed the benchmarks, which separates a company-specific move from a market-wide one. Quotes come from Yahoo Finance's chart endpoint — publicly reachable but **not a documented, supported API** — so it is rate limited, cached for five minutes, and a failure is shown as *unavailable* rather than filled with a stale or invented price. Indicative, delayed, and not investment advice. ANI Technologies and Krutrim are private and so are absent rather than shown as empty tiles. |
| **Regulatory** | Items from a regulator, exchange, court or ministry source are written to the regulatory tracker with document type and severity inferred from the authority's own wording — but only if they actually concern the portfolio. A regulator's feed is dominated by enforcement against unrelated parties (recovery certificates, demat attachments, appeals by named individuals), which is rejected at collection. A document is kept when it **names** a tracked company or executive, or when it is a **general instrument that binds one**: an obligation on listed entities (LODR, disclosure, insider trading, governance) or a rule covering electric vehicles, ride-hailing, consumer protection or data protection. Every rejection records a reason. |

Summaries are **extractive by default**: the heuristic engine reuses the publisher's own
headline and syndicated description and adds an explicitly derived framing sentence. It
never asserts facts absent from the source and never invents quotations, figures or
links. With `ANTHROPIC_API_KEY` set, Claude writes the summary and "why this matters"
under a prompt that forbids adding anything not present in the input. Every record
stores which engine produced its text (`heuristic-v1` or `llm:<model>`).

Items below the relevance threshold are still stored (for the audit trail) but marked
`SUPPRESSED` and excluded from the feed and metrics.

---

## How PNG generation works

**Export PNG** on any story opens a preview dialog. The preview is rendered by the same
endpoint that produces the download, so what you see is exactly what you get.

- Server-side rendering with `@napi-rs/canvas` at 2× for a high-resolution result.
- Sizes: **Email** 1200×675 · **WhatsApp** 1080×1350 · **Executive report** 1600×2000 ·
  **Presentation** 1920×1080 · **Social square** 1080×1080.
- Each card carries the original headline, the machine-generated summary, "why this
  matters", company, category, sentiment, risk, publisher, publication date,
  verification and confidence indicators, a QR code and short link to the original,
  the generation date, Ola News branding and the small "Prepared for …" line.
  Taller formats add a signal-breakdown panel.
- Risk level drives a coloured accent rail; demo records carry a **DEMO DATA — NOT LIVE
  NEWS** marker.
- **The full article body is never rendered into the image.** Only the headline, the
  generated summary and metadata appear, always alongside attribution and a link back.

`GET /api/export/png?articleId=…&preset=email` returns the image;
adding `&download=true` sets a download disposition and records an `ExportRecord`.

---

## How PowerPoint generation works

`/briefing` builds a real, editable `.pptx` with `pptxgenjs`.

- **Slide templates:** cover, executive summary, standard news, positive announcement,
  risk/crisis alert, regulatory update, company comparison, trend chart, closing/sources.
  The story template is chosen automatically from each story's own risk and sentiment.
- **Native PowerPoint objects only** — text boxes, shapes, tables and real charts
  (`line` for the trend slide, clustered `bar` for the comparison slide). Nothing is a
  screenshot, and charts remain editable in PowerPoint.
- **Source links stay clickable**, and each story and regulatory slide carries a QR code
  to the original article or official document.
- Each story slide shows the original headline, concise summary, "why this matters",
  company, category, sentiment and risk, publisher, publication date, source link,
  verification/confidence, related-story count, Ola News branding and the small
  "Prepared for …" footer.
- Briefing types: daily, weekly, regulatory, risk & crisis, custom selection, single
  story. Themes: Ola Light, Ola Dark, Executive Mono. 16:9 throughout.
- Reorder, remove and preview stories before generating; auto-select the top N by
  importance score. The closing slide lists every source with its link and flags demo
  records.

`POST /api/export/pptx` returns the file and records a `Briefing` plus an `ExportRecord`.
Individual slides can be exported as PNG cards from the same page.

---

## Alerts

Create rules on `/alerts` matching on keywords, company, executive, product,
competitor, category, sentiment, minimum risk level, regulatory authority, regulatory
document type, or a **coverage volume spike** (a multiple of the recent baseline over a
chosen window). All supplied conditions must match.

Alerts are evaluated during every refresh and throttled per rule. Matches appear in the
header notification bell.

Delivery is abstracted behind a `Notifier` interface. **In-app** is implemented; **email**
and **Slack** are registered but disabled and shown as *not configured* — the system
never silently pretends to have delivered a message. Adding a channel means
implementing one `Notifier` and enabling it.

---

## Security and compliance

- API keys are server-side only. No `NEXT_PUBLIC_*` variables exist; `src/lib/env.ts`
  carries the `server-only` guard. `/sources` reports only *whether* a key is set.
- All external data is validated (Zod) and sanitised before storage or display. Feed
  HTML is stripped to text — no third-party markup is ever injected into the DOM — and
  only `http(s)` URLs are stored or rendered as links.
- Route handlers are rate limited per client and route (a tighter budget for refresh and
  exports) and return a uniform error envelope; stack traces are never exposed.
- Requests declare an identifying user agent, honour per-host rate limits, use timeouts
  and bounded retries, and log every source and processing failure.
- Duplicate ingestion is prevented at three levels (canonical URL, headline hash,
  content fingerprint), with a unique index on the URL hash as the final guard.
- **Copyright and terms:** only the headline, the publisher's own syndicated
  description, metadata and a link are stored. Full article bodies are never copied,
  paywalls are never bypassed, and sources that block automated collection are left
  disabled with the reason recorded.
- Indian Standard Time is the default display timezone; changeable in Settings.

---

## Testing

```bash
npm test
```

142 tests across 6 files:

| File | Covers |
| --- | --- |
| `normalize.test.ts` | Source normalisation, RSS/Atom parsing, GDELT mapping, URL canonicalisation, fingerprints |
| `dedupe-cluster.test.ts` | Duplicate detection (URL / headline / syndicated), cross-publisher preservation, story clustering |
| `intelligence.test.ts` | Company matching, relevance, category classification, sentiment mapping, risk mapping, content type, importance, verification, trend detection |
| `exports.test.ts` | PNG generation at every preset (verifying real PNG headers and pixel dimensions), PPTX generation (real ZIP, slide counts, native chart parts), QR generation |
| `refresh-behaviour.test.ts` | Retry/timeout behaviour, source failure handling, API rate limiting, alert rule matching, sanitisation |
| `branding-filtering.test.ts` | Branding configuration, export presets and themes, timezone handling, filtering helpers |

The app has been exercised end-to-end against the real live sources — a refresh
collecting 449 items across 13 connectors with a rate-limited source correctly reported
as failed — and is currently running on live data only, with real stories from CNBC TV18,
NDTV Profit, The Hindu BusinessLine, Mint, The Times of India, Inc42 and others, plus 28
primary SEBI documents in the regulatory tracker. Checked at mobile (375px), tablet and
desktop widths with no horizontal overflow and no hydration errors.

---

## Deployment

**Any Node host**

```bash
npm ci
npm run build
npm run db:deploy
npm start
```

**Vercel**

1. Switch to PostgreSQL (`npm run db:use-postgres`) — a serverless filesystem is
   ephemeral, so SQLite is not viable in production.
2. Provision Postgres (the Vercel Marketplace offers Neon and others) and set
   `DATABASE_URL`.
3. Add the environment variables from `.env.example`.
4. Set the build command to `prisma generate && prisma migrate deploy && next build`.
5. Optionally add a cron job hitting `POST /api/refresh` on your preferred interval
   instead of relying on browser-driven auto-refresh.

`@napi-rs/canvas`, `better-sqlite3` and `pptxgenjs` are declared in
`serverExternalPackages`, so they are loaded at runtime rather than bundled. Both export
routes declare an extended `maxDuration`.

---

## Open it on your phone or another computer

**Same Wi-Fi** — no accounts, works in about a minute:

```bash
npm run build && npm run start:lan     # bind to every network interface
npm run share                          # prints the address + a QR code
```

Scan the QR with your phone camera, or type the printed
`http://<your-ip>:3000` into any browser on the same network.

> Use `start:lan` (production), not `dev:lan`. The dev server works over the network
> but its hot-reload websocket cannot reach another device, which leaves pages stuck
> on loading placeholders. Production mode has no such socket.

Both devices must be on the same Wi-Fi and this machine must stay awake. The
dashboard has no login, so on a shared or public network start it read-only:

```bash
OLA_NEWS_PUBLIC_READ_ONLY=true npm run start:lan
```

**From anywhere** — deploy it, see below. That is the only option that survives
closing your laptop.

---

## Deploy it somewhere shareable

The dashboard runs on SQLite locally, which is perfect for one machine and
impossible on serverless — those filesystems are ephemeral and unshared, so every
deploy would wipe the data. Production therefore needs hosted PostgreSQL. The build
is self-configuring: `scripts/sync-db-provider.mjs` sets the Prisma provider from
`DATABASE_URL`, and refuses to build on Vercel if that still points at SQLite.

### Vercel + Neon (free tier, ~5 minutes)

```bash
npm i -g vercel
vercel login
```

1. **Create a PostgreSQL database.** In the Vercel dashboard: *Storage → Create →
   Neon (Serverless Postgres)*, or use any provider that gives you a connection
   string (Supabase, Prisma Postgres, Railway).

2. **Link and configure the project:**

   ```bash
   vercel link
   vercel env add DATABASE_URL production           # the Postgres connection string
   vercel env add OLA_NEWS_PUBLIC_READ_ONLY production   # true
   vercel env add OLA_NEWS_ADMIN_TOKEN production        # openssl rand -hex 32
   vercel env add OLA_NEWS_BRAND_NAME production         # your name
   ```

3. **Deploy:**

   ```bash
   vercel --prod
   ```

   `vercel-build` runs the provider sync, `prisma generate`, `prisma db push` and
   `next build`. The database schema is created on first deploy.

4. **Seed the tracked companies, sources and categories** (once, against the
   production database):

   ```bash
   vercel env pull .env.production.local
   DATABASE_URL="$(grep DATABASE_URL .env.production.local | cut -d= -f2- | tr -d '\"')" npm run deploy:seed
   ```

5. **Collect the first news.** Refreshing is a write, so it needs the admin token:

   ```bash
   curl -X POST https://<your-app>.vercel.app/api/refresh \
     -H "x-admin-token: <your token>"
   ```

### Keeping it fresh automatically

`vercel.json` registers a daily cron:

```json
{ "crons": [{ "path": "/api/cron/refresh", "schedule": "30 1 * * *" }] }
```

That is 01:30 UTC / 07:00 IST, so the overnight news cycle is collected before the
working day. **Vercel Hobby permits one cron run per day** — a more frequent
expression is rejected at deploy time with a clear error. On Pro, tighten it to
something like `0 */6 * * *`.

Vercel Cron can only issue a plain GET and cannot attach the admin token header,
so `/api/cron/refresh` carries its own guard: it accepts
`Authorization: Bearer $CRON_SECRET` (which Vercel sends automatically once that
variable is set) or the admin token for manual triggering, compared in constant
time. Set it with:

```bash
vercel env add CRON_SECRET production      # openssl rand -hex 32
```

Without `CRON_SECRET` the endpoint refuses every request — it is a GET, so the
read-only guard alone would not protect it, and an open refresh URL would let
anyone drain the shared per-host source rate limits.

The route also refuses to stack runs: if a refresh is already in flight it
returns `{ "skipped": true }` rather than starting a second one that would
compete with the first for the same rate limits.

### Publishing read-only

The dashboard has no user accounts. Set `OLA_NEWS_PUBLIC_READ_ONLY=true` before
exposing it publicly and visitors get everything worth showing — the feed, filters,
charts, regulatory tracker, PNG cards and PowerPoint briefings — while configuration
changes, deletions and manual refreshes are refused with a 403.

Administrator actions are unlocked by sending `OLA_NEWS_ADMIN_TOKEN` as an
`x-admin-token` header or an `ola_news_admin` cookie. To administer from the browser,
set the cookie once in the console:

```js
document.cookie = 'ola_news_admin=YOUR_TOKEN; path=/; max-age=31536000; samesite=lax';
```

The guard is enforced centrally in `withApi`, so a new endpoint cannot ship without
it. Leave the flag unset for a local install and nothing changes.

> **Native dependencies.** PNG rendering uses `@napi-rs/canvas`, which ships prebuilt
> Linux binaries and works on Vercel's Node runtime; it is listed in
> `serverExternalPackages` so it is loaded at runtime rather than bundled.

---

## Known limitations

- **Coverage is limited by what publishers permit.** Several important Indian sources —
  PIB, MoRTH, BSE, NSE, MCA and the courts — block automated collection or publish no
  machine-readable feed. Their connectors exist but ship disabled. Full regulatory
  coverage needs licensed feeds or written permission.
- **GDELT is aggressively rate limited** and may return HTTP 429 on a busy run. This is
  reported as a source failure rather than hidden.
- **The default analysis engine is heuristic, not a language model.** It is transparent,
  fast, free and explainable, but it is a lexicon-and-rules system: sarcasm, unusual
  phrasing and domain-specific idiom will be mis-scored. Set `ANTHROPIC_API_KEY` for
  LLM-written summaries. Treat every derived field as an estimate.
- **Clustering is lexical**, based on headline fingerprints. Two outlets describing the
  same event in very different words may not cluster; corroboration counts are a floor,
  not a guarantee.
- **Regulatory documents are only as complete as their sources.** Only SEBI is collected
  live today, and the overwhelming majority of what SEBI publishes is enforcement against
  unrelated parties, which is filtered out. The tracker is therefore often empty — that is
  the honest state, not a failure: it means nothing SEBI published recently touches the
  tracked companies. Meaningful coverage of MoRTH notifications, exchange filings and
  court matters needs the blocked connectors above or a licensed feed.
- **The relevance test is keyword-driven and conservative.** A document naming a tracked
  entity is always kept. A general instrument is kept only if its wording matches a known
  obligation category, so an unusually phrased circular could be missed. Run
  `npm run db:prune-regulatory` (dry run) to see how existing entries are being judged.
- **Most live coverage arrives via a Google News redirect.** Around 97% of currently
  collected stories link through `news.google.com`, whose article URLs are opaque tokens
  that only resolve in a browser (the redirect is performed by JavaScript). They cannot
  be followed server-side without reverse-engineering an undocumented endpoint, which
  this project does not do. The link works for a reader and the QR code resolves
  correctly; the UI and exports therefore show **"via Google News"** with the real
  publisher named separately, rather than printing a meaningless token under a headline
  attributed to a named outlet. Configuring a licensed news API (`NEWSAPI_KEY` and
  friends) yields direct publisher URLs.
- **Most live coverage arrives headline-only.** Google News and similar aggregators put
  the headline in the description field rather than a real summary. The pipeline detects
  that and stores no description instead of echoing the title, so those stories show a
  metadata-based summary and a prompt to open the source. Publisher feeds that syndicate
  a genuine description (Economic Times, Mint, BusinessLine) produce a real extractive
  summary.
- **Single-user, no authentication.** There is no login, and settings are global. Put it
  behind your own access control before exposing it beyond a trusted network.
- **Rate limiting is in-process.** Behind multiple instances, move the store to Redis.
- **Auto-refresh runs in the browser tab.** For unattended scheduling, use a server cron
  hitting `POST /api/refresh`.
- **The bundled logo is a placeholder**, not the Ola logo. See
  [Supplying the official logo](#supplying-the-official-logo).
- **The demo dataset is fictional.** It exists so the product can be evaluated without
  credentials and is labelled as such everywhere; it must never be read as news.
