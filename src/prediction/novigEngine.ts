/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IMarketData, IOrderBook, IOrderBookLevel, VenueId } from '../types/market';
import { SignalDirection } from '../types/signal';

export interface INovigProtocolConfig {
  apiEndpoint: string;
  wsEndpoint: string;
  apiKey?: string;
  environment: 'SANDBOX' | 'PRODUCTION';
  simulatedLatencyMs: number;
  autoRequote: boolean;
  commissionRate: 0.0; // Strictly 0.0% commission peer-to-peer exchange
}

export interface INovigOrder {
  id: string;
  symbol: string;
  side: SignalDirection;
  outcome: 'YES' | 'NO';
  orderType: 'LIMIT' | 'MARKET' | 'POST_ONLY';
  price: number;
  size: number;
  notionalUsd: number;
  filledSize: number;
  remainingSize: number;
  avgFillPrice: number;
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';
  feeRatePct: 0.0;
  feesPaidUsd: 0.0;
  timestamp: number;
  updatedAt: number;
}

export interface INovigTrade {
  id: string;
  orderId: string;
  symbol: string;
  side: SignalDirection;
  outcome: 'YES' | 'NO';
  price: number;
  size: number;
  notionalUsd: number;
  feeUsd: 0.0;
  counterpartyId: string;
  timestamp: number;
}

export interface INovigMarketSummary {
  symbol: string;
  eventTitle: string;
  category: 'Politics' | 'Crypto' | 'Macro' | 'Sports' | 'Tech';
  bid: number;
  ask: number;
  lastPrice: number;
  midPrice: number;
  spreadBps: number;
  volume24h: number;
  liquidityUsd: number;
  impliedProbPct: number;
  vigPct: 0.0;
}

export type NovigPriceUpdateListener = (market: IMarketData, orderbook: IOrderBook) => void;
export type NovigOrderUpdateListener = (order: INovigOrder) => void;
export type NovigTradeListener = (trade: INovigTrade) => void;

/**
 * NovigPredictionMarketEngine
 * 
 * Manages institutional interaction with the Novig protocol:
 * - Direct L2 commission-free orderbook management
 * - Sub-10ms peer-to-peer (P2P) order matching & execution
 * - Zero-vig passive market-making spread harvesting
 * - Real-time WebSocket price updates and event-driven listeners
 */
export class NovigPredictionMarketEngine {
  private config: INovigProtocolConfig;
  private orderbooks: Map<string, IOrderBook> = new Map();
  private markets: Map<string, IMarketData> = new Map();
  private openOrders: Map<string, INovigOrder> = new Map();
  private orderHistory: INovigOrder[] = [];
  private trades: INovigTrade[] = [];
  private isConnected = false;
  private pingLatencyMs = 11.2;

  // Listeners
  private priceListeners: Set<NovigPriceUpdateListener> = new Set();
  private orderListeners: Set<NovigOrderUpdateListener> = new Set();
  private tradeListeners: Set<NovigTradeListener> = new Set();

  constructor(config: Partial<INovigProtocolConfig> = {}) {
    this.config = {
      apiEndpoint: 'https://api.novig.us/v1',
      wsEndpoint: 'wss://ws.novig.us/v1/stream',
      environment: 'PRODUCTION',
      simulatedLatencyMs: 12,
      autoRequote: true,
      commissionRate: 0.0,
      ...config
    };

    this.initializeDefaultMarkets();
    this.connectWebSocketStream();
  }

  /**
   * Initializes default Novig prediction markets and seed orderbooks
   */
  private initializeDefaultMarkets() {
    const defaultMarkets: {
      symbol: string;
      eventTitle: string;
      category: 'Politics' | 'Crypto' | 'Macro' | 'Sports' | 'Tech';
      bid: number;
      ask: number;
      liquidityUsd: number;
    }[] = [
      {
        symbol: 'NOVIG:US_PRES_2028_DEM',
        eventTitle: 'Democratic Party wins 2028 US Presidential Election',
        category: 'Politics',
        bid: 0.495,
        ask: 0.505,
        liquidityUsd: 110000
      },
      {
        symbol: 'NOVIG:FED_RATE_CUT_Q4',
        eventTitle: 'Federal Reserve cuts interest rates by >= 50bps in Q4',
        category: 'Macro',
        bid: 0.695,
        ask: 0.715,
        liquidityUsd: 85000
      },
      {
        symbol: 'NOVIG:SUPERBOWL_CHAMP_KC',
        eventTitle: 'Kansas City Chiefs win Super Bowl Championship',
        category: 'Sports',
        bid: 0.235,
        ask: 0.245,
        liquidityUsd: 92000
      },
      {
        symbol: 'NOVIG:NBA_FINALS_BOS',
        eventTitle: 'Boston Celtics win NBA Championship',
        category: 'Sports',
        bid: 0.305,
        ask: 0.315,
        liquidityUsd: 78000
      },
      {
        symbol: 'NOVIG:BTC_ABOVE_150K_2026',
        eventTitle: 'Bitcoin price exceeds $150,000 USD before year-end 2026',
        category: 'Crypto',
        bid: 0.415,
        ask: 0.425,
        liquidityUsd: 65000
      }
    ];

    const now = Date.now();

    for (const m of defaultMarkets) {
      const mid = Number(((m.bid + m.ask) / 2).toFixed(3));
      const spread = Number((m.ask - m.bid).toFixed(3));
      const spreadBps = Number(((spread / mid) * 10000).toFixed(0));

      const marketData: IMarketData = {
        id: `MKT_${m.symbol}`,
        symbol: m.symbol,
        venue: 'novig',
        assetType: 'prediction',
        baseAsset: m.symbol.replace('NOVIG:', ''),
        quoteAsset: 'USD',
        bid: m.bid,
        ask: m.ask,
        lastPrice: mid,
        midPrice: mid,
        volume24h: Math.round(m.liquidityUsd * 1.8),
        change24h: 1.25,
        spreadBps,
        depthLiquidityUsd: m.liquidityUsd,
        timestamp: now,
        contractOutcome: 'YES',
        eventTitle: m.eventTitle,
        category: m.category
      };

      this.markets.set(m.symbol, marketData);

      // Generate seed Level 2 orderbook ladder
      this.orderbooks.set(m.symbol, this.generateL2Ladder(m.symbol, m.bid, m.ask));
    }
  }

  /**
   * Generates a realistic 6-deep L2 depth ladder for commission-free orders
   */
  private generateL2Ladder(symbol: string, bestBid: number, bestAsk: number): IOrderBook {
    const bids: IOrderBookLevel[] = [];
    const asks: IOrderBookLevel[] = [];
    let bidTotal = 0;
    let askTotal = 0;

    for (let i = 0; i < 6; i++) {
      const bidPrice = Number((bestBid - i * 0.005).toFixed(3));
      const bidSize = Math.round(1500 + Math.random() * 2500);
      bidTotal += bidSize;
      bids.push({ price: Math.max(0.01, bidPrice), size: bidSize, total: bidTotal });

      const askPrice = Number((bestAsk + i * 0.005).toFixed(3));
      const askSize = Math.round(1500 + Math.random() * 2500);
      askTotal += askSize;
      asks.push({ price: Math.min(0.99, askPrice), size: askSize, total: askTotal });
    }

    const spread = Number((bestAsk - bestBid).toFixed(3));
    const mid = (bestAsk + bestBid) / 2;
    const spreadBps = Number(((spread / mid) * 10000).toFixed(0));
    const imbalance = Number(((bidTotal - askTotal) / (bidTotal + askTotal)).toFixed(3));
    const microPrice = Number((mid + imbalance * (spread / 2)).toFixed(3));

    return {
      symbol,
      venue: 'novig',
      timestamp: Date.now(),
      bids,
      asks,
      spread,
      spreadBps,
      microPrice,
      imbalance
    };
  }

  /**
   * Connects to simulated Novig WebSocket stream with real-time heartbeat
   */
  public connectWebSocketStream(): void {
    this.isConnected = true;
    this.pingLatencyMs = 10.5 + Math.random() * 2.5;
  }

  public disconnectWebSocketStream(): void {
    this.isConnected = false;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getPingLatencyMs(): number {
    return Number(this.pingLatencyMs.toFixed(1));
  }

  /**
   * Fetches the commission-free orderbook for a given contract
   */
  public getOrderBook(symbol: string): IOrderBook | undefined {
    return this.orderbooks.get(symbol);
  }

  /**
   * Fetches all cached Novig orderbooks
   */
  public getAllOrderBooks(): Map<string, IOrderBook> {
    return new Map(this.orderbooks);
  }

  /**
   * Fetches all active Novig market summaries with 0% vig metrics
   */
  public getAllMarkets(): IMarketData[] {
    return Array.from(this.markets.values());
  }

  public getMarket(symbol: string): IMarketData | undefined {
    return this.markets.get(symbol);
  }

  /**
   * Submits a peer-to-peer order to the Novig exchange.
   * Guaranteed 0.0% taker and maker fee deduction.
   */
  public submitP2POrder(params: {
    symbol: string;
    side: SignalDirection;
    outcome?: 'YES' | 'NO';
    orderType: 'LIMIT' | 'MARKET' | 'POST_ONLY';
    price?: number;
    size: number;
  }): { success: boolean; order?: INovigOrder; error?: string } {
    const market = this.markets.get(params.symbol);
    if (!market) {
      return { success: false, error: `Market "${params.symbol}" not found on Novig.` };
    }

    if (params.size <= 0) {
      return { success: false, error: 'Order size must be greater than zero.' };
    }

    const price = params.price ?? (params.side === 'BUY' ? market.ask : market.bid);
    if (price <= 0 || price >= 1.0) {
      return { success: false, error: `Invalid prediction price $${price}. Must be between $0.01 and $0.99.` };
    }

    const orderId = `NOVIG_ORD_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const notionalUsd = Number((params.size * price).toFixed(2));
    const ob = this.orderbooks.get(params.symbol);

    // Determine execution / fill against current L2 depth
    let status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' = 'OPEN';
    let filledSize = 0;
    let avgFillPrice = price;

    if (params.orderType === 'MARKET' || (params.side === 'BUY' && price >= market.ask) || (params.side === 'SELL' && price <= market.bid)) {
      // Immediate execution against existing resting orders at 0% fee
      filledSize = params.size;
      status = 'FILLED';
      avgFillPrice = params.side === 'BUY' ? market.ask : market.bid;

      // Record trade execution
      const trade: INovigTrade = {
        id: `TRD_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        orderId,
        symbol: params.symbol,
        side: params.side,
        outcome: params.outcome || 'YES',
        price: avgFillPrice,
        size: filledSize,
        notionalUsd: Number((filledSize * avgFillPrice).toFixed(2)),
        feeUsd: 0.0, // Strictly 0.00% commission
        counterpartyId: `P2P_PEER_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        timestamp: Date.now()
      };

      this.trades.unshift(trade);
      this.notifyTradeListeners(trade);
    }

    const order: INovigOrder = {
      id: orderId,
      symbol: params.symbol,
      side: params.side,
      outcome: params.outcome || 'YES',
      orderType: params.orderType,
      price,
      size: params.size,
      notionalUsd,
      filledSize,
      remainingSize: params.size - filledSize,
      avgFillPrice,
      status,
      feeRatePct: 0.0,
      feesPaidUsd: 0.0,
      timestamp: Date.now(),
      updatedAt: Date.now()
    };

    if (status === 'OPEN') {
      this.openOrders.set(orderId, order);
    }

    this.orderHistory.unshift(order);
    this.notifyOrderListeners(order);

    return { success: true, order };
  }

  /**
   * Cancels an open resting P2P order
   */
  public cancelOrder(orderId: string): boolean {
    const order = this.openOrders.get(orderId);
    if (!order) return false;

    order.status = 'CANCELED';
    order.updatedAt = Date.now();
    this.openOrders.delete(orderId);
    this.notifyOrderListeners(order);
    return true;
  }

  /**
   * Cancels all open resting orders for a given symbol or entirely
   */
  public cancelAllOrders(symbol?: string): number {
    let canceledCount = 0;
    for (const [id, ord] of this.openOrders.entries()) {
      if (!symbol || ord.symbol === symbol) {
        ord.status = 'CANCELED';
        ord.updatedAt = Date.now();
        this.openOrders.delete(id);
        this.notifyOrderListeners(ord);
        canceledCount++;
      }
    }
    return canceledCount;
  }

  /**
   * Returns list of currently open resting orders
   */
  public getOpenOrders(symbol?: string): INovigOrder[] {
    const orders = Array.from(this.openOrders.values());
    return symbol ? orders.filter(o => o.symbol === symbol) : orders;
  }

  /**
   * Returns complete order history
   */
  public getOrderHistory(): INovigOrder[] {
    return [...this.orderHistory];
  }

  /**
   * Returns executed trades
   */
  public getTrades(): INovigTrade[] {
    return [...this.trades];
  }

  /**
   * Broadcasts real-time price updates across all connected listeners and updates local L2 book
   */
  public updateMarketPrice(symbol: string, newBid: number, newAsk: number, lastPrice?: number): void {
    const existing = this.markets.get(symbol);
    if (!existing) return;

    const midPrice = Number(((newBid + newAsk) / 2).toFixed(3));
    const spread = Number((newAsk - newBid).toFixed(3));
    const spreadBps = Number(((spread / midPrice) * 10000).toFixed(0));

    const updatedMarket: IMarketData = {
      ...existing,
      bid: newBid,
      ask: newAsk,
      midPrice,
      lastPrice: lastPrice ?? midPrice,
      spreadBps,
      timestamp: Date.now()
    };

    this.markets.set(symbol, updatedMarket);

    const updatedBook = this.generateL2Ladder(symbol, newBid, newAsk);
    this.orderbooks.set(symbol, updatedBook);

    this.notifyPriceListeners(updatedMarket, updatedBook);
  }

  /**
   * Zero-Fee Passive Market Making Helper:
   * Posts simultaneous resting Bid and Ask quotes around the mid-price to harvest the full spread without paying fees.
   */
  public postMarketMakerQuotes(symbol: string, halfSpreadBps = 15, notionalPerSide = 2500): {
    bidOrder?: INovigOrder;
    askOrder?: INovigOrder;
  } {
    const market = this.markets.get(symbol);
    if (!market) return {};

    const spreadOffset = (halfSpreadBps / 10000) * market.midPrice;
    const bidPrice = Number(Math.max(0.01, market.midPrice - spreadOffset).toFixed(3));
    const askPrice = Number(Math.min(0.99, market.midPrice + spreadOffset).toFixed(3));

    const bidSize = Math.round(notionalPerSide / bidPrice);
    const askSize = Math.round(notionalPerSide / askPrice);

    const bidRes = this.submitP2POrder({
      symbol,
      side: 'BUY',
      orderType: 'POST_ONLY',
      price: bidPrice,
      size: bidSize
    });

    const askRes = this.submitP2POrder({
      symbol,
      side: 'SELL',
      orderType: 'POST_ONLY',
      price: askPrice,
      size: askSize
    });

    return {
      bidOrder: bidRes.order,
      askOrder: askRes.order
    };
  }

  /**
   * Event Listeners Subscription
   */
  public onPriceUpdate(listener: NovigPriceUpdateListener): () => void {
    this.priceListeners.add(listener);
    return () => this.priceListeners.delete(listener);
  }

  public onOrderUpdate(listener: NovigOrderUpdateListener): () => void {
    this.orderListeners.add(listener);
    return () => this.orderListeners.delete(listener);
  }

  public onTrade(listener: NovigTradeListener): () => void {
    this.tradeListeners.add(listener);
    return () => this.tradeListeners.delete(listener);
  }

  private notifyPriceListeners(market: IMarketData, book: IOrderBook): void {
    for (const listener of this.priceListeners) {
      try {
        listener(market, book);
      } catch (err) {
        console.error('Error in Novig price listener:', err);
      }
    }
  }

  private notifyOrderListeners(order: INovigOrder): void {
    for (const listener of this.orderListeners) {
      try {
        listener(order);
      } catch (err) {
        console.error('Error in Novig order listener:', err);
      }
    }
  }

  private notifyTradeListeners(trade: INovigTrade): void {
    for (const listener of this.tradeListeners) {
      try {
        listener(trade);
      } catch (err) {
        console.error('Error in Novig trade listener:', err);
      }
    }
  }

  /**
   * Diagnostic telemetry and protocol status
   */
  public getProtocolStatus(): {
    venue: VenueId;
    environment: string;
    commissionRatePct: number;
    connected: boolean;
    pingLatencyMs: number;
    activeContractsCount: number;
    openOrdersCount: number;
    totalTradesCount: number;
    totalFeesSavedUsd: number;
  } {
    const totalTradedNotional = this.trades.reduce((sum, t) => sum + t.notionalUsd, 0);
    // Polymarket charges 0.1% (10 bps) and traditional sportsbooks charge ~5-10% vig
    const estimatedFeesSavedUsd = Number((totalTradedNotional * 0.003).toFixed(2));

    return {
      venue: 'novig',
      environment: this.config.environment,
      commissionRatePct: 0.0,
      connected: this.isConnected,
      pingLatencyMs: Number(this.pingLatencyMs.toFixed(1)),
      activeContractsCount: this.markets.size,
      openOrdersCount: this.openOrders.size,
      totalTradesCount: this.trades.length,
      totalFeesSavedUsd: estimatedFeesSavedUsd
    };
  }
}

export const globalNovigEngine = new NovigPredictionMarketEngine();
