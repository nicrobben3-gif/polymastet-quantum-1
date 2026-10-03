/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SolanaDex = 
  | 'Raydium_AMM' 
  | 'Raydium_CPMM' 
  | 'Meteora_DLMM' 
  | 'Pump_Fun' 
  | 'Orca_Whirlpool';

export type HedgeMode = 
  | 'DELTA_NEUTRAL'     // 100% SOL beta neutralized
  | 'BETA_ADJUSTED'     // Dynamically scaled by meme token correlation
  | 'CONSERVATIVE_50'   // 50% fixed SOL downside shield
  | 'MOMENTUM_DYNAMIC'; // Increases hedge as profit grows to lock gains

export interface ISafetyAudit {
  safetyScore: number;           // 0 - 100
  mintAuthRevoked: boolean;      // No further tokens can be minted
  freezeAuthRevoked: boolean;    // Dev cannot freeze accounts
  lpBurnedPct: number;           // % of initial LP burned / locked
  top10HoldersPct: number;       // Concentration of non-LP supply
  devHoldingPct: number;         // Dev team holding %
  honeypotSafe: boolean;         // Verified buy/sell tax simulation (<2%)
  bundledInSlot0: boolean;       // Dev bundled purchases in launch slot
  isRugRisk: boolean;            // Overall risk flag
  riskFlags: string[];           // Descriptive risk warnings
}

export interface ISolanaPoolDetection {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  dex: SolanaDex;
  initialSolLiquidity: number;
  initialMarketCapUsd: number;
  solPriceUsd: number;
  slot: number;
  timestamp: number;
  safetyAudit: ISafetyAudit;
  status: 'DETECTED' | 'SNIPING' | 'SNIPED' | 'SKIPPED_UNSAFE' | 'EXITED';
  buyVolumeSol5m: number;
  uniqueBuyersCount: number;
}

export interface ISniperPosition {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  dex: SolanaDex;
  entryPriceSol: number;
  entryPriceUsd: number;
  currentPriceSol: number;
  currentPriceUsd: number;
  peakPriceUsd: number;
  amountTokens: number;
  entrySol: number;
  entryCostUsd: number;
  currentValueUsd: number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  tpStagesHit: number[];
  trailingStopPriceUsd: number;
  hardStopPriceUsd: number;
  status: 'ACTIVE' | 'PARTIALLY_EXITED' | 'CLOSED';
  entryTimestamp: number;
  jitoTipSol: number;
  bundleId: string;
  hedgePositionId: string;
}

export interface ISolanaHedge {
  id: string;
  positionTargetId: string;
  tokenSymbol: string;
  hedgeInstrument: 'SOL-PERP-SHORT' | 'DRIFT-SOL-SHORT' | 'SYNTHETIC-PUT';
  venue: 'Hyperliquid' | 'Drift' | 'JupiterPerps';
  solPriceAtOpen: number;
  currentSolPrice: number;
  notionalHedgedUsd: number;
  hedgeRatioPct: number;
  unrealizedHedgePnlUsd: number; // Positive if SOL drops, shielding the position
  status: 'ACTIVE' | 'REBALANCED' | 'CLOSED';
  lastRebalanceTimestamp: number;
}

export interface ISniperConfig {
  autoSnipeEnabled: boolean;
  autoHedgeEnabled: boolean;
  hedgeMode: HedgeMode;
  hedgeRatioPct: number;          // 50% - 100%
  minSafetyScore: number;         // e.g. 80/100
  maxSnipeSizeSol: number;        // e.g. 1.0 SOL
  jitoTipSol: number;             // e.g. 0.005 SOL
  priorityFeeLevel: 'ULTRA_TURBO' | 'TURBO' | 'STANDARD';
  takeProfitTiers: { profitPct: number; sellPct: number }[];
  trailingStopPct: number;        // e.g. 12%
  hardStopLossPct: number;        // e.g. 20%
  preferredDexes: SolanaDex[];
}

export interface ISniperTelemetry {
  totalSnipesExecuted: number;
  profitableSnipesCount: number;
  winRatePct: number;
  grossSnipePnlUsd: number;
  hedgePnlContributionUsd: number;
  netHedgedPnlUsd: number;
  capitalSavedByHedgeUsd: number;
  averageExecutionLatencyMs: number;
  rugsAvoidedCount: number;
  activePositionsCount: number;
  activeHedgesCount: number;
  totalHedgeNotionalUsd: number;
}

export interface ISolanaLiquidPool {
  id: string;
  poolAddress: string;
  baseTokenAddress: string;
  baseTokenSymbol: string;
  baseTokenName: string;
  quoteTokenSymbol: 'SOL' | 'USDC';
  dex: SolanaDex;
  tvlUsd: number;
  volume24hUsd: number;
  volume1hUsd: number;
  aprPct: number;
  feeTierPct: number;
  currentPriceSol: number;
  currentPriceUsd: number;
  priceChange24hPct: number;
  priceChange1hPct: number;
  transactions24h: number;
  solLiquidity: number;
  safetyAudit: ISafetyAudit;
  isConcentrated?: boolean;
  binStep?: number;
  lastUpdated: number;
  trendingRank: number;
  volumeVelocityMultiplier: number;
}
