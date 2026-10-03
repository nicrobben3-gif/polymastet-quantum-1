/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from './market';

export type SignalDirection = 'BUY' | 'SELL' | 'CLOSE' | 'NEUTRAL';
export type MarketRegime = 'TRENDING_BULL' | 'TRENDING_BEAR' | 'MEAN_REVERTING' | 'HIGH_VOLATILITY' | 'COMPRESSED_RANGE';

export interface ITradingSignal {
  id: string;
  symbol: string;
  venue: VenueId;
  timestamp: number;
  direction: SignalDirection;
  confidence: number; // 0.0 to 1.0
  strategy: string; // e.g. "trend_following", "cross_venue_arb"
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  expectedValue: number; // in USD or % edge
  riskRewardRatio: number;
  liquidityUsd: number;
  volatility: number;
  marketRegime: MarketRegime;
  signalExpiration: number; // unix timestamp ms
  // Scoring metrics
  historicalScore: number;
  regimeFit: number;
  executionQualityFactor: number;
  weightedScore: number;
  rationale: string;
}

export interface ISignalScoreWeights {
  historicalPerformance: number;
  currentRegimeFit: number;
  volatilityFactor: number;
  liquidityFactor: number;
  correlationPenalty: number;
  drawdownPenalty: number;
  recentQuality: number;
  executionQuality: number;
}
