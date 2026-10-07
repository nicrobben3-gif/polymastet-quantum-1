/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId, AssetType } from './market';
import { SignalDirection } from './signal';

export type OpportunityCategory = 
  | 'ABNORMAL_VOLUME'
  | 'VOLATILITY_EXPANSION'
  | 'BREAKOUT'
  | 'MOMENTUM_ACCELERATION'
  | 'ORDERBOOK_IMBALANCE'
  | 'CROSS_EXCHANGE_DISCREPANCY'
  | 'FUNDING_DISCREPANCY'
  | 'PREDICTION_MISPRICING'
  | 'WHALE_ACCUMULATION'
  | 'LOGICAL_HEDGE';

export interface IScannedOpportunity {
  id: string;
  asset: string;
  venue: VenueId;
  assetType: AssetType;
  category: OpportunityCategory;
  strategyId: string;
  direction: SignalDirection;
  entryPrice: number;
  expectedExitPrice: number;
  grossEdgePct: number;
  estimatedFeesPct: number;
  estimatedSlippagePct: number;
  netExpectedEdgePct: number;
  expectedValueUsd: number;
  availableLiquidityUsd: number;
  confidenceScore: number; // 0 - 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  capitalRequiredUsd: number;
  timeToExecutionSec: number;
  executionProbabilityPct: number;
  score: number; // compound ranking score
  timestamp: number;
  status: 'PENDING' | 'EXECUTING' | 'EXECUTED' | 'IGNORED';
  notes: string;
}
