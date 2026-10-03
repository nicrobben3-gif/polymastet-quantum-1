/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VenueId = 
  | 'polymarket'
  | 'kalshi'
  | 'opinion'
  | 'binance'
  | 'bybit'
  | 'uniswap_v3'
  | 'hyperliquid'
  | 'solana'
  | 'raydium';

export type AssetType = 'prediction' | 'crypto_perp' | 'crypto_spot' | 'fx';

export interface IMarketData {
  id: string;
  symbol: string;
  venue: VenueId;
  assetType: AssetType;
  baseAsset: string;
  quoteAsset: string;
  bid: number;
  ask: number;
  lastPrice: number;
  midPrice: number;
  volume24h: number;
  change24h?: number;
  openInterest?: number;
  fundingRate?: number; // 8h funding rate for perps
  predictedFundingRate?: number;
  spreadBps: number;
  depthLiquidityUsd: number;
  timestamp: number;
  // Specific for prediction markets (e.g. Polymarket / Kalshi)
  contractOutcome?: 'YES' | 'NO';
  eventTitle?: string;
  category?: 'Politics' | 'Crypto' | 'Macro' | 'Sports' | 'Tech';
  resolutionDate?: string;
}

export interface IOrderBookLevel {
  price: number;
  size: number;
  total: number;
}

export interface IOrderBook {
  symbol: string;
  venue: VenueId;
  timestamp: number;
  bids: IOrderBookLevel[];
  asks: IOrderBookLevel[];
  spread: number;
  spreadBps: number;
  microPrice: number;
  imbalance: number; // -1.0 to +1.0 (positive = bid heavy)
}

export interface ICandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
