/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from './market';
import { SignalDirection } from './signal';

export type OrderType = 
  | 'MARKET'
  | 'LIMIT'
  | 'STOP_LOSS'
  | 'TAKE_PROFIT'
  | 'BRACKET'
  | 'POST_ONLY'
  | 'FOK'
  | 'IOC';

export type OrderStatus = 
  | 'PENDING'
  | 'SUBMITTED'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'REJECTED'
  | 'EXPIRED';

export type ExecutionAlgorithm = 'DIRECT' | 'TWAP' | 'VWAP' | 'SNIPER' | 'PASSIVE_MAKER';

export interface IOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  venue: VenueId;
  direction: SignalDirection;
  orderType: OrderType;
  price?: number;
  size: number;
  notionalUsd: number;
  filledSize: number;
  avgFillPrice: number;
  status: OrderStatus;
  algorithm: ExecutionAlgorithm;
  reduceOnly: boolean;
  postOnly: boolean;
  stopPrice?: number;
  takeProfitPrice?: number;
  maxSlippageBps: number;
  timestamp: number;
  updatedAt: number;
  strategyId: string;
  feesPaidUsd: number;
  slippageIncurredBps: number;
  simulatedLatencyMs: number;
}

export interface IFill {
  id: string;
  orderId: string;
  symbol: string;
  venue: VenueId;
  price: number;
  size: number;
  feeUsd: number;
  liquidity: 'MAKER' | 'TAKER';
  timestamp: number;
}
