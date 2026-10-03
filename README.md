# PolyMaster Quantum - Unified Master Trading & Prediction Market Engine

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Status: Production-Ready](https://img.shields.io/badge/Status-Production--Ready-emerald.svg)]()
[![Type: Quantitative-Terminal](https://img.shields.io/badge/Architecture-Modular-indigo.svg)]()

> **Institutional-grade quantitative multi-strategy trading engine unifying PredictEngine, PolyCop, Polycool, PolyGun, TurbineFi, Stand, Fireplace, FORS Market, PolyClaw, and PolyBot into one risk-governed platform.**

---

## 1. System Overview

PolyMaster Quantum rejects the concept of ten disconnected trading bots. Instead, it extracts the strongest documented engineering patterns and mathematical concepts from ten leading systems into a single modular architecture:

```
[ Market Data Bus (Multi-Venue Normalizer) ]
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
[ HARD RISK ENGINE (Supreme Pre-Trade Gatekeeper) ] ──► [ REJECT / BLOCKED ]
           │ (Approved)
           ▼
[ Smart Order Router (FORS Market Depth Splitter) ]
           │
           ├─► [ Paper Trading Simulator (Realistic Latency & Slippage) ]
           └─► [ Live Venue Execution Gateway (Idempotent Nonce Engine) ]
```

---

## 2. Inspired Capabilities from the 10 Systems

| Project | Key Architectural Idea Unified | Module Location |
| :--- | :--- | :--- |
| **PredictEngine** | Natural-Language / Visual Strategy DSL & Cross-Market Scanner | `/src/prediction/predictionEngine.ts` |
| **PolyCop** | Real-time copy trading with slippage caps and FOK fallback | `/src/whale/whaleTracker.ts` |
| **Polycool** | Trader intelligence, historical wallet accuracy, smart alerts | `/src/whale/whaleTracker.ts` |
| **PolyGun** | High-speed signal-to-order pipeline and sniper mode | `/src/execution/executionEngine.ts` |
| **TurbineFi** | Plain-English prompt compilation + Backtest-Before-Deployment gate | `/src/prediction/` & `/src/backtesting/` |
| **Stand** | Dual-venue Polymarket + Kalshi terminal, whale feed, counter-trade | `/src/data/` & `/src/strategies/` |
| **Fireplace** | Event/News intelligence mapping to prediction contracts | `/src/market_scanner/` |
| **FORS Market** | Unified order book, Smart Order Routing (SOR), net-edge arbitrage | `/src/execution/` & `/src/arbitrage/` |
| **PolyClaw** | Formal logical implication hedging ($P \implies Q$), state coverage | `/src/prediction/logicalHedge.ts` |
| **PolyBot** | Self-custodial Safe wallet abstraction, circuit breakers, Auto Trader | `/src/risk/riskEngine.ts` |

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

---

## 4. Hard Risk Engine Gates (Non-Bypassable)

- **Max Risk Per Trade**: Defaults to 1.5% of equity (stops position sizing from over-allocating).
- **Max Daily Loss Limit**: 3.0% 24h loss ceiling halts all new position opening.
- **Max Drawdown Limit**: 10.0% peak-to-trough high-water mark drawdown cap.
- **Max Leverage**: 3.0x maximum gross portfolio exposure.
- **Max Venue & Strategy Exposure**: Caps single venue to 35% and single strategy to 25%.
- **Slippage & Spread Cutoffs**: Blocks orders if spread exceeds 50 bps or slippage exceeds 30 bps.
- **Liquidity Floor**: Minimum $15,000 USD depth in top 5 book levels.
- **Emergency Kill Switch**: Instantly pauses entries, cancels working orders, and emergency flattens inventory.

---

## 5. Quickstart & Deployment

### Quick Setup:
```bash
# Clone the repository
git clone https://github.com/<your-username>/polymaster-quantum.git
cd polymaster-quantum

# Install dependencies
npm install

# Start development server
npm run dev
# Server listening on http://localhost:3000
```

### Pushing to your GitHub Repository:
```bash
# 1. Create a new empty repository on GitHub (e.g., https://github.com/new)
# 2. Add the remote and push:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

### Run Comprehensive Automated Test Suite:
Runs all 13 unit tests, integration tests, risk gate tests, arbitrage formulas, and simulations:
```bash
# In the dashboard UI, switch to the "CLI & System Tests" tab, or run:
npm run lint
npm run build
```
```

### Starting Paper Trading:
```bash
# Via CLI inside terminal:
paper start

# Or in bash:
curl -X POST http://localhost:3000/api/bot/start -d '{"mode": "PAPER"}'
```

### Enabling Live Trading (Strict Multi-Step Gate):
1. Configure credentials in `.env` (ensure withdrawal permissions are disabled).
2. Set `LIVE_TRADING_ENABLED="true"` in `.env`.
3. In terminal: `bot start --mode=live`.

---

## 6. Project Tree

```
├── docs/
│   ├── architecture.md
│   ├── research.md
│   ├── strategies.md
│   ├── risk.md
│   ├── backtesting.md
│   ├── deployment.md
│   ├── security.md
│   ├── api.md
│   └── configuration.md
├── src/
│   ├── types/
│   │   ├── market.ts
│   │   ├── strategy.ts
│   │   ├── signal.ts
│   │   ├── risk.ts
│   │   ├── execution.ts
│   │   ├── portfolio.ts
│   │   ├── arbitrage.ts
│   │   └── scanner.ts
│   ├── core/
│   │   └── orchestrator.ts
│   ├── data/
│   │   ├── marketData.ts
│   │   └── qualityChecker.ts
│   ├── strategies/
│   │   └── index.ts
│   ├── signals/
│   │   └── masterSignalEngine.ts
│   ├── risk/
│   │   └── riskEngine.ts
│   ├── portfolio/
│   │   └── portfolioEngine.ts
│   ├── execution/
│   │   └── executionEngine.ts
│   ├── arbitrage/
│   │   └── arbitrageEngine.ts
│   ├── flashloan/
│   │   └── flashloanModule.ts
│   ├── prediction/
│   │   ├── predictionEngine.ts
│   │   └── logicalHedge.ts
│   ├── market_scanner/
│   │   └── marketScanner.ts
│   ├── whale/
│   │   └── whaleTracker.ts
│   ├── cli/
│   │   └── cliInterpreter.ts
│   ├── tests/
│   │   └── runAllTests.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 7. Performance Disclaimer

**Past or simulated performance is not a guarantee of future live trading results.** Markets can experience black swan events, regulatory changes, and catastrophic liquidity freezes. Always deploy risk-controlled capital and maintain strict loss cutoffs.
