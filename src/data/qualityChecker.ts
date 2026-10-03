/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IMarketData } from '../types/market';

export interface IDataQualityReport {
  isValid: boolean;
  isStale: boolean;
  isOutlier: boolean;
  ageMs: number;
  anomalyScore: number;
  errors: string[];
}

export class DataQualityChecker {
  private lastPrices: Map<string, number[]> = new Map();
  private maxAgeMs: number;

  constructor(maxAgeMs = 4000) {
    this.maxAgeMs = maxAgeMs;
  }

  public setMaxAge(ageMs: number) {
    this.maxAgeMs = ageMs;
  }

  public validate(tick: IMarketData): IDataQualityReport {
    const now = Date.now();
    const ageMs = Math.max(0, now - tick.timestamp);
    const errors: string[] = [];
    let isStale = false;
    let isOutlier = false;
    let anomalyScore = 0;

    // 1. Timestamp freshness check
    if (ageMs > this.maxAgeMs) {
      isStale = true;
      errors.push(`Stale market data: age ${ageMs}ms exceeds max allowed ${this.maxAgeMs}ms`);
      anomalyScore += 40;
    }

    // 2. Spread sanity check
    if (tick.bid <= 0 || tick.ask <= 0) {
      errors.push(`Invalid non-positive quotes: bid=${tick.bid}, ask=${tick.ask}`);
      anomalyScore += 50;
    } else if (tick.bid > tick.ask) {
      errors.push(`Crossed book detected: bid=${tick.bid} > ask=${tick.ask}`);
      anomalyScore += 40;
    }

    // 3. Outlier and flash spike detection
    const history = this.lastPrices.get(tick.symbol) || [];
    if (history.length >= 5) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / history.length;
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        const zScore = Math.abs(tick.lastPrice - mean) / stdDev;
        if (zScore > 4.5) {
          isOutlier = true;
          errors.push(`Extreme price outlier: z-score ${zScore.toFixed(2)} on ${tick.symbol}`);
          anomalyScore += 35;
        }
      }
    }

    // Update history ring buffer
    history.push(tick.lastPrice);
    if (history.length > 20) history.shift();
    this.lastPrices.set(tick.symbol, history);

    return {
      isValid: errors.length === 0,
      isStale,
      isOutlier,
      ageMs,
      anomalyScore,
      errors
    };
  }
}

export const globalQualityChecker = new DataQualityChecker();
