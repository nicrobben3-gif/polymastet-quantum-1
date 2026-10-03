# PolyMaster Quantum - Strategy Framework & Implementations

## 1. Unified Strategy Interface

Every strategy adheres to the strict interface:
```typescript
interface IStrategy {
  id: string;
  name: string;
  category: StrategyCategory;
  enabled: boolean;
  weight: number;
  parameters: Record<string, any>;

  initialize(context: ITradingContext): Promise<void>;
  generate_signal(marketData: IMarketData, orderbook?: IOrderBook): Promise<ITradingSignal | null>;
  calculate_position(signal: ITradingSignal, portfolio: IPortfolioState, risk: IRiskConfig): number;
  calculate_stop(signal: ITradingSignal, currentPrice: number): number;
  calculate_targets(signal: ITradingSignal, currentPrice: number): number[];
  validate_signal(signal: ITradingSignal, marketData: IMarketData): boolean;
  on_fill(fill: IFill): void;
  on_cancel(orderId: string, reason: string): void;
  shutdown(): Promise<void>;
}
```

---

## 2. Catalog of Built-In Strategies

### 1. Trend Following (`trend_following`)
- **Formula**: EMA(fast) vs EMA(slow) cross with ADX trend strength filter ($ADX > 25$).
- **Position Sizing**: Volatility adjusted (ATR-based).

### 2. Momentum (`momentum`)
- **Formula**: Relative Strength Index ($RSI(14)$) divergence + ROC (Rate of Change).
- **Execution**: Aggressive entry upon momentum breakout confirmation.

### 3. Mean Reversion (`mean_reversion`)
- **Formula**: Bollinger Bands ($2.0\sigma$) + z-score of price deviation ($Z = \frac{P - \mu}{\sigma}$).
- **Exit**: Reversion to 20-period VWAP.

### 4. Breakout (`breakout`)
- **Formula**: Donchian Channels (20-period high/low) expansion with Volume Confirmation ($Volume > 1.8 \times \overline{Volume}$).

### 5. Volatility Expansion (`volatility_expansion`)
- **Formula**: Bollinger Band Squeeze ($Bandwidth < 0.05$) followed by ATR expansion breakout.

### 6. Market Making (`market_making`)
- **Formula**: Avellaneda-Stoikov inventory model with micro-price reservation price:
  $$r(s, q) = s - q \gamma \sigma^2 (T - t)$$
- **Quotes**: Symmetric or inventory-skewed two-sided limit orders inside the spread.

### 7. Statistical Arbitrage (`stat_arb`)
- **Formula**: Cointegration residual z-score on correlated asset pairs (e.g., SOL/USDT vs ETH/USDT or Polymarket correlated binary outcomes).

### 8. Cross-Venue Arbitrage (`cross_venue_arb`)
- **Formula**: Exploits price discrepancies between Polymarket and Kalshi or CEX spot vs DEX prices. Requires positive net edge after fees, gas, and slippage.

### 9. Funding Rate Arbitrage (`funding_arb`)
- **Formula**: Delta-neutral cash-and-carry: Spot Long + Perpetual Short when predicted annualized funding rate exceeds borrow cost + 4.0% hurdle rate.

### 10. Basis Trading (`basis_trading`)
- **Formula**: Futures-Spot basis convergence trading:
  $$Basis = F_t - S_t$$

### 11. Prediction Market Probability Strategy (`pred_market_prob`)
- **Formula**: Binary contract mispricing where $\sum P(Outcome_i) \neq 1.00$ or probability deviates from calibrated predictive model.

### 12. Event-Driven Strategy (`event_driven`)
- **Formula**: Catalyst detection from fast news feeds, mapping sentiment scores to contract volatility spikes.

### 13. Orderbook Imbalance (`orderbook_imbalance`)
- **Formula**:
  $$Imbalance = \frac{V_{bid} - V_{ask}}{V_{bid} + V_{ask}}$$
  When $|Imbalance| > 0.65$, signals rapid directional order flow pressure.

### 14. Whale Activity & Smart Money (`whale_activity` - PolyCop / Stand inspired)
- **Formula**: Monitors verified high-performance wallets ($Win Rate > 62\%$, $Sharpe > 1.8$). Generates copy signals only when current market price is within $\le 1.0\%$ of leader entry and liquidity exceeds $20,000$.

### 15. Logical Hedge Strategy (`logical_hedge` - PolyClaw inspired)
- **Formula**: Formal logical implication $P \implies Q$. Evaluates joint outcome payoff matrices:
  - If $P$ occurs, $Q$ must occur.
  - Hedging short $P$ with long $Q$ guarantees non-negative payoff across all states if $Cost(P) + Cost(\neg Q) < 1.00$.

### 16. Natural Language Compiled Strategy (`nl_compiled` - TurbineFi / PredictEngine inspired)
- **Formula**: Compiled from natural language rules into validated JSON DSL with static type checking and automated backtest requirements.
