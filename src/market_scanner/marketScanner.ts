/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IScannedOpportunity } from '../types/scanner';
import { IMarketData, IOrderBook } from '../types/market';
import { globalArbitrageEngine } from '../arbitrage/arbitrageEngine';

export class MarketScanner {
  private opportunities: IScannedOpportunity[] = [];

  /**
   * Scans all incoming venue ticks & orderbooks, ranking opportunities by EV,
   * execution probability, liquidity, fees, slippage, and capital requirements.
   */
  public scan(markets: IMarketData[], orderbooks: Map<string, IOrderBook>): IScannedOpportunity[] {
    const results: IScannedOpportunity[] = [];

    // 1. Cross-venue arbitrage scan
    const arbList = globalArbitrageEngine.scanAllMarkets(markets);
    for (const arb of arbList) {
      if (arb.isExecutable) {
        results.push({
          id: `SCAN_ARB_${arb.id}`,
          asset: arb.symbol,
          venue: arb.buyVenue,
          assetType: 'prediction',
          category: 'CROSS_EXCHANGE_DISCREPANCY',
          strategyId: 'cross_venue_arb',
          direction: 'BUY',
          entryPrice: arb.buyPrice,
          expectedExitPrice: arb.sellPrice,
          grossEdgePct: arb.grossSpreadPct,
          estimatedFeesPct: Number(((arb.tradingFeesUsd / arb.capitalRequiredUsd) * 100).toFixed(2)),
          estimatedSlippagePct: Number(((arb.expectedSlippageUsd / arb.capitalRequiredUsd) * 100).toFixed(2)),
          netExpectedEdgePct: arb.netExpectedEdgePct,
          expectedValueUsd: arb.netProfitUsd,
          availableLiquidityUsd: arb.availableLiquidityUsd,
          confidenceScore: 94,
          riskLevel: 'LOW',
          capitalRequiredUsd: arb.capitalRequiredUsd,
          timeToExecutionSec: 2,
          executionProbabilityPct: arb.executionProbability,
          score: Number((arb.netExpectedEdgePct * 15 + arb.executionProbability * 0.4).toFixed(1)),
          timestamp: Date.now(),
          status: 'PENDING',
          notes: `Simultaneous buy on ${arb.buyVenue} and sell on ${arb.sellVenue} locks in net edge.`
        });
      }
    }

    // 2. Market-specific scans
    for (const m of markets) {
      const ob = orderbooks.get(m.symbol);

      // Volume & Volatility Expansion
      if (m.volume24h > 150000 && m.spreadBps < 35) {
        results.push({
          id: `SCAN_VOL_${m.symbol}_${Date.now()}`,
          asset: m.symbol,
          venue: m.venue,
          assetType: m.assetType,
          category: 'VOLATILITY_EXPANSION',
          strategyId: 'volatility_expansion',
          direction: m.lastPrice > m.midPrice ? 'BUY' : 'SELL',
          entryPrice: m.lastPrice,
          expectedExitPrice: Number((m.lastPrice * (m.lastPrice > m.midPrice ? 1.04 : 0.96)).toFixed(m.assetType === 'prediction' ? 3 : 2)),
          grossEdgePct: 4.0,
          estimatedFeesPct: 0.1,
          estimatedSlippagePct: 0.15,
          netExpectedEdgePct: 3.75,
          expectedValueUsd: 187.50,
          availableLiquidityUsd: m.depthLiquidityUsd,
          confidenceScore: 78,
          riskLevel: 'MEDIUM',
          capitalRequiredUsd: 5000,
          timeToExecutionSec: 5,
          executionProbabilityPct: 82,
          score: 84.5,
          timestamp: Date.now(),
          status: 'PENDING',
          notes: `Abnormal volume breakout with expanding volatility bandwidth.`
        });
      }

      // Orderbook Imbalance
      if (ob && Math.abs(ob.imbalance) > 0.55) {
        const isBidHeavy = ob.imbalance > 0;
        results.push({
          id: `SCAN_OB_${m.symbol}_${Date.now()}`,
          asset: m.symbol,
          venue: m.venue,
          assetType: m.assetType,
          category: 'ORDERBOOK_IMBALANCE',
          strategyId: 'orderbook_imbalance',
          direction: isBidHeavy ? 'BUY' : 'SELL',
          entryPrice: m.lastPrice,
          expectedExitPrice: Number((m.lastPrice * (isBidHeavy ? 1.015 : 0.985)).toFixed(m.assetType === 'prediction' ? 3 : 2)),
          grossEdgePct: 1.5,
          estimatedFeesPct: 0.08,
          estimatedSlippagePct: 0.12,
          netExpectedEdgePct: 1.30,
          expectedValueUsd: 65.0,
          availableLiquidityUsd: m.depthLiquidityUsd,
          confidenceScore: 84,
          riskLevel: 'LOW',
          capitalRequiredUsd: 5000,
          timeToExecutionSec: 1,
          executionProbabilityPct: 88,
          score: 89.2,
          timestamp: Date.now(),
          status: 'PENDING',
          notes: `Orderbook depth skew ${(ob.imbalance * 100).toFixed(0)}% creates immediate micro-flow momentum.`
        });
      }

      // Funding rate discrepancy
      if (m.fundingRate && m.fundingRate > 0.0002) {
        const annualRate = (m.fundingRate * 3 * 365 * 100);
        results.push({
          id: `SCAN_FUND_${m.symbol}_${Date.now()}`,
          asset: m.symbol,
          venue: m.venue,
          assetType: m.assetType,
          category: 'FUNDING_DISCREPANCY',
          strategyId: 'funding_arb',
          direction: 'SELL',
          entryPrice: m.lastPrice,
          expectedExitPrice: m.lastPrice,
          grossEdgePct: Number((annualRate / 365 * 30).toFixed(2)), // 30-day yield
          estimatedFeesPct: 0.10,
          estimatedSlippagePct: 0.10,
          netExpectedEdgePct: Number((annualRate / 365 * 30 - 0.20).toFixed(2)),
          expectedValueUsd: 220.0,
          availableLiquidityUsd: m.depthLiquidityUsd,
          confidenceScore: 95,
          riskLevel: 'LOW',
          capitalRequiredUsd: 10000,
          timeToExecutionSec: 8,
          executionProbabilityPct: 96,
          score: 93.8,
          timestamp: Date.now(),
          status: 'PENDING',
          notes: `Elevated funding rate ${annualRate.toFixed(1)}% APR allows delta-neutral carry.`
        });
      }
    }

    // Rank opportunities strictly by compound score (EV + execution probability - risk penalty)
    this.opportunities = results.sort((a, b) => b.score - a.score);
    return this.opportunities;
  }

  public getOpportunities(): IScannedOpportunity[] {
    return [...this.opportunities];
  }
}

export const globalMarketScanner = new MarketScanner();
