# 📈 Wall Street Time Machine: 1980–2026 (Stocktrade)

A mobile-first stock & crypto game inspired by market history, spanning **January 2, 1980 to October 23, 2026** (12,110 trading days across 98 iconic assets).

## Simulation Model and Data Provenance

Daily prices are **synthetic game data**, not a replay of observed daily market
prices. `ASSETS_CONFIG` in `index.html` contains hand-authored date/price
waypoints. Between positive waypoints the engine interpolates log prices and
adds seeded random bridge noise, combining a shared market shock with an
asset-specific shock. Bankruptcy segments use a separate decline curve to zero.
The same inputs and seeds produce the same paths on every run.

**Waypoint provenance is undocumented.** The supplied repository includes no
original data-provider attribution, citations, retrieval dates, or import script
for these values. Their historical accuracy, adjustment conventions, and licensing
have not been verified. Treat all waypoints, including 2026 endpoints, as game
inputs rather than verified observations. A future verified dataset should record
its source, retrieval date, units, and split/dividend adjustments per asset.

The **calendar is approximate**. All assets, including crypto, use weekdays
excluding Jan 1, Jul 4, Dec 25 and Sep 11–14, 2001. Other exchange holidays and
observed dates are omitted, and crypto has no weekend sessions. Interest accrues
per simulation session using a 252-session year; quarterly dividends use 63
sessions. Five-year challenges use 1,260 sessions. These conventions affect
annualized returns and event/expiry timing; they do not reproduce a complete
exchange calendar or continuous crypto trading.

The Call/Put desk uses **arcade leveraged-return contracts**, not real option
pricing. For underlying return `r = (currentPrice - entryPrice) / entryPrice`:

- Call payout: `max(0, premium * (1 + 5 * r))`.
- Put payout: `max(0, premium * (1 - 5 * r))`.

Contracts settle after 30 simulation sessions, at campaign end if sooner, or on
bankruptcy; players can also cash out early. An unchanged underlying returns the
premium. A +20% move doubles a Call and wipes out a Put; the reverse applies to a
-20% move. There is no time decay, implied volatility, exercise, or strike-based
intrinsic-value payoff. Loss is capped at the premium.

Mystery mode masks asset labels, order notifications, trade summaries and search
while an asset remains hidden. Search uses the displayed mystery code/name and
sector. Identities are revealed after bankruptcy or at campaign end. This is a
UI game mode: historical context, IPO dates and price paths can still provide
clues, and the client source contains the asset mapping.

## 🚀 Key Features

- **Real-Time Simulation Ticker (`1d/s` to `1yr/s`):** Continuous speed slider plus `+1D`, `+1W`, and `+1M` step buttons and automatic pause on major IPOs & crashes.
- **98 Historical Assets (82 Stocks/Indices/Commodities + 16 Cryptocurrencies):**
  - **Macro:** S&P 500 (`SPX`), NASDAQ-100 (`QQQ`), Gold (`GLD`), WTI Crude Oil (`USO`)
  - **Tech & AI:** `IBM`, `INTC`, `AMD`, `AAPL`, `ORCL`, `MSFT`, `CSCO`, `QCOM`, `AMZN`, `NVDA`, `CRM`, `GOOG`, `META`, `SHOP`, `PLTR`, `TXN`, `MU`, `ADBE`, `AVGO`, `NOW`, `SPOT`, `UBER`, `SNOW`
  - **Crypto (2011–2026):** `BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `DOGE`, `ADA`, `AVAX`, `LINK`, `LTC`, `UNI`, `SHIB`, `COIN`, `MSTR`, plus collapses `LUNA` & `FTT`
  - **12 Famous Historical Bankruptcies (Short-Selling Targets):** Pan Am (`PNAA`), Pets.com (`IPET`), Webvan (`TWX`), Enron (`ENE`), WorldCom (`WCOM`), Lehman Brothers (`LEH`), Blockbuster (`BBI`), Kodak (`KODK`), Sears (`SHLD`), Silicon Valley Bank (`SIVB`), Terra (`LUNA`), FTX (`FTT`)
- **Pro Order Desk:**
  - **Long & Short Selling** with partial position trimming (`25%`, `50%`, `100%`)
  - **30-Session 5x Arcade Call & Put Contracts**
  - **Prime Broker Margin (`1x`, `1.5x`, `2x`, `2.5x`)** with maintenance margin protection
  - **Pre-IPO Syndicate Auto-Buy Queue** & **-10% Dip Limit Orders**
  - **Auto Stop-Loss & Take-Profit**
- **Blind Mystery Ticker Mode (`🕵️`):** Masks all 98 ticker symbols and company names (`MACRO-01`, `TECH-01`, `CRYPTO-01`) across asset views and search until bankruptcy or campaign end. Historical context may still provide clues.
- **Retention & Progression Modes:**
  - **Auto-Save & Instant Campaign Resume** (`localStorage`)
  - **🔥 Daily 5-Year Blitz Challenge** (seeded daily) & **🎯 6 Historical Scenario Missions**
  - **⚡ Interactive Historical Dilemma Events** (2-choice market decisions)
  - **🎩 6 Tycoon Lifestyle & Hedge Fund Upgrades** (money sinks with permanent passive buffs)
  - **🏅 2026 Career Wrap-Up Scorecard, Shareable Rival Codes (`WSTM-...`) & ★ Roguelite Prestige (New Game+)**
  - **💡 Built-In Tutorials, 10-Feature Visual Tour & 16 Pro Hot-Tips**

## 🕹️ How to Run Locally or on GitHub Pages

1. Open `index.html` (or `wall_street_1980_tycoon.html`) directly in any desktop or mobile browser.
2. Enable **GitHub Pages** on the `main` branch to play immediately on mobile!

## Regression Checks

From this directory, run `python3 -m http.server 8765`, then open
`http://localhost:8765/tests/regressions.html`. The browser checks both game
entrypoints for short-cover accounting, first-day resume, new-game persistence,
safe rival-code import/rendering, scenario deadlines and benchmarks, prestige
rewinds, risk controls, historical net worth, save validation and clipboard
feedback. Existing game storage is restored after
the checks complete.

Campaign saves include the original base cash, scenario progress, risk settings,
and recorded daily net worth. Older saves remain supported; missing historical
values are displayed as gaps rather than estimated returns. Playback saves after
each simulation update; campaign actions and page hiding also flush saves.

## Development and Architecture

Use Node.js 22 or later. Run `npm ci`, then `npm run build` after editing source.
The build compiles pinned Tailwind CSS and inlines all styles and scripts into
`index.html` and the generated compatibility alias `wall_street_1980_tycoon.html`.
Commit both generated files so GitHub Pages and direct-file downloads work.
Do not edit generated HTML: `npm run build:check` detects stale outputs in CI.

Source layout:

- `src/index.html`: canonical page markup and accessible controls.
- `src/styles.css`: Tailwind directives and application styles; system fonts.
- `src/data.js`: asset waypoints, deterministic prices, calendar and scenarios.
- `src/engine.js`: trading/account calculations and daily advancement, created
  with explicit state, market data and effect callbacks; no DOM dependency.
- `src/persistence.js`: campaign serialization, validation and atomic loading,
  with injected storage and portfolio calculations; no browser dependency.
- `src/accessibility.js`: modal focus, keyboard handling, background isolation
  and list update helpers.
- `src/app.js`: application state, UI rendering, navigation and event wiring.

The UI renders the visible screen and active news tab. Unchanged generated
markup is retained, and market row buttons stay stable across price updates.
Modals pause time, contain keyboard focus, isolate the background, close with
Escape and return focus to the opener. Dilemmas require an explicit choice.
Browser zoom is enabled and reduced-motion preferences are respected.

The generated HTML uses no remote scripts, styles or fonts. Download either
entrypoint to play offline, including by opening it directly. The hosted page
has no service worker; revisiting a URL offline still depends on browser caching.
An internet connection is needed to install development dependencies, not to play.

## Automated Checks

- `npm test`: engine and persistence tests using Node's built-in test runner.
- `npm run build:check`: confirms both generated entrypoints match the source.
- `npx playwright install chromium`, then `npm run test:browser`: runs the
  browser regression suite with external requests blocked, plus direct-file startup.
- GitHub Actions runs these checks on pushes and pull requests.

The browser suite covers both entrypoints and restores existing campaign storage.
The original browser-only test page remains available at `tests/regressions.html`.

## License Status

The project owner has chosen to keep the project unlicensed for now. The package
is marked `private` and `UNLICENSED`; see `LICENSE.md`. Dependency notices are in `THIRD_PARTY_NOTICES.md`.
