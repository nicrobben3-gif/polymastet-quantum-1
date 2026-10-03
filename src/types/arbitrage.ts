/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from './market';

export type ArbitrageType = 
  | 'CEX_CEX'
  | 'DEX_DEX'
  | 'CEX_DEX'
  | 'SPOT_PERP_BASIS'
  | 'FUNDING_RATE'
  | 'PREDICTION_MARKET_CROSS_VENUE'
  | 'TRIANGULAR'
  | 'FLASH_LOAN';

export interface IArbitrageOpportunity {
  id: string;
  type: ArbitrageType;
  symbol: string;
  buyVenue: VenueId;
  sellVenue: VenueId;
  buyPrice: number;
  sellPrice: number;
  grossSpreadPct: number;
  grossEdgeUsd: number;
  // Rigorous executable deductions
  tradingFeesUsd: number;
  gasCostUsd: number;
  bridgeCostUsd: number;
  fundingCostUsd: number;
  borrowingCostUsd: number;
  expectedSlippageUsd: number;
  executionLatencyBufferUsd: number;
  priceImpactUsd: number;
  totalCostUsd: number;
  // Net Edge
  netExpectedEdgePct: number;
  netProfitUsd: number;
  availableLiquidityUsd: number;
  capitalRequiredUsd: number;
  executionProbability: number;
  isExecutable: boolean;
  timestamp: number;
  rationale: string;
}
