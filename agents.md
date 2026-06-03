# Global Macro Dashboard - Agent Instructions

## Project Overview

This application is a personal macroeconomic dashboard used for market monitoring and research.

The dashboard should help a macro-focused investor or trader quickly assess:

* Yield curve movements
* Interest rate expectations
* Inflation data
* Labor market data
* Central bank activity
* Commodity prices
* Currency movements
* Major market indicators

The application is designed for a single user and is not intended to be a multi-user SaaS product.

---

## Project — V1 Scope

V1 is a **single-page, mock-data dashboard** in `src/routes/+page.svelte`: dense Bloomberg-style layout, category blocks, scrolling summary ticker, and static values for development and layout iteration.

### V1 — Implemented UI

The following are **fully implemented in V1** (no external data feeds yet):

* **Live clock & market status banner** (top of page): NY, London, Tokyo, and New Delhi clocks (1s refresh); US Treasury **OPEN/CLOSED** indicator (NY time, Mon–Fri 08:00–17:00).
* **Yield Curve Monitor** (bottom of page): inline **SVG** line chart for UST tenors **3M, 2Y, 10Y, 30Y**, aligned with US Rates mock yields; tenor labels and spread KPIs.

### V1 — Asset Universe (Baseline)

This is the canonical **V1 asset universe**. All tickers below should appear in the dashboard mock data and scrolling ticker unless noted otherwise.

**1. US Rates & Funding**

* EFFR
* SOFR
* US 3-Month T-Bill (3M)
* US 2-Year Treasury (2Y)
* US 10-Year Treasury (10Y)
* US 30-Year Treasury (30Y)

**2. Yield Spreads**

* 2s10s
* 10s30s

**3. Global Sovereign 10Y**

* Bunds 10Y (Germany)
* JGB 10Y (Japan)
* Australia 10Y

**4. Global Equities**

* S&P 500 (SPX)
* NASDAQ 100 (NDX)
* Dow Jones (DJI)
* FTSE 100 (UKX)
* Nifty 50 (NSE)
* CSI 300 (CSI) *(in V1 UI)*

**5. Commodities & Global FX**

* Gold (GC)
* Silver (SI)
* WTI Crude (CL)
* US Dollar Index (DXY)
* USD/JPY
* USD/INR

---

## Roadmap

**V1 (current)** — Mock dashboard, asset universe above, clock banner, SVG yield curve, column/block layout (Rates · Equities · Commodities/FX on top row; Spreads · Sovereign below; curve monitor under blocks).

**Post-V1** — Live data via service modules, charting library for richer curves, economic releases (CPI, NFP, etc.), calendars, watchlists, alerts (see Dashboard Priorities).

---

## Technology Stack

Framework:

* SvelteKit

Language:

* TypeScript

Styling:

* Tailwind CSS

Package Manager:

* npm

Version Control:

* Git

---

## Design Philosophy

The UI should be inspired by:

* Bloomberg Terminal
* Trading dashboards
* Institutional research platforms

Principles:

* Information density is preferred over excessive whitespace.
* Functionality is preferred over visual effects.
* Professional appearance.
* Dark theme by default.
* Fast loading.
* Responsive layout.

Avoid:

* Marketing-style designs.
* Excessive animations.
* Large hero sections.
* Unnecessary decorative elements.

---

## Development Standards

Always:

* Use TypeScript.
* Use SvelteKit conventions.
* Create reusable components.
* Use descriptive naming.
* Prefer simple solutions.
* Keep files reasonably small.
* Add comments only when logic is non-obvious.

Avoid:

* Unnecessary dependencies.
* Duplicate code.
* Over-engineering.
* Premature optimization.

---

## Data Architecture

Separate data-fetching logic from UI.

Preferred structure:

* services/
* components/
* routes/
* stores/

External APIs should be accessed through service modules.

UI components should not contain API logic whenever possible.

---

## Charting

Use a single charting library throughout the application.

Do not introduce additional chart libraries without a strong reason.

Consistency is preferred over experimentation.

---

## Dashboard Priorities

Priority 1 (aligned with **V1 asset universe** above):

* US Rates & Funding (EFFR, SOFR, 3M, 2Y, 10Y, 30Y)
* Yield spreads (2s10s, 10s30s)
* Global sovereign 10Y (Bunds, JGB, Australia)
* Global equities and China indices (CSI 300)
* Commodities & FX (Gold, Silver, WTI, DXY, USD/JPY, USD/INR)

Priority 1 — data releases (post-V1 feeds):

* Fed Funds expectations
* CPI
* PPI
* Nonfarm Payrolls
* Unemployment Rate

Priority 2:

* Central bank calendars
* Treasury auctions
* Economic calendar
* Watchlists

Priority 3:

* Alerts
* AI-generated commentary
* Custom analytics

---

## Agent Workflow

Before making significant changes:

1. Explain the implementation plan.
2. Identify files that will be modified.
3. Highlight major architectural decisions.

After implementation:

1. Summarize changes made.
2. Explain how to test.
3. List any assumptions.
4. List potential improvements.

---

## Dependency Rules

Before adding a new package:

* Explain why it is needed.
* Check if existing dependencies already solve the problem.
* Prefer fewer dependencies.

---

## General Principle

Build the simplest working solution first.

Prefer:

Working > Elegant

Simple > Complex

Maintainable > Clever
