/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IMarketData, IOrderBook } from './market';
import { ITradingSignal } from './signal';
import { IPortfolioState } from './portfolio';
import { IRiskConfig } from './risk';
import { IFill } from './execution';

export type StrategyCategory = 
  | 'MOMENTUM_TREND'
  | 'MEAN_REVERSION'
  | 'MARKET_MAKING'
  | 'ARBITRAGE'
  | 'PREDICTION_MARKET'
  | 'EVENT_DRIVEN'
  | 'ORDERBOOK_MICROSTRUCTURE'
  | 'COPY_WHALE'
  | 'AI_COMPILED';

export interface IStrategyMetadata {
  id: string;
  name: string;
  category: StrategyCategory;
  description: string;
  enabled: boolean;
  weight: number; // 0.0 to 2.0
  supportedVenues: string[];
  parameters: Record<string, number | string | boolean>;
  // Performance attribution
  totalSignals: number;
  profitableSignals: number;
  winRatePct: number;
  totalPnlUsd: number;
  sharpeRatio: number;
  maxDrawdownPct: number;
  lastSignalTimestamp?: number;
}

export interface IStrategy {
  id: string;
  name: string;
  category: StrategyCategory;
  enabled: boolean;
  weight: number;
  parameters: Record<string, any>;
  winRatePct?: number;
  sharpeRatio?: number;
  totalPnlUsd?: number;

  initialize(): Promise<void>;
  generate_signal(marketData: IMarketData, orderbook?: IOrderBook): Promise<ITradingSignal | null>;
  calculate_position(signal: ITradingSignal, portfolio: IPortfolioState, risk: IRiskConfig): number;
  calculate_stop(signal: ITradingSignal, currentPrice: number): number;
  calculate_targets(signal: ITradingSignal, currentPrice: number): number[];
  validate_signal(signal: ITradingSignal, marketData: IMarketData): boolean;
  on_fill(fill: IFill): void;
  on_cancel(orderId: string, reason: string): void;
  shutdown(): Promise<void>;
}
