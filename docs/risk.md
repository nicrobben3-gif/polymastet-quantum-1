# PolyMaster Quantum - Hard Risk Engine

## 1. Non-Bypassable Risk Principle

The Risk Engine serves as the supreme gatekeeper in PolyMaster Quantum. **No strategy, external signal, or automated trigger can execute an order without passing the pre-trade risk validation pipeline.**

```
                     Candidate Signal / Order
                                │
                                ▼
                   [ PRE-TRADE RISK CHECKS ]
    1. System Status Check (Kill Switch Active? Circuit Breaker?)
    2. Daily Drawdown Limit Check (Current Loss < Max Daily Loss)
    3. Portfolio Drawdown Limit Check (High-Water Mark Drawdown < Max DD)
    4. Per-Trade Risk Limit Check (Max $ Risk ≤ Max Risk % × Equity)
    5. Leverage Check (Total Position Notional ≤ Max Leverage × Equity)
    6. Venue Exposure Limit Check (Venue Exposure ≤ Max Venue Exposure %)
    7. Strategy Allocation Limit Check (Strategy Exposure ≤ Max Strategy %)
    8. Correlation Exposure Check (Correlated Portfolio Beta ≤ Cap)
    9. Market Liquidity Check (Order Size ≤ Max % of L2 Orderbook Depth)
   10. Spread & Slippage Check (Current Spread ≤ Max Spread Allowed)
   11. Data Freshness Check (Tick Age ≤ Max Allowed Age, e.g. 5000ms)
                                │
                  ┌─────────────┴─────────────┐
                  ▼                           ▼
              [ PASS ]                    [ REJECT ]
        Route to Smart Router       Log Risk Violation Event
                                    Emit Notification Alert
```

---

## 2. Hard Limits & Configurable Thresholds

| Parameter | Default (Conservative) | Aggressive | Description |
| :--- | :--- | :--- | :--- |
| `MAX_RISK_PER_TRADE_PCT` | `1.5%` | `2.5%` | Maximum capital at risk on stop-loss breach. |
| `MAX_DAILY_LOSS_PCT` | `3.0%` | `5.0%` | Maximum 24-hour loss. Triggers 24h trading suspension. |
| `MAX_PORTFOLIO_DRAWDOWN_PCT`| `10.0%` | `15.0%` | Maximum peak-to-trough drawdown before circuit breaker. |
| `MAX_TOTAL_LEVERAGE` | `3.0x` | `5.0x` | Maximum aggregate portfolio notional leverage. |
| `MAX_VENUE_EXPOSURE_PCT` | `35.0%` | `50.0%` | Maximum capital committed to a single exchange/venue. |
| `MAX_STRATEGY_EXPOSURE_PCT` | `25.0%` | `35.0%` | Maximum capital allocated to any single strategy. |
| `MAX_SLIPPAGE_BPS` | `30 bps (0.30%)` | `75 bps` | Order rejected if expected slippage exceeds threshold. |
| `MAX_SPREAD_BPS` | `50 bps (0.50%)` | `120 bps` | Order rejected if bid-ask spread is abnormally wide. |
| `MIN_MARKET_LIQUIDITY_USD` | `$15,000` | `$5,000` | Minimum depth in top 5 book levels. |
| `STALE_DATA_TIMEOUT_MS` | `4,000 ms` | `10,000 ms` | Reject trading if market tick is older than timeout. |

---

## 3. Circuit Breaker & Emergency Kill Switch

### Kill Switch Modes:
1. **PAUSE_NEW_ENTRIES**: Allows existing positions to manage stop losses/take profits, but strictly blocks new position opens.
2. **CANCEL_ALL_OPEN_ORDERS**: Immediately sends cancel requests for all working limit/bracket orders across all venues.
3. **EMERGENCY_FLATTEN (Liquidation)**: Submits aggressive market orders to flatten all open positions and liquidate inventory into cash/USDC.

### Automatic Circuit Breaker Triggers:
- **Exchange Disconnect / Webhook Failure**: Triggered when heartbeat is lost for $> 15$ seconds.
- **Abnormal Volatility / Flash Crash**: 1-minute price move $> 6.0\%$.
- **Spread Blowout**: Bid-ask spread expands by $> 5\times$ historical median.
- **Repeated Order Rejections**: 3 consecutive execution rejections within 60 seconds.
