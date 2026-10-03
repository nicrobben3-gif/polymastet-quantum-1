/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from './market';

export interface IRiskConfig {
  maxRiskPerTradePct: number;    // default: 1.5%
  maxDailyLossPct: number;       // default: 3.0%
  maxPortfolioDrawdownPct: number; // default: 10.0%
  maxTotalLeverage: number;      // default: 3.0x
  maxPositionSizeUsd: number;    // default: $25,000
  maxVenueExposurePct: number;   // default: 35.0%
  maxStrategyExposurePct: number;// default: 25.0%
  maxCorrelatedExposurePct: number; // default: 40.0%
  maxSlippageBps: number;        // default: 30 bps (0.30%)
  maxSpreadBps: number;          // default: 50 bps (0.50%)
  minLiquidityUsd: number;       // default: $15,000
  stopLossRequired: boolean;     // default: true
  killSwitchActive: boolean;     // default: false
  circuitBreakerTriggered: boolean;
  staleDataTimeoutMs: number;    // default: 4000 ms
}

export type RiskViolationType = 
  | 'KILL_SWITCH_ENGAGED'
  | 'CIRCUIT_BREAKER_ACTIVE'
  | 'DAILY_LOSS_EXCEEDED'
  | 'DRAWDOWN_EXCEEDED'
  | 'POSITION_SIZE_EXCEEDED'
  | 'LEVERAGE_EXCEEDED'
  | 'VENUE_EXPOSURE_EXCEEDED'
  | 'STRATEGY_EXPOSURE_EXCEEDED'
  | 'CORRELATED_EXPOSURE_EXCEEDED'
  | 'SLIPPAGE_EXCEEDED'
  | 'SPREAD_TOO_WIDE'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'STALE_MARKET_DATA'
  | 'MISSING_STOP_LOSS';

export interface IRiskCheckResult {
  approved: boolean;
  violations: RiskViolationType[];
  adjustedSizeUsd?: number;
  message: string;
}

export interface IRiskEvent {
  id: string;
  timestamp: number;
  violation: RiskViolationType;
  details: string;
  venue?: VenueId | string;
  strategy?: string;
  actionTaken: 'BLOCKED' | 'HALTED_VENUE' | 'EMERGENCY_LIQUIDATE' | 'WARNING';
}
