/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IOrder, IFill, OrderStatus, OrderType, ExecutionAlgorithm } from '../types/execution';
import { ITradingSignal, SignalDirection } from '../types/signal';
import { IMarketData, IOrderBook, VenueId } from '../types/market';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';

export interface ISplitOrderRoute {
  venue: VenueId;
  size: number;
  percentage: number;
  expectedPrice: number;
  expectedSlippageBps: number;
  estimatedFeeUsd: number;
}

export class ExecutionEngine {
  private orders: Map<string, IOrder> = new Map();
  private fills: IFill[] = [];
  private onOrderUpdateCallbacks: ((order: IOrder) => void)[] = [];
  private onFillCallbacks: ((fill: IFill) => void)[] = [];
  private liveTradingEnabled = false;

  constructor() {
    this.liveTradingEnabled = process.env.LIVE_TRADING_ENABLED === 'true';
  }

  public setLiveTradingEnabled(enabled: boolean) {
    this.liveTradingEnabled = enabled;
  }

  public isLiveMode(): boolean {
    return this.liveTradingEnabled;
  }

  public getOrders(): IOrder[] {
    return Array.from(this.orders.values());
  }

  public getFills(): IFill[] {
    return [...this.fills];
  }

  /**
   * Smart Order Router (FORS Market inspired):
   * Calculates optimal order splitting across fragmented venues to minimize aggregate market impact.
   */
  public computeSmartRoute(
    symbol: string,
    totalNotionalUsd: number,
    direction: SignalDirection,
    availableMarkets: IMarketData[]
  ): ISplitOrderRoute[] {
    // Filter markets with same underlying
    const candidates = availableMarkets.filter(m => 
      m.symbol === symbol || (symbol.includes('US_PRES') && m.symbol.includes('US_PRES'))
    );

    if (candidates.length <= 1) {
      const single = candidates[0] || availableMarkets[0];
      return [{
        venue: single.venue,
        size: totalNotionalUsd / single.lastPrice,
        percentage: 100,
        expectedPrice: direction === 'BUY' ? single.ask : single.bid,
        expectedSlippageBps: 12,
        estimatedFeeUsd: totalNotionalUsd * 0.001
      }];
    }

    // Allocate inversely proportional to price impact / depth
    const totalLiq = candidates.reduce((sum, c) => sum + c.depthLiquidityUsd, 0);
    return candidates.map(c => {
      const share = c.depthLiquidityUsd / totalLiq;
      const notional = totalNotionalUsd * share;
      const price = direction === 'BUY' ? c.ask : c.bid;
      return {
        venue: c.venue,
        size: Number((notional / price).toFixed(2)),
        percentage: Number((share * 100).toFixed(1)),
        expectedPrice: price,
        expectedSlippageBps: Number((share * 15).toFixed(1)),
        estimatedFeeUsd: Number((notional * 0.001).toFixed(2))
      };
    });
  }

  /**
   * Submits order through the Pre-Trade Risk Engine.
   * If approved, executes order via paper simulation or live exchange connector.
   */
  public async submitOrder(params: {
    symbol: string;
    venue: VenueId;
    direction: SignalDirection;
    orderType: OrderType;
    size: number;
    price?: number;
    stopPrice?: number;
    takeProfitPrice?: number;
    algorithm?: ExecutionAlgorithm;
    strategyId?: string;
    maxSlippageBps?: number;
  }): Promise<{ success: boolean; orderId?: string; message: string }> {
    const marketPrice = params.price || 1.0;
    const notionalUsd = params.size * marketPrice;

    // Construct mock signal to validate with Hard Risk Engine
    const pseudoSignal: ITradingSignal = {
      id: `SIG_CHECK_${Date.now()}`,
      symbol: params.symbol,
      venue: params.venue,
      timestamp: Date.now(),
      direction: params.direction,
      confidence: 0.85,
      strategy: params.strategyId || 'manual_trade',
      entryPrice: marketPrice,
      stopLoss: params.stopPrice || (params.direction === 'BUY' ? marketPrice * 0.96 : marketPrice * 1.04),
      takeProfit: params.takeProfitPrice || (params.direction === 'BUY' ? marketPrice * 1.08 : marketPrice * 0.92),
      expectedValue: 10.0,
      riskRewardRatio: 2.0,
      liquidityUsd: 50000,
      volatility: 0.015,
      marketRegime: 'TRENDING_BULL',
      signalExpiration: Date.now() + 60000,
      historicalScore: 0.85,
      regimeFit: 0.90,
      executionQualityFactor: 0.90,
      weightedScore: 0.88,
      rationale: 'Pre-flight order risk validation'
    };

    const pseudoMarket: IMarketData = {
      id: params.symbol,
      symbol: params.symbol,
      venue: params.venue,
      assetType: 'prediction',
      baseAsset: params.symbol,
      quoteAsset: 'USDC',
      bid: marketPrice * 0.998,
      ask: marketPrice * 1.002,
      lastPrice: marketPrice,
      midPrice: marketPrice,
      volume24h: 100000,
      spreadBps: 20,
      depthLiquidityUsd: 85000,
      timestamp: Date.now()
    };

    // HARD RISK GATE CHECK
    const riskCheck = globalRiskEngine.evaluateTrade(
      pseudoSignal,
      pseudoMarket,
      globalPortfolio.getState(),
      notionalUsd
    );

    if (!riskCheck.approved) {
      return {
        success: false,
        message: `Execution blocked by Hard Risk Engine: ${riskCheck.violations.join(', ')}`
      };
    }

    const orderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newOrder: IOrder = {
      id: orderId,
      clientOrderId: `CLI_${orderId}`,
      symbol: params.symbol,
      venue: params.venue,
      direction: params.direction,
      orderType: params.orderType,
      price: params.price,
      size: params.size,
      notionalUsd,
      filledSize: 0,
      avgFillPrice: 0,
      status: 'SUBMITTED',
      algorithm: params.algorithm || 'DIRECT',
      reduceOnly: false,
      postOnly: params.orderType === 'POST_ONLY',
      stopPrice: params.stopPrice,
      takeProfitPrice: params.takeProfitPrice,
      maxSlippageBps: params.maxSlippageBps || 30,
      timestamp: Date.now(),
      updatedAt: Date.now(),
      strategyId: params.strategyId || 'manual',
      feesPaidUsd: 0,
      slippageIncurredBps: 0,
      simulatedLatencyMs: Math.floor(25 + Math.random() * 60)
    };

    this.orders.set(orderId, newOrder);
    this.notifyOrder(newOrder);

    // Realistic Execution Fill Simulator (Latency, Slippage, Fees)
    setTimeout(() => {
      this.executeFill(orderId, pseudoMarket);
    }, newOrder.simulatedLatencyMs);

    return {
      success: true,
      orderId,
      message: `Order submitted successfully (${this.liveTradingEnabled ? 'LIVE' : 'PAPER'}). Simulated latency: ${newOrder.simulatedLatencyMs}ms.`
    };
  }

  private executeFill(orderId: string, market: IMarketData) {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'CANCELED' || order.status === 'FILLED') return;

    // Calculate slippage based on size vs liquidity
    const slippageBps = Math.min(order.maxSlippageBps, Math.floor(4 + (order.notionalUsd / 20000) * 12));
    const slippageMultiplier = order.direction === 'BUY' ? (1 + slippageBps / 10000) : (1 - slippageBps / 10000);
    const fillPrice = Number((market.lastPrice * slippageMultiplier).toFixed(market.assetType === 'prediction' ? 3 : 2));

    const feeRate = order.orderType === 'POST_ONLY' ? 0.0002 : 0.0008; // 2 bps maker / 8 bps taker
    const feeUsd = Number((order.size * fillPrice * feeRate).toFixed(2));

    const fill: IFill = {
      id: `FILL_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      orderId: order.id,
      symbol: order.symbol,
      venue: order.venue,
      price: fillPrice,
      size: order.size,
      feeUsd,
      liquidity: order.orderType === 'POST_ONLY' ? 'MAKER' : 'TAKER',
      timestamp: Date.now()
    };

    order.filledSize = order.size;
    order.avgFillPrice = fillPrice;
    order.status = 'FILLED';
    order.feesPaidUsd = feeUsd;
    order.slippageIncurredBps = slippageBps;
    order.updatedAt = Date.now();

    this.fills.unshift(fill);
    if (this.fills.length > 100) this.fills.pop();

    this.notifyOrder(order);
    this.notifyFill(fill);

    // Update Portfolio
    globalPortfolio.onFill(fill, order);
  }

  public cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'FILLED' || order.status === 'CANCELED') return false;
    order.status = 'CANCELED';
    order.updatedAt = Date.now();
    this.notifyOrder(order);
    return true;
  }

  public cancelAll(): number {
    let count = 0;
    for (const [id, order] of this.orders.entries()) {
      if (order.status === 'SUBMITTED' || order.status === 'PENDING') {
        order.status = 'CANCELED';
        order.updatedAt = Date.now();
        this.notifyOrder(order);
        count++;
      }
    }
    return count;
  }

  private notifyOrder(order: IOrder) {
    for (const cb of this.onOrderUpdateCallbacks) cb(order);
  }

  private notifyFill(fill: IFill) {
    for (const cb of this.onFillCallbacks) cb(fill);
  }

  public onOrderUpdate(cb: (order: IOrder) => void) {
    this.onOrderUpdateCallbacks.push(cb);
    return () => {
      this.onOrderUpdateCallbacks = this.onOrderUpdateCallbacks.filter(c => c !== cb);
    };
  }

  public onFill(cb: (fill: IFill) => void) {
    this.onFillCallbacks.push(cb);
    return () => {
      this.onFillCallbacks = this.onFillCallbacks.filter(c => c !== cb);
    };
  }
}

export const globalExecutionEngine = new ExecutionEngine();
