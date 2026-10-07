-- =========================================================================
-- POLYMASTER QUANTUM - PRODUCTION POSTGRESQL SCHEMA
-- Strict relational schema with primary keys, indexes, and constraints
-- =========================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  mode VARCHAR(16) NOT NULL CHECK (mode IN ('PAPER', 'LIVE')),
  cash_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  equity_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  initial_capital_basis_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  high_water_mark_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  max_drawdown_pct NUMERIC(8, 4) NOT NULL DEFAULT 0.0000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_mode ON accounts(user_id, mode);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(64) PRIMARY KEY,
  client_order_id VARCHAR(64) UNIQUE NOT NULL,
  symbol VARCHAR(64) NOT NULL,
  venue VARCHAR(32) NOT NULL,
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  order_type VARCHAR(16) NOT NULL,
  price NUMERIC(18, 6),
  size NUMERIC(18, 6) NOT NULL,
  notional_usd NUMERIC(18, 4) NOT NULL,
  filled_size NUMERIC(18, 6) NOT NULL DEFAULT 0.0000,
  avg_fill_price NUMERIC(18, 6),
  status VARCHAR(24) NOT NULL CHECK (status IN ('CREATED', 'VALIDATED', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED')),
  strategy_id VARCHAR(64) NOT NULL,
  fees_paid_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  slippage_bps NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_symbol ON orders(symbol);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS fills (
  id VARCHAR(64) PRIMARY KEY,
  order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  symbol VARCHAR(64) NOT NULL,
  venue VARCHAR(32) NOT NULL,
  price NUMERIC(18, 6) NOT NULL,
  size NUMERIC(18, 6) NOT NULL,
  fee_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  liquidity VARCHAR(8) NOT NULL CHECK (liquidity IN ('MAKER', 'TAKER')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fills_order ON fills(order_id);
CREATE INDEX IF NOT EXISTS idx_fills_created_at ON fills(created_at DESC);

CREATE TABLE IF NOT EXISTS positions (
  id VARCHAR(64) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  symbol VARCHAR(64) NOT NULL,
  venue VARCHAR(32) NOT NULL,
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  size NUMERIC(18, 6) NOT NULL,
  entry_price NUMERIC(18, 6) NOT NULL,
  current_price NUMERIC(18, 6) NOT NULL,
  unrealized_pnl_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  realized_pnl_usd NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
  notional_usd NUMERIC(18, 4) NOT NULL,
  margin_usd NUMERIC(18, 4) NOT NULL,
  leverage NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
  strategy_id VARCHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_account_symbol ON positions(account_id, symbol);

CREATE TABLE IF NOT EXISTS deposit_receipts (
  id VARCHAR(64) PRIMARY KEY,
  amount_usd NUMERIC(18, 4) NOT NULL,
  asset VARCHAR(32) NOT NULL,
  tx_hash VARCHAR(128) NOT NULL,
  from_address VARCHAR(128) NOT NULL,
  deposit_address VARCHAR(128) NOT NULL,
  target_mode VARCHAR(16) NOT NULL CHECK (target_mode IN ('PAPER', 'LIVE')),
  user_id VARCHAR(64) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposits_created_at ON deposit_receipts(created_at DESC);

CREATE TABLE IF NOT EXISTS performance_fee_receipts (
  id VARCHAR(64) PRIMARY KEY,
  requested_amount_usd NUMERIC(18, 4) NOT NULL,
  starting_capital_basis_usd NUMERIC(18, 4) NOT NULL,
  profit_portion_usd NUMERIC(18, 4) NOT NULL,
  principal_portion_usd NUMERIC(18, 4) NOT NULL,
  fee_usd NUMERIC(18, 4) NOT NULL,
  net_payout_usd NUMERIC(18, 4) NOT NULL,
  developer_wallet VARCHAR(64) NOT NULL,
  tx_hash VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_trail (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  component VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(64),
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_trail(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_trail(event_type);
