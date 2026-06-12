# Global Macro Dashboard — Agent Instructions

## Project Overview

Personal macroeconomic dashboard for market monitoring and research. Single-user focus (not multi-tenant SaaS).

Helps a macro-focused investor or trader quickly assess:

- Yield curve movements
- Interest rate expectations
- Inflation and labor market data (FRED)
- Central bank policy rates
- Commodity prices, FX, and global equities
- Major market indicators and crypto (BTC)
- FOMC rate decision probabilities (Kalshi prediction markets)

**Deployment target:** Vercel (serverless) via `@sveltejs/adapter-vercel`. Intended to be shareable via link; design for reasonable API usage when multiple tabs/users are open.

---

## Current State (Live Dashboard)

V1 mock data has been replaced with **live server-side feeds**. The app is a **single-page dashboard**.

### File layout

| File / directory                      | Role                                                                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+page.server.ts`          | Load orchestration: tiered caches, circuit breakers, parallel fetch, Kalshi Fed Watch, macro release alerts, `dataSources` metadata, `loadedAt`, fallbacks |
| `src/routes/+page.svelte`             | Thin orchestration: client refresh loop, price-flash effects, composes child components                                                                    |
| `src/routes/+layout.svelte`           | App shell, `<svelte:head>` metadata (title, description, theme-color)                                                                                      |
| `src/lib/services/yahoo.ts`           | Yahoo batch fetch, per-symbol fallback (`fetchYahooMarketData`)                                                                                            |
| `src/lib/services/yieldSpreads.ts`    | Pure yield spread math (`computeYieldSpreads`) — re-exported from `yahoo.ts`                                                                               |
| `src/lib/services/tradingview.ts`     | TV scanner (rates/sovereign), CB quotes, ECB MRO normalization                                                                                             |
| `src/lib/services/fred.ts`            | Dual-pipeline FRED macro fetch + release calendar API                                                                                                      |
| `src/lib/services/macroStatus.ts`     | Pure macro beat/miss evaluation (`evaluateMacroStatus`)                                                                                                    |
| `src/lib/services/kalshi.ts`          | Pure Kalshi bucket classification + dominant action picker                                                                                                 |
| `src/lib/services/constants.ts`       | Shared `FETCH_TIMEOUT_MS` (8000)                                                                                                                           |
| `src/lib/config/macro-forecasts.ts`   | Manually maintained consensus placeholders + `MACRO_FORECASTS_UPDATED` date                                                                                |
| `src/lib/server/env.ts`               | `warnMissingFredKey()`, `isDebugLoad()`                                                                                                                    |
| `src/lib/server/circuitBreaker.ts`    | Consecutive-failure circuit breaker for Yahoo/TV fast track                                                                                                |
| `src/lib/types/market.ts`             | Shared types: `LiveQuote`, `MacroBlock`, `DataSources`, etc.                                                                                               |
| `src/lib/dashboard/marketSections.ts` | `buildMarketLayout`, ticker builders, release alert line helpers                                                                                           |
| `src/lib/dashboard/priceFlash.ts`     | Price tracker IDs, macro outcome blink helpers                                                                                                             |
| `src/lib/components/`                 | `ClockBanner`, `RibbonHeader`, `TickerRibbon`, `Panel`, `QuoteRow`, `MacroTable`, `PolicyStrip`, `YieldCurveInline`, `Footer`, `SourceBadge`, `StatusPill` |
| `src/lib/styles/dashboard.css`        | Design tokens, panel/quote/macro/ticker global styles                                                                                                      |
| `src/routes/layout.css`               | Tailwind entry + imports `dashboard.css`                                                                                                                   |

UI does not call external APIs directly. Raw fetch/parse/normalize logic belongs in `src/lib/services/` — not in `+page.server.ts`.

---

## CSS Architecture Rule

**Never use `:global()` in plain `.css` files** (e.g. `dashboard.css`). Browsers ignore invalid selectors and the entire stylesheet can fail to apply.

- **Global styles:** plain class selectors in `src/lib/styles/dashboard.css`
- **Component-specific layout:** Svelte scoped `<style>` blocks in `.svelte` files
- **Do not duplicate** panel styles in both `Panel.svelte` and `dashboard.css` — `dashboard.css` is the source of truth for `.dash-panel` / `.quote-row`; components only add component-specific overrides

---

## Data Sources & Feeds

### Fast Track — every page load (~15s client refresh)

| Provider                | Service module                                                 | Data                                                                                                                          |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Yahoo Finance**       | `yahoo.ts` — batch `YAHOO_BATCH_SYMBOLS` + per-symbol fallback | BTC, SPX, NDX, DJI, FTSE, NSE, CSI 300, Gold, Silver, Brent (`BZ=F`), DXY, USD/JPY, USD/INR, US 10Y (`^TNX`), US 30Y (`^TYX`) |
| **TradingView scanner** | `tradingview.ts` — POST `scanner.tradingview.com/global/scan`  | EFFR, SOFR (CME SR11 implied), US 3M, US 2Y, DE/JP/AU 10Y                                                                     |

**Derived on server:** `spread2s10s` (10Y − 2Y), `spread10s30s` (30Y − 10Y) via `computeYieldSpreads()` in `yieldSpreads.ts`.

**Fast-track stale-on-failure cache:** `yahooMarketCache` and `tradingViewScanCache` in `+page.server.ts`, **TTL 30 seconds**. On live fetch failure within TTL, serve last good frame instead of static placeholders.

**Circuit breaker:** After 3 consecutive Yahoo or TV failures, skip live fetch for 60s and serve stale cache immediately (`src/lib/server/circuitBreaker.ts`).

### Slow Track — 4-hour server cache

| Provider                  | Service module   | Data                                           |
| ------------------------- | ---------------- | ---------------------------------------------- |
| **TradingView CB quotes** | `tradingview.ts` | Fed, ECB, RBI, BoJ, BoC, BoE, RBA policy rates |

**ECB rule (do not change):** `EUINTR` widget often surfaces deposit facility rate. MRO = deposit + 15bp since Sep 2024 (`normalizeEcbMroRate` in `tradingview.ts`).

### Macro Track — 12-hour server cache

| Provider | Series     | Metric                                  |
| -------- | ---------- | --------------------------------------- |
| **FRED** | `CPIAUCSL` | US CPI YoY                              |
| **FRED** | `CPILFESL` | Core CPI YoY                            |
| **FRED** | `PCEPILFE` | Core PCE YoY                            |
| **FRED** | `PAYEMS`   | Nonfarm Payrolls net monthly change (K) |
| **FRED** | `UNRATE`   | Unemployment rate (spot)                |
| **FRED** | `GDPC1`    | Real GDP QoQ annualized                 |

**Forecasts:** manually maintained in `src/lib/config/macro-forecasts.ts` (not live consensus). Update before CPI/NFP week. Macro table footer shows `MACRO_FORECASTS_UPDATED` date.

**Fallback:** `OFFICIAL_MACRO_2026` baseline bundle in `fred.ts` used when FRED fetch fails and no macro cache exists.

### Fed Watch — 1-hour server cache

| Provider   | Data                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| **Kalshi** | `KXFEDDECISION-{YY}{MON}` markets — next FOMC meeting dominant probability |

Kalshi classification in `src/lib/services/kalshi.ts`. Orchestration in `+page.server.ts`. Ribbon shows `FOMC [Kalshi]` with `SourceBadge` for freshness.

### Macro Release Alerts — 24-hour schedule cache

When any of the six macro indicators has an official print within the **next 24 hours**, a pulsing red `CRITICAL MACRO` message appears in the ribbon (countdown ticks client-side every 1s). Source badge on alert line.

### Release Day Override

**8:29–8:35 AM ET:** FRED macro cache is bypassed on every refresh so CPI/NFP-style releases snap live during the BLS window.

---

## Tiered Cache Engine & Core Resilience Matrix

In-memory caches in `+page.server.ts` (per serverless instance on Vercel):

```
yahooMarketCache       — TTL 30s  (stale-on-failure + circuit breaker)
tradingViewScanCache   — TTL 30s  (stale-on-failure + circuit breaker)
centralBanksCache      — TTL 4 hours
macroBlocksCache       — TTL 12 hours (bypassed 8:29–8:35 AM ET)
macroReleaseDatesCache — TTL 24 hours
fedWatchCache          — TTL 1 hour
```

### Parallel load

Four core data tracks run concurrently via `Promise.allSettled`. Fed Watch and macro release alerts run in parallel via outer `Promise.all`.

**Destructuring rule:** `Promise.all` returns `[coreSettled, fedWatchResult, macroReleaseAlertsResult]` — three elements only.

### Data freshness metadata (`dataSources`)

Every `load()` returns sector-level source tags plus `loadedAt` ISO timestamp:

```typescript
dataSources: {
  markets: 'live' | 'cache' | 'fallback',
  macro: 'live' | 'cache' | 'fallback',
  centralBanks: 'live' | 'cache' | 'fallback',
  fedWatch: 'live' | 'cache' | 'fallback',
  releaseAlerts: 'live' | 'cache' | 'fallback'
}
loadedAt: string // ISO timestamp of server load
```

- **`live`** — fresh network fetch succeeded this load
- **`cache`** — served from tiered or fast-track memory cache
- **`fallback`** — static dev baselines

### Client refresh

- `invalidateAll()` every **15 seconds** when tab is visible
- **Paused** when `document.hidden` (tab in background)
- **Kill switch:** `PUBLIC_REFRESH_ENABLED=false` disables the refresh loop entirely
- Server-side tiered cache still protects FRED/CB from excessive API calls

### UI freshness badging

- `SourceBadge` on panels, policy strip, yield curve, macro table, FOMC chip, release alert
- **`CACHED`** when `source === 'cache'`
- **`[STALE]`** when `source === 'fallback'`
- Fallback hint on panels: _"Using fallback baselines — provider unreachable"_
- Footer: data source disclaimers + last server refresh + forecast placeholder note

---

## Macro Status & Outcome Rules

See `evaluateMacroStatus()` in `macroStatus.ts`.

| Indicator type                   | Beat logic                                       |
| -------------------------------- | ------------------------------------------------ |
| CPI, Core CPI, PCE, Unemployment | actual > forecast → `HOT BEAT`; else `COOL MISS` |
| NFP, GDP                         | actual > forecast → `EXP. BEAT`; else `MISS`     |

OUTCOME text lives in an inner `<span class="macroOutcome price-flash">` inside a normal `<td>`.

---

## Technology Stack

- **Framework:** SvelteKit 2 (Svelte 5 runes)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 + `dashboard.css` design tokens
- **Adapter:** `@sveltejs/adapter-vercel`
- **Tests:** Node built-in `node:test` for pure service helpers
- **CI:** GitHub Actions — `npm ci && npm run build && npm run test && npm run lint`

### Environment variables

| Variable                 | Required    | Purpose                                                          |
| ------------------------ | ----------- | ---------------------------------------------------------------- |
| `FRED_API_KEY`           | Recommended | FRED JSON API + release calendar; warns in production if missing |
| `PUBLIC_REFRESH_ENABLED` | Optional    | Set `"false"` to disable 15s client refresh                      |
| `DEBUG_LOAD`             | Optional    | Set `"true"` for verbose server load logs (auto-on in dev)       |

Copy `.env.example` to `.env` locally. Set the same variables in Vercel project settings.

---

## Roadmap

**Done**

- Live Yahoo + TradingView + FRED integration
- Service layer split + component modularization
- Tiered cache engine + circuit breakers for Yahoo/TV
- `dataSources` metadata extended to Fed Watch + release alerts
- `PUBLIC_REFRESH_ENABLED` kill switch + pause-when-tab-hidden
- Manual macro forecast config (`macro-forecasts.ts`)
- Component extraction: `ClockBanner`, `RibbonHeader`, `TickerRibbon`, `Footer`
- Design system in `dashboard.css` with documented CSS rules
- `@sveltejs/adapter-vercel`, env validation, gated debug logs
- Unit tests + GitHub Actions CI
- README, layout metadata, data honesty footer

**Next (priority)**

- Shared cache for Vercel (KV/Redis) for cross-instance macro/CB cache
- Client-side tiered refresh intervals (markets 15s, macro slower)
- Optional `degraded` tag in `dataSources.markets` when circuit breaker is open

**Later**

- Economic calendar, watchlists, alerts
- Secondary market data provider (paid fallback)
- Richer charting library (if replacing inline SVG curve)

---

## Agent Workflow

Before significant changes:

1. Explain the plan and files touched
2. Preserve Yahoo batch, TV curve feeds, ECB rate logic, and Kalshi bucket rules unless explicitly asked to change them
3. Do not reintroduce global macro memory cache without TTL / release-window bypass
4. Keep fetch logic in services; keep caches and orchestration in `+page.server.ts`
5. Maintain backwards-compatible `load()` return shape

After implementation:

1. Summarize changes
2. Run `npm run build && npm run test && npm run lint`
3. List assumptions and follow-ups

---

## General Principle

Build the simplest working solution first.

**Working > Elegant · Simple > Complex · Maintainable > Clever**
