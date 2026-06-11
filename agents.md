# Global Macro Dashboard — Agent Instructions

## Project Overview

Personal macroeconomic dashboard for market monitoring and research. Single-user focus (not multi-tenant SaaS).

Helps a macro-focused investor or trader quickly assess:

* Yield curve movements
* Interest rate expectations
* Inflation and labor market data (FRED)
* Central bank policy rates
* Commodity prices, FX, and global equities
* Major market indicators and crypto (BTC)
* FOMC rate decision probabilities (Kalshi prediction markets)

**Deployment target:** Vercel (serverless). Intended to be shareable via link; design for reasonable API usage when multiple tabs/users are open.

---

## Current State (Live Dashboard)

V1 mock data has been replaced with **live server-side feeds**. The app is a **single-page dashboard**.

### File layout

| File / directory | Role |
|---|---|
| `src/routes/+page.server.ts` | Load orchestration: tiered caches, parallel fetch, Kalshi Fed Watch, macro release alerts, `dataSources` metadata, fallbacks |
| `src/lib/services/yahoo.ts` | Yahoo batch fetch, per-symbol fallback, yield spread math (`fetchYahooMarketData`, `computeYieldSpreads`) |
| `src/lib/services/tradingview.ts` | TV scanner (rates/sovereign), CB quotes, ECB MRO normalization (`fetchTradingViewScan`, `fetchCentralBankRates`) |
| `src/lib/services/fred.ts` | Dual-pipeline FRED macro fetch + release calendar API (`fetchFredMacroData`, `fetchFredMacroReleaseSchedules`) |
| `src/lib/services/constants.ts` | Shared `FETCH_TIMEOUT_MS` (8000) |
| `src/lib/types/market.ts` | Shared types: `LiveQuote`, `MacroBlock`, `CentralBanks`, `DataSourceTag`, `DataSources`, etc. |
| `src/routes/+page.svelte` | UI, client refresh loop, price-flash animations, freshness badging, derived display |
| `src/routes/+layout.svelte` | App shell |
| `src/routes/layout.css` | Tailwind entry |

UI does not call external APIs directly. Raw fetch/parse/normalize logic belongs in `src/lib/services/` — not in `+page.server.ts`.

---

## Data Sources & Feeds

### Fast Track — every page load (~15s client refresh)

| Provider | Service module | Data |
|---|---|---|
| **Yahoo Finance** | `yahoo.ts` — batch `YAHOO_BATCH_SYMBOLS` + per-symbol fallback | BTC, SPX, NDX, DJI, FTSE, NSE, CSI 300, Gold, Silver, Brent (`BZ=F`), DXY, USD/JPY, USD/INR, US 10Y (`^TNX`), US 30Y (`^TYX`) |
| **TradingView scanner** | `tradingview.ts` — POST `scanner.tradingview.com/global/scan` | EFFR, SOFR (CME SR11 implied), US 3M, US 2Y, DE/JP/AU 10Y |

**Derived on server:** `spread2s10s` (10Y − 2Y), `spread10s30s` (30Y − 10Y) via `computeYieldSpreads()` in `yahoo.ts` (Yahoo 10Y/30Y + TV 2Y).

**Fast-track stale-on-failure cache:** `yahooMarketCache` and `tradingViewScanCache` in `+page.server.ts`, **TTL 30 seconds**. On live fetch failure within TTL, serve last good frame instead of static placeholders. After TTL expiry with no successful fetch, fall back to dev baselines.

### Slow Track — 4-hour server cache

| Provider | Service module | Data |
|---|---|---|
| **TradingView CB quotes** | `tradingview.ts` | Fed, ECB, RBI, BoJ, BoC, BoE, RBA policy rates |

**ECB rule (do not change):** `EUINTR` widget often surfaces deposit facility rate. MRO = deposit + 15bp since Sep 2024 (`normalizeEcbMroRate` in `tradingview.ts`).

### Macro Track — 12-hour server cache

| Provider | Series | Metric |
|---|---|---|
| **FRED** | `CPIAUCSL` | US CPI YoY |
| **FRED** | `CPILFESL` | Core CPI YoY |
| **FRED** | `PCEPILFE` | Core PCE YoY |
| **FRED** | `PAYEMS` | Nonfarm Payrolls net monthly change (K) |
| **FRED** | `UNRATE` | Unemployment rate (spot) |
| **FRED** | `GDPC1` | Real GDP QoQ annualized |

Implemented in `fred.ts`. FRED fetch: observations JSON API with `sort_order=desc` when `FRED_API_KEY` is set; otherwise public CSV graph (reversed to desc). History from `2018-01-01`, limit 48 obs.

**YoY / QoQ math uses calendar date matching** (not array index offsets) so missing FRED months (e.g. gaps in CPI) do not skew comparisons.

**Forecasts are hardcoded** in `FRED_MACRO_SERIES` inside `fred.ts` (consensus placeholders). They do not auto-update from an external source. Status/outcome is computed vs these static forecasts.

**Fallback:** `OFFICIAL_MACRO_2026` baseline bundle in `fred.ts` used when FRED fetch fails and no macro cache exists.

### Fed Watch — 1-hour server cache

| Provider | Data |
|---|---|
| **Kalshi** | `KXFEDDECISION-{YY}{MON}` markets — next FOMC meeting dominant probability (HOLD / 25bps CUT / 25bps HIKE) |

Kalshi logic lives in `+page.server.ts`. Uses `yes_sub_title` for classification ("Fed maintains rate" → HOLD; "Hike 0bps" → HOLD). Displayed as `FOMC [Kalshi] {date}: {action} ({probability})` in the sticky ribbon.

### Macro Release Alerts — 24-hour schedule cache

When any of the six macro indicators has an official print within the **next 24 hours**, a pulsing red `CRITICAL MACRO` message appears centered in the ribbon (countdown ticks client-side every 1s).

Release schedule: FRED `/series/release` + `/release/dates` via `fred.ts` when `FRED_API_KEY` is set; otherwise hardcoded BLS/BEA 2026 calendar in `+page.server.ts`. All prints assumed **8:30 AM ET**. Grouped prints share one alert (US CPI · Core CPI; NFP · Unemployment). Alert hides once `releaseAt` passes.

### Release Day Override

**8:29–8:35 AM ET:** FRED macro cache is bypassed on every refresh so CPI/NFP-style releases snap live during the BLS window.

---

## Tiered Cache Engine & Core Resilience Matrix

In-memory caches in `+page.server.ts` (per serverless instance on Vercel):

```
yahooMarketCache       — TTL 30s  (stale-on-failure only; always attempts live fetch)
tradingViewScanCache   — TTL 30s  (stale-on-failure only; always attempts live fetch)
centralBanksCache      — TTL 4 hours
macroBlocksCache       — TTL 12 hours (bypassed 8:29–8:35 AM ET)
macroReleaseDatesCache — TTL 24 hours
fedWatchCache          — TTL 1 hour
```

On cache miss or expiry: fetch fresh, update cache. On fetch failure: serve last good cache if available, else static fallbacks.

### Parallel load (`Promise.allSettled`)

The four core data tracks run **concurrently** on every `load()` — a slow or failed provider never blocks the others:

```typescript
Promise.allSettled([
  loadYahooMarketTrack(),        // → fetchYahooMarketData()
  loadTradingViewScanTrack(),    // → fetchTradingViewScan()
  loadCentralBankRatesTiered(),  // → fetchCentralBankRates()
  loadFredMacroBlocksTiered()    // → fetchFredMacroData()
])
```

Fed Watch and macro release alerts run in parallel via outer `Promise.all` alongside the settled core batch.

**Destructuring rule:** `Promise.all` returns `[coreSettled, fedWatch, macroReleaseAlerts]` — three elements only. Do not over-destructure.

### Data freshness metadata (`dataSources`)

Every `load()` returns sector-level source tags:

```typescript
dataSources: {
  markets: 'live' | 'cache' | 'fallback',      // Yahoo + TV combined (worst tier wins)
  macro: 'live' | 'cache' | 'fallback',      // FRED macro blocks
  centralBanks: 'live' | 'cache' | 'fallback' // CB policy strip
}
```

* **`live`** — fresh network fetch succeeded this load
* **`cache`** — served from tiered or fast-track memory cache (includes 4h/12h cache hits)
* **`fallback`** — static dev baselines (`FALLBACK`, `OFFICIAL_MACRO_2026`, `FALLBACK_CENTRAL_BANKS`)

Types exported from `+page.server.ts`: `DataSourceTag`, `DataSources`.

### UI freshness badging

`+page.svelte` reads `data.dataSources` and shows inline header badges (does not alter table cell widths):

* **`CACHED`** — neutral zinc, when `source === 'cache'`
* **`[STALE]`** — rose (`sourceBadgeStale`), when `source === 'fallback'`
* **`opacity-75`** on sector wrapper when fallback

Badges appear on: policy rates strip, all market section panels, yield spreads block, yield curve widget, US macro table widget.

**Client refresh:** `invalidateAll()` every **15 seconds** in `+page.svelte` `onMount`. This re-runs `load` but does not re-hit FRED/CB when server cache is fresh.

**Typical external API load per tab (warmed cache):** ~2 requests per 15s (Yahoo batch + TV scan) ≈ 8/min.

**Vercel note:** In-memory cache is not shared across all serverless instances or cold starts. For heavy shared traffic, consider Vercel KV / Upstash for shared macro/CB cache.

**Not yet implemented:** env kill switch (`PUBLIC_REFRESH_ENABLED`), pause-when-tab-hidden, client-side tiered intervals, circuit breakers, Fed Watch source badging.

---

## Macro Status & Outcome Rules

Exported type `MacroStatus`: `HOT BEAT` | `COOL MISS` | `EXP. BEAT` | `MISS` | `INLINE` | `PENDING`.

| Indicator type | Beat logic |
|---|---|
| CPI, Core CPI, PCE, Unemployment | actual > forecast → `HOT BEAT`; else `COOL MISS` |
| NFP, GDP | actual > forecast → `EXP. BEAT`; else `MISS` |

**UI colors (OUTCOME column):**

* **Rose (`text-rose-500`):** `HOT BEAT`, `MISS`
* **Emerald (`text-emerald-500`):** `EXP. BEAT`, `COOL MISS`

OUTCOME text lives in an inner `<span class="macroOutcome price-flash">` inside a normal `<td>` — never apply `price-flash` / `inline-block` directly on the `<td>`.

---

## UI — Implemented Features

### Top banner

* Live clocks: NY, London, Tokyo, New Delhi (1s client tick)
* US Treasury OPEN/CLOSED (NY, Mon–Fri 08:00–17:00)

### Sticky summary ticker

* Left: `Global Macro Dashboard`
* Center: macro release alert (when within 24h of a print) — `CRITICAL MACRO — {labels} in {countdown}`
* Right: LOCAL clock + `FOMC [Kalshi] {date}: {action} ({probability})`
* Scrolling duplicate track of all market tickers + spreads + BTC below
* Green/red flash on price change (`price-flash`, 800ms)

### Policy rates strip

* Horizontal scroll: FED, ECB, RBI, BOJ, BoC, BoE, RBA
* Freshness badge on `POLICY RATES:` label

### Category blocks (grid)

* **Row 1:** US Rates & Funding · Global Equities · Commodities & FX
* **Row 2:** Yield Spreads & Crypto · Global Sovereign 10Y

Each section header shows `CACHED` or `[STALE]` when applicable.

### Bottom row (two columns on `lg+`)

* **Yield Curve Monitor:** inline SVG (3M / 2Y / 10Y / 30Y), mini KPIs, 2s10s badge
* **US Macro Data Blocks:** `w-full table-fixed` table, column widths 30% / 15% / 20% / 15% / 20%

### Macro table columns

INDICATOR · ACTUAL · Δ VS PRIOR · FORECAST · OUTCOME — five `<td>` cells per row, data cells `text-right font-mono`.

### Responsive behavior

* `macroTableWrap` uses `overflow-x-auto` for narrow viewports
* Block grids collapse to single column on mobile

---

## Asset Universe (Live)

**US Rates & Funding:** EFFR, SOFR, 3M, 2Y, 10Y, 30Y

**Yield Spreads:** 2s10s, 10s30s

**Crypto:** BTC-USD

**Global Sovereign 10Y:** Bunds (DE), JGB (JP), Australia (AU)

**Global Equities:** SPX, NDX, DJI, FTSE, Nifty 50, CSI 300

**Commodities & FX:** Gold, Silver, Brent Crude, DXY, USD/JPY, USD/INR

**US Macro (FRED):** CPI YoY, Core CPI YoY, Core PCE YoY, NFP, Unemployment, GDP QoQ Ann.

**Central Banks:** US, EU (MRO-normalized), IN, JP, CA, GB, AU

**Fed Watch:** Kalshi `KXFEDDECISION` implied probabilities for next FOMC meeting

---

## Technology Stack

* **Framework:** SvelteKit 2 (Svelte 5 runes: `$props`, `$state`, `$derived`, `$effect`)
* **Language:** TypeScript
* **Styling:** Tailwind CSS 4
* **Package manager:** npm
* **Adapter:** `@sveltejs/adapter-auto` (Vercel-compatible)

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `FRED_API_KEY` | Recommended | FRED observations JSON API + release calendar; without it, CSV graph fallback and hardcoded 2026 release dates are used |

Copy `.env.example` to `.env` locally. Set the same variable in Vercel project settings for production. Never commit `.env`.

---

## Design Philosophy

Inspired by Bloomberg Terminal and institutional research UIs.

* Information density over excessive whitespace
* Functionality over visual effects
* Dark theme (`zinc` palette), professional, fast, responsive
* Subtle price-flash animations only — no marketing hero sections
* **Honest data:** never silently show stale static numbers — badge or dim when not live

---

## Development Standards

* TypeScript + SvelteKit conventions
* Prefer simple, maintainable solutions; minimal scope per change
* Raw API fetch/parse logic in `src/lib/services/`; orchestration and caches in `+page.server.ts`
* Comments only for non-obvious business logic (ECB normalization, calendar YoY, tiered cache, release window, Kalshi bucket classification)
* Do not add dependencies without strong reason
* Do not break mobile responsiveness or existing live metrics when editing macro/rates code

### Layout rules for macro table (do not regress)

* Table: `class="macroTable w-full table-fixed"`
* Fixed header widths: `w-[30%]`, `w-[15%]`, `w-[20%]`, `w-[15%]`, `w-[20%]`
* OUTCOME: inner span for colors/flash; `<td>` stays a normal table cell
* Freshness badges go in headers/wrappers only — never inside `<td>` or on table structure

### Service module conventions

* **`yahoo.ts`:** export `fetchYahooMarketData()`, `computeYieldSpreads()`, `YAHOO_BATCH_SYMBOLS`
* **`tradingview.ts`:** export `fetchTradingViewScan()`, `fetchCentralBankRates()`, `normalizeEcbMroRate()`
* **`fred.ts`:** export `fetchFredMacroData()`, `fetchFredMacroReleaseSchedules()`, `OFFICIAL_MACRO_2026`
* **`market.ts`:** shared types only — no fetch logic

---

## Roadmap

**Done**

* Live Yahoo + TradingView + FRED integration
* Service layer split (`src/lib/services/`, `src/lib/types/market.ts`)
* Tiered cache engine (fast / slow / macro / Fed Watch / release dates)
* Core Resilience Matrix: parallel `Promise.allSettled`, fast-track 30s stale-on-failure cache, `dataSources` metadata, UI freshness badging
* Release-window FRED bypass (8:29–8:35 AM ET)
* Calendar-based macro calculations
* US Macro Data Blocks table with outcome color coding
* Global policy rates strip with ECB MRO normalization
* Kalshi Fed Watch in sticky ribbon (`FOMC [Kalshi]`)
* Macro release alert ribbon (24h window, FRED calendar + fallback)
* Brent Crude (`BZ=F`) replacing WTI

**Next (priority)**

* Per-release or external consensus forecasts (replace hardcoded `FRED_MACRO_SERIES.forecast`)
* Shared cache for Vercel (KV/Redis) so macro/CB cache works across instances
* Pause client refresh when tab hidden; optional `PUBLIC_REFRESH_ENABLED` kill switch
* Client-side tiered refresh intervals (markets 15s, macro slower)
* Circuit breakers for flaky providers (Yahoo/TV)
* Fed Watch / release-alert source badging

**Later**

* Economic calendar, central bank calendars, treasury auctions
* Watchlists, alerts
* Secondary market data provider (paid fallback for Yahoo/TV)
* Richer charting library (if replacing inline SVG curve)

---

## Agent Workflow

Before significant changes:

1. Explain the plan and files touched
2. Preserve Yahoo batch, TV curve feeds, ECB rate logic, and Kalshi bucket rules unless explicitly asked to change them
3. Do not reintroduce global macro memory cache without TTL / release-window bypass
4. Keep fetch logic in services; keep caches and orchestration in `+page.server.ts`
5. Maintain backwards-compatible `load()` return shape (all existing payload keys + `centralBanks`, `fedWatch`, `macroReleaseAlerts`, `dataSources`)

After implementation:

1. Summarize changes
2. Note how to test (`npm run dev`, verify server logs, check macro table alignment, confirm `dataSources` in logs)
3. List assumptions and follow-ups

---

## Dependency Rules

Before adding a package: explain why, check existing stack, prefer fewer dependencies.

**Charting:** Inline SVG for yield curve only. Do not add a chart library without explicit approval.

---

## General Principle

Build the simplest working solution first.

**Working > Elegant · Simple > Complex · Maintainable > Clever**
