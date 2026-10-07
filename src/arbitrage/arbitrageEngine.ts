/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IArbitrageOpportunity, ArbitrageType } from '../types/arbitrage';
import { IMarketData } from '../types/market';

export interface IArbitrageCostModel {
  minNetEdgePct: number; // e.g. 0.8%
  safetyMarginPct: number; // e.g. 0.3%
  gasPriceGwei: number;
  ethPriceUsd: number;
}

export class ArbitrageEngine {
  private costModel: IArbitrageCostModel;
  private opportunities: IArbitrageOpportunity[] = [];

  constructor(costModel: Partial<IArbitrageCostModel> = {}) {
    this.costModel = {
      minNetEdgePct: 0.8,
      safetyMarginPct: 0.3,
      gasPriceGwei: 25,
      ethPriceUsd: 3450,
      ...costModel
    };
  }

  /**
   * Scans cross-venue pairs and calculates True Executable Net Edge.
   * Subtracts trading fees, gas, bridge, funding, borrowing, slippage, and latency buffer.
   */
  public evaluatePair(
    marketA: IMarketData,
    marketB: IMarketData,
    notionalTradeUsd = 10000
  ): IArbitrageOpportunity | null {
    // Check if markets represent the same underlying event or asset
    const isSameUnderlying = 
      (marketA.baseAsset === marketB.baseAsset) ||
      (marketA.symbol.includes('US_PRES') && marketB.symbol.includes('US_PRES')) ||
      (marketA.symbol.includes('FED_RATE') && marketB.symbol.includes('FED_RATE')) ||
      (marketA.symbol.includes('SUPERBOWL') && marketB.symbol.includes('SUPERBOWL')) ||
      (marketA.symbol.includes('NBA') && marketB.symbol.includes('NBA')) ||
      (marketA.symbol.includes('BTC_ABOVE') && marketB.symbol.includes('BTC_ABOVE'));

    if (!isSameUnderlying || marketA.venue === marketB.venue) {
      return null;
    }

    // Determine Buy Venue (cheaper ask) and Sell Venue (higher bid)
    let buyMarket: IMarketData;
    let sellMarket: IMarketData;

    if (marketA.ask < marketB.bid) {
      buyMarket = marketA;
      sellMarket = marketB;
    } else if (marketB.ask < marketA.bid) {
      buyMarket = marketB;
      sellMarket = marketA;
    } else {
      return null; // No gross spread
    }

    const buyPrice = buyMarket.ask;
    const sellPrice = sellMarket.bid;
    const grossSpreadUsd = sellPrice - buyPrice;
    const grossSpreadPct = (grossSpreadUsd / buyPrice) * 100;

    if (grossSpreadPct <= 0) return null;

    // Rigorous Cost Deductions
    // 1. Trading fees (Novig is 0% commission exchange / P2P, Polymarket is 0.1%, Kalshi is 0.3%)
    const getVenueFeeRate = (venue: string): number => {
      if (venue === 'novig') return 0.0; // Novig 0% commission P2P orderbook
      if (venue === 'polymarket') return 0.001;
      if (venue === 'kalshi') return 0.003;
      return 0.0005;
    };

    const takerFeeBuyPct = getVenueFeeRate(buyMarket.venue);
    const takerFeeSellPct = getVenueFeeRate(sellMarket.venue);
    const tradingFeesUsd = notionalTradeUsd * (takerFeeBuyPct + takerFeeSellPct);

    // 2. Blockchain gas costs (if on-chain DEX or Polygon settlement)
    const isBuyOnchain = buyMarket.venue === 'polymarket' || buyMarket.venue === 'uniswap_v3';
    const isSellOnchain = sellMarket.venue === 'polymarket' || sellMarket.venue === 'uniswap_v3';
    const gasCostUsd = (isBuyOnchain ? 2.50 : 0) + (isSellOnchain ? 2.50 : 0);

    // 3. Expected slippage based on depth
    const buySlippage = notionalTradeUsd / Math.max(10000, buyMarket.depthLiquidityUsd) * 0.002 * notionalTradeUsd;
    const sellSlippage = notionalTradeUsd / Math.max(10000, sellMarket.depthLiquidityUsd) * 0.002 * notionalTradeUsd;
    const expectedSlippageUsd = buySlippage + sellSlippage;

    // 4. Execution latency buffer (risk of adverse fill during routing delay)
    const executionLatencyBufferUsd = notionalTradeUsd * 0.0015; // 15 bps buffer

    // 5. Bridge & borrowing costs
    const bridgeCostUsd = buyMarket.venue !== sellMarket.venue && (isBuyOnchain !== isSellOnchain) ? 5.00 : 0.0;
    const fundingCostUsd = (buyMarket.fundingRate || 0) * notionalTradeUsd;
    const borrowingCostUsd = 0.0;
    const priceImpactUsd = expectedSlippageUsd * 0.5;

    const totalCostUsd = 
      tradingFeesUsd +
      gasCostUsd +
      bridgeCostUsd +
      fundingCostUsd +
      borrowingCostUsd +
      expectedSlippageUsd +
      executionLatencyBufferUsd +
      priceImpactUsd;

    const grossEdgeUsd = (grossSpreadPct / 100) * notionalTradeUsd;
    const netProfitUsd = grossEdgeUsd - totalCostUsd;
    const netExpectedEdgePct = (netProfitUsd / notionalTradeUsd) * 100;

    // Must exceed minimum edge + safety margin
    const hurdleRate = this.costModel.minNetEdgePct + this.costModel.safetyMarginPct;
    const isExecutable = netExpectedEdgePct >= hurdleRate && netProfitUsd > 10;

    let arbType: ArbitrageType = 'PREDICTION_MARKET_CROSS_VENUE';
    if (buyMarket.assetType === 'crypto_perp') {
      arbType = 'CEX_CEX';
    } else if (buyMarket.venue === 'uniswap_v3' || sellMarket.venue === 'uniswap_v3') {
      arbType = 'CEX_DEX';
    }

    const cleanSymbol = buyMarket.symbol.replace(/[^a-zA-Z0-9_]/g, '_');
    const randomSalt = Math.random().toString(36).substring(2, 7);

    const opportunity: IArbitrageOpportunity = {
      id: `ARB_${cleanSymbol}_${buyMarket.venue}_${sellMarket.venue}_${Date.now()}_${randomSalt}`,
      type: arbType,
      symbol: buyMarket.symbol,
      buyVenue: buyMarket.venue,
      sellVenue: sellMarket.venue,
      buyPrice,
      sellPrice,
      grossSpreadPct: Number(grossSpreadPct.toFixed(2)),
      grossEdgeUsd: Number(grossEdgeUsd.toFixed(2)),
      tradingFeesUsd: Number(tradingFeesUsd.toFixed(2)),
      gasCostUsd: Number(gasCostUsd.toFixed(2)),
      bridgeCostUsd: Number(bridgeCostUsd.toFixed(2)),
      fundingCostUsd: Number(fundingCostUsd.toFixed(2)),
      borrowingCostUsd: Number(borrowingCostUsd.toFixed(2)),
      expectedSlippageUsd: Number(expectedSlippageUsd.toFixed(2)),
      executionLatencyBufferUsd: Number(executionLatencyBufferUsd.toFixed(2)),
      priceImpactUsd: Number(priceImpactUsd.toFixed(2)),
      totalCostUsd: Number(totalCostUsd.toFixed(2)),
      netExpectedEdgePct: Number(netExpectedEdgePct.toFixed(2)),
      netProfitUsd: Number(netProfitUsd.toFixed(2)),
      availableLiquidityUsd: Math.min(buyMarket.depthLiquidityUsd, sellMarket.depthLiquidityUsd),
      capitalRequiredUsd: notionalTradeUsd,
      executionProbability: isExecutable ? 94 : 45,
      isExecutable,
      timestamp: Date.now(),
      rationale: isExecutable 
        ? `Executable spread: Buy on ${buyMarket.venue} @ ${buyPrice}, sell on ${sellMarket.venue} @ ${sellPrice}. Net edge +${netExpectedEdgePct.toFixed(2)}% after all friction.`
        : `Unexecutable: Gross spread +${grossSpreadPct.toFixed(2)}% eroded by fees/gas ($${totalCostUsd.toFixed(2)}).`
    };

    return opportunity;
  }

  public scanAllMarkets(markets: IMarketData[]): IArbitrageOpportunity[] {
    const opps: IArbitrageOpportunity[] = [];
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const opp = this.evaluatePair(markets[i], markets[j]);
        if (opp) {
          opps.push(opp);
        }
      }
    }
    this.opportunities = opps.sort((a, b) => b.netExpectedEdgePct - a.netExpectedEdgePct);
    return this.opportunities;
  }

  public getOpportunities(): IArbitrageOpportunity[] {
    return [...this.opportunities];
  }
}

export const globalArbitrageEngine = new ArbitrageEngine();
