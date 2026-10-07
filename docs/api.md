# PolyMaster Quantum - REST & WebSocket API Reference

## 1. REST API Endpoints

### System & Health
- `GET /api/health` - System health, database connection, exchange ping status.
- `GET /api/status` - Current execution mode (`BACKTEST` | `PAPER` | `LIVE`), active strategies, circuit breaker status.
- `POST /api/kill-switch` - Emergency kill switch toggle (`{ "action": "PAUSE" | "CANCEL" | "FLATTEN" }`).

### Portfolio & Positions
- `GET /api/portfolio` - Portfolio equity, margin, cash balance, unrealized/realized P&L.
- `GET /api/positions` - List of open positions with mark price, entry price, liquidation price, P&L.
- `POST /api/positions/close` - Close specific position or all positions.

### Orders & Execution
- `GET /api/orders` - Active working orders, fills, cancel records.
- `POST /api/orders` - Submit new order (passes through Hard Risk Engine).
- `DELETE /api/orders/:id` - Cancel specific order.

### Strategies & Signals
- `GET /api/strategies` - Catalog of 16 strategies with status, weights, parameters, win rate, Sharpe.
- `PATCH /api/strategies/:id` - Enable/disable strategy, update weight or parameters.
- `GET /api/signals` - Real-time aggregated master signals feed with EV and confidence.

### Market Scanner & Arbitrage
- `GET /api/scanner/opportunities` - Real-time scanned opportunities ranked by EV and liquidity.
- `GET /api/arbitrage/opportunities` - Cross-venue arbitrage spreads with true net edge calculations.
- `POST /api/flashloan/simulate` - Simulate blockchain flash-loan arbitrage route.

### AI & Strategy Compiler
- `POST /api/ai/compile` - Compile natural language trading prompt into validated DSL.
- `POST /api/ai/hedge` - Compute formal implication hedge matrix ($P \implies Q$).

---

## 2. WebSocket Streams (`ws://localhost:3000/ws`)

### Subscriptions:
```json
{ "action": "subscribe", "channels": ["ticker", "orderbook", "signals", "trades", "risk_alerts"] }
```
- `channel: orderbook` - L2 delta updates with micro-price and imbalance.
- `channel: signals` - New master signals emitted from engine.
- `channel: trades` - Real-time trade fills and copy trader executions.
- `channel: risk_alerts` - Immediate notification of circuit breakers or limit rejections.
