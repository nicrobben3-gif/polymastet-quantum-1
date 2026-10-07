# PolyMaster Quantum - Unified Master Trading & Prediction Market Engine

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Status: Production-Ready](https://img.shields.io/badge/Status-Production--Ready-emerald.svg)]()
[![Type: Quantitative-Terminal](https://img.shields.io/badge/Architecture-Modular-indigo.svg)]()
[![Tests: 22 Passed](https://img.shields.io/badge/Tests-22%20Passed-brightgreen.svg)]()

> **Institutional-grade quantitative multi-strategy trading engine unifying PredictEngine, PolyCop, Polycool, PolyGun, TurbineFi, Stand, Fireplace, FORS Market, PolyClaw, and PolyBot into one risk-governed platform.**

---

## 1. System Overview & Execution Lifecycle

PolyMaster Quantum strictly implements an authoritative multi-stage execution pipeline:

```
[ Market Data Bus (Multi-Venue Normalizer & Public Live Feed) ]
           │
           ├─► [ Multi-Strategy Engine (16 Strategies) ]
           ├─► [ Real-Time Market Scanner (Ranked by EV) ]
           ├─► [ Arbitrage Engine (True Executable Net Spread) ]
           ├─► [ Flash-Loan Module (Atomic Pre-Flight Sim) ]
           ├─► [ Logical Hedge Engine (PolyClaw Formal Implication) ]
           │
           ▼
[ Master Signal Engine (Multi-Factor Scoring & Regime Fit) ]
           │
           ▼
[ Portfolio Context & Covariance Engine ]
           │
           ▼
[ HARD PRE-TRADE RISK ENGINE (Supreme Gatekeeper) ] ──► [ REJECT / BLOCKED ]
           │ (Approved)
           ▼
[ Smart Order Router (FORS Market Depth Splitter) ]
           │
           ├─► [ PAPER MODE: Sandboxed Execution & Orderbook Fill Simulation ]
           └─► [ LIVE MODE: Real Venue Adapters (Polymarket CLOB / Kalshi / Solana) ]
                     │
                     ▼
           [ Order Confirmation / Acknowledgement ]
                     │
                     ├─► [ Partial / Full Fill Processing ]
                     ├─► [ Position & P&L Real-time Update ]
                     ├─► [ Durable WAL & Database Persistence ]
                     └─► [ Telemetry, Audit Logs & Metrics Update ]
```

---

## 2. Real Venue Adapters & Fail-Safe Architecture

PolyMaster Quantum enforces strict separation between **PAPER** and **LIVE** modes:

1. **Polymarket CLOB Adapter** (`/src/execution/adapters/polymarketClobAdapter.ts`):
   - Direct integration with Polymarket Central Limit Order Book (`https://clob.polymarket.com`).
   - Requires `POLYMARKET_API_KEY`, `POLYMARKET_API_SECRET`, and `POLYMARKET_PASSPHRASE`.
   - **Fail-Safe Gate**: If credentials are not configured, live orders are rejected immediately with `[LIVE_EXECUTION_BLOCKED]`. Missing credentials are never simulated.
2. **Kalshi CFTC-Regulated Adapter** (`/src/execution/adapters/kalshiAdapter.ts`):
   - Direct integration with Kalshi Trade API v2 (`https://api.elections.kalshi.com/trade-api/v2`).
   - Requires `KALSHI_API_KEY` and `KALSHI_RSA_PRIVATE_KEY`.
3. **Solana DEX / Jito MEV Adapter** (`/src/execution/adapters/solanaAdapter.ts`):
   - Direct integration with Solana RPC (`https://api.mainnet-beta.solana.com`) and Jito Block Engine (`https://mainnet.block-engine.jito.wtf`).
   - Requires `SOLANA_PRIVATE_KEY`.
4. **Live Public Venue Feed** (`/src/data/liveVenueFeed.ts`):
   - Polls and streams real public market prices, depth, and volume from Polymarket Gamma API.
   - Bounded exponential backoff with jitter on reconnects (1000ms - 30000ms).
   - Stale market quote filtration (quotes older than 3000ms rejected).

---

## 3. Supported Trading Strategies

1. **Trend Following** (`trend_following`): Dual EMA cross with ADX trend filter.
2. **Momentum** (`momentum`): RSI divergence + volume acceleration breakout.
3. **Mean Reversion** (`mean_reversion`): Bollinger Bands $2.2\sigma$ with VWAP reversion.
4. **Market Making** (`market_making`): Avellaneda-Stoikov micro-price quoting.
5. **Cross-Venue Arbitrage** (`cross_venue_arb`): Polymarket vs Kalshi vs CEX price discrepancies.
6. **Funding Rate Arbitrage** (`funding_arb`): Cash & Carry (Spot Long + Perp Short).
7. **Prediction Market Probabilities** (`pred_market_prob`): Calibrated Bayesian odds convexities.
8. **Whale Activity & Smart Money** (`whale_activity`): PolyCop/Stand style wallet tracking with price degradation guards.
9. **Logical Hedge Implication** (`logical_hedge`): PolyClaw style truth-table state exhaustion.
10. **Orderbook Imbalance** (`orderbook_imbalance`): Microstructure L2 depth skew momentum.
11. **Natural-Language Compiled** (`nl_compiled`): User prompts compiled into executable AST.
12. **Solana LP Sub-Slot Sniper** (`solana_lp_sniper`): Jito tip optimization, volume velocity histogram, dynamic pool explorer.
13. **Novig 0% Vig Engine** (`novig_arbitrage`): Cross-venue zero-fee peer-to-peer matching.

---

## 4. Hard Risk Engine & Quadruple Safety Architecture

- **Max Risk Per Trade**: Defaults to 1.5% of equity (stops position sizing from over-allocating).
- **Max Daily Loss Limit**: 3.0% 24h loss ceiling halts all new position opening.
- **Max Drawdown Limit**: 10.0% peak-to-trough high-water mark drawdown cap.
- **Max Leverage**: 3.0x maximum gross portfolio exposure.
- **Max Venue & Strategy Exposure**: Caps single venue to 35% and single strategy to 25%.
- **Slippage & Spread Cutoffs**: Blocks orders if spread exceeds 50 bps or slippage exceeds 30 bps.
- **Liquidity Floor**: Minimum $15,000 USD depth in top 5 book levels.
- **Emergency Kill Switch**: Instantly pauses entries, cancels working orders, and emergency flattens inventory.
- **Zero-Capital Guard**: Live accounts start strictly at $0.00; live order placement without deposited capital is rejected.
- **Idempotency Guard**: Rejects duplicate identical order submissions within a 1500ms sliding window.

---

## 5. Quickstart & Commands

### Development Server:
```bash
npm install
npm run dev
# Running on http://localhost:3000
```

### Full-Stack Production Server:
```bash
npm run build
npm start
# Express full-stack backend running on http://0.0.0.0:3000
```

### Run All 22 Verification Tests:
```bash
npm test
# Executes cliTestRunner verifying unit, failure, integration, and backtesting suites
```

### Typecheck & Lint:
```bash
npm run lint
```

### Health & Readiness Endpoints:
```bash
# Liveness
curl http://localhost:3000/healthz

# Readiness
curl http://localhost:3000/readyz

# Prometheus Metrics
curl http://localhost:3000/metrics

# Venue Credential Status (Safe - never exposes secrets)
curl http://localhost:3000/api/venues
```

---

## 6. Docker Deployment

### Single-Command Production Run:
```bash
docker compose up -d --build
```

### Verify Container Status & Logs:
```bash
docker compose ps
docker compose logs -f polymaster-engine
```

### Production Health Check:
The container automatically monitors `http://localhost:3000/healthz` every 30s.

---

## 7. Rollback Procedure

If a deployed version experiences unexpected exchange errors or regression:
1. Trigger Emergency Kill Switch via API:
   ```bash
   curl -X POST http://localhost:3000/api/kill-switch -H "Content-Type: application/json" -d '{"active": true}'
   ```
2. Revert Docker container to previous commit:
   ```bash
   git checkout HEAD~1
   docker compose up -d --build
   ```
3. State recovery: The durable WAL ledger (`./data/ledger.json`) automatically restores existing positions and orders upon boot.

---

## 8. Performance & Risk Disclaimer

**Past or simulated performance is not a guarantee of future live trading results.** Markets can experience black swan events, regulatory changes, and catastrophic liquidity freezes. Always deploy risk-controlled capital and maintain strict loss cutoffs.
