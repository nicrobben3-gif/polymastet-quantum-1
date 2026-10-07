/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from '../../types/market';
import { SignalDirection } from '../../types/signal';
import { OrderType } from '../../types/execution';

export interface IVenueOrderParams {
  symbol: string;
  venue: VenueId;
  direction: SignalDirection;
  orderType: OrderType;
  size: number;
  price?: number;
  stopPrice?: number;
  takeProfitPrice?: number;
  clientOrderId: string;
  maxSlippageBps: number;
}

export interface IVenueExecutionResult {
  success: boolean;
  venueOrderId?: string;
  status: 'SUBMITTED' | 'FILLED' | 'PARTIALLY_FILLED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  filledSize: number;
  avgFillPrice: number;
  feeUsd: number;
  message: string;
  rawResponse?: any;
  latencyMs: number;
}

export interface IVenueCredentialsStatus {
  venue: VenueId;
  configured: boolean;
  missingVariables: string[];
  endpoint: string;
  isTestnet: boolean;
}

export interface IVenueAdapter {
  venue: VenueId;
  getName(): string;
  getCredentialsStatus(): IVenueCredentialsStatus;
  submitOrder(order: IVenueOrderParams): Promise<IVenueExecutionResult>;
  cancelOrder(venueOrderId: string, symbol: string): Promise<{ success: boolean; message: string }>;
  getOrderStatus(venueOrderId: string, symbol: string): Promise<IVenueExecutionResult | null>;
  ping(): Promise<{ alive: boolean; latencyMs: number }>;
}
