# PolyMaster Quantum - Architecture Specification

## 1. High-Level System Architecture

PolyMaster Quantum implements an asynchronous, modular event-driven quantitative trading architecture. It decouples market data ingestion, strategy execution, signal generation, portfolio accounting, hard risk controls, and order execution.

```
                              [ User Interfaces ]
                Web Terminal | Telegram Gateway | CLI Console | REST/WS API
                                      │
                                      ▼
                      [ AI & Strategy Compiler (DSL) ]
              TurbineFi / PredictEngine Natural Language Parser
                                      │
                                      ▼
                         [ Market Data Bus & Normalizer ]
           Polymarket CLOB | Kalshi | Opinion | CEX (Binance/Bybit) | DEX (Uniswap)
                          Data Quality & Freshness Gate
                                      │
         ┌────────────────────────────┼───────────────────────────┐
         ▼                            ▼                           ▼
[ Multi-Strategy Engine ]    [ Real-Time Scanner ]    [ Logical Hedge Engine ]
 15+ Quantitative Models      Abnormal Volume, Spread   PolyClaw Implication Matrix
 (Trend, MM, Arb, Whale)      Funding & Prob Discrepancy   Coverage & Worst-Case Loss
         │                            │                           │
         └────────────────────────────┼───────────────────────────┘
                                      ▼
                          [ Master Signal Engine ]
                  Multi-Factor Scoring & Regime Weighting
                  Conflict Resolution & Stale Filter
                                      │
                                      ▼
                            [ Portfolio Engine ]
                 Real-Time P&L, Margin, Exposure, Covariance
                                      │
                                      ▼
                            [ HARD RISK ENGINE ]
            ★ Overrides Every Strategy - Cannot Be Bypassed ★
            • Max Risk/Trade (e.g. 1.5%)    • Max Daily Loss (3.0%)
            • Max Drawdown (10.0%)          • Max Leverage (5x)
            • Correlated Exposure Cap       • Slippage & Spread Gate
            • Liquidity Cutoff              • Circuit Breaker & Kill Switch
                                      │
                                 [ Approved ]
                                      ▼
                       [ Smart Order Router (SOR) ]
                       FORS Market Multi-Venue Splitter
                       Price Impact & Fee Optimization
                                      │
                                      ▼
                          [ Execution Abstraction ]
               Paper Trading Engine  │  Live Execution Gateway
               (Slippage, Latency,   │  (Idempotent, Nonce Mgr,
                Partial Fills)       │   Atomic Simulation)
                                      ▼
                                [ Exchanges ]
```

---

## 2. Directory Structure & Module Responsibilities

- `/src/core`: Master orchestrator, state management, event emitter, lifecycle coordinator.
- `/src/data`: Normalized market data models, tick-by-tick feeds, orderbook generators, data quality validator (stale detection, gap detection, outlier filter).
- `/src/strategies`: Multi-strategy engine with common lifecycle interface (`initialize`, `generate_signal`, `calculate_position`, `calculate_stop`, `calculate_targets`, `validate_signal`, `on_fill`, `on_cancel`, `shutdown`).
- `/src/signals`: Master signal aggregator, regime scoring, conflict resolution, score normalization.
- `/src/portfolio`: Positions, equity, realized/unrealized P&L, cash balance, margin, exposure attribution, covariance matrix.
- `/src/risk`: Hard risk engine, circuit breakers, daily drawdown monitor, kill switch, emergency liquidation.
- `/src/execution`: Multi-venue execution abstraction, Smart Order Router (SOR), order splitting, TWAP, VWAP, sniper mode.
- `/src/arbitrage`: Real executable net profit calculator (gross spread - fees - gas - bridge - funding - slippage - latency buffer).
- `/src/prediction`: Machine learning feature generator, logistic/GBM probability calibration, PolyClaw logical hedge engine, natural language strategy compiler.
- `/src/flashloan`: Blockchain arbitrage simulator, Aave/Uniswap flash-loan route validator, atomic repayment verifier, private RPC failover.
- `/src/market_scanner`: Continuous multi-venue scanner for volume, volatility expansion, breakouts, funding spreads, prediction mispricings.
- `/src/orderbook`: L2 orderbook engine, micro-price calculation, depth ladder, bid/ask imbalance.
- `/src/notifications`: Multi-channel alerts (Telegram, Discord, Webhook, Dashboard).
- `/src/paper_trading`: Realistic simulated execution engine sharing identical APIs with live execution.
- `/src/security`: API key encryption, credential masking, rate limiting, least-privilege verification.
- `/src/database`: Schemas and migration definitions for trades, orders, positions, signals, backtests, and audit logs.
- `/src/api`: REST and WebSocket API schemas and endpoints.
- `/src/cli`: Embedded and standalone command-line interpreter.
- `/src/tests`: Automated test suites for risk gates, mathematical calculations, orderbook, arbitrage formulas, and simulations.

---

## 3. The Central Design Principle

**Many Data Sources + Many Strategies + Many Venues → One Signal Framework → One Portfolio → One Hard Risk Engine → One Execution Abstraction.**

No strategy or external trigger is permitted to bypass the Risk Engine. All orders pass through pre-trade risk validation before routing to execution adapters.
