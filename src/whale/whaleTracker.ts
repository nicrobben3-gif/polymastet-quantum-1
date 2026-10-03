/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ISmartWallet {
  address: string;
  alias: string;
  winRatePct: number;
  totalPnlUsd: number;
  sharpeRatio: number;
  tradesCount: number;
  avgHoldTimeHours: number;
  tags: string[];
  isFollowed: boolean;
  copyAllocationUsd: number;
}

export interface IWhaleTradeAlert {
  id: string;
  walletAddress: string;
  alias: string;
  symbol: string;
  venue: string;
  direction: 'BUY' | 'SELL';
  price: number;
  sizeUsd: number;
  timestamp: number;
  priceDeteriorationPct: number;
  isEligibleForCopy: boolean;
  rejectionReason?: string;
}

export class WhaleTracker {
  private wallets: ISmartWallet[] = [
    {
      address: '0x71C...a829',
      alias: 'Apex Macro Alpha',
      winRatePct: 76.4,
      totalPnlUsd: 485000,
      sharpeRatio: 3.12,
      tradesCount: 340,
      avgHoldTimeHours: 18,
      tags: ['Polymarket Whale', 'Election Specialist', 'Consistent'],
      isFollowed: true,
      copyAllocationUsd: 1500
    },
    {
      address: '0x39F...91c0',
      alias: 'Solana Arb Engine',
      winRatePct: 88.2,
      totalPnlUsd: 290000,
      sharpeRatio: 3.84,
      tradesCount: 1120,
      avgHoldTimeHours: 0.5,
      tags: ['High Frequency', 'Delta Neutral', 'Arbitrageur'],
      isFollowed: true,
      copyAllocationUsd: 2500
    },
    {
      address: '0xB42...771e',
      alias: 'Rate Cut Strategist',
      winRatePct: 69.5,
      totalPnlUsd: 175000,
      sharpeRatio: 2.25,
      tradesCount: 180,
      avgHoldTimeHours: 72,
      tags: ['Fed & Macro', 'Deep Liquidity'],
      isFollowed: false,
      copyAllocationUsd: 1000
    },
    {
      address: '0x10a...55f8',
      alias: 'Event Catalyst Sniper',
      winRatePct: 64.0,
      totalPnlUsd: 112000,
      sharpeRatio: 1.90,
      tradesCount: 220,
      avgHoldTimeHours: 4,
      tags: ['Fast Breaking', 'News Sniper'],
      isFollowed: true,
      copyAllocationUsd: 800
    }
  ];

  private recentTrades: IWhaleTradeAlert[] = [
    {
      id: 'WT_1',
      walletAddress: '0x71C...a829',
      alias: 'Apex Macro Alpha',
      symbol: 'POLY:US_PRES_2028_DEM',
      venue: 'polymarket',
      direction: 'BUY',
      price: 0.52,
      sizeUsd: 45000,
      timestamp: Date.now() - 120000,
      priceDeteriorationPct: 0.15,
      isEligibleForCopy: true
    },
    {
      id: 'WT_2',
      walletAddress: '0x39F...91c0',
      alias: 'Solana Arb Engine',
      symbol: 'BINANCE:SOL_USDT_PERP',
      venue: 'binance',
      direction: 'BUY',
      price: 218.20,
      sizeUsd: 85000,
      timestamp: Date.now() - 360000,
      priceDeteriorationPct: 0.22,
      isEligibleForCopy: true
    },
    {
      id: 'WT_3',
      walletAddress: '0xB42...771e',
      alias: 'Rate Cut Strategist',
      symbol: 'POLY:FED_RATE_CUT_Q4',
      venue: 'polymarket',
      direction: 'BUY',
      price: 0.68,
      sizeUsd: 22000,
      timestamp: Date.now() - 900000,
      priceDeteriorationPct: 1.45,
      isEligibleForCopy: false,
      rejectionReason: 'Price deteriorated by > 1.0% max allowable copy slippage threshold.'
    }
  ];

  public getWallets(): ISmartWallet[] {
    return [...this.wallets];
  }

  public getRecentTrades(): IWhaleTradeAlert[] {
    return [...this.recentTrades];
  }

  public toggleFollow(address: string): boolean {
    const w = this.wallets.find(x => x.address === address);
    if (!w) return false;
    w.isFollowed = !w.isFollowed;
    return w.isFollowed;
  }

  public updateAllocation(address: string, amountUsd: number) {
    const w = this.wallets.find(x => x.address === address);
    if (w) w.copyAllocationUsd = amountUsd;
  }
}

export const globalWhaleTracker = new WhaleTracker();
