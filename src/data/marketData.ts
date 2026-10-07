/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IMarketData, IOrderBook, IOrderBookLevel, VenueId } from '../types/market';

export interface ISimulatedMarketConfig {
  symbol: string;
  venue: VenueId;
  assetType: 'prediction' | 'crypto_perp' | 'crypto_spot';
  baseAsset: string;
  quoteAsset: string;
  initialPrice: number;
  volatility: number;
  drift: number;
  spreadBps: number;
  liquidityUsd: number;
  contractOutcome?: 'YES' | 'NO';
  eventTitle?: string;
  category?: 'Politics' | 'Crypto' | 'Macro' | 'Sports' | 'Tech';
  fundingRate?: number;
}

export const INITIAL_MARKETS: ISimulatedMarketConfig[] = [
  {
    symbol: 'POLY:US_PRES_2028_DEM',
    venue: 'polymarket',
    assetType: 'prediction',
    baseAsset: 'DEM_WIN',
    quoteAsset: 'USDC',
    initialPrice: 0.52,
    volatility: 0.008,
    drift: 0.0001,
    spreadBps: 20,
    liquidityUsd: 145000,
    contractOutcome: 'YES',
    eventTitle: 'Democratic Party wins 2028 US Presidential Election',
    category: 'Politics'
  },
  {
    symbol: 'KALSHI:US_PRES_2028_DEM',
    venue: 'kalshi',
    assetType: 'prediction',
    baseAsset: 'DEM_WIN',
    quoteAsset: 'USD',
    initialPrice: 0.49, // Price divergence vs Polymarket -> Cross-venue arbitrage opportunity!
    volatility: 0.007,
    drift: 0.0001,
    spreadBps: 25,
    liquidityUsd: 95000,
    contractOutcome: 'YES',
    eventTitle: 'Democratic Party wins 2028 US Presidential Election',
    category: 'Politics'
  },
  {
    symbol: 'POLY:FED_RATE_CUT_Q4',
    venue: 'polymarket',
    assetType: 'prediction',
    baseAsset: 'FED_CUT_50BPS',
    quoteAsset: 'USDC',
    initialPrice: 0.68,
    volatility: 0.012,
    drift: -0.0002,
    spreadBps: 30,
    liquidityUsd: 82000,
    contractOutcome: 'YES',
    eventTitle: 'Federal Reserve cuts interest rates by >= 50bps in Q4',
    category: 'Macro'
  },
  {
    symbol: 'KALSHI:FED_RATE_CUT_Q4',
    venue: 'kalshi',
    assetType: 'prediction',
    baseAsset: 'FED_CUT_50BPS',
    quoteAsset: 'USD',
    initialPrice: 0.72,
    volatility: 0.011,
    drift: -0.0001,
    spreadBps: 28,
    liquidityUsd: 64000,
    contractOutcome: 'YES',
    eventTitle: 'Federal Reserve cuts interest rates by >= 50bps in Q4',
    category: 'Macro'
  },
  {
    symbol: 'POLY:ETH_ALL_TIME_HIGH_2026',
    venue: 'polymarket',
    assetType: 'prediction',
    baseAsset: 'ETH_ATH',
    quoteAsset: 'USDC',
    initialPrice: 0.38,
    volatility: 0.015,
    drift: 0.0003,
    spreadBps: 35,
    liquidityUsd: 58000,
    contractOutcome: 'YES',
    eventTitle: 'Ethereum reaches new All-Time High in 2026',
    category: 'Crypto'
  },
  {
    symbol: 'NOVIG:US_PRES_2028_DEM',
    venue: 'novig',
    assetType: 'prediction',
    baseAsset: 'DEM_WIN',
    quoteAsset: 'USD',
    initialPrice: 0.505, // Zero-vig peer-to-peer mid price -> creates 3-way arb vs Polymarket & Kalshi!
    volatility: 0.006,
    drift: 0.0001,
    spreadBps: 15,
    liquidityUsd: 110000,
    contractOutcome: 'YES',
    eventTitle: 'Democratic Party wins 2028 US Presidential Election',
    category: 'Politics'
  },
  {
    symbol: 'NOVIG:FED_RATE_CUT_Q4',
    venue: 'novig',
    assetType: 'prediction',
    baseAsset: 'FED_CUT_50BPS',
    quoteAsset: 'USD',
    initialPrice: 0.705,
    volatility: 0.009,
    drift: -0.0001,
    spreadBps: 18,
    liquidityUsd: 85000,
    contractOutcome: 'YES',
    eventTitle: 'Federal Reserve cuts interest rates by >= 50bps in Q4',
    category: 'Macro'
  },
  {
    symbol: 'NOVIG:SUPERBOWL_CHAMP_KC',
    venue: 'novig',
    assetType: 'prediction',
    baseAsset: 'KC_SUPERBOWL',
    quoteAsset: 'USD',
    initialPrice: 0.24,
    volatility: 0.014,
    drift: 0.0002,
    spreadBps: 20,
    liquidityUsd: 92000,
    contractOutcome: 'YES',
    eventTitle: 'Kansas City Chiefs win Super Bowl Championship',
    category: 'Sports'
  },
  {
    symbol: 'NOVIG:NBA_FINALS_BOS',
    venue: 'novig',
    assetType: 'prediction',
    baseAsset: 'BOS_NBA_CHAMP',
    quoteAsset: 'USD',
    initialPrice: 0.31,
    volatility: 0.012,
    drift: 0.0001,
    spreadBps: 22,
    liquidityUsd: 78000,
    contractOutcome: 'YES',
    eventTitle: 'Boston Celtics win NBA Championship',
    category: 'Sports'
  },
  {
    symbol: 'NOVIG:BTC_ABOVE_150K_2026',
    venue: 'novig',
    assetType: 'prediction',
    baseAsset: 'BTC_150K',
    quoteAsset: 'USD',
    initialPrice: 0.42,
    volatility: 0.018,
    drift: 0.0004,
    spreadBps: 25,
    liquidityUsd: 65000,
    contractOutcome: 'YES',
    eventTitle: 'Bitcoin price exceeds $150,000 USD before year-end 2026',
    category: 'Crypto'
  },
  {
    symbol: 'BINANCE:SOL_USDT_PERP',
    venue: 'binance',
    assetType: 'crypto_perp',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    initialPrice: 218.45,
    volatility: 0.025,
    drift: 0.0005,
    spreadBps: 4,
    liquidityUsd: 850000,
    fundingRate: 0.00025, // 0.025% 8h funding (~27% annualized)
    category: 'Crypto'
  },
  {
    symbol: 'BYBIT:SOL_USDT_PERP',
    venue: 'bybit',
    assetType: 'crypto_perp',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    initialPrice: 218.15,
    volatility: 0.024,
    drift: 0.0004,
    spreadBps: 5,
    liquidityUsd: 720000,
    fundingRate: 0.00012, // Funding rate divergence -> Funding rate arbitrage opportunity!
    category: 'Crypto'
  },
  {
    symbol: 'BINANCE:BTC_USDT_PERP',
    venue: 'binance',
    assetType: 'crypto_perp',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    initialPrice: 94250.00,
    volatility: 0.018,
    drift: 0.0003,
    spreadBps: 2,
    liquidityUsd: 2400000,
    fundingRate: 0.00015,
    category: 'Crypto'
  },
  {
    symbol: 'UNISWAP_V3:ETH_USDC',
    venue: 'uniswap_v3',
    assetType: 'crypto_spot',
    baseAsset: 'ETH',
    quoteAsset: 'USDC',
    initialPrice: 3485.50,
    volatility: 0.02,
    drift: 0.0002,
    spreadBps: 8,
    liquidityUsd: 1100000,
    category: 'Crypto'
  }
];

export class MarketDataFeed {
  private markets: Map<string, IMarketData> = new Map();
  private orderbooks: Map<string, IOrderBook> = new Map();
  private subscribers: ((data: IMarketData) => void)[] = [];
  private intervalTimer: any = null;

  constructor() {
    this.initMarkets();
  }

  private initMarkets() {
    for (const cfg of INITIAL_MARKETS) {
      const halfSpread = (cfg.initialPrice * (cfg.spreadBps / 10000)) / 2;
      const bid = Math.max(0.01, cfg.initialPrice - halfSpread);
      const ask = cfg.initialPrice + halfSpread;
      const tick: IMarketData = {
        id: cfg.symbol,
        symbol: cfg.symbol,
        venue: cfg.venue,
        assetType: cfg.assetType,
        baseAsset: cfg.baseAsset,
        quoteAsset: cfg.quoteAsset,
        bid: Number(bid.toFixed(4)),
        ask: Number(ask.toFixed(4)),
        lastPrice: cfg.initialPrice,
        midPrice: cfg.initialPrice,
        volume24h: cfg.liquidityUsd * 2.5,
        spreadBps: cfg.spreadBps,
        depthLiquidityUsd: cfg.liquidityUsd,
        timestamp: Date.now(),
        contractOutcome: cfg.contractOutcome,
        eventTitle: cfg.eventTitle,
        category: cfg.category,
        fundingRate: cfg.fundingRate
      };
      this.markets.set(cfg.symbol, tick);
      this.orderbooks.set(cfg.symbol, this.generateOrderbook(tick));
    }
  }

  public startStreaming(intervalMs = 800) {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stopStreaming() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public tick() {
    for (const [symbol, market] of this.markets.entries()) {
      // Geometric Brownian motion / mean-reverting jump diffusion
      const cfg = INITIAL_MARKETS.find(c => c.symbol === symbol);
      const vol = cfg ? cfg.volatility : 0.01;
      const drift = cfg ? cfg.drift : 0;
      
      const shock = (Math.random() - 0.495) * vol * market.lastPrice;
      let newPrice = market.lastPrice + drift * market.lastPrice + shock;

      // Bound prediction markets between 0.01 and 0.99
      if (market.assetType === 'prediction') {
        newPrice = Math.max(0.02, Math.min(0.98, newPrice));
      } else {
        newPrice = Math.max(0.1, newPrice);
      }

      const spreadAmount = (newPrice * (market.spreadBps / 10000)) / 2;
      const bid = Number((newPrice - spreadAmount).toFixed(market.assetType === 'prediction' ? 3 : 2));
      const ask = Number((newPrice + spreadAmount).toFixed(market.assetType === 'prediction' ? 3 : 2));

      const updated: IMarketData = {
        ...market,
        bid,
        ask,
        lastPrice: Number(newPrice.toFixed(market.assetType === 'prediction' ? 3 : 2)),
        midPrice: Number(((bid + ask) / 2).toFixed(market.assetType === 'prediction' ? 3 : 2)),
        volume24h: market.volume24h + Math.floor(Math.random() * 500),
        timestamp: Date.now()
      };

      this.markets.set(symbol, updated);
      this.orderbooks.set(symbol, this.generateOrderbook(updated));

      for (const sub of this.subscribers) {
        sub(updated);
      }
    }
  }

  public generateOrderbook(market: IMarketData): IOrderBook {
    const isPred = market.assetType === 'prediction';
    const precision = isPred ? 3 : 2;
    const tickSize = isPred ? 0.005 : market.lastPrice > 1000 ? 1.0 : 0.05;

    const bids: IOrderBookLevel[] = [];
    const asks: IOrderBookLevel[] = [];

    let bidCum = 0;
    let askCum = 0;

    for (let i = 0; i < 8; i++) {
      const bPrice = Number((market.bid - i * tickSize).toFixed(precision));
      const aPrice = Number((market.ask + i * tickSize).toFixed(precision));
      if (bPrice > 0) {
        const bSize = Math.floor(1000 / (i + 1) + Math.random() * 250);
        bidCum += bSize;
        bids.push({ price: bPrice, size: bSize, total: bidCum });
      }
      const aSize = Math.floor(1000 / (i + 1) + Math.random() * 250);
      askCum += aSize;
      asks.push({ price: aPrice, size: aSize, total: askCum });
    }

    const topBidSize = bids[0]?.size || 1;
    const topAskSize = asks[0]?.size || 1;
    const microPrice = (market.bid * topAskSize + market.ask * topBidSize) / (topBidSize + topAskSize);
    const imbalance = (bidCum - askCum) / (bidCum + askCum);

    return {
      symbol: market.symbol,
      venue: market.venue,
      timestamp: market.timestamp,
      bids,
      asks,
      spread: Number((market.ask - market.bid).toFixed(precision)),
      spreadBps: market.spreadBps,
      microPrice: Number(microPrice.toFixed(precision)),
      imbalance: Number(imbalance.toFixed(3))
    };
  }

  public getMarket(symbol: string): IMarketData | undefined {
    return this.markets.get(symbol);
  }

  public getAllMarkets(): IMarketData[] {
    return Array.from(this.markets.values());
  }

  public getOrderBook(symbol: string): IOrderBook | undefined {
    return this.orderbooks.get(symbol);
  }

  public subscribe(cb: (data: IMarketData) => void) {
    this.subscribers.push(cb);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== cb);
    };
  }
}

export const globalMarketFeed = new MarketDataFeed();
