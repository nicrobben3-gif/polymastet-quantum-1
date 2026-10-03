/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ISolanaPoolDetection,
  ISniperPosition,
  ISolanaHedge,
  ISniperConfig,
  ISniperTelemetry,
  ISolanaLiquidPool,
  SolanaDex,
  HedgeMode
} from '../types/solanaSniper';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalProfitSplitterEngine } from '../core/profitSplitterEngine';

export class SolanaSniperEngine {
  private radar: ISolanaPoolDetection[] = [];
  private liquidPools: ISolanaLiquidPool[] = [];
  private positions: Map<string, ISniperPosition> = new Map();
  private hedges: Map<string, ISolanaHedge> = new Map();
  private listeners: (() => void)[] = [];
  private loopTimer: any = null;
  private currentSolPriceUsd: number = 178.50;

  private config: ISniperConfig = {
    autoSnipeEnabled: true,
    autoHedgeEnabled: true,
    hedgeMode: 'DELTA_NEUTRAL',
    hedgeRatioPct: 100,
    minSafetyScore: 82,
    maxSnipeSizeSol: 1.5,
    jitoTipSol: 0.005,
    priorityFeeLevel: 'ULTRA_TURBO',
    takeProfitTiers: [
      { profitPct: 50, sellPct: 25 },
      { profitPct: 120, sellPct: 35 },
      { profitPct: 250, sellPct: 25 }
    ],
    trailingStopPct: 12,
    hardStopLossPct: 20,
    preferredDexes: ['Raydium_AMM', 'Raydium_CPMM', 'Meteora_DLMM', 'Pump_Fun', 'Orca_Whirlpool']
  };

  private telemetry: ISniperTelemetry = {
    totalSnipesExecuted: 14,
    profitableSnipesCount: 11,
    winRatePct: 78.6,
    grossSnipePnlUsd: 4890.40,
    hedgePnlContributionUsd: 1120.80,
    netHedgedPnlUsd: 6011.20,
    capitalSavedByHedgeUsd: 2450.00,
    averageExecutionLatencyMs: 84,
    rugsAvoidedCount: 38,
    activePositionsCount: 0,
    activeHedgesCount: 0,
    totalHedgeNotionalUsd: 0
  };

  constructor() {
    this.seedInitialRadarAndPositions();
    this.seedInitialLiquidPools();
    this.startEngineLoop();
  }

  private seedInitialRadarAndPositions() {
    // Seed initial high-quality radar detections
    const sampleTokens = [
      { sym: 'QUANTUM', name: 'Quantum Solana AI', dex: 'Raydium_CPMM' as SolanaDex, score: 94, lp: 85, mc: 42000, safe: true },
      { sym: 'NEO_PUMP', name: 'Neo Acceleration', dex: 'Pump_Fun' as SolanaDex, score: 88, lp: 42, mc: 28000, safe: true },
      { sym: 'DLMM_SOL', name: 'Meteora Velocity', dex: 'Meteora_DLMM' as SolanaDex, score: 96, lp: 120, mc: 85000, safe: true },
      { sym: 'RUG_ALERT', name: 'SafeMoon 2.0 SOL', dex: 'Raydium_AMM' as SolanaDex, score: 32, lp: 15, mc: 12000, safe: false, flags: ['Mint Authority Enabled', 'Top 10 hold 68%', 'Honeypot tax 25%'] }
    ];

    sampleTokens.forEach((t, i) => {
      const id = `POOL_${Date.now() - (i * 120000)}_${t.sym}`;
      this.radar.push({
        id,
        tokenAddress: `So11111${t.sym.toLowerCase()}xxxxxxx${i}`,
        tokenSymbol: t.sym,
        tokenName: t.name,
        dex: t.dex,
        initialSolLiquidity: t.lp,
        initialMarketCapUsd: t.mc,
        solPriceUsd: this.currentSolPriceUsd,
        slot: 285400000 + i * 150,
        timestamp: Date.now() - (i * 120000),
        buyVolumeSol5m: t.safe ? 24.5 + i * 8 : 2.1,
        uniqueBuyersCount: t.safe ? 48 + i * 12 : 5,
        status: t.safe && i < 2 ? 'SNIPED' : t.safe ? 'DETECTED' : 'SKIPPED_UNSAFE',
        safetyAudit: {
          safetyScore: t.score,
          mintAuthRevoked: t.safe,
          freezeAuthRevoked: t.safe,
          lpBurnedPct: t.safe ? 100 : 15,
          top10HoldersPct: t.safe ? 11.4 : 68.2,
          devHoldingPct: t.safe ? 2.1 : 34.0,
          honeypotSafe: t.safe,
          bundledInSlot0: !t.safe,
          isRugRisk: !t.safe,
          riskFlags: t.safe ? [] : t.flags || ['High rug risk detected']
        }
      });
    });

    // Seed 2 active sniped positions with active hedges
    this.createActivePosition({
      tokenAddress: 'So11111quantumxxxxxxx0',
      tokenSymbol: 'QUANTUM',
      tokenName: 'Quantum Solana AI',
      dex: 'Raydium_CPMM',
      entrySol: 1.2,
      entryPriceSol: 0.00042,
      priceMultiplier: 1.65 // currently up 65%
    });

    this.createActivePosition({
      tokenAddress: 'So11111neo_pumpxxxxxxx1',
      tokenSymbol: 'NEO_PUMP',
      tokenName: 'Neo Acceleration',
      dex: 'Pump_Fun',
      entrySol: 0.8,
      entryPriceSol: 0.00015,
      priceMultiplier: 1.18 // currently up 18%
    });
  }

  private seedInitialLiquidPools() {
    this.liquidPools = [
      {
        id: 'LP_SOL_USDC_METEORA',
        poolAddress: 'Eo7WjKq67rjJQSZxS6z3YKapzY3eYbGJX1DLM1M3KsoZ',
        baseTokenAddress: 'So11111111111111111111111111111111111111112',
        baseTokenSymbol: 'SOL',
        baseTokenName: 'Solana',
        quoteTokenSymbol: 'USDC',
        dex: 'Meteora_DLMM',
        tvlUsd: 68450000,
        volume24hUsd: 194200000,
        volume1hUsd: 12450000,
        aprPct: 42.6,
        feeTierPct: 0.05,
        currentPriceSol: 1.0,
        currentPriceUsd: this.currentSolPriceUsd,
        priceChange24hPct: 3.4,
        priceChange1hPct: 0.6,
        transactions24h: 342100,
        solLiquidity: 383400,
        safetyAudit: {
          safetyScore: 99,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 4.2,
          devHoldingPct: 0.0,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        isConcentrated: true,
        binStep: 10,
        lastUpdated: Date.now(),
        trendingRank: 1,
        volumeVelocityMultiplier: 1.8
      },
      {
        id: 'LP_BONK_SOL_RAYDIUM',
        poolAddress: '3NeUXhZ8kH8k27N1hL9mPxPqL4B7t9R1C2v8M1K7n8P9',
        baseTokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        baseTokenSymbol: 'BONK',
        baseTokenName: 'Bonk Doge',
        quoteTokenSymbol: 'SOL',
        dex: 'Raydium_CPMM',
        tvlUsd: 28400000,
        volume24hUsd: 82500000,
        volume1hUsd: 5800000,
        aprPct: 114.8,
        feeTierPct: 0.25,
        currentPriceSol: 0.000000142,
        currentPriceUsd: 0.0000253,
        priceChange24hPct: 12.8,
        priceChange1hPct: 1.9,
        transactions24h: 184500,
        solLiquidity: 159100,
        safetyAudit: {
          safetyScore: 98,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 6.8,
          devHoldingPct: 0.4,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        lastUpdated: Date.now(),
        trendingRank: 2,
        volumeVelocityMultiplier: 2.4
      },
      {
        id: 'LP_WIF_SOL_ORCA',
        poolAddress: 'EpqS49aG2Z11XvG4R5B6t7Y8U9i0O1P2Q3W4E5R6T7Y8',
        baseTokenAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
        baseTokenSymbol: 'WIF',
        baseTokenName: 'dogwifhat',
        quoteTokenSymbol: 'SOL',
        dex: 'Orca_Whirlpool',
        tvlUsd: 42100000,
        volume24hUsd: 118400000,
        volume1hUsd: 7900000,
        aprPct: 98.2,
        feeTierPct: 0.30,
        currentPriceSol: 0.0148,
        currentPriceUsd: 2.64,
        priceChange24hPct: -2.4,
        priceChange1hPct: 0.4,
        transactions24h: 245000,
        solLiquidity: 235800,
        safetyAudit: {
          safetyScore: 97,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 7.2,
          devHoldingPct: 0.0,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        isConcentrated: true,
        lastUpdated: Date.now(),
        trendingRank: 3,
        volumeVelocityMultiplier: 1.6
      },
      {
        id: 'LP_FARTCOIN_SOL_METEORA',
        poolAddress: '9aB8c7D6e5F4g3H2j1K0m9N8P7q6R5s4T3u2V1w0X9Y8',
        baseTokenAddress: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdZbgpump',
        baseTokenSymbol: 'FARTCOIN',
        baseTokenName: 'Fartcoin Terminal',
        quoteTokenSymbol: 'SOL',
        dex: 'Meteora_DLMM',
        tvlUsd: 19800000,
        volume24hUsd: 89400000,
        volume1hUsd: 9100000,
        aprPct: 242.0,
        feeTierPct: 0.25,
        currentPriceSol: 0.0053,
        currentPriceUsd: 0.946,
        priceChange24hPct: 34.6,
        priceChange1hPct: 5.2,
        transactions24h: 312000,
        solLiquidity: 110900,
        safetyAudit: {
          safetyScore: 94,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 11.2,
          devHoldingPct: 1.2,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        isConcentrated: true,
        binStep: 20,
        lastUpdated: Date.now(),
        trendingRank: 4,
        volumeVelocityMultiplier: 3.8
      },
      {
        id: 'LP_AI16Z_SOL_RAYDIUM',
        poolAddress: 'HeZq8X7v6W5u4T3s2R1q0P9o8N7m6L5k4J3i2H1g0F9e',
        baseTokenAddress: 'HeLp6NuQknYB4pSVducUymQwhKn12wnETSVTgJAkLV9B',
        baseTokenSymbol: 'AI16Z',
        baseTokenName: 'ai16z Marc AIndreessen',
        quoteTokenSymbol: 'SOL',
        dex: 'Raydium_CPMM',
        tvlUsd: 14200000,
        volume24hUsd: 64800000,
        volume1hUsd: 6200000,
        aprPct: 318.5,
        feeTierPct: 0.25,
        currentPriceSol: 0.0028,
        currentPriceUsd: 0.499,
        priceChange24hPct: 28.4,
        priceChange1hPct: 4.1,
        transactions24h: 198000,
        solLiquidity: 79500,
        safetyAudit: {
          safetyScore: 92,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 12.8,
          devHoldingPct: 2.5,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        lastUpdated: Date.now(),
        trendingRank: 5,
        volumeVelocityMultiplier: 3.2
      },
      {
        id: 'LP_POPCAT_SOL_RAYDIUM',
        poolAddress: '7XyZ8aB9cD0eF1g2H3i4J5k6L7m8N9o0P1q2R3s4T5u6',
        baseTokenAddress: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
        baseTokenSymbol: 'POPCAT',
        baseTokenName: 'Popcat Mascot',
        quoteTokenSymbol: 'SOL',
        dex: 'Raydium_AMM',
        tvlUsd: 16400000,
        volume24hUsd: 46200000,
        volume1hUsd: 3100000,
        aprPct: 148.6,
        feeTierPct: 0.25,
        currentPriceSol: 0.0084,
        currentPriceUsd: 1.499,
        priceChange24hPct: 8.2,
        priceChange1hPct: 1.1,
        transactions24h: 124000,
        solLiquidity: 91800,
        safetyAudit: {
          safetyScore: 96,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 9.4,
          devHoldingPct: 0.8,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        lastUpdated: Date.now(),
        trendingRank: 6,
        volumeVelocityMultiplier: 1.9
      },
      {
        id: 'LP_JUP_SOL_METEORA',
        poolAddress: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
        baseTokenAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        baseTokenSymbol: 'JUP',
        baseTokenName: 'Jupiter Exchange',
        quoteTokenSymbol: 'SOL',
        dex: 'Meteora_DLMM',
        tvlUsd: 22800000,
        volume24hUsd: 58900000,
        volume1hUsd: 4200000,
        aprPct: 68.4,
        feeTierPct: 0.10,
        currentPriceSol: 0.0058,
        currentPriceUsd: 1.035,
        priceChange24hPct: 4.8,
        priceChange1hPct: 0.8,
        transactions24h: 156000,
        solLiquidity: 127700,
        safetyAudit: {
          safetyScore: 99,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 5.1,
          devHoldingPct: 0.0,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        isConcentrated: true,
        binStep: 15,
        lastUpdated: Date.now(),
        trendingRank: 7,
        volumeVelocityMultiplier: 1.7
      },
      {
        id: 'LP_QUANTUM_SOL_RAYDIUM',
        poolAddress: 'QNTM8x9w0v1u2t3s4r5q6p7o8n9m0l1k2j3i4h5g6f7e',
        baseTokenAddress: 'So11111quantumxxxxxxx0',
        baseTokenSymbol: 'QUANTUM',
        baseTokenName: 'Quantum Solana AI',
        quoteTokenSymbol: 'SOL',
        dex: 'Raydium_CPMM',
        tvlUsd: 9600000,
        volume24hUsd: 34500000,
        volume1hUsd: 3800000,
        aprPct: 284.0,
        feeTierPct: 0.25,
        currentPriceSol: 0.000693,
        currentPriceUsd: 0.1237,
        priceChange24hPct: 65.4,
        priceChange1hPct: 8.4,
        transactions24h: 142000,
        solLiquidity: 53800,
        safetyAudit: {
          safetyScore: 94,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 10.4,
          devHoldingPct: 1.8,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        lastUpdated: Date.now(),
        trendingRank: 8,
        volumeVelocityMultiplier: 4.5
      },
      {
        id: 'LP_PUMP_ELITE_PUMP',
        poolAddress: 'PUMP8Elite4Pool3Address2Pump1Fun0Graduated',
        baseTokenAddress: 'So11111neo_pumpxxxxxxx1',
        baseTokenSymbol: 'NEO_PUMP',
        baseTokenName: 'Neo Acceleration',
        quoteTokenSymbol: 'SOL',
        dex: 'Pump_Fun',
        tvlUsd: 4800000,
        volume24hUsd: 26800000,
        volume1hUsd: 3100000,
        aprPct: 395.0,
        feeTierPct: 1.0,
        currentPriceSol: 0.000177,
        currentPriceUsd: 0.0315,
        priceChange24hPct: 18.2,
        priceChange1hPct: 3.2,
        transactions24h: 165000,
        solLiquidity: 26900,
        safetyAudit: {
          safetyScore: 88,
          mintAuthRevoked: true,
          freezeAuthRevoked: true,
          lpBurnedPct: 100,
          top10HoldersPct: 14.2,
          devHoldingPct: 2.1,
          honeypotSafe: true,
          bundledInSlot0: false,
          isRugRisk: false,
          riskFlags: []
        },
        lastUpdated: Date.now(),
        trendingRank: 9,
        volumeVelocityMultiplier: 3.9
      }
    ];
  }

  private createActivePosition(params: {
    tokenAddress: string;
    tokenSymbol: string;
    tokenName: string;
    dex: SolanaDex;
    entrySol: number;
    entryPriceSol: number;
    priceMultiplier: number;
  }) {
    const posId = `POS_${Date.now()}_${params.tokenSymbol}`;
    const hedgeId = `HEDGE_${Date.now()}_${params.tokenSymbol}`;
    const entryCostUsd = params.entrySol * this.currentSolPriceUsd;
    const amountTokens = (params.entrySol / params.entryPriceSol);
    const entryPriceUsd = params.entryPriceSol * this.currentSolPriceUsd;
    const currentPriceSol = params.entryPriceSol * params.priceMultiplier;
    const currentPriceUsd = currentPriceSol * this.currentSolPriceUsd;
    const currentValueUsd = amountTokens * currentPriceUsd;
    const unrealizedPnlUsd = currentValueUsd - entryCostUsd;
    const unrealizedPnlPct = ((currentPriceUsd - entryPriceUsd) / entryPriceUsd) * 100;

    const pos: ISniperPosition = {
      id: posId,
      tokenAddress: params.tokenAddress,
      tokenSymbol: params.tokenSymbol,
      tokenName: params.tokenName,
      dex: params.dex,
      entryPriceSol: params.entryPriceSol,
      entryPriceUsd,
      currentPriceSol,
      currentPriceUsd,
      peakPriceUsd: currentPriceUsd * 1.05,
      amountTokens,
      entrySol: params.entrySol,
      entryCostUsd,
      currentValueUsd,
      unrealizedPnlUsd,
      unrealizedPnlPct,
      tpStagesHit: unrealizedPnlPct >= 50 ? [1] : [],
      trailingStopPriceUsd: (currentPriceUsd * 1.05) * (1 - this.config.trailingStopPct / 100),
      hardStopPriceUsd: entryPriceUsd * (1 - this.config.hardStopLossPct / 100),
      status: 'ACTIVE',
      entryTimestamp: Date.now() - 300000,
      jitoTipSol: this.config.jitoTipSol,
      bundleId: `jito_${Math.random().toString(36).substring(2, 10)}`,
      hedgePositionId: hedgeId
    };

    this.positions.set(posId, pos);

    // Create corresponding continuous short hedge to neutralize SOL delta
    if (this.config.autoHedgeEnabled) {
      const hedgeNotionalUsd = entryCostUsd * (this.config.hedgeRatioPct / 100);
      const hedge: ISolanaHedge = {
        id: hedgeId,
        positionTargetId: posId,
        tokenSymbol: params.tokenSymbol,
        hedgeInstrument: 'SOL-PERP-SHORT',
        venue: 'Hyperliquid',
        solPriceAtOpen: this.currentSolPriceUsd + 1.20,
        currentSolPrice: this.currentSolPriceUsd,
        notionalHedgedUsd: hedgeNotionalUsd,
        hedgeRatioPct: this.config.hedgeRatioPct,
        unrealizedHedgePnlUsd: Number((hedgeNotionalUsd * 0.04).toFixed(2)), // simulated protective gain
        status: 'ACTIVE',
        lastRebalanceTimestamp: Date.now()
      };
      this.hedges.set(hedgeId, hedge);
    }

    this.updateTelemetryCounts();
  }

  private startEngineLoop() {
    if (this.loopTimer) clearInterval(this.loopTimer);
    this.loopTimer = setInterval(() => {
      this.tick();
    }, 2500);
  }

  private tick() {
    // 1. Slightly drift SOL price with realistic random walk
    const solDrift = (Math.random() - 0.49) * 0.45;
    this.currentSolPriceUsd = Math.max(80, Number((this.currentSolPriceUsd + solDrift).toFixed(2)));

    // 2. Chance of detecting a new pool in the mempool
    if (Math.random() < 0.35) {
      this.simulateIncomingPool();
    }

    // 3. Update existing sniped positions and their continuous hedges
    for (const pos of this.positions.values()) {
      if (pos.status === 'CLOSED') continue;

      // Realistic meme coin price action
      const priceShock = (Math.random() - 0.46) * 0.06;
      pos.currentPriceUsd = Math.max(0.000001, pos.currentPriceUsd * (1 + priceShock));
      pos.currentPriceSol = pos.currentPriceUsd / this.currentSolPriceUsd;

      if (pos.currentPriceUsd > pos.peakPriceUsd) {
        pos.peakPriceUsd = pos.currentPriceUsd;
        pos.trailingStopPriceUsd = pos.peakPriceUsd * (1 - this.config.trailingStopPct / 100);
      }

      pos.currentValueUsd = pos.amountTokens * pos.currentPriceUsd;
      pos.unrealizedPnlUsd = pos.currentValueUsd - pos.entryCostUsd;
      pos.unrealizedPnlPct = ((pos.currentPriceUsd - pos.entryPriceUsd) / pos.entryPriceUsd) * 100;

      // Update matching hedge
      const hedge = this.hedges.get(pos.hedgePositionId);
      if (hedge && hedge.status === 'ACTIVE') {
        hedge.currentSolPrice = this.currentSolPriceUsd;
        // Short hedge profits when SOL price falls below open price
        const solPriceChangePct = ((hedge.solPriceAtOpen - this.currentSolPriceUsd) / hedge.solPriceAtOpen);
        hedge.unrealizedHedgePnlUsd = Number((hedge.notionalHedgedUsd * solPriceChangePct).toFixed(2));
      }

      // Check Take Profit Tiers
      this.checkTakeProfitsAndStops(pos);
    }

    // 4. Update liquid pools real-time metrics (TVL, volume velocity, price action)
    for (const p of this.liquidPools) {
      const priceWiggle = (Math.random() - 0.49) * 0.008;
      p.currentPriceUsd = Math.max(0.000001, Number((p.currentPriceUsd * (1 + priceWiggle)).toFixed(6)));
      p.currentPriceSol = p.currentPriceUsd / this.currentSolPriceUsd;
      p.priceChange1hPct = Number((p.priceChange1hPct + (Math.random() - 0.5) * 0.1).toFixed(2));
      p.volume1hUsd = Number((p.volume1hUsd * (1 + (Math.random() - 0.5) * 0.02)).toFixed(0));
      p.lastUpdated = Date.now();
    }

    this.updateTelemetryCounts();
    this.notify();
  }

  private simulateIncomingPool() {
    const prefixes = ['SOL', 'AI', 'PEPE', 'BONK', 'NEO', 'HYPER', 'QUANT', 'ORCA', 'MET'];
    const suffixes = ['AI', 'BOT', 'PUMP', 'X', 'DAO', 'FLOKI', 'GROK', 'TURBO'];
    const sym = `${prefixes[Math.floor(Math.random() * prefixes.length)]}_${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
    const dexes: SolanaDex[] = ['Raydium_CPMM', 'Meteora_DLMM', 'Pump_Fun', 'Raydium_AMM'];
    const dex = dexes[Math.floor(Math.random() * dexes.length)];

    const isRug = Math.random() < 0.28;
    const safetyScore = isRug ? Math.floor(25 + Math.random() * 35) : Math.floor(82 + Math.random() * 17);

    const initialLpSol = Number((20 + Math.random() * 120).toFixed(1));
    const initialMcUsd = Number((initialLpSol * this.currentSolPriceUsd * 2.2).toFixed(0));

    const poolId = `POOL_${Date.now()}_${sym}`;
    const pool: ISolanaPoolDetection = {
      id: poolId,
      tokenAddress: `So11111${sym.toLowerCase()}xxxx${Date.now().toString(36)}`,
      tokenSymbol: sym,
      tokenName: `${sym} Protocol`,
      dex,
      initialSolLiquidity: initialLpSol,
      initialMarketCapUsd: initialMcUsd,
      solPriceUsd: this.currentSolPriceUsd,
      slot: 285450000 + Math.floor(Math.random() * 5000),
      timestamp: Date.now(),
      buyVolumeSol5m: Number((Math.random() * 35).toFixed(1)),
      uniqueBuyersCount: Math.floor(15 + Math.random() * 60),
      status: 'DETECTED',
      safetyAudit: {
        safetyScore,
        mintAuthRevoked: !isRug,
        freezeAuthRevoked: !isRug,
        lpBurnedPct: !isRug ? 100 : Math.floor(Math.random() * 40),
        top10HoldersPct: !isRug ? Number((8 + Math.random() * 6).toFixed(1)) : Number((45 + Math.random() * 40).toFixed(1)),
        devHoldingPct: !isRug ? Number((1 + Math.random() * 3).toFixed(1)) : Number((20 + Math.random() * 30).toFixed(1)),
        honeypotSafe: !isRug,
        bundledInSlot0: isRug,
        isRugRisk: isRug,
        riskFlags: isRug
          ? ['Unverified creator bundle', 'High top 10 supply concentration', 'Mint authority active']
          : []
      }
    };

    this.radar.unshift(pool);
    if (this.radar.length > 50) this.radar.pop();

    if (isRug) {
      this.telemetry.rugsAvoidedCount++;
      pool.status = 'SKIPPED_UNSAFE';
    } else if (this.config.autoSnipeEnabled && safetyScore >= this.config.minSafetyScore) {
      // Auto-Snipe triggered!
      pool.status = 'SNIPING';
      setTimeout(() => {
        this.executeSnipe(pool, this.config.maxSnipeSizeSol);
      }, 150);
    }
  }

  private checkTakeProfitsAndStops(pos: ISniperPosition) {
    // 1. Take Profit Tiers
    for (let i = 0; i < this.config.takeProfitTiers.length; i++) {
      const tier = this.config.takeProfitTiers[i];
      if (pos.unrealizedPnlPct >= tier.profitPct && !pos.tpStagesHit.includes(i + 1)) {
        pos.tpStagesHit.push(i + 1);
        const tokensToSell = pos.amountTokens * (tier.sellPct / 100);
        const realizedGainUsd = tokensToSell * pos.currentPriceUsd;
        pos.amountTokens -= tokensToSell;

        // Partially rebalance / scale down short hedge
        const hedge = this.hedges.get(pos.hedgePositionId);
        if (hedge && hedge.status === 'ACTIVE') {
          const hedgeReduction = hedge.notionalHedgedUsd * (tier.sellPct / 100);
          hedge.notionalHedgedUsd -= hedgeReduction;
        }

        // Deposit realized gain to portfolio engine
        const netProfit = realizedGainUsd * (pos.unrealizedPnlPct / (100 + pos.unrealizedPnlPct));
        globalPortfolio.depositCash(netProfit);
        this.telemetry.grossSnipePnlUsd += netProfit;
        this.telemetry.netHedgedPnlUsd += netProfit;
        this.telemetry.profitableSnipesCount++;
      }
    }

    // 2. Trailing Stop Loss trigger
    if (pos.currentPriceUsd <= pos.trailingStopPriceUsd && pos.peakPriceUsd > pos.entryPriceUsd * 1.15) {
      this.closePosition(pos.id, 'TRAILING_STOP_EXIT');
      return;
    }

    // 3. Hard Stop Loss trigger
    if (pos.currentPriceUsd <= pos.hardStopPriceUsd) {
      this.closePosition(pos.id, 'HARD_STOP_EXIT');
      return;
    }
  }

  public executeSnipe(pool: ISolanaPoolDetection, sizeSol: number): ISniperPosition {
    pool.status = 'SNIPED';
    const posId = `POS_${Date.now()}_${pool.tokenSymbol}`;
    const hedgeId = `HEDGE_${Date.now()}_${pool.tokenSymbol}`;
    const entryCostUsd = sizeSol * this.currentSolPriceUsd;
    const entryPriceSol = Number((0.0001 + Math.random() * 0.0005).toFixed(6));
    const entryPriceUsd = entryPriceSol * this.currentSolPriceUsd;
    const amountTokens = (sizeSol / entryPriceSol);

    const pos: ISniperPosition = {
      id: posId,
      tokenAddress: pool.tokenAddress,
      tokenSymbol: pool.tokenSymbol,
      tokenName: pool.tokenName,
      dex: pool.dex,
      entryPriceSol,
      entryPriceUsd,
      currentPriceSol: entryPriceSol,
      currentPriceUsd: entryPriceUsd,
      peakPriceUsd: entryPriceUsd,
      amountTokens,
      entrySol: sizeSol,
      entryCostUsd,
      currentValueUsd: entryCostUsd,
      unrealizedPnlUsd: 0,
      unrealizedPnlPct: 0,
      tpStagesHit: [],
      trailingStopPriceUsd: entryPriceUsd * (1 - this.config.trailingStopPct / 100),
      hardStopPriceUsd: entryPriceUsd * (1 - this.config.hardStopLossPct / 100),
      status: 'ACTIVE',
      entryTimestamp: Date.now(),
      jitoTipSol: this.config.jitoTipSol,
      bundleId: `jito_bundle_${Math.random().toString(36).substring(2, 9)}`,
      hedgePositionId: hedgeId
    };

    this.positions.set(posId, pos);

    // Continuous Dynamic Hedge: Open short SOL hedge simultaneously
    if (this.config.autoHedgeEnabled) {
      const hedgeNotionalUsd = entryCostUsd * (this.config.hedgeRatioPct / 100);
      const hedge: ISolanaHedge = {
        id: hedgeId,
        positionTargetId: posId,
        tokenSymbol: pool.tokenSymbol,
        hedgeInstrument: 'SOL-PERP-SHORT',
        venue: 'Hyperliquid',
        solPriceAtOpen: this.currentSolPriceUsd,
        currentSolPrice: this.currentSolPriceUsd,
        notionalHedgedUsd: hedgeNotionalUsd,
        hedgeRatioPct: this.config.hedgeRatioPct,
        unrealizedHedgePnlUsd: 0,
        status: 'ACTIVE',
        lastRebalanceTimestamp: Date.now()
      };
      this.hedges.set(hedgeId, hedge);
    }

    this.telemetry.totalSnipesExecuted++;
    this.updateTelemetryCounts();
    this.notify();
    return pos;
  }

  public closePosition(positionId: string, reason = 'MANUAL_EXIT') {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status === 'CLOSED') return;

    pos.status = 'CLOSED';

    // Close and settle continuous hedge
    const hedge = this.hedges.get(pos.hedgePositionId);
    if (hedge && hedge.status === 'ACTIVE') {
      hedge.status = 'CLOSED';
      this.telemetry.hedgePnlContributionUsd += hedge.unrealizedHedgePnlUsd;
      if (hedge.unrealizedHedgePnlUsd > 0) {
        this.telemetry.capitalSavedByHedgeUsd += hedge.unrealizedHedgePnlUsd;
      }
    }

    // Book net P&L into portfolio engine & profit splitter
    const netTradePnlUsd = pos.unrealizedPnlUsd + (hedge ? hedge.unrealizedHedgePnlUsd : 0);
    this.telemetry.grossSnipePnlUsd += pos.unrealizedPnlUsd;
    this.telemetry.netHedgedPnlUsd += netTradePnlUsd;

    if (netTradePnlUsd > 0) {
      this.telemetry.profitableSnipesCount++;
      globalPortfolio.depositCash(netTradePnlUsd);
      globalProfitSplitterEngine.updateEquity('default_user', globalPortfolio.getState().equityUsd);
    }

    this.updateTelemetryCounts();
    this.notify();
  }

  public manualRebalanceHedges() {
    for (const hedge of this.hedges.values()) {
      if (hedge.status === 'ACTIVE') {
        hedge.lastRebalanceTimestamp = Date.now();
        hedge.currentSolPrice = this.currentSolPriceUsd;
      }
    }
    this.notify();
  }

  private updateTelemetryCounts() {
    let activePosCount = 0;
    let activeHedgeCount = 0;
    let totalHedgeNotional = 0;

    for (const pos of this.positions.values()) {
      if (pos.status === 'ACTIVE') activePosCount++;
    }
    for (const hedge of this.hedges.values()) {
      if (hedge.status === 'ACTIVE') {
        activeHedgeCount++;
        totalHedgeNotional += hedge.notionalHedgedUsd;
      }
    }

    this.telemetry.activePositionsCount = activePosCount;
    this.telemetry.activeHedgesCount = activeHedgeCount;
    this.telemetry.totalHedgeNotionalUsd = totalHedgeNotional;
    if (this.telemetry.totalSnipesExecuted > 0) {
      this.telemetry.winRatePct = Number(
        ((this.telemetry.profitableSnipesCount / this.telemetry.totalSnipesExecuted) * 100).toFixed(1)
      );
    }
  }

  // Getters & Configuration
  public getRadar(): ISolanaPoolDetection[] {
    return [...this.radar];
  }

  public getLiquidPools(): ISolanaLiquidPool[] {
    return [...this.liquidPools];
  }

  public snipeLiquidPool(
    poolId: string,
    options?: { sizeSol?: number; hedgeMode?: HedgeMode; trailingStopPct?: number }
  ): ISniperPosition | null {
    const pool = this.liquidPools.find(p => p.id === poolId);
    if (!pool) return null;

    const sizeSol = options?.sizeSol ?? this.config.maxSnipeSizeSol;
    const hedgeMode = options?.hedgeMode ?? this.config.hedgeMode;
    const trailingStopPct = options?.trailingStopPct ?? this.config.trailingStopPct;

    const posId = `POS_${Date.now()}_${pool.baseTokenSymbol}`;
    const hedgeId = `HEDGE_${Date.now()}_${pool.baseTokenSymbol}`;
    const entryCostUsd = sizeSol * this.currentSolPriceUsd;
    const entryPriceSol = pool.currentPriceSol;
    const entryPriceUsd = pool.currentPriceUsd;
    const amountTokens = (sizeSol / entryPriceSol);

    const pos: ISniperPosition = {
      id: posId,
      tokenAddress: pool.baseTokenAddress,
      tokenSymbol: pool.baseTokenSymbol,
      tokenName: pool.baseTokenName,
      dex: pool.dex,
      entryPriceSol,
      entryPriceUsd,
      currentPriceSol: entryPriceSol,
      currentPriceUsd: entryPriceUsd,
      peakPriceUsd: entryPriceUsd,
      amountTokens,
      entrySol: sizeSol,
      entryCostUsd,
      currentValueUsd: entryCostUsd,
      unrealizedPnlUsd: 0,
      unrealizedPnlPct: 0,
      tpStagesHit: [],
      trailingStopPriceUsd: entryPriceUsd * (1 - trailingStopPct / 100),
      hardStopPriceUsd: entryPriceUsd * (1 - this.config.hardStopLossPct / 100),
      status: 'ACTIVE',
      entryTimestamp: Date.now(),
      jitoTipSol: this.config.jitoTipSol,
      bundleId: `jito_pool_bundle_${Math.random().toString(36).substring(2, 9)}`,
      hedgePositionId: hedgeId
    };

    this.positions.set(posId, pos);

    // Continuous inverse SOL perp hedge
    if (this.config.autoHedgeEnabled) {
      let hedgeRatio = 100;
      if (hedgeMode === 'CONSERVATIVE_50') hedgeRatio = 50;
      else if (hedgeMode === 'BETA_ADJUSTED') hedgeRatio = 75;
      else if (hedgeMode === 'MOMENTUM_DYNAMIC') hedgeRatio = 90;

      const hedgeNotionalUsd = entryCostUsd * (hedgeRatio / 100);
      const hedge: ISolanaHedge = {
        id: hedgeId,
        positionTargetId: posId,
        tokenSymbol: pool.baseTokenSymbol,
        hedgeInstrument: 'SOL-PERP-SHORT',
        venue: 'Hyperliquid',
        solPriceAtOpen: this.currentSolPriceUsd,
        currentSolPrice: this.currentSolPriceUsd,
        notionalHedgedUsd: hedgeNotionalUsd,
        hedgeRatioPct: hedgeRatio,
        unrealizedHedgePnlUsd: 0,
        status: 'ACTIVE',
        lastRebalanceTimestamp: Date.now()
      };
      this.hedges.set(hedgeId, hedge);
    }

    this.telemetry.totalSnipesExecuted++;
    this.updateTelemetryCounts();
    this.notify();
    return pos;
  }

  public getPositions(): ISniperPosition[] {
    return Array.from(this.positions.values());
  }

  public getHedges(): ISolanaHedge[] {
    return Array.from(this.hedges.values());
  }

  public getConfig(): ISniperConfig {
    return { ...this.config };
  }

  public updateConfig(partial: Partial<ISniperConfig>) {
    this.config = { ...this.config, ...partial };
    this.notify();
  }

  public getTelemetry(): ISniperTelemetry {
    return { ...this.telemetry };
  }

  public getSolPriceUsd(): number {
    return this.currentSolPriceUsd;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch (e) {
        console.error('Error in SolanaSniperEngine listener:', e);
      }
    }
  }
}

export const globalSolanaSniper = new SolanaSniperEngine();
