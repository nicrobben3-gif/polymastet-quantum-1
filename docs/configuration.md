# PolyMaster Quantum - Configuration & Environment Variables

## 1. Complete Environment Reference

All settings can be configured via `.env` or system environment variables.

### System & Trading Mode
```env
# Mode: "BACKTEST" | "PAPER" | "LIVE"
TRADING_MODE=PAPER

# Explicit master safety flag required for real live orders
LIVE_TRADING_ENABLED=false

# Port & Network
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
```

### Risk Engine Thresholds (Hard Limits)
```env
# Maximum risk per single trade as % of equity
MAX_RISK_PER_TRADE_PCT=1.5

# Maximum daily loss % before 24h trading halt
MAX_DAILY_LOSS_PCT=3.0

# Maximum portfolio peak-to-trough drawdown %
MAX_DRAWDOWN_PCT=10.0

# Maximum gross leverage
MAX_TOTAL_LEVERAGE=3.0

# Maximum capital exposure to any single exchange/venue %
MAX_VENUE_EXPOSURE_PCT=35.0

# Maximum capital exposure to any single strategy %
MAX_STRATEGY_EXPOSURE_PCT=25.0

# Maximum allowed slippage in basis points (1 bps = 0.01%)
MAX_SLIPPAGE_BPS=30

# Maximum allowed bid/ask spread in basis points
MAX_SPREAD_BPS=50

# Minimum market liquidity required (in top 5 orderbook levels)
MIN_LIQUIDITY_USD=15000

# Minimum net expected edge required to execute arbitrage trades %
MIN_EXPECTED_EDGE_PCT=1.2
```

### Market Data & Exchange Credentials
```env
# Prediction Markets
POLYMARKET_API_KEY=""
POLYMARKET_API_SECRET=""
POLYMARKET_PASSPHRASE=""
KALSHI_API_KEY=""
KALSHI_RSA_PRIVATE_KEY=""
OPINION_API_KEY=""

# Centralized Exchanges
BINANCE_API_KEY=""
BINANCE_API_SECRET=""
BYBIT_API_KEY=""
BYBIT_API_SECRET=""

# Blockchain RPC & Web3
POLYGON_RPC_URL="https://polygon-rpc.com"
ETHEREUM_RPC_URL="https://eth.llamarpc.com"
SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
WALLET_PUBLIC_ADDRESS=""
# Note: Private keys must be loaded via secure hardware wallet / KMS signing service
```

### Notifications & Webhooks
```env
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""
DISCORD_WEBHOOK_URL=""
ALERT_WEBHOOK_URL=""
```

### AI / Prediction Key
```env
GEMINI_API_KEY=""
```
