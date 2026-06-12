# Global Macro Dashboard

A personal Bloomberg-style macro monitoring dashboard built with **SvelteKit 2**, **Svelte 5**, and **TypeScript**. Aggregates live market data, US rates, FRED macro prints, central bank policy rates, Kalshi FOMC probabilities, and pre-release macro alerts into a single dark terminal UI.

## Features

- **Live markets** — equities, commodities, FX, crypto, US yields (Yahoo Finance + TradingView)
- **US macro blocks** — CPI, Core CPI, Core PCE, NFP, Unemployment, GDP with beat/miss vs consensus placeholders
- **Policy rates** — Fed, ECB, RBI, BoJ, BoC, BoE, RBA (ECB MRO-normalized)
- **Fed Watch** — Kalshi `KXFEDDECISION` implied probabilities for the next FOMC meeting
- **Release alerts** — pulsing ribbon when major macro prints within 24 hours
- **Honest freshness** — `CACHED` / `[STALE]` badges per data sector
- **Resilient pipeline** — parallel `Promise.allSettled`, tiered server cache, stale-on-failure fast track

## Architecture

Four data tracks run concurrently on every server `load()`:

| Track             | Provider                | Cache TTL                           |
| ----------------- | ----------------------- | ----------------------------------- |
| Markets (Yahoo)   | Yahoo Finance chart API | 30s stale-on-failure                |
| Markets (TV scan) | TradingView scanner     | 30s stale-on-failure                |
| Central banks     | TradingView CB quotes   | 4 hours                             |
| Macro             | FRED JSON/CSV           | 12 hours (bypassed 8:29–8:35 AM ET) |

Also in parallel: Kalshi Fed Watch (1h cache), macro release schedule (24h cache).

Client refreshes via `invalidateAll()` every 15s when the tab is visible (`PUBLIC_REFRESH_ENABLED`).

```
src/lib/services/     Raw fetch/parse (yahoo, tradingview, fred, kalshi)
src/routes/+page.server.ts   Orchestration, tiered cache, circuit breakers
src/lib/components/   UI panels (MacroTable, PolicyStrip, YieldCurveInline, …)
```

## Data sources & disclaimers

| Source        | Use                                        | Note                              |
| ------------- | ------------------------------------------ | --------------------------------- |
| Yahoo Finance | Equities, commodities, FX, BTC, US 10Y/30Y | Unofficial chart API              |
| TradingView   | EFFR, SOFR, yields, CB rates               | Scanner + widget endpoints        |
| FRED          | Macro observations + release calendar      | Requires API key for best results |
| Kalshi        | FOMC decision probabilities                | Public prediction market API      |

Macro **forecasts** are manually maintained placeholders in `src/lib/config/macro-forecasts.ts` — not live consensus. OUTCOME labels compare actual prints vs these static values.

## Environment variables

Copy `.env.example` to `.env`:

```bash
FRED_API_KEY=your_32_char_key          # Recommended — FRED JSON API + release calendar
PUBLIC_REFRESH_ENABLED=true            # Set to "false" to disable 15s client refresh
DEBUG_LOAD=false                       # Set to "true" for verbose server load logs
```

Set the same variables in Vercel project settings for production.

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # Production build
npm run test       # Unit tests (node:test)
npm run lint       # Prettier check
```

## Deployment

Targets **Vercel** via `@sveltejs/adapter-vercel`. Connect the repo and set env vars in the Vercel dashboard.

## License

Personal project — not affiliated with Bloomberg, FRED, Yahoo, TradingView, or Kalshi.
