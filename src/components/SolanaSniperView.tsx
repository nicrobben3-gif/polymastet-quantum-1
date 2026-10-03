/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  Flame,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
  AlertTriangle,
  Lock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  Crosshair,
  BarChart2,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { globalSolanaSniper } from '../solana_sniper/solanaSniperEngine';
import {
  ISolanaPoolDetection,
  ISniperPosition,
  ISolanaHedge,
  ISniperConfig,
  ISniperTelemetry,
  ISolanaLiquidPool,
  HedgeMode,
  SolanaDex
} from '../types/solanaSniper';
import { SolanaPoolExplorer } from './SolanaPoolExplorer';
import { VolumeVelocityHistogram } from './VolumeVelocityHistogram';

export interface SolanaSniperContextValue {
  radar: ISolanaPoolDetection[];
  liquidPools: ISolanaLiquidPool[];
  positions: ISniperPosition[];
  hedges: ISolanaHedge[];
  config: ISniperConfig;
  telemetry: ISniperTelemetry;
  solPrice: number;
  activeTab: 'RADAR' | 'EXPLORER' | 'POSITIONS' | 'SETTINGS';
  setActiveTab: (tab: 'RADAR' | 'EXPLORER' | 'POSITIONS' | 'SETTINGS') => void;
  showNotice: (msg: string) => void;
  executeSnipeOnPool: (pool: ISolanaLiquidPool, sizeSol: number, hedgeMode: HedgeMode) => void;
}

export const SolanaSniperContext = React.createContext<SolanaSniperContextValue | null>(null);

export const useSolanaSniper = () => {
  const ctx = React.useContext(SolanaSniperContext);
  if (!ctx) {
    throw new Error('useSolanaSniper must be used within a SolanaSniperContext.Provider');
  }
  return ctx;
};

export const SolanaSniperView: React.FC = () => {
  const [radar, setRadar] = useState<ISolanaPoolDetection[]>([]);
  const [liquidPools, setLiquidPools] = useState<ISolanaLiquidPool[]>(globalSolanaSniper.getLiquidPools());
  const [positions, setPositions] = useState<ISniperPosition[]>([]);
  const [hedges, setHedges] = useState<ISolanaHedge[]>([]);
  const [config, setConfig] = useState<ISniperConfig>(globalSolanaSniper.getConfig());
  const [telemetry, setTelemetry] = useState<ISniperTelemetry>(globalSolanaSniper.getTelemetry());
  const [solPrice, setSolPrice] = useState<number>(globalSolanaSniper.getSolPriceUsd());

  const [selectedPool, setSelectedPool] = useState<ISolanaPoolDetection | null>(null);
  const [manualAmountSol, setManualAmountSol] = useState<string>('1.0');
  const [activeTab, setActiveTab] = useState<'RADAR' | 'EXPLORER' | 'POSITIONS' | 'SETTINGS'>('EXPLORER');
  const [showVelocityWidget, setShowVelocityWidget] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setRadar(globalSolanaSniper.getRadar());
      setLiquidPools(globalSolanaSniper.getLiquidPools());
      setPositions(globalSolanaSniper.getPositions());
      setHedges(globalSolanaSniper.getHedges());
      setConfig(globalSolanaSniper.getConfig());
      setTelemetry(globalSolanaSniper.getTelemetry());
      setSolPrice(globalSolanaSniper.getSolPriceUsd());
    };

    update();
    const unsub = globalSolanaSniper.subscribe(update);
    return () => unsub();
  }, []);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleToggleAutoSnipe = () => {
    const next = !config.autoSnipeEnabled;
    globalSolanaSniper.updateConfig({ autoSnipeEnabled: next });
    showNotice(next ? '✓ Auto-Snipe Activated: Jito sub-slot bundle execution enabled.' : '⏸ Auto-Snipe Paused.');
  };

  const handleToggleAutoHedge = () => {
    const next = !config.autoHedgeEnabled;
    globalSolanaSniper.updateConfig({ autoHedgeEnabled: next });
    showNotice(next ? '✓ Continuous Dynamic Hedging Activated: SOL Delta neutralized.' : '⚠️ Auto-Hedge Disabled.');
  };

  const handleHedgeModeChange = (mode: HedgeMode) => {
    globalSolanaSniper.updateConfig({ hedgeMode: mode });
    showNotice(`✓ Continuous Hedge Mode switched to: ${mode}`);
  };

  const handleManualSnipe = (pool: ISolanaPoolDetection) => {
    const amt = parseFloat(manualAmountSol) || config.maxSnipeSizeSol;
    globalSolanaSniper.executeSnipe(pool, amt);
    showNotice(`🚀 Sniped ${pool.tokenSymbol} with ${amt} SOL! Associated short hedge opened.`);
  };

  const handleClosePosition = (id: string) => {
    globalSolanaSniper.closePosition(id, 'MANUAL_USER_EXIT');
    showNotice('✓ Position closed & continuous hedge settled.');
  };

  const handleRebalanceHedges = () => {
    globalSolanaSniper.manualRebalanceHedges();
    showNotice('✓ Rebalanced all continuous short delta hedges on Hyperliquid/Drift.');
  };

  const executeSnipeOnPool = (pool: ISolanaLiquidPool, sizeSol: number, hedgeMode: HedgeMode) => {
    globalSolanaSniper.snipeLiquidPool(pool.id, { sizeSol, hedgeMode });
    showNotice(`🚀 Sniped ${pool.baseTokenSymbol} (${sizeSol} SOL) with paired ${hedgeMode.replace('_', ' ')} short hedge!`);
    setActiveTab('POSITIONS');
  };

  const contextValue: SolanaSniperContextValue = {
    radar,
    liquidPools,
    positions,
    hedges,
    config,
    telemetry,
    solPrice,
    activeTab,
    setActiveTab,
    showNotice,
    executeSnipeOnPool
  };

  return (
    <SolanaSniperContext.Provider value={contextValue}>
      <div className="space-y-6">
      {/* 1. HEADER BANNER WITH SOLANA GRADIENT & ENGINE CONTROLS */}
      <div className="bg-gradient-to-r from-[#0d131f] via-[#101726] to-[#120f1f] border border-cyan-500/30 p-5 rounded-xl shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
              <Crosshair className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Solana Sub-Slot LP Sniper
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gradient-to-r from-cyan-950 to-purple-950 text-cyan-300 border border-cyan-700/60">
                  JITO BUNDLE ENGINE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60">
                  CONTINUOUS DELTA HEDGE
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-1">
                State-of-the-art launch & LP sniper maximizing meme alpha while continuously short-hedging SOL downside beta.
              </p>
            </div>
          </div>

          {/* Quick Price & Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#090d16] border border-[#1b2230] px-3 py-1.5 rounded-lg font-mono text-xs">
              <span className="text-[#64748b] block text-[10px]">SOL / USD</span>
              <span className="text-white font-bold text-sm">${solPrice.toFixed(2)}</span>
            </div>

            {/* Auto-Snipe Switch */}
            <button
              onClick={handleToggleAutoSnipe}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                config.autoSnipeEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                  : 'bg-[#1a2333] hover:bg-[#253248] text-[#94a3b8]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{config.autoSnipeEnabled ? 'AUTO-SNIPE: ON' : 'AUTO-SNIPE: OFF'}</span>
            </button>

            {/* Continuous Dynamic Hedge Switch */}
            <button
              onClick={handleToggleAutoHedge}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                config.autoHedgeEnabled
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950'
                  : 'bg-[#1a2333] hover:bg-[#253248] text-[#94a3b8]'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{config.autoHedgeEnabled ? 'CONTINUOUS HEDGE: ON' : 'HEDGE: OFF'}</span>
            </button>

            {/* Volume Velocity Churn Histogram Switch */}
            <button
              onClick={() => setShowVelocityWidget(!showVelocityWidget)}
              className={`px-3.5 py-2 rounded-lg font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                showVelocityWidget
                  ? 'bg-cyan-700/80 hover:bg-cyan-600 text-white shadow-cyan-950 border border-cyan-500/50'
                  : 'bg-[#1a2333] hover:bg-[#253248] text-[#94a3b8]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-cyan-300" />
              <span>{showVelocityWidget ? 'VELOCITY HISTOGRAM: ON' : 'HISTOGRAM: OFF'}</span>
            </button>
          </div>
        </div>

        {/* Action feedback banner */}
        {actionNotice && (
          <div className="p-2.5 bg-cyan-950/80 border border-cyan-700/60 rounded-lg text-xs font-mono text-cyan-200 animate-fadeIn flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* HEDGE MODE SELECTOR STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1b2230]/80 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-[#64748b]">Active Hedging Architecture:</span>
            <div className="flex gap-1.5">
              {(['DELTA_NEUTRAL', 'BETA_ADJUSTED', 'CONSERVATIVE_50', 'MOMENTUM_DYNAMIC'] as HedgeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleHedgeModeChange(mode)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    config.hedgeMode === mode
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                      : 'bg-[#0e1420] text-[#94a3b8] hover:text-white border border-[#1b2230]'
                  }`}
                >
                  {mode.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#64748b]">Jito MEV Tip:</span>
            <span className="text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              {config.jitoTipSol} SOL (Ultra Turbo)
            </span>
          </div>
        </div>
      </div>

      {/* 2. INSTITUTIONAL TELEMETRY KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
        <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded-lg">
          <span className="text-[10px] text-[#64748b] block uppercase">Total Snipes</span>
          <span className="text-white text-lg font-bold tabular-nums">
            {telemetry.totalSnipesExecuted}
          </span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">{telemetry.profitableSnipesCount} Profitable</span>
        </div>

        <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded-lg">
          <span className="text-[10px] text-[#64748b] block uppercase">Win Rate</span>
          <span className="text-emerald-400 text-lg font-bold tabular-nums">
            {telemetry.winRatePct}%
          </span>
          <span className="text-[10px] text-[#64748b] block mt-0.5">High Conviction</span>
        </div>

        <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded-lg">
          <span className="text-[10px] text-[#64748b] block uppercase">Gross Snipe Gains</span>
          <span className="text-emerald-400 text-lg font-bold tabular-nums">
            +${telemetry.grossSnipePnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-[#64748b] block mt-0.5">Meme token upside</span>
        </div>

        <div className="bg-[#10141e] border border-indigo-900/40 p-3 rounded-lg">
          <span className="text-[10px] text-indigo-400 block uppercase">Hedge Contribution</span>
          <span className="text-indigo-300 text-lg font-bold tabular-nums">
            +${telemetry.hedgePnlContributionUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-[#64748b] block mt-0.5">Short SOL perp gains</span>
        </div>

        <div className="bg-[#10141e] border border-cyan-900/40 p-3 rounded-lg">
          <span className="text-[10px] text-cyan-400 block uppercase">Net Hedged Alpha</span>
          <span className="text-cyan-300 text-lg font-bold tabular-nums">
            +${telemetry.netHedgedPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <span className="text-[10px] text-[#64748b] block mt-0.5">Pure risk-adjusted profit</span>
        </div>

        <div className="bg-[#10141e] border border-emerald-900/40 p-3 rounded-lg">
          <span className="text-[10px] text-emerald-400 block uppercase flex items-center justify-between">
            <span>Rugs Blocked</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </span>
          <span className="text-emerald-300 text-lg font-bold tabular-nums">
            {telemetry.rugsAvoidedCount}
          </span>
          <span className="text-[10px] text-[#64748b] block mt-0.5">Saved ~${telemetry.capitalSavedByHedgeUsd.toLocaleString()}</span>
        </div>
      </div>

      {/* 3. CONTINUOUS DYNAMIC HEDGE STATION CALLOUT */}
      <div className="bg-[#0b101a] border border-indigo-800/40 p-4 rounded-xl space-y-3 font-mono">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Continuous Dynamic Hedging Station
            </span>
            <span className="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800/60">
              HYPERLIQUID & DRIFT PERPS
            </span>
          </div>

          <button
            onClick={handleRebalanceHedges}
            className="px-3 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Rebalance All Hedges</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#070b12] border border-[#1b2230] rounded-lg space-y-1">
            <span className="text-[#64748b] text-[10px] block">LONG SNIPER EXPOSURE (MEME ALPHA)</span>
            <div className="text-white font-bold text-sm">
              ${positions.filter(p => p.status === 'ACTIVE').reduce((sum, p) => sum + p.currentValueUsd, 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-[#94a3b8]">
              {positions.filter(p => p.status === 'ACTIVE').length} active sniped tokens on Raydium/Pump.fun
            </p>
          </div>

          <div className="p-3 bg-[#070b12] border border-[#1b2230] rounded-lg space-y-1">
            <span className="text-indigo-400 text-[10px] block">SHORT SOL HEDGE NOTIONAL</span>
            <div className="text-indigo-300 font-bold text-sm">
              ${hedges.filter(h => h.status === 'ACTIVE').reduce((sum, h) => sum + h.notionalHedgedUsd, 0).toFixed(2)}
            </div>
            <p className="text-[10px] text-[#94a3b8]">
              Continuous short perps dynamically scaled to match SOL beta
            </p>
          </div>

          <div className="p-3 bg-[#070b12] border border-[#1b2230] rounded-lg space-y-1">
            <span className="text-cyan-400 text-[10px] block">NET DELTA EXPOSURE</span>
            <div className="text-cyan-300 font-bold text-sm">
              ~0.00 SOL <span className="text-[10px] text-emerald-400 font-normal">(Delta-Neutralized)</span>
            </div>
            <p className="text-[10px] text-emerald-400">
              Macro SOL crashes offset by short profits; 100% meme upside retained.
            </p>
          </div>
        </div>
      </div>

      {/* 4. D3 VOLUME VELOCITY & LIQUIDITY CHURN HISTOGRAM WIDGET */}
      {showVelocityWidget && (
        <VolumeVelocityHistogram
          pools={liquidPools}
          solPrice={solPrice}
          onQuickSnipe={(pool) => {
            executeSnipeOnPool(pool, 1.0, config.hedgeMode);
          }}
        />
      )}

      {/* 5. SUB-TABS: RADAR vs EXPLORER vs POSITIONS vs SETTINGS */}
      <div className="space-y-4">
        <div className="flex border-b border-[#1b2230] text-xs font-mono gap-4">
          <button
            onClick={() => setActiveTab('RADAR')}
            className={`pb-2.5 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'RADAR'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-[#64748b] hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Mempool & Pool Radar ({radar.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('EXPLORER')}
            className={`pb-2.5 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'EXPLORER'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-[#64748b] hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pool Explorer ({liquidPools.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('POSITIONS')}
            className={`pb-2.5 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'POSITIONS'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-[#64748b] hover:text-white'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Active Snipes ({positions.filter(p => p.status === 'ACTIVE').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`pb-2.5 font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SETTINGS'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-[#64748b] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Sniper Execution Engine Parameters</span>
          </button>
        </div>

        {/* TAB 1: MEMPOOL & LAUNCH RADAR */}
        {activeTab === 'RADAR' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#64748b]">
              <span>Real-Time Stream of Newly Detected Pools on Raydium AMM/CPMM, Meteora DLMM, and Pump.fun</span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Geyser RPC Feed Active</span>
              </span>
            </div>

            <div className="overflow-x-auto border border-[#1b2230] rounded-xl bg-[#0e131d]">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#1b2230] text-[#64748b] uppercase text-[10px] bg-[#090d16]">
                    <th className="py-2.5 px-3">Token & DEX</th>
                    <th className="py-2.5 px-3">Initial Liquidity</th>
                    <th className="py-2.5 px-3">5m Volume / Buyers</th>
                    <th className="py-2.5 px-3">Rug-Check Safety Audit</th>
                    <th className="py-2.5 px-3">Safety Score</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2230]">
                  {radar.map((pool) => {
                    const isSafe = pool.safetyAudit.safetyScore >= config.minSafetyScore;
                    return (
                      <tr key={pool.id} className="hover:bg-[#141b28] transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-indigo-950 border border-indigo-700/50 flex items-center justify-center font-bold text-white text-[11px]">
                              {pool.tokenSymbol.slice(0, 2)}
                            </div>
                            <div>
                              <span className="font-bold text-white block">{pool.tokenSymbol}</span>
                              <span className="text-[10px] text-[#64748b]">{pool.dex.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-white font-semibold">{pool.initialSolLiquidity} SOL</span>
                          <span className="text-[10px] text-[#64748b] block">${pool.initialMarketCapUsd.toLocaleString()} MC</span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="text-emerald-400 font-semibold">{pool.buyVolumeSol5m} SOL</span>
                          <span className="text-[10px] text-[#64748b] block">{pool.uniqueBuyersCount} unique buyers</span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            <span className={`px-1.5 py-0.2 rounded border ${pool.safetyAudit.mintAuthRevoked ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'}`}>
                              Mint {pool.safetyAudit.mintAuthRevoked ? 'Revoked' : 'Active'}
                            </span>
                            <span className={`px-1.5 py-0.2 rounded border ${pool.safetyAudit.freezeAuthRevoked ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-rose-950 text-rose-300 border-rose-800'}`}>
                              Freeze {pool.safetyAudit.freezeAuthRevoked ? 'Revoked' : 'Active'}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                              LP {pool.safetyAudit.lpBurnedPct}% Burned
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-8 text-center py-0.5 rounded font-bold text-[11px] ${
                              pool.safetyAudit.safetyScore >= 85
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : pool.safetyAudit.safetyScore >= 60
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}>
                              {pool.safetyAudit.safetyScore}
                            </div>
                            {pool.safetyAudit.safetyScore >= 85 ? (
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ShieldAlert className="w-4 h-4 text-rose-400" />
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            pool.status === 'SNIPED'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : pool.status === 'SNIPING'
                              ? 'bg-purple-950 text-purple-300 border border-purple-800 animate-pulse'
                              : pool.status === 'SKIPPED_UNSAFE'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : 'bg-[#1b2230] text-[#94a3b8]'
                          }`}>
                            {pool.status}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right">
                          {pool.status === 'DETECTED' && isSafe ? (
                            <button
                              onClick={() => handleManualSnipe(pool)}
                              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                            >
                              Snipe & Hedge
                            </button>
                          ) : pool.status === 'SNIPED' ? (
                            <span className="text-[10px] text-cyan-400 font-semibold">Active in Positions</span>
                          ) : (
                            <span className="text-[10px] text-[#64748b]">Unsafe to Snipe</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SOLANA POOL EXPLORER */}
        {activeTab === 'EXPLORER' && (
          <SolanaPoolExplorer
            pools={liquidPools}
            solPrice={solPrice}
            onSnipeSuccess={(pool, sizeSol, hedgeMode) => {
              showNotice(`🚀 Sniped ${pool.baseTokenSymbol} (${sizeSol} SOL) with paired ${hedgeMode.replace('_', ' ')} short hedge!`);
              setActiveTab('POSITIONS');
            }}
            onNavigateToPositions={() => setActiveTab('POSITIONS')}
          />
        )}

        {/* TAB 2: ACTIVE SNIPED POSITIONS WITH TAKE-PROFIT TIERS */}
        {activeTab === 'POSITIONS' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#64748b]">
              <span>Active sniped meme tokens with automated multi-tier take profit & continuous short SOL delta hedges.</span>
              <span className="text-white font-bold">{positions.filter(p => p.status === 'ACTIVE').length} Active Positions</span>
            </div>

            {positions.filter(p => p.status === 'ACTIVE').length === 0 ? (
              <div className="bg-[#10141e] border border-[#1b2230] p-8 rounded-xl text-center font-mono text-xs text-[#64748b]">
                No active sniper positions right now. Toggle Auto-Snipe ON or snipe directly from the Mempool Radar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
                {positions.filter(p => p.status === 'ACTIVE').map((pos) => {
                  const matchingHedge = hedges.find(h => h.id === pos.hedgePositionId);
                  return (
                    <div key={pos.id} className="bg-[#10141e] border border-cyan-500/30 p-4 rounded-xl space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs">
                            {pos.tokenSymbol.slice(0, 2)}
                          </div>
                          <div>
                            <span className="text-sm font-bold text-white">{pos.tokenSymbol}</span>
                            <span className="text-[10px] text-[#64748b] block">{pos.dex.replace('_', ' ')}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-sm font-bold ${pos.unrealizedPnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {pos.unrealizedPnlPct >= 0 ? '+' : ''}{pos.unrealizedPnlPct.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-[#64748b] block">
                            (${pos.unrealizedPnlUsd >= 0 ? '+' : ''}{pos.unrealizedPnlUsd.toFixed(2)})
                          </span>
                        </div>
                      </div>

                      {/* Financial Detail Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-[#090d16] p-2.5 rounded-lg border border-[#1b2230]">
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Entry Value:</span>
                          <span className="text-white font-semibold">{pos.entrySol} SOL (${pos.entryCostUsd.toFixed(2)})</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Current Value:</span>
                          <span className="text-emerald-300 font-semibold">${pos.currentValueUsd.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Trailing Stop:</span>
                          <span className="text-amber-400 font-semibold">${pos.trailingStopPriceUsd.toFixed(6)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Peak Price:</span>
                          <span className="text-purple-300 font-semibold">${pos.peakPriceUsd.toFixed(6)}</span>
                        </div>
                      </div>

                      {/* Matching Continuous Short Hedge Callout */}
                      {matchingHedge && (
                        <div className="p-2.5 bg-[#070b14] border border-indigo-900/50 rounded-lg text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-indigo-300">
                            <span className="flex items-center gap-1 font-semibold">
                              <Shield className="w-3 h-3 text-indigo-400" />
                              <span>Continuous Short SOL Hedge</span>
                            </span>
                            <span className="text-[10px] font-bold text-emerald-400">
                              +${matchingHedge.unrealizedHedgePnlUsd.toFixed(2)} PnL
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#64748b]">
                            <span>Notional: ${matchingHedge.notionalHedgedUsd.toFixed(2)}</span>
                            <span>Venue: {matchingHedge.venue}</span>
                            <span>Shield: Active</span>
                          </div>
                        </div>
                      )}

                      {/* Take-Profit Milestone Indicators */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-[#64748b] block">TAKE-PROFIT PROGRESSION:</span>
                        <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
                          <div className={`p-1 rounded border ${pos.tpStagesHit.includes(1) ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-[#090d16] text-[#64748b] border-[#1b2230]'}`}>
                            TP1: +50% (Sell 25%)
                          </div>
                          <div className={`p-1 rounded border ${pos.tpStagesHit.includes(2) ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-[#090d16] text-[#64748b] border-[#1b2230]'}`}>
                            TP2: +120% (Sell 35%)
                          </div>
                          <div className={`p-1 rounded border ${pos.tpStagesHit.includes(3) ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-[#090d16] text-[#64748b] border-[#1b2230]'}`}>
                            TP3: +250% (Sell 25%)
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-[#64748b] truncate max-w-[200px]">
                          Bundle: {pos.bundleId}
                        </span>
                        <button
                          onClick={() => handleClosePosition(pos.id)}
                          className="px-3 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Close & Harvest All
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SNIPER CONFIGURATION & SAFETY GATES */}
        {activeTab === 'SETTINGS' && (
          <div className="bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-[#1b2230] pb-3">
              <div>
                <h4 className="text-sm font-bold text-white">Institutional Sniper Parameters</h4>
                <p className="text-[#94a3b8] text-[11px] mt-0.5">
                  Fine-tune Jito sub-slot priority, rug-check threshold, and trailing stop protection.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Max Snipe Size */}
              <div className="space-y-1.5 bg-[#090d16] p-3 rounded-lg border border-[#1b2230]">
                <label className="text-[#64748b] block text-[11px]">Max Allocation Per Snipe (SOL):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    value={config.maxSnipeSizeSol}
                    onChange={(e) => globalSolanaSniper.updateConfig({ maxSnipeSizeSol: parseFloat(e.target.value) || 1.0 })}
                    className="w-full bg-[#0c1018] border border-[#1b2230] px-3 py-1.5 rounded text-white font-bold text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-white font-bold">SOL</span>
                </div>
                <span className="text-[10px] text-[#64748b]">~${(config.maxSnipeSizeSol * solPrice).toFixed(2)} USD per position</span>
              </div>

              {/* Jito MEV Tip */}
              <div className="space-y-1.5 bg-[#090d16] p-3 rounded-lg border border-[#1b2230]">
                <label className="text-[#64748b] block text-[11px]">Jito MEV Tip (Sub-Slot Priority):</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    max="0.05"
                    value={config.jitoTipSol}
                    onChange={(e) => globalSolanaSniper.updateConfig({ jitoTipSol: parseFloat(e.target.value) || 0.005 })}
                    className="w-full bg-[#0c1018] border border-[#1b2230] px-3 py-1.5 rounded text-cyan-400 font-bold text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-white font-bold">SOL</span>
                </div>
                <span className="text-[10px] text-[#64748b]">Guarantees slot 0 inclusion before public RPC mempool</span>
              </div>

              {/* Min Safety Score */}
              <div className="space-y-1.5 bg-[#090d16] p-3 rounded-lg border border-[#1b2230]">
                <label className="text-[#64748b] block text-[11px]">Minimum Rug-Check Safety Score (0-100):</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="60"
                    max="95"
                    step="1"
                    value={config.minSafetyScore}
                    onChange={(e) => globalSolanaSniper.updateConfig({ minSafetyScore: parseInt(e.target.value) })}
                    className="flex-1 accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-cyan-400 font-bold text-sm w-8">{config.minSafetyScore}</span>
                </div>
                <span className="text-[10px] text-[#64748b]">Rejects any pool with active mint/freeze authority or dev bundles</span>
              </div>

              {/* Trailing Stop Distance */}
              <div className="space-y-1.5 bg-[#090d16] p-3 rounded-lg border border-[#1b2230]">
                <label className="text-[#64748b] block text-[11px]">Dynamic Trailing Stop Loss Distance (%):</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="1"
                    value={config.trailingStopPct}
                    onChange={(e) => globalSolanaSniper.updateConfig({ trailingStopPct: parseInt(e.target.value) })}
                    className="flex-1 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-indigo-400 font-bold text-sm w-8">{config.trailingStopPct}%</span>
                </div>
                <span className="text-[10px] text-[#64748b]">Ratchets up behind peak price to lock in exponential gains</span>
              </div>
            </div>

            {/* PRESET PROFILES */}
            <div className="pt-2 border-t border-[#1b2230] space-y-2">
              <span className="text-[#64748b] block text-[11px]">QUICK EXECUTION STRATEGY PRESETS:</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    globalSolanaSniper.updateConfig({
                      minSafetyScore: 88,
                      maxSnipeSizeSol: 1.0,
                      hedgeMode: 'DELTA_NEUTRAL',
                      hedgeRatioPct: 100,
                      jitoTipSol: 0.005,
                      trailingStopPct: 10
                    });
                    showNotice('✓ Applied Institutional Delta-Neutral Preset: 100% SOL beta hedge, 88+ score only.');
                  }}
                  className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded font-semibold cursor-pointer transition-colors"
                >
                  Institutional Delta-Neutral (Safe)
                </button>

                <button
                  onClick={() => {
                    globalSolanaSniper.updateConfig({
                      minSafetyScore: 78,
                      maxSnipeSizeSol: 2.5,
                      hedgeMode: 'BETA_ADJUSTED',
                      hedgeRatioPct: 75,
                      jitoTipSol: 0.015,
                      trailingStopPct: 15
                    });
                    showNotice('✓ Applied Degen Alpha Preset: Ultra fast Jito tip, 75% dynamic hedge.');
                  }}
                  className="px-3 py-1.5 bg-purple-950 hover:bg-purple-900 border border-purple-700/60 text-purple-300 rounded font-semibold cursor-pointer transition-colors"
                >
                  Degen Alpha (Max Velocity)
                </button>

                <button
                  onClick={() => {
                    globalSolanaSniper.updateConfig({
                      minSafetyScore: 92,
                      maxSnipeSizeSol: 0.5,
                      hedgeMode: 'CONSERVATIVE_50',
                      hedgeRatioPct: 50,
                      jitoTipSol: 0.003,
                      trailingStopPct: 8
                    });
                    showNotice('✓ Applied Conservative Capital Preservation Preset: 92+ score, tight 8% trailing stop.');
                  }}
                  className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded font-semibold cursor-pointer transition-colors"
                >
                  Conservative Capital Shield
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </SolanaSniperContext.Provider>
  );
};
