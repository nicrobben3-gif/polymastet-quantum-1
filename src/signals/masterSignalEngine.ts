/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ITradingSignal, ISignalScoreWeights, MarketRegime } from '../types/signal';
import { IMarketData } from '../types/market';
import { IPortfolioState } from '../types/portfolio';

export const DEFAULT_SIGNAL_WEIGHTS: ISignalScoreWeights = {
  historicalPerformance: 0.25,
  currentRegimeFit: 0.20,
  volatilityFactor: 0.15,
  liquidityFactor: 0.15,
  correlationPenalty: 0.10,
  drawdownPenalty: 0.05,
  recentQuality: 0.05,
  executionQuality: 0.05
};

export class MasterSignalEngine {
  private weights: ISignalScoreWeights;
  private signalHistory: ITradingSignal[] = [];
  private activeSignals: Map<string, ITradingSignal> = new Map(); // Key: symbol

  constructor(weights: Partial<ISignalScoreWeights> = {}) {
    this.weights = { ...DEFAULT_SIGNAL_WEIGHTS, ...weights };
  }

  public getWeights(): ISignalScoreWeights {
    return { ...this.weights };
  }

  public updateWeights(newWeights: Partial<ISignalScoreWeights>) {
    this.weights = { ...this.weights, ...newWeights };
  }

  /**
   * Evaluates, scores, and reconciles incoming signals from multiple strategies.
   * Rejects conflicting directions, negative expected value, or sub-threshold scores.
   */
  public processSignals(
    rawSignals: ITradingSignal[],
    marketDataMap: Map<string, IMarketData>,
    portfolio: IPortfolioState
  ): ITradingSignal[] {
    const validSignals: ITradingSignal[] = [];

    // Group signals by symbol to resolve conflicts
    const bySymbol: Map<string, ITradingSignal[]> = new Map();
    for (const sig of rawSignals) {
      if (sig.direction === 'NEUTRAL' || sig.direction === 'CLOSE') continue;
      const list = bySymbol.get(sig.symbol) || [];
      list.push(sig);
      bySymbol.set(sig.symbol, list);
    }

    for (const [symbol, candidates] of bySymbol.entries()) {
      const market = marketDataMap.get(symbol);
      if (!market) continue;

      // 1. Check for directional conflict (e.g. Trend says BUY, Mean Rev says SELL)
      const hasBuy = candidates.some(s => s.direction === 'BUY');
      const hasSell = candidates.some(s => s.direction === 'SELL');

      if (hasBuy && hasSell) {
        // Conflicting signals on the same symbol!
        // Rather than averaging to neutral noise, evaluate weighted score of strongest side.
        const buyScores = candidates.filter(s => s.direction === 'BUY').map(s => this.scoreSignal(s, market, portfolio));
        const sellScores = candidates.filter(s => s.direction === 'SELL').map(s => this.scoreSignal(s, market, portfolio));
        
        const maxBuy = Math.max(...buyScores.map(b => b.weightedScore), 0);
        const maxSell = Math.max(...sellScores.map(s => s.weightedScore), 0);

        // If conflict margin is too narrow (< 0.25 difference), reject both for safety!
        if (Math.abs(maxBuy - maxSell) < 0.25) {
          continue; // conflict rejected
        }

        const dominant = maxBuy > maxSell 
          ? buyScores.find(b => b.weightedScore === maxBuy)
          : sellScores.find(s => s.weightedScore === maxSell);

        if (dominant && dominant.weightedScore >= 0.60) {
          validSignals.push(dominant);
          this.recordSignal(dominant);
        }
      } else {
        // Consistent direction: Pick highest confidence & EV scored candidate
        for (const candidate of candidates) {
          const scored = this.scoreSignal(candidate, market, portfolio);
          if (scored.weightedScore >= 0.58 && scored.expectedValue > 0) {
            validSignals.push(scored);
            this.recordSignal(scored);
          }
        }
      }
    }

    return validSignals;
  }

  /**
   * Computes rigorous multi-factor score:
   * Historical Perf + Regime Fit + Volatility + Liquidity - Correlation - Drawdown
   */
  public scoreSignal(
    signal: ITradingSignal,
    market: IMarketData,
    portfolio: IPortfolioState
  ): ITradingSignal {
    // 1. Historical Performance Factor (0.0 to 1.0)
    const historicalFactor = Math.min(1.0, Math.max(0.2, signal.historicalScore || 0.72));

    // 2. Market Regime Alignment
    const regimeFit = this.calculateRegimeFit(signal.strategy, signal.marketRegime, signal.direction);

    // 3. Volatility Factor (optimal medium volatility, penalized in illiquid chaotic extreme vol)
    const vol = Math.max(0.001, signal.volatility);
    const volFactor = vol > 0.08 ? 0.4 : vol < 0.005 ? 0.6 : 0.95;

    // 4. Liquidity Depth Factor
    const minLiq = 15000;
    const liqFactor = Math.min(1.0, Math.max(0.1, signal.liquidityUsd / minLiq));

    // 5. Correlation & Drawdown Penalties
    const isUnderDrawdown = portfolio.currentDrawdownPct > 5.0;
    const ddPenalty = isUnderDrawdown ? (portfolio.currentDrawdownPct / 20) : 0;

    const currentStratExposure = portfolio.strategyExposurePct[signal.strategy] || 0;
    const corrPenalty = currentStratExposure > 20 ? 0.3 : 0;

    // Execution Quality Factor (low spread, high fill likelihood)
    const spreadPenalty = Math.max(0, (market.spreadBps - 20) / 100);
    const execFactor = Math.max(0.2, 1.0 - spreadPenalty);

    // Weighted composite
    const rawScore = 
      (this.weights.historicalPerformance * historicalFactor) +
      (this.weights.currentRegimeFit * regimeFit) +
      (this.weights.volatilityFactor * volFactor) +
      (this.weights.liquidityFactor * liqFactor) +
      (this.weights.executionQuality * execFactor) -
      (this.weights.correlationPenalty * corrPenalty) -
      (this.weights.drawdownPenalty * ddPenalty);

    const weightedScore = Math.max(0, Math.min(1.0, Number(rawScore.toFixed(3))));

    return {
      ...signal,
      historicalScore: Number(historicalFactor.toFixed(2)),
      regimeFit: Number(regimeFit.toFixed(2)),
      executionQualityFactor: Number(execFactor.toFixed(2)),
      weightedScore,
      confidence: Number((signal.confidence * 0.4 + weightedScore * 0.6).toFixed(2))
    };
  }

  private calculateRegimeFit(strategy: string, regime: MarketRegime, direction: string): number {
    if (strategy.includes('trend') || strategy.includes('momentum')) {
      if (regime === 'TRENDING_BULL' && direction === 'BUY') return 0.95;
      if (regime === 'TRENDING_BEAR' && direction === 'SELL') return 0.95;
      if (regime === 'MEAN_REVERTING') return 0.35;
      return 0.60;
    }
    if (strategy.includes('mean_reversion') || strategy.includes('market_making')) {
      if (regime === 'MEAN_REVERTING' || regime === 'COMPRESSED_RANGE') return 0.95;
      if (regime === 'HIGH_VOLATILITY') return 0.40;
      return 0.55;
    }
    if (strategy.includes('breakout') || strategy.includes('volatility')) {
      if (regime === 'COMPRESSED_RANGE' || regime === 'HIGH_VOLATILITY') return 0.90;
      return 0.60;
    }
    if (strategy.includes('arb') || strategy.includes('basis') || strategy.includes('funding')) {
      // Arbitrage is market-neutral by design
      return 0.92;
    }
    return 0.70;
  }

  private recordSignal(signal: ITradingSignal) {
    this.signalHistory.unshift(signal);
    if (this.signalHistory.length > 100) this.signalHistory.pop();
    this.activeSignals.set(signal.symbol, signal);
  }

  public getRecentSignals(): ITradingSignal[] {
    return [...this.signalHistory];
  }

  public getActiveSignals(): ITradingSignal[] {
    return Array.from(this.activeSignals.values());
  }
}

export const globalSignalEngine = new MasterSignalEngine();
