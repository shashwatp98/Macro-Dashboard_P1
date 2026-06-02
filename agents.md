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

Priority 1:

* US Treasury yields
* Yield curve spreads
* Fed Funds expectations
* CPI
* PPI
* Nonfarm Payrolls
* Unemployment Rate
* DXY
* Gold
* WTI
* Brent
* Copper

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
