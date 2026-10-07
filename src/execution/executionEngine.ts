/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IOrder, IFill, OrderStatus, OrderType, ExecutionAlgorithm } from '../types/execution';
import { ITradingSignal, SignalDirection } from '../types/signal';
import { IMarketData, VenueId } from '../types/market';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';
import { globalVenueRegistry } from './adapters/venueRegistry';
import { globalLogger } from '../observability/logger';
import { globalDbPool } from '../db/dbPool';

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

  // Concurrency & Idempotency guards
  private pendingSubmissions: Set<string> = new Set();
  private recentOrderHashes: Map<string, number> = new Map(); // Hash -> timestamp

  constructor() {
    this.liveTradingEnabled = typeof process !== 'undefined' && process.env?.LIVE_TRADING_ENABLED === 'true';
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
   * Smart Order Router (SOR):
   * Calculates optimal order splitting across fragmented prediction venues.
   */
  public computeSmartRoute(
    symbol: string,
    totalNotionalUsd: number,
    direction: SignalDirection,
    availableMarkets: IMarketData[]
  ): ISplitOrderRoute[] {
    const candidates = availableMarkets.filter(m => 
      m.symbol === symbol || (symbol.includes('US_PRES') && m.symbol.includes('US_PRES'))
    );

    if (candidates.length <= 1) {
      const single = candidates[0] || availableMarkets[0];
      const price = direction === 'BUY' ? single.ask : single.bid;
      return [{
        venue: single.venue,
        size: Number((totalNotionalUsd / price).toFixed(2)),
        percentage: 100,
        expectedPrice: price,
        expectedSlippageBps: 12,
        estimatedFeeUsd: Number((totalNotionalUsd * 0.001).toFixed(2))
      }];
    }

    const totalLiq = candidates.reduce((sum, c) => sum + c.depthLiquidityUsd, 0) || 1;
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
   * Full Production Order Submission Pipeline:
   * 1. Idempotency & Duplicate Check
   * 2. Quadruple Safety Gate Matrix (Zero-balance, Kill switch, Circuit breaker)
   * 3. Pre-Trade Hard Risk Engine Gate
   * 4. Mode Determination (PAPER vs LIVE)
   * 5. In LIVE mode: Route to authentic venue adapter (Polymarket, Kalshi, Solana)
   *    -> Fail-safe rejection if credentials missing or exchange rejects.
   * 6. In PAPER mode: Execute verified simulated fill with realistic slippage & fee model.
   * 7. Persistence to WAL & DB Pool.
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
    clientOrderId?: string;
  }): Promise<{ success: boolean; orderId?: string; message: string }> {
    const marketPrice = params.price || 1.0;
    const notionalUsd = params.size * marketPrice;
    const clientOrderId = params.clientOrderId || `CLI_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // -------------------------------------------------------------------------
    // 1. IDEMPOTENCY & DUPLICATE SUBMISSION GUARD
    // -------------------------------------------------------------------------
    const orderHash = `${params.symbol}_${params.venue}_${params.direction}_${params.size}_${marketPrice.toFixed(2)}`;
    const lastSeen = this.recentOrderHashes.get(orderHash);
    const now = Date.now();

    if (lastSeen && (now - lastSeen) < 1500) {
      globalLogger.warn(`[IDEMPOTENCY_REJECTED] Duplicate order detected within 1500ms window: ${orderHash}`);
      return {
        success: false,
        message: `[IDEMPOTENCY_GUARD_REJECTED] Duplicate order detected: Identical order was already submitted within the last 1.5s.`
      };
    }

    if (this.pendingSubmissions.has(clientOrderId)) {
      return {
        success: false,
        message: `[CONCURRENCY_LOCKED] Order with Client ID ${clientOrderId} is already being processed.`
      };
    }

    this.pendingSubmissions.add(clientOrderId);
    this.recentOrderHashes.set(orderHash, now);

    try {
      // -----------------------------------------------------------------------
      // 2. QUADRUPLE SAFETY CHECK MATRIX
      // -----------------------------------------------------------------------
      const isLive = this.liveTradingEnabled || globalPortfolio.getTradingMode() === 'LIVE';
      const portfolioState = globalPortfolio.getState();

      if (isLive) {
        if (portfolioState.cashUsd <= 0 || portfolioState.availableMarginUsd <= 0) {
          return {
            success: false,
            message: `[QUADRUPLE_SAFETY_GATE_1_REJECTED] Zero live capital detected ($0.00). Live trading strictly prohibits order placement without real deposited funds. Please deposit trading capital first.`
          };
        }
        if (notionalUsd > portfolioState.availableMarginUsd) {
          return {
            success: false,
            message: `[QUADRUPLE_SAFETY_GATE_1_REJECTED] Margin Insufficiency: Required $${notionalUsd.toFixed(2)}, available live cash is only $${portfolioState.availableMarginUsd.toFixed(2)}.`
          };
        }
      } else {
        if (notionalUsd > portfolioState.availableMarginUsd) {
          return {
            success: false,
            message: `[QUADRUPLE_SAFETY_GATE_1_REJECTED] Insufficient paper margin: Required $${notionalUsd.toFixed(2)}, available $${portfolioState.availableMarginUsd.toFixed(2)}.`
          };
        }
      }

      // Safety Gate 2: Emergency Kill Switch
      const riskCfg = globalRiskEngine.getConfig();
      if (riskCfg.killSwitchActive) {
        return {
          success: false,
          message: `[QUADRUPLE_SAFETY_GATE_2_REJECTED] Emergency Kill Switch engaged. Execution system halted.`
        };
      }
      if (riskCfg.circuitBreakerTriggered) {
        return {
          success: false,
          message: `[QUADRUPLE_SAFETY_GATE_2_REJECTED] Daily loss circuit breaker active. Trading paused.`
        };
      }

      // Safety Gate 3: Hard Pre-Trade Risk Engine
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

      const riskCheck = globalRiskEngine.evaluateTrade(
        pseudoSignal,
        pseudoMarket,
        portfolioState,
        notionalUsd
      );

      if (!riskCheck.approved) {
        return {
          success: false,
          message: `[QUADRUPLE_SAFETY_GATE_3_REJECTED] Pre-Trade Risk Engine: ${riskCheck.violations.join(', ')}`
        };
      }

      // Safety Gate 4: Slippage Threshold
      const maxSlippage = params.maxSlippageBps || 30;
      if (maxSlippage > 50) {
        return {
          success: false,
          message: `[QUADRUPLE_SAFETY_GATE_4_REJECTED] Max slippage (${maxSlippage} bps) exceeds protocol safety limit of 50 bps.`
        };
      }

      // Construct Order Object
      const orderId = `ORD_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newOrder: IOrder = {
        id: orderId,
        clientOrderId,
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
        maxSlippageBps: maxSlippage,
        timestamp: Date.now(),
        updatedAt: Date.now(),
        strategyId: params.strategyId || 'manual',
        feesPaidUsd: 0,
        slippageIncurredBps: 0,
        simulatedLatencyMs: 0
      };

      this.orders.set(orderId, newOrder);
      this.notifyOrder(newOrder);
      await globalDbPool.recordOrder(newOrder);

      // -----------------------------------------------------------------------
      // 3. EXECUTION ROUTING: LIVE vs PAPER
      // -----------------------------------------------------------------------
      if (isLive) {
        // LIVE TRADING: Route to real venue adapter
        const adapter = globalVenueRegistry.getAdapter(params.venue);
        if (!adapter) {
          newOrder.status = 'REJECTED';
          this.notifyOrder(newOrder);
          return {
            success: false,
            orderId,
            message: `[VENUE_ROUTER_ERROR] No registered live adapter found for venue: ${params.venue}`
          };
        }

        const creds = adapter.getCredentialsStatus();
        if (!creds.configured) {
          newOrder.status = 'REJECTED';
          this.notifyOrder(newOrder);
          const msg = `[LIVE_EXECUTION_BLOCKED] Missing authentic credentials for ${adapter.getName()} (${creds.missingVariables.join(', ')}). Live order rejected. Missing credentials cannot be simulated.`;
          globalLogger.error(msg);
          return {
            success: false,
            orderId,
            message: msg
          };
        }

        // Dispatch to real exchange endpoint
        const venueRes = await adapter.submitOrder({
          symbol: params.symbol,
          venue: params.venue,
          direction: params.direction,
          orderType: params.orderType,
          size: params.size,
          price: params.price,
          stopPrice: params.stopPrice,
          takeProfitPrice: params.takeProfitPrice,
          clientOrderId,
          maxSlippageBps: maxSlippage
        });

        if (!venueRes.success) {
          newOrder.status = 'REJECTED';
          newOrder.updatedAt = Date.now();
          this.notifyOrder(newOrder);
          await globalDbPool.recordOrder(newOrder);
          return {
            success: false,
            orderId,
            message: `[EXCHANGE_REJECTION] ${venueRes.message}`
          };
        }

        // Confirmed fill from real venue
        if (venueRes.status === 'FILLED' || venueRes.status === 'PARTIALLY_FILLED') {
          const fill: IFill = {
            id: `FILL_${venueRes.venueOrderId || Date.now()}`,
            orderId: newOrder.id,
            symbol: newOrder.symbol,
            venue: newOrder.venue,
            price: venueRes.avgFillPrice,
            size: venueRes.filledSize,
            feeUsd: venueRes.feeUsd,
            liquidity: 'TAKER',
            timestamp: Date.now()
          };

          newOrder.filledSize = venueRes.filledSize;
          newOrder.avgFillPrice = venueRes.avgFillPrice;
          newOrder.status = venueRes.status;
          newOrder.feesPaidUsd = venueRes.feeUsd;
          newOrder.updatedAt = Date.now();

          this.fills.unshift(fill);
          this.notifyOrder(newOrder);
          this.notifyFill(fill);

          await globalDbPool.recordOrder(newOrder);
          await globalDbPool.recordFill(fill);

          globalPortfolio.onFill(fill, newOrder);
        }

        return {
          success: true,
          orderId,
          message: `Live order confirmed on ${adapter.getName()}: ${venueRes.message}`
        };
      } else {
        // PAPER MODE: Realistic Execution Fill Model
        const slippageBps = Math.min(maxSlippage, Math.floor(4 + (notionalUsd / 20000) * 12));
        const slippageMultiplier = params.direction === 'BUY' ? (1 + slippageBps / 10000) : (1 - slippageBps / 10000);
        const fillPrice = Number((marketPrice * slippageMultiplier).toFixed(3));
        const feeUsd = Number((params.size * fillPrice * 0.0005).toFixed(4));

        const fill: IFill = {
          id: `FILL_PAPER_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          orderId: newOrder.id,
          symbol: newOrder.symbol,
          venue: newOrder.venue,
          price: fillPrice,
          size: newOrder.size,
          feeUsd,
          liquidity: 'TAKER',
          timestamp: Date.now()
        };

        newOrder.filledSize = newOrder.size;
        newOrder.avgFillPrice = fillPrice;
        newOrder.status = 'FILLED';
        newOrder.feesPaidUsd = feeUsd;
        newOrder.slippageIncurredBps = slippageBps;
        newOrder.updatedAt = Date.now();

        this.fills.unshift(fill);
        if (this.fills.length > 200) this.fills.pop();

        this.notifyOrder(newOrder);
        this.notifyFill(fill);

        await globalDbPool.recordOrder(newOrder);
        await globalDbPool.recordFill(fill);

        globalPortfolio.onFill(fill, newOrder);

        return {
          success: true,
          orderId,
          message: `Paper order executed in sandbox (${newOrder.size} units @ $${fillPrice.toFixed(3)}).`
        };
      }
    } finally {
      this.pendingSubmissions.delete(clientOrderId);
    }
  }

  public cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'FILLED' || order.status === 'CANCELED' || order.status === 'REJECTED') return false;
    order.status = 'CANCELED';
    order.updatedAt = Date.now();
    this.notifyOrder(order);
    globalDbPool.recordOrder(order);
    return true;
  }

  public cancelAll(): number {
    let count = 0;
    for (const [_, order] of this.orders.entries()) {
      if (order.status === 'SUBMITTED' || order.status === 'PENDING') {
        order.status = 'CANCELED';
        order.updatedAt = Date.now();
        this.notifyOrder(order);
        globalDbPool.recordOrder(order);
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
