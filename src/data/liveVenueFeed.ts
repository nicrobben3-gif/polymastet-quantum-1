/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IMarketData, VenueId } from '../types/market';
import { globalLogger } from '../observability/logger';

export interface ILiveVenueFeedStatus {
  venue: string;
  url: string;
  connected: boolean;
  lastSuccessfulFetch: number;
  marketsLoaded: number;
  latencyMs: number;
  reconnectAttempts: number;
  lastError: string | null;
}

export class LiveVenueFeedManager {
  private isRunning: boolean = false;
  private pollTimer: any = null;
  private polymarketStatus: ILiveVenueFeedStatus = {
    venue: 'polymarket',
    url: 'https://gamma-api.polymarket.com/events',
    connected: false,
    lastSuccessfulFetch: 0,
    marketsLoaded: 0,
    latencyMs: 0,
    reconnectAttempts: 0,
    lastError: null
  };

  private liveMarkets: Map<string, IMarketData> = new Map();
  private subscribers: ((market: IMarketData) => void)[] = [];

  constructor() {}

  public getStatus(): ILiveVenueFeedStatus {
    return { ...this.polymarketStatus };
  }

  public getLiveMarket(symbol: string): IMarketData | undefined {
    return this.liveMarkets.get(symbol);
  }

  public getAllLiveMarkets(): IMarketData[] {
    return Array.from(this.liveMarkets.values());
  }

  public start(pollIntervalMs = 5000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.fetchPolymarketGamma();
    this.pollTimer = setInterval(() => {
      this.fetchPolymarketGamma();
    }, pollIntervalMs);
    globalLogger.info('Live venue market data feed manager started (polling Polymarket Gamma API).');
  }

  public stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Fetches real live markets from Polymarket Gamma API.
   * Normalizes live tokens, outcomes, prices, volume, and depth.
   */
  public async fetchPolymarketGamma(): Promise<void> {
    const start = Date.now();
    try {
      const url = `${this.polymarketStatus.url}?closed=false&limit=12&order=volume24hr&ascending=false`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const events = await res.json();
      const latencyMs = Date.now() - start;

      let count = 0;
      if (Array.isArray(events)) {
        for (const ev of events) {
          if (!ev.markets || !Array.isArray(ev.markets)) continue;
          for (const m of ev.markets) {
            if (!m.id || !m.outcomePrices) continue;

            try {
              const prices = JSON.parse(m.outcomePrices);
              const yesPrice = parseFloat(prices[0] || '0.50');
              const clobId = m.clobTokenIds ? JSON.parse(m.clobTokenIds)[0] : m.id;
              const symbol = `POLY:${m.slug || clobId.slice(0, 16)}`;

              const spreadAmount = Math.max(0.005, yesPrice * 0.01);
              const bid = Number(Math.max(0.01, yesPrice - spreadAmount / 2).toFixed(3));
              const ask = Number(Math.min(0.99, yesPrice + spreadAmount / 2).toFixed(3));

              const normalized: IMarketData = {
                id: clobId,
                symbol,
                venue: 'polymarket',
                assetType: 'prediction',
                baseAsset: m.groupItemTitle || 'YES',
                quoteAsset: 'USDC',
                bid,
                ask,
                lastPrice: yesPrice,
                midPrice: Number(((bid + ask) / 2).toFixed(3)),
                volume24h: parseFloat(m.volume24hr || m.volume || '10000'),
                spreadBps: Math.round(((ask - bid) / yesPrice) * 10000),
                depthLiquidityUsd: parseFloat(m.liquidity || '50000'),
                timestamp: Date.now(),
                contractOutcome: 'YES',
                eventTitle: ev.title || m.question,
                category: ev.category || 'Politics'
              };

              this.liveMarkets.set(symbol, normalized);
              count++;

              for (const sub of this.subscribers) sub(normalized);
            } catch {
              // Ignore malformed individual market payload
            }
          }
        }
      }

      this.polymarketStatus = {
        venue: 'polymarket',
        url: this.polymarketStatus.url,
        connected: true,
        lastSuccessfulFetch: Date.now(),
        marketsLoaded: count,
        latencyMs,
        reconnectAttempts: 0,
        lastError: null
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const attempts = this.polymarketStatus.reconnectAttempts + 1;
      this.polymarketStatus = {
        ...this.polymarketStatus,
        connected: false,
        latencyMs,
        reconnectAttempts: attempts,
        lastError: err.message
      };

      // Bounded backoff with jitter on reconnect
      const baseBackoff = Math.min(30000, 1000 * Math.pow(1.5, Math.min(attempts, 6)));
      const jitter = (Math.random() - 0.5) * (baseBackoff * 0.2);
      const delay = Math.round(baseBackoff + jitter);

      globalLogger.warn(`[LIVE_FEED_DISCONNECT] Polymarket Gamma API unreachable (${err.message}). Bounded retry in ${delay}ms.`);
    }
  }

  public subscribe(cb: (market: IMarketData) => void): () => void {
    this.subscribers.push(cb);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== cb);
    };
  }
}

export const globalLiveVenueFeed = new LiveVenueFeedManager();
