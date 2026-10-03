# PolyMaster Quantum - Backtesting Engine Specification

## 1. Event-Driven Methodology

PolyMaster Quantum strictly rejects vector-based backtests that assume instantaneous fills at close prices. The backtesting engine uses a realistic **discrete-event queue simulation**:

1. **Realistic Order Book Walk**: Limit and market orders execute against historical orderbook snapshots or synthetic depth curves.
2. **Dynamic Slippage Modeling**:
   $$Slippage = \alpha \cdot \left(\frac{OrderSize}{BookLiquidity}\right)^\beta + LatencySlippage$$
3. **Fee Models**:
   - Polymarket: 0% maker, dynamic taker fees where applicable.
   - Kalshi: Exchange fee schedules ($0.02 - $0.07 per contract).
   - Crypto CEX: 2 bps maker, 5 bps taker.
   - DEX: 30 bps Uniswap v3 fee tier + Gas costs ($2 - $25 per swap).
4. **Funding & Borrow Costs**: Continuously accrued 8-hour funding rates for perpetuals and daily margin borrow rates.
5. **Partial Fills**: Models queue priority and partial fills when order size exceeds top-of-book volume.
6. **Latency Modeling**: Injects realistic execution delay (e.g. 50ms - 250ms) between signal generation and fill timestamp.

---

## 2. Institutional Performance Metrics

- **CAGR** (Compound Annual Growth Rate)
- **Total Return %**
- **Sharpe Ratio** ($R_f = 4.0\%$)
- **Sortino Ratio** (downside deviation penalized)
- **Max Drawdown %** and Duration (days to recovery)
- **Calmar Ratio** ($\frac{CAGR}{|MaxDD|}$)
- **Profit Factor** ($\frac{\sum Gross Profits}{\sum Gross Losses}$)
- **Win Rate %** and Win/Loss Ratio
- **Expectancy per Trade ($)**
- **Value at Risk (VaR 95% & 99%)**
- **Conditional Value at Risk (CVaR / Expected Shortfall)**

---

## 3. Walk-Forward & Monte Carlo Analysis

To eliminate look-ahead bias, data leakage, and overfitting:
1. **Walk-Forward Validation**:
   - In-Sample (IS) training window (e.g., 60% of data).
   - Out-of-Sample (OOS) validation window (40% of data).
   - Rolling anchoring windows step forward without peeking into future data.
2. **Monte Carlo Simulation**:
   - Runs 1,000+ stochastic permutations of trade order sequences.
   - Computes probability distribution of maximum drawdown and ruin probability.
