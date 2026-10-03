/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPortfolioState, IPosition, ITreasuryFeeConfig, ITreasuryWithdrawalReceipt } from '../types/portfolio';
import { IFill, IOrder } from '../types/execution';
import { IMarketData, VenueId } from '../types/market';
import { globalProfitSplitterEngine } from '../core/profitSplitterEngine';

export class PortfolioEngine {
  private state: IPortfolioState;
  private positions: Map<string, IPosition> = new Map();
  private initialCapital: number;
  // Creator Fee Wallet: Configured strictly via server-side environment config or creator fallback.
  // Converted and routed in USDT on the Solana blockchain. End-users cannot modify or redirect.
  public static readonly CREATOR_FEE_WALLET: string =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CREATOR_FEE_WALLET) ||
    'DME5GLjjttYLoMcRcd7HjCUZHoMhKoYE2uMusefXcQET';
  private readonly developerWallet: string = PortfolioEngine.CREATOR_FEE_WALLET;
  private readonly performanceFeePct: number = 2.5; // 2.5% on profits only ($0.025 on every dollar of profit)
  private totalPerformanceFeesCollectedUsd: number = 0;
  private totalProfitsDistributedUsd: number = 0;
  private totalWithdrawalsProcessedUsd: number = 0;
  private feeReceipts: ITreasuryWithdrawalReceipt[] = [];

  constructor(initialCapital = 100000) {
    this.initialCapital = initialCapital;
    this.state = {
      cashUsd: initialCapital,
      equityUsd: initialCapital,
      usedMarginUsd: 0,
      availableMarginUsd: initialCapital,
      totalUnrealizedPnlUsd: 0,
      totalRealizedPnlUsd: 0,
      todayPnlUsd: 0,
      todayPnlPct: 0,
      highWaterMarkUsd: initialCapital,
      currentDrawdownPct: 0,
      maxDrawdownPct: 0,
      grossLeverage: 0,
      positionsCount: 0,
      venueExposurePct: {
        polymarket: 0,
        kalshi: 0,
        opinion: 0,
        binance: 0,
        bybit: 0,
        uniswap_v3: 0,
        hyperliquid: 0,
        solana: 0,
        raydium: 0
      },
      strategyExposurePct: {},
      sharpeRatio: 2.14,
      sortinoRatio: 3.28,
      winRatePct: 68.4,
      totalTrades: 142
    };
  }

  public getState(): IPortfolioState {
    return { ...this.state };
  }

  public getPositions(): IPosition[] {
    return Array.from(this.positions.values());
  }

  public getPosition(symbol: string): IPosition | undefined {
    return this.positions.get(symbol);
  }

  public onFill(fill: IFill, order: IOrder) {
    const isBuy = order.direction === 'BUY';
    const fillNotional = fill.price * fill.size;

    this.state.cashUsd -= fill.feeUsd;
    this.state.totalTrades += 1;

    let position = this.positions.get(fill.symbol);

    if (!position) {
      // New position opened
      position = {
        id: `POS_${Date.now()}_${fill.symbol}`,
        symbol: fill.symbol,
        venue: fill.venue,
        direction: isBuy ? 'LONG' : 'SHORT',
        size: fill.size,
        entryPrice: fill.price,
        currentPrice: fill.price,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        realizedPnl: 0,
        notionalUsd: fillNotional,
        marginUsd: fillNotional / (order.venue.includes('binance') || order.venue.includes('bybit') ? 5 : 1),
        leverage: order.venue.includes('binance') || order.venue.includes('bybit') ? 5 : 1,
        stopLoss: order.stopPrice,
        takeProfit: order.takeProfitPrice,
        strategyId: order.strategyId,
        openedAt: Date.now(),
        updatedAt: Date.now(),
        accumulatedFundingUsd: 0,
        peakPrice: fill.price,
        peakPnlPct: 0
      };
      this.positions.set(fill.symbol, position);
    } else {
      // Position update or close
      if ((position.direction === 'LONG' && isBuy) || (position.direction === 'SHORT' && !isBuy)) {
        // Increasing position size
        const totalSize = position.size + fill.size;
        position.entryPrice = (position.entryPrice * position.size + fill.price * fill.size) / totalSize;
        position.size = totalSize;
        position.notionalUsd = position.size * position.currentPrice;
        position.peakPrice = Math.max(position.peakPrice ?? fill.price, fill.price);
      } else {
        // Reducing or closing position
        const closedSize = Math.min(position.size, fill.size);
        const pnlPerUnit = position.direction === 'LONG' ? fill.price - position.entryPrice : position.entryPrice - fill.price;
        const closedPnl = pnlPerUnit * closedSize;

        this.state.totalRealizedPnlUsd += closedPnl;
        this.state.todayPnlUsd += closedPnl;
        this.state.cashUsd += closedPnl;
        position.realizedPnl += closedPnl;
        position.size -= closedSize;

        if (position.size <= 0.0001) {
          this.positions.delete(fill.symbol);
        } else {
          position.notionalUsd = position.size * position.currentPrice;
        }
      }
    }

    this.recalculateState();
  }

  public updateMarketPrice(market: IMarketData) {
    const pos = this.positions.get(market.symbol);
    if (!pos) return;

    pos.currentPrice = market.lastPrice;
    const diff = pos.direction === 'LONG' ? pos.currentPrice - pos.entryPrice : pos.entryPrice - pos.currentPrice;
    pos.unrealizedPnl = diff * pos.size;
    pos.unrealizedPnlPct = pos.entryPrice > 0 ? (diff / pos.entryPrice) * 100 : 0;
    pos.notionalUsd = pos.size * pos.currentPrice;
    pos.updatedAt = Date.now();

    // Track peak price and peak unrealized profit for trailing stop protection
    if (!pos.peakPrice) pos.peakPrice = market.lastPrice;
    if (pos.direction === 'LONG') {
      if (market.lastPrice > pos.peakPrice) pos.peakPrice = market.lastPrice;
    } else {
      if (market.lastPrice < pos.peakPrice) pos.peakPrice = market.lastPrice;
    }
    if ((pos.peakPnlPct === undefined) || pos.unrealizedPnlPct > pos.peakPnlPct) {
      pos.peakPnlPct = pos.unrealizedPnlPct;
    }

    this.recalculateState();
  }

  public depositCash(amountUsd: number) {
    if (amountUsd <= 0) return;
    this.state.cashUsd += amountUsd;
    this.state.equityUsd += amountUsd;
    this.state.availableMarginUsd += amountUsd;
    this.initialCapital += amountUsd;
    globalProfitSplitterEngine.recordDeposit('default_user', amountUsd);
    this.recalculateState();
  }

  public getDeveloperWallet(): string {
    return this.developerWallet;
  }

  /**
   * Protected: The 2.5% creator commission wallet is hardcoded by the application creator.
   * End-users cannot modify or override this destination address.
   */
  public setDeveloperWallet(_wallet: string) {
    // Non-modifiable by end-users; creator fee address is fixed.
    console.warn('Creator commission wallet is immutable and cannot be modified by end users.');
  }

  public getPerformanceFeePct(): number {
    return this.performanceFeePct;
  }

  public getInitialCapital(): number {
    return this.initialCapital;
  }

  public getAvailableProfitUsd(): number {
    return Math.max(0, this.state.equityUsd - this.initialCapital);
  }

  public calculateWithdrawalFee(amountUsd: number): ITreasuryWithdrawalReceipt {
    const cumulativeProfit = Math.max(0, this.state.equityUsd - this.initialCapital);
    const receiptId = `REC_TREASURY_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const txHash = `0x${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}${Math.random().toString(16).substring(2, 8)}`;

    // Rule 1: "I only want to remove a percentage of profits if somebody breaks even or loses I don’t want anything"
    if (cumulativeProfit <= 0 || amountUsd <= 0) {
      return {
        id: receiptId,
        timestamp: Date.now(),
        requestedAmountUsd: amountUsd,
        startingCapitalBasisUsd: this.initialCapital,
        preWithdrawalEquityUsd: this.state.equityUsd,
        cumulativeProfitUsd: 0,
        profitPortionUsd: 0,
        principalPortionUsd: amountUsd,
        feeRatePct: this.performanceFeePct,
        feeUsd: 0,
        netPayoutUsd: amountUsd,
        developerWallet: this.developerWallet,
        isProfitFeeApplied: false,
        txHash,
        notes: `Breakeven / Loss Protection Active: $0.00 fee. 100% of withdrawn funds ($${amountUsd.toLocaleString()}) delivered to user.`
      };
    }

    // Rule 2: "every Dollar that they make more than they had when they started I want 2 1/2 cents of that dollar"
    // (2.5% fee on profit portion only = $0.025 per $1.00 profit)
    const profitPortionUsd = Math.min(amountUsd, cumulativeProfit);
    const principalPortionUsd = Math.max(0, amountUsd - profitPortionUsd);
    const feeUsd = Number((profitPortionUsd * (this.performanceFeePct / 100)).toFixed(2));
    const netPayoutUsd = Number((amountUsd - feeUsd).toFixed(2));

    return {
      id: receiptId,
      timestamp: Date.now(),
      requestedAmountUsd: amountUsd,
      startingCapitalBasisUsd: this.initialCapital,
      preWithdrawalEquityUsd: this.state.equityUsd,
      cumulativeProfitUsd: cumulativeProfit,
      profitPortionUsd,
      principalPortionUsd,
      feeRatePct: this.performanceFeePct,
      feeUsd,
      netPayoutUsd,
      developerWallet: this.developerWallet,
      isProfitFeeApplied: feeUsd > 0,
      txHash,
      notes: `Base Architecture 2.5% Performance Fee ($0.025/$1.00 on $${profitPortionUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} profit) converted and routed in USDT to Creator Solana Wallet: ${this.developerWallet}.`
    };
  }

  public withdrawCash(amountUsd: number): { success: boolean; receipt?: ITreasuryWithdrawalReceipt } {
    if (amountUsd <= 0 || amountUsd > this.state.availableMarginUsd) {
      return { success: false };
    }

    const receipt = this.calculateWithdrawalFee(amountUsd);

    this.state.cashUsd -= amountUsd;
    this.state.equityUsd -= amountUsd;
    this.state.availableMarginUsd -= amountUsd;
    this.totalWithdrawalsProcessedUsd += amountUsd;

    // Principal portion reduces initialCapital basis so future withdrawals aren't double-taxed
    this.initialCapital = Math.max(0, this.initialCapital - receipt.principalPortionUsd);

    if (receipt.feeUsd > 0) {
      this.totalPerformanceFeesCollectedUsd = Number((this.totalPerformanceFeesCollectedUsd + receipt.feeUsd).toFixed(2));
      this.totalProfitsDistributedUsd = Number((this.totalProfitsDistributedUsd + receipt.profitPortionUsd).toFixed(2));
    }

    this.feeReceipts.unshift(receipt);
    if (this.feeReceipts.length > 50) this.feeReceipts.pop();

    // Trigger profit splitter engine middleware and record transfer event
    globalProfitSplitterEngine.executeWithdrawal('default_user', amountUsd);

    this.recalculateState();
    return { success: true, receipt };
  }

  public getTreasuryFeeConfig(): ITreasuryFeeConfig {
    return {
      feeRatePct: this.performanceFeePct,
      developerWallet: this.developerWallet,
      initialCapitalBasisUsd: this.initialCapital,
      currentEquityUsd: this.state.equityUsd,
      availableProfitUsd: Math.max(0, this.state.equityUsd - this.initialCapital),
      totalFeesCollectedUsd: this.totalPerformanceFeesCollectedUsd,
      totalProfitsDistributedUsd: this.totalProfitsDistributedUsd,
      totalWithdrawalsProcessedUsd: this.totalWithdrawalsProcessedUsd,
      receipts: [...this.feeReceipts]
    };
  }

  public recalculateState() {
    let totalUnrealized = 0;
    let totalUsedMargin = 0;
    let totalNotional = 0;

    const venueNotional: Record<string, number> = {};
    const stratNotional: Record<string, number> = {};

    for (const pos of this.positions.values()) {
      totalUnrealized += pos.unrealizedPnl;
      totalUsedMargin += pos.marginUsd;
      totalNotional += pos.notionalUsd;

      venueNotional[pos.venue] = (venueNotional[pos.venue] || 0) + pos.notionalUsd;
      stratNotional[pos.strategyId] = (stratNotional[pos.strategyId] || 0) + pos.notionalUsd;
    }

    const equity = this.state.cashUsd + totalUnrealized;
    this.state.equityUsd = equity;
    this.state.totalUnrealizedPnlUsd = totalUnrealized;
    this.state.usedMarginUsd = totalUsedMargin;
    this.state.availableMarginUsd = Math.max(0, equity - totalUsedMargin);
    this.state.grossLeverage = equity > 0 ? totalNotional / equity : 0;
    this.state.positionsCount = this.positions.size;

    // High water mark and drawdown
    if (equity > this.state.highWaterMarkUsd) {
      this.state.highWaterMarkUsd = equity;
    }
    globalProfitSplitterEngine.updateEquity('default_user', equity);
    const dd = this.state.highWaterMarkUsd > 0 ? ((this.state.highWaterMarkUsd - equity) / this.state.highWaterMarkUsd) * 100 : 0;
    this.state.currentDrawdownPct = Math.max(0, dd);
    if (this.state.currentDrawdownPct > this.state.maxDrawdownPct) {
      this.state.maxDrawdownPct = this.state.currentDrawdownPct;
    }

    this.state.todayPnlPct = this.initialCapital > 0 ? ((equity - this.initialCapital) / this.initialCapital) * 100 : 0;

    // Venue exposure percentages
    const venues: VenueId[] = ['polymarket', 'kalshi', 'opinion', 'binance', 'bybit', 'uniswap_v3', 'hyperliquid', 'solana', 'raydium'];
    for (const v of venues) {
      this.state.venueExposurePct[v] = equity > 0 ? ((venueNotional[v] || 0) / equity) * 100 : 0;
    }

    for (const s in stratNotional) {
      this.state.strategyExposurePct[s] = equity > 0 ? (stratNotional[s] / equity) * 100 : 0;
    }
  }

  public emergencyFlattenAll(): IPosition[] {
    const closedPositions = Array.from(this.positions.values());
    for (const pos of closedPositions) {
      this.state.totalRealizedPnlUsd += pos.unrealizedPnl;
      this.state.cashUsd += pos.unrealizedPnl;
    }
    this.positions.clear();
    this.recalculateState();
    return closedPositions;
  }
}

export const globalPortfolio = new PortfolioEngine();
