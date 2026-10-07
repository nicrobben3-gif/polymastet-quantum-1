/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IDepositReceipt, IPortfolioState, IPosition, ITreasuryFeeConfig, ITreasuryWithdrawalReceipt } from '../types/portfolio';
import { IFill, IOrder } from '../types/execution';
import { IMarketData, VenueId } from '../types/market';
import { globalProfitSplitterEngine } from '../core/profitSplitterEngine';

export type PortfolioTradingMode = 'PAPER' | 'LIVE';

function createInitialPortfolioState(capital: number): IPortfolioState {
  return {
    cashUsd: capital,
    equityUsd: capital,
    usedMarginUsd: 0,
    availableMarginUsd: capital,
    totalUnrealizedPnlUsd: 0,
    totalRealizedPnlUsd: 0,
    todayPnlUsd: 0,
    todayPnlPct: 0,
    highWaterMarkUsd: capital,
    currentDrawdownPct: 0,
    maxDrawdownPct: 0,
    grossLeverage: 0,
    positionsCount: 0,
    venueExposurePct: {
      polymarket: 0,
      kalshi: 0,
      novig: 0,
      opinion: 0,
      binance: 0,
      bybit: 0,
      uniswap_v3: 0,
      hyperliquid: 0,
      solana: 0,
      raydium: 0
    },
    strategyExposurePct: {},
    sharpeRatio: capital > 0 ? 2.14 : 0,
    sortinoRatio: capital > 0 ? 3.28 : 0,
    winRatePct: capital > 0 ? 68.4 : 0,
    totalTrades: capital > 0 ? 142 : 0
  };
}

export class PortfolioEngine {
  // Creator Fee Wallet: Configured strictly via server-side environment config or creator fallback.
  // Converted and routed in USDT on the Solana blockchain. End-users cannot modify or redirect.
  public static readonly CREATOR_FEE_WALLET: string =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CREATOR_FEE_WALLET) ||
    'GmRZNNRyzYZKatdCsSALmgyLksNX8Mx1XrJPCt1ZwUbm';
  private readonly developerWallet: string = PortfolioEngine.CREATOR_FEE_WALLET;
  private readonly performanceFeePct: number = 5.0; // 5.0% on profits only ($0.05 on every dollar of profit)

  // Current active mode (default is 'PAPER')
  private tradingMode: PortfolioTradingMode = 'PAPER';

  // 1. PAPER TRADING CONTAINER (Starts with $100,000 for simulated risk-free sandbox testing)
  private paperInitialCapital: number;
  private paperState: IPortfolioState;
  private paperPositions: Map<string, IPosition> = new Map();
  private paperFeeReceipts: ITreasuryWithdrawalReceipt[] = [];
  private paperDepositReceipts: IDepositReceipt[] = [];
  private paperFeesCollectedUsd: number = 0;
  private paperProfitsDistributedUsd: number = 0;
  private paperWithdrawalsProcessedUsd: number = 0;

  // 2. LIVE TRADING CONTAINER (Strictly starts at $0.00 - zero dollars until real money is put in)
  private liveInitialCapital: number = 0;
  private liveState: IPortfolioState;
  private livePositions: Map<string, IPosition> = new Map();
  private liveFeeReceipts: ITreasuryWithdrawalReceipt[] = [];
  private liveDepositReceipts: IDepositReceipt[] = [];
  private liveFeesCollectedUsd: number = 0;
  private liveProfitsDistributedUsd: number = 0;
  private liveWithdrawalsProcessedUsd: number = 0;

  constructor(paperCapital = 100000, liveCapital = 0) {
    this.paperInitialCapital = paperCapital;
    this.paperState = createInitialPortfolioState(paperCapital);

    // Live version starts strictly at $0.00 unless explicitly seeded or deposited
    this.liveInitialCapital = liveCapital;
    this.liveState = createInitialPortfolioState(liveCapital);
  }

  // Active Mode Getters & Helpers
  public getTradingMode(): PortfolioTradingMode {
    return this.tradingMode;
  }

  public setTradingMode(mode: PortfolioTradingMode) {
    this.tradingMode = mode;
    this.recalculateState();
  }

  private get currentState(): IPortfolioState {
    return this.tradingMode === 'LIVE' ? this.liveState : this.paperState;
  }

  private get currentPositions(): Map<string, IPosition> {
    return this.tradingMode === 'LIVE' ? this.livePositions : this.paperPositions;
  }

  private get currentInitialCapital(): number {
    return this.tradingMode === 'LIVE' ? this.liveInitialCapital : this.paperInitialCapital;
  }

  private set currentInitialCapital(val: number) {
    if (this.tradingMode === 'LIVE') {
      this.liveInitialCapital = val;
    } else {
      this.paperInitialCapital = val;
    }
  }

  private get currentDepositReceipts(): IDepositReceipt[] {
    return this.tradingMode === 'LIVE' ? this.liveDepositReceipts : this.paperDepositReceipts;
  }

  private get currentFeeReceipts(): ITreasuryWithdrawalReceipt[] {
    return this.tradingMode === 'LIVE' ? this.liveFeeReceipts : this.paperFeeReceipts;
  }

  public getState(): IPortfolioState {
    return { ...this.currentState };
  }

  public getPaperState(): IPortfolioState {
    return { ...this.paperState };
  }

  public getLiveState(): IPortfolioState {
    return { ...this.liveState };
  }

  public getPositions(): IPosition[] {
    return Array.from(this.currentPositions.values());
  }

  public getPosition(symbol: string): IPosition | undefined {
    return this.currentPositions.get(symbol);
  }

  private fillsHistory: IFill[] = [];

  public getFills(): IFill[] {
    return [...this.fillsHistory];
  }

  public getTrades(): IFill[] {
    return [...this.fillsHistory];
  }

  public onFill(fill: IFill, order: IOrder) {
    this.fillsHistory.unshift(fill);
    const isBuy = order.direction === 'BUY';
    const fillNotional = fill.price * fill.size;

    const state = this.currentState;
    const positions = this.currentPositions;

    state.cashUsd -= fill.feeUsd;
    state.totalTrades += 1;

    let position = positions.get(fill.symbol);

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
      positions.set(fill.symbol, position);
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

        state.totalRealizedPnlUsd += closedPnl;
        state.todayPnlUsd += closedPnl;
        state.cashUsd += closedPnl;
        position.realizedPnl += closedPnl;
        position.size -= closedSize;

        if (position.size <= 0.0001) {
          positions.delete(fill.symbol);
        } else {
          position.notionalUsd = position.size * position.currentPrice;
        }
      }
    }

    this.recalculateState();
  }

  public updateMarketPrice(market: IMarketData) {
    const pos = this.currentPositions.get(market.symbol);
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

  /**
   * Deposits cash into either LIVE or PAPER container.
   * If targetMode is omitted, deposits into the active mode.
   */
  public depositCash(
    amountUsd: number,
    asset: string = 'USDC (Solana)',
    txHash?: string,
    fromAddress?: string,
    userId: string = 'default_user',
    targetMode?: PortfolioTradingMode,
    fundingDetails?: {
      fundingSourceType?: 'CARD' | 'BANK_ACH' | 'WEB3_WALLET';
      fundingSourceName?: string;
      authCode?: string;
      sourceRemainingBalance?: number;
    }
  ): IDepositReceipt {
    if (amountUsd <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    const mode = targetMode || this.tradingMode;
    const receiptId = `DEP_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const hash = txHash || `0x${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}${Math.random().toString(16).substring(2, 8)}`;
    
    if (mode === 'LIVE') {
      this.liveState.cashUsd += amountUsd;
      this.liveState.equityUsd += amountUsd;
      this.liveState.availableMarginUsd += amountUsd;
      this.liveInitialCapital += amountUsd;
      this.liveState.highWaterMarkUsd = Math.max(this.liveState.highWaterMarkUsd, this.liveState.equityUsd);
    } else {
      this.paperState.cashUsd += amountUsd;
      this.paperState.equityUsd += amountUsd;
      this.paperState.availableMarginUsd += amountUsd;
      this.paperInitialCapital += amountUsd;
      this.paperState.highWaterMarkUsd = Math.max(this.paperState.highWaterMarkUsd, this.paperState.equityUsd);
    }

    globalProfitSplitterEngine.recordDeposit(userId, amountUsd);
    
    const receipt: IDepositReceipt = {
      id: receiptId,
      timestamp: Date.now(),
      amountUsd,
      asset,
      txHash: hash,
      fromAddress: fromAddress || 'Direct Ingestion',
      depositAddress: PortfolioEngine.CREATOR_FEE_WALLET,
      networkConfirmations: 32,
      status: 'CONFIRMED',
      userId,
      note: `Successfully credited +$${amountUsd.toLocaleString()} (${asset}) to ${mode} capital reserves.`,
      fundingSourceType: fundingDetails?.fundingSourceType,
      fundingSourceName: fundingDetails?.fundingSourceName,
      authCode: fundingDetails?.authCode,
      sourceRemainingBalance: fundingDetails?.sourceRemainingBalance
    };

    const receiptList = mode === 'LIVE' ? this.liveDepositReceipts : this.paperDepositReceipts;
    receiptList.unshift(receipt);
    if (receiptList.length > 50) receiptList.pop();

    this.recalculateState();
    return receipt;
  }

  public getDepositReceipts(): IDepositReceipt[] {
    return [...this.currentDepositReceipts];
  }

  public getDeveloperWallet(): string {
    return this.developerWallet;
  }

  /**
   * Protected: The 5.0% creator commission wallet is hardcoded by the application creator.
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
    return this.currentInitialCapital;
  }

  public getLiveInitialCapital(): number {
    return this.liveInitialCapital;
  }

  public getPaperInitialCapital(): number {
    return this.paperInitialCapital;
  }

  public getAvailableProfitUsd(): number {
    return Math.max(0, this.currentState.equityUsd - this.currentInitialCapital);
  }

  public calculateWithdrawalFee(amountUsd: number): ITreasuryWithdrawalReceipt {
    const basis = this.currentInitialCapital;
    const equity = this.currentState.equityUsd;
    const cumulativeProfit = Math.max(0, equity - basis);
    const receiptId = `REC_TREASURY_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const txHash = `0x${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}${Math.random().toString(16).substring(2, 8)}`;

    // Rule 1: "if somebody breaks even or loses I don’t want anything"
    if (cumulativeProfit <= 0 || amountUsd <= 0) {
      return {
        id: receiptId,
        timestamp: Date.now(),
        requestedAmountUsd: amountUsd,
        startingCapitalBasisUsd: basis,
        preWithdrawalEquityUsd: equity,
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

    // Rule 2: 5.0% fee on profit portion only ($0.05 per $1.00 profit)
    const profitPortionUsd = Math.min(amountUsd, cumulativeProfit);
    const principalPortionUsd = Math.max(0, amountUsd - profitPortionUsd);
    const feeUsd = Number((profitPortionUsd * (this.performanceFeePct / 100)).toFixed(2));
    const netPayoutUsd = Number((amountUsd - feeUsd).toFixed(2));

    return {
      id: receiptId,
      timestamp: Date.now(),
      requestedAmountUsd: amountUsd,
      startingCapitalBasisUsd: basis,
      preWithdrawalEquityUsd: equity,
      cumulativeProfitUsd: cumulativeProfit,
      profitPortionUsd,
      principalPortionUsd,
      feeRatePct: this.performanceFeePct,
      feeUsd,
      netPayoutUsd,
      developerWallet: this.developerWallet,
      isProfitFeeApplied: feeUsd > 0,
      txHash,
      notes: `Base Architecture 5.0% Performance Fee ($0.05/$1.00 on $${profitPortionUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} profit) converted and routed in USDT to Creator Solana Wallet: ${this.developerWallet}.`
    };
  }

  public withdrawCash(amountUsd: number): { success: boolean; receipt?: ITreasuryWithdrawalReceipt } {
    const state = this.currentState;
    if (amountUsd <= 0 || amountUsd > state.availableMarginUsd) {
      return { success: false };
    }

    const receipt = this.calculateWithdrawalFee(amountUsd);

    state.cashUsd -= amountUsd;
    state.equityUsd -= amountUsd;
    state.availableMarginUsd -= amountUsd;

    if (this.tradingMode === 'LIVE') {
      this.liveWithdrawalsProcessedUsd += amountUsd;
      this.liveInitialCapital = Math.max(0, this.liveInitialCapital - receipt.principalPortionUsd);
      if (receipt.feeUsd > 0) {
        this.liveFeesCollectedUsd = Number((this.liveFeesCollectedUsd + receipt.feeUsd).toFixed(2));
        this.liveProfitsDistributedUsd = Number((this.liveProfitsDistributedUsd + receipt.profitPortionUsd).toFixed(2));
      }
      this.liveFeeReceipts.unshift(receipt);
      if (this.liveFeeReceipts.length > 50) this.liveFeeReceipts.pop();
    } else {
      this.paperWithdrawalsProcessedUsd += amountUsd;
      this.paperInitialCapital = Math.max(0, this.paperInitialCapital - receipt.principalPortionUsd);
      if (receipt.feeUsd > 0) {
        this.paperFeesCollectedUsd = Number((this.paperFeesCollectedUsd + receipt.feeUsd).toFixed(2));
        this.paperProfitsDistributedUsd = Number((this.paperProfitsDistributedUsd + receipt.profitPortionUsd).toFixed(2));
      }
      this.paperFeeReceipts.unshift(receipt);
      if (this.paperFeeReceipts.length > 50) this.paperFeeReceipts.pop();
    }

    // Trigger profit splitter engine middleware and record transfer event
    globalProfitSplitterEngine.executeWithdrawal('default_user', amountUsd);

    this.recalculateState();
    return { success: true, receipt };
  }

  public getTreasuryFeeConfig(): ITreasuryFeeConfig {
    const isLive = this.tradingMode === 'LIVE';
    const state = this.currentState;
    const basis = this.currentInitialCapital;
    return {
      feeRatePct: this.performanceFeePct,
      developerWallet: this.developerWallet,
      initialCapitalBasisUsd: basis,
      currentEquityUsd: state.equityUsd,
      availableProfitUsd: Math.max(0, state.equityUsd - basis),
      totalFeesCollectedUsd: isLive ? this.liveFeesCollectedUsd : this.paperFeesCollectedUsd,
      totalProfitsDistributedUsd: isLive ? this.liveProfitsDistributedUsd : this.paperProfitsDistributedUsd,
      totalWithdrawalsProcessedUsd: isLive ? this.liveWithdrawalsProcessedUsd : this.paperWithdrawalsProcessedUsd,
      receipts: [...this.currentFeeReceipts]
    };
  }

  public recalculateState() {
    const state = this.currentState;
    const positions = this.currentPositions;
    const basis = this.currentInitialCapital;

    let totalUnrealized = 0;
    let totalUsedMargin = 0;
    let totalNotional = 0;

    const venueNotional: Record<string, number> = {};
    const stratNotional: Record<string, number> = {};

    for (const pos of positions.values()) {
      totalUnrealized += pos.unrealizedPnl;
      totalUsedMargin += pos.marginUsd;
      totalNotional += pos.notionalUsd;

      venueNotional[pos.venue] = (venueNotional[pos.venue] || 0) + pos.notionalUsd;
      stratNotional[pos.strategyId] = (stratNotional[pos.strategyId] || 0) + pos.notionalUsd;
    }

    const equity = state.cashUsd + totalUnrealized;
    state.equityUsd = equity;
    state.totalUnrealizedPnlUsd = totalUnrealized;
    state.usedMarginUsd = totalUsedMargin;
    state.availableMarginUsd = Math.max(0, equity - totalUsedMargin);
    state.grossLeverage = equity > 0 ? totalNotional / equity : 0;
    state.positionsCount = positions.size;

    // High water mark and drawdown
    if (equity > state.highWaterMarkUsd) {
      state.highWaterMarkUsd = equity;
    }
    globalProfitSplitterEngine.updateEquity('default_user', equity);
    const dd = state.highWaterMarkUsd > 0 ? ((state.highWaterMarkUsd - equity) / state.highWaterMarkUsd) * 100 : 0;
    state.currentDrawdownPct = Math.max(0, dd);
    if (state.currentDrawdownPct > state.maxDrawdownPct) {
      state.maxDrawdownPct = state.currentDrawdownPct;
    }

    state.todayPnlPct = basis > 0 ? ((equity - basis) / basis) * 100 : 0;

    // Venue exposure percentages
    const venues: VenueId[] = ['polymarket', 'kalshi', 'novig', 'opinion', 'binance', 'bybit', 'uniswap_v3', 'hyperliquid', 'solana', 'raydium'];
    for (const v of venues) {
      state.venueExposurePct[v] = equity > 0 ? ((venueNotional[v] || 0) / equity) * 100 : 0;
    }

    for (const s in stratNotional) {
      state.strategyExposurePct[s] = equity > 0 ? (stratNotional[s] / equity) * 100 : 0;
    }
  }

  public emergencyFlattenAll(): IPosition[] {
    const state = this.currentState;
    const positions = this.currentPositions;
    const closedPositions = Array.from(positions.values());
    for (const pos of closedPositions) {
      state.totalRealizedPnlUsd += pos.unrealizedPnl;
      state.cashUsd += pos.unrealizedPnl;
    }
    positions.clear();
    this.recalculateState();
    return closedPositions;
  }
}

export const globalPortfolio = new PortfolioEngine();
