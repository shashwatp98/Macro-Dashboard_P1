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

**Deployment target:** Vercel (serverless). Intended to be shareable via link; design for reasonable API usage when multiple tabs/users are open.

---

## Current State (Live Dashboard)

V1 mock data has been replaced with **live server-side feeds**. The app is a **single-page dashboard**:

| File | Role |
|---|---|
| `src/routes/+page.server.ts` | All external API fetching, parsing, tiered caching, fallbacks |
| `src/routes/+page.svelte` | UI, client refresh loop, price-flash animations, derived display |
| `src/routes/+layout.svelte` | App shell |
| `src/routes/layout.css` | Tailwind entry |

Data-fetching currently lives in `+page.server.ts` (not yet split into `services/`). UI does not call external APIs directly.

---

## Data Sources & Feeds

### Fast Track — every page load (~15s client refresh)

Fetched on **every** `load` invocation. No server-side TTL cache.

| Provider | Endpoint / method | Data |
|---|---|---|
| **Yahoo Finance** | Single batch chart request (`YAHOO_BATCH_SYMBOLS` joined) | BTC, SPX, NDX, DJI, FTSE, NSE, CSI 300, Gold, Silver, WTI, DXY, USD/JPY, USD/INR, US 10Y (`^TNX`), US 30Y (`^TYX`) |
| **TradingView scanner** | POST `scanner.tradingview.com/global/scan` | EFFR, SOFR (CME SR11 implied), US 3M, US 2Y, DE/JP/AU 10Y |

Yahoo batch is preferred; per-symbol fallback only if batch returns incomplete results.

**Derived on server:** `spread2s10s` (10Y − 2Y), `spread10s30s` (30Y − 10Y) from Yahoo 10Y/30Y + TV 2Y.

### Slow Track — 4-hour server cache

| Provider | Data |
|---|---|
| **TradingView CB quotes** | Fed, ECB, RBI, BoJ, BoC, BoE, RBA policy rates |

**ECB rule (do not change):** `EUINTR` widget often surfaces deposit facility rate. MRO = deposit + 15bp since Sep 2024 (`normalizeEcbMroRate`).

### Macro Track — 12-hour server cache

| Provider | Series | Metric |
|---|---|---|
| **FRED** | `CPIAUCSL` | US CPI YoY |
| **FRED** | `CPILFESL` | Core CPI YoY |
| **FRED** | `PCEPILFE` | Core PCE YoY |
| **FRED** | `PAYEMS` | Nonfarm Payrolls net monthly change (K) |
| **FRED** | `UNRATE` | Unemployment rate (spot) |
| **FRED** | `GDPC1` | Real GDP QoQ annualized |

FRED fetch: observations API with `sort_order=desc` when `FRED_API_KEY` is set in env; otherwise public CSV graph (reversed to desc). History from `2018-01-01`, limit 48 obs.

**YoY / QoQ math uses calendar date matching** (not array index offsets) so missing FRED months (e.g. gaps in CPI) do not skew comparisons.

**Forecasts are hardcoded** in `FRED_MACRO_SERIES` (consensus placeholders). They do not auto-update from an external source. Status/outcome is computed vs these static forecasts.

**Fallback:** `OFFICIAL_MACRO_2026` baseline bundle used when FRED fetch fails or before cache is warm.

### Release Day Override

**8:29–8:35 AM ET:** FRED macro cache is bypassed on every refresh so CPI/NFP-style releases snap live during the BLS window.

---

## Tiered Cache Engine

In-memory caches in `+page.server.ts` (per serverless instance on Vercel):

```
centralBanksCache  — TTL 4 hours
macroBlocksCache   — TTL 12 hours (bypassed 8:29–8:35 AM ET)
```

On cache miss or expiry: fetch fresh, update cache. On fetch failure: serve last good cache if available, else fallbacks.

**Client refresh:** `invalidateAll()` every **15 seconds** in `+page.svelte` `onMount`. This re-runs `load` but **does not** re-hit FRED/CB when server cache is fresh.

**Typical external API load per tab (warmed cache):** ~2 requests per 15s (Yahoo batch + TV scan) ≈ 8/min.

**Vercel note:** In-memory cache is not shared across all serverless instances or cold starts. For heavy shared traffic, consider Vercel KV / Upstash for shared macro/CB cache.

**Not yet implemented:** env kill switch (`PUBLIC_REFRESH_ENABLED`), pause-when-tab-hidden, client-side tiered intervals.

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

* Scrolling duplicate track of all market tickers + spreads + BTC
* Green/red flash on price change (`price-flash`, 800ms)

### Policy rates strip

* Horizontal scroll: FED, ECB, RBI, BOJ, BoC, BoE, RBA

### Category blocks (grid)

* **Row 1:** US Rates & Funding · Global Equities · Commodities & FX
* **Row 2:** Yield Spreads & Crypto · Global Sovereign 10Y

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

**Commodities & FX:** Gold, Silver, WTI, DXY, USD/JPY, USD/INR

**US Macro (FRED):** CPI YoY, Core CPI YoY, Core PCE YoY, NFP, Unemployment, GDP QoQ Ann.

**Central Banks:** US, EU (MRO-normalized), IN, JP, CA, GB, AU

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
| `FRED_API_KEY` | Optional | FRED observations JSON API; without it, CSV graph fallback is used |

---

## Design Philosophy

Inspired by Bloomberg Terminal and institutional research UIs.

* Information density over excessive whitespace
* Functionality over visual effects
* Dark theme (`zinc` palette), professional, fast, responsive
* Subtle price-flash animations only — no marketing hero sections

---

## Development Standards

* TypeScript + SvelteKit conventions
* Prefer simple, maintainable solutions; minimal scope per change
* Comments only for non-obvious business logic (ECB normalization, calendar YoY, tiered cache, release window)
* Do not add dependencies without strong reason
* Do not break mobile responsiveness or existing live metrics when editing macro/rates code

### Layout rules for macro table (do not regress)

* Table: `class="macroTable w-full table-fixed"`
* Fixed header widths: `w-[30%]`, `w-[15%]`, `w-[20%]`, `w-[15%]`, `w-[20%]`
* OUTCOME: inner span for colors/flash; `<td>` stays a normal table cell

---

## Roadmap

**Done**

* Live Yahoo + TradingView + FRED integration
* Tiered cache engine (fast / slow / macro tracks)
* Release-window FRED bypass
* Calendar-based macro calculations
* US Macro Data Blocks table with outcome color coding
* Global policy rates strip with ECB MRO normalization

**Next (priority)**

* Per-release or external consensus forecasts (replace hardcoded `FRED_MACRO_SERIES.forecast`)
* Shared cache for Vercel (KV/Redis) so macro/CB cache works across instances
* Pause client refresh when tab hidden; optional `PUBLIC_REFRESH_ENABLED` kill switch
* Client-side tiered refresh intervals (markets 15s, macro slower)
* Split `+page.server.ts` fetch logic into `src/lib/services/`

**Later**

* Economic calendar, central bank calendars, treasury auctions
* Watchlists, alerts
* Richer charting library (if replacing inline SVG curve)

---

## Agent Workflow

Before significant changes:

1. Explain the plan and files touched
2. Preserve Yahoo batch, TV curve feeds, and ECB rate logic unless explicitly asked to change them
3. Do not reintroduce global macro memory cache without TTL / release-window bypass

After implementation:

1. Summarize changes
2. Note how to test (`npm run dev`, verify server logs, check macro table alignment)
3. List assumptions and follow-ups

---

## Dependency Rules

Before adding a package: explain why, check existing stack, prefer fewer dependencies.

**Charting:** Inline SVG for yield curve only. Do not add a chart library without explicit approval.

---

## General Principle

Build the simplest working solution first.

**Working > Elegant · Simple > Complex · Maintainable > Clever**
