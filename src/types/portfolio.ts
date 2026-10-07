/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from './market';
import { SignalDirection } from './signal';

export interface IPosition {
  id: string;
  symbol: string;
  venue: VenueId;
  direction: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  currentPrice: number;
  liquidationPrice?: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  notionalUsd: number;
  marginUsd: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  strategyId: string;
  openedAt: number;
  updatedAt: number;
  accumulatedFundingUsd: number;
  peakPrice?: number;
  peakPnlPct?: number;
  harvestTriggered?: boolean;
}

export interface ITreasuryWithdrawalReceipt {
  id: string;
  timestamp: number;
  requestedAmountUsd: number;
  startingCapitalBasisUsd: number;
  preWithdrawalEquityUsd: number;
  cumulativeProfitUsd: number;
  profitPortionUsd: number;
  principalPortionUsd: number;
  feeRatePct: number;
  feeUsd: number; // 5% of profit portion ($0.05 per dollar of profit)
  netPayoutUsd: number; // Amount delivered to user
  developerWallet: string; // Destination wallet of user's choice
  isProfitFeeApplied: boolean;
  txHash: string;
  notes: string;
}

export interface ITreasuryFeeConfig {
  feeRatePct: number; // 5.0%
  developerWallet: string;
  initialCapitalBasisUsd: number;
  currentEquityUsd: number;
  availableProfitUsd: number;
  totalFeesCollectedUsd: number;
  totalProfitsDistributedUsd: number;
  totalWithdrawalsProcessedUsd: number;
  receipts: ITreasuryWithdrawalReceipt[];
}

export interface IDepositReceipt {
  id: string;
  timestamp: number;
  amountUsd: number;
  asset: string;
  txHash: string;
  fromAddress?: string;
  depositAddress: string;
  networkConfirmations: number;
  status: 'CONFIRMED' | 'PENDING';
  userId: string;
  note?: string;
  fundingSourceType?: 'CARD' | 'BANK_ACH' | 'WEB3_WALLET';
  fundingSourceName?: string;
  authCode?: string;
  sourceRemainingBalance?: number;
}

export interface IPortfolioState {
  cashUsd: number;
  equityUsd: number;
  usedMarginUsd: number;
  availableMarginUsd: number;
  totalUnrealizedPnlUsd: number;
  totalRealizedPnlUsd: number;
  todayPnlUsd: number;
  todayPnlPct: number;
  highWaterMarkUsd: number;
  currentDrawdownPct: number;
  maxDrawdownPct: number;
  grossLeverage: number;
  positionsCount: number;
  venueExposurePct: Record<VenueId, number>;
  strategyExposurePct: Record<string, number>;
  sharpeRatio: number;
  sortinoRatio: number;
  winRatePct: number;
  totalTrades: number;
}
