/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Crosshair,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  Zap,
  TrendingUp,
  Activity,
  ArrowUpDown,
  Sliders,
  DollarSign,
  Lock,
  Layers,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Flame,
  CheckCircle2,
  X,
  AlertCircle
} from 'lucide-react';
import {
  ISolanaLiquidPool,
  SolanaDex,
  HedgeMode
} from '../types/solanaSniper';
import { globalSolanaSniper } from '../solana_sniper/solanaSniperEngine';

interface Props {
  pools: ISolanaLiquidPool[];
  solPrice: number;
  onSnipeSuccess?: (pool: ISolanaLiquidPool, sizeSol: number, hedgeMode: HedgeMode) => void;
  onNavigateToPositions?: () => void;
}

type SortField = 'tvl' | 'volume24h' | 'volume1h' | 'apr' | 'priceChange24h' | 'rank';

export const SolanaPoolExplorer: React.FC<Props> = ({
  pools,
  solPrice,
  onSnipeSuccess,
  onNavigateToPositions
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDex, setSelectedDex] = useState<string>('ALL');
  const [selectedQuote, setSelectedQuote] = useState<string>('ALL');
  const [minSafetyScore, setMinSafetyScore] = useState<number>(0);
  const [sortField, setSortField] = useState<SortField>('tvl');
  const [sortAsc, setSortAsc] = useState(false);

  // Configuration & Snipe Modal State
  const [selectedPoolForSnipe, setSelectedPoolForSnipe] = useState<ISolanaLiquidPool | null>(null);
  const [snipeSizeSol, setSnipeSizeSol] = useState<number>(1.0);
  const [snipeHedgeMode, setSnipeHedgeMode] = useState<HedgeMode>('DELTA_NEUTRAL');
  const [trailingStopPct, setTrailingStopPct] = useState<number>(12);
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Filter & Sort Logic
  const filteredPools = useMemo(() => {
    return pools
      .filter((p) => {
        // Search filter
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          const matchSym = p.baseTokenSymbol.toLowerCase().includes(q);
          const matchName = p.baseTokenName.toLowerCase().includes(q);
          const matchAddr = p.poolAddress.toLowerCase().includes(q) || p.baseTokenAddress.toLowerCase().includes(q);
          if (!matchSym && !matchName && !matchAddr) return false;
        }

        // DEX filter
        if (selectedDex !== 'ALL' && p.dex !== selectedDex) return false;

        // Quote token filter
        if (selectedQuote !== 'ALL' && p.quoteTokenSymbol !== selectedQuote) return false;

        // Safety score filter
        if (p.safetyAudit.safetyScore < minSafetyScore) return false;

        return true;
      })
      .sort((a, b) => {
        let valA = 0;
        let valB = 0;

        switch (sortField) {
          case 'tvl':
            valA = a.tvlUsd;
            valB = b.tvlUsd;
            break;
          case 'volume24h':
            valA = a.volume24hUsd;
            valB = b.volume24hUsd;
            break;
          case 'volume1h':
            valA = a.volume1hUsd;
            valB = b.volume1hUsd;
            break;
          case 'apr':
            valA = a.aprPct;
            valB = b.aprPct;
            break;
          case 'priceChange24h':
            valA = a.priceChange24hPct;
            valB = b.priceChange24hPct;
            break;
          case 'rank':
            valA = b.trendingRank;
            valB = a.trendingRank;
            break;
        }

        return sortAsc ? valA - valB : valB - valA;
      });
  }, [pools, searchQuery, selectedDex, selectedQuote, minSafetyScore, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleOpenConfigureSnipe = (pool: ISolanaLiquidPool) => {
    setSelectedPoolForSnipe(pool);
    setSnipeSizeSol(1.0);
    setSnipeHedgeMode('DELTA_NEUTRAL');
    setTrailingStopPct(12);
  };

  const handleExecuteConfigureAndSnipe = () => {
    if (!selectedPoolForSnipe) return;
    setIsExecuting(true);

    const pos = globalSolanaSniper.snipeLiquidPool(selectedPoolForSnipe.id, {
      sizeSol: snipeSizeSol,
      hedgeMode: snipeHedgeMode,
      trailingStopPct
    });

    if (pos) {
      setFeedbackNotice(
        `✓ Sniped ${selectedPoolForSnipe.baseTokenSymbol} with ${snipeSizeSol} SOL! Paired continuous short SOL perp hedge (${snipeHedgeMode.replace('_', ' ')}) is active on Hyperliquid.`
      );
      if (onSnipeSuccess) {
        onSnipeSuccess(selectedPoolForSnipe, snipeSizeSol, snipeHedgeMode);
      }
    }

    setIsExecuting(false);
    setSelectedPoolForSnipe(null);
  };

  // Helper calculations for modal
  const notionalLongUsd = selectedPoolForSnipe ? snipeSizeSol * solPrice : 0;
  const hedgeRatio = snipeHedgeMode === 'CONSERVATIVE_50' ? 50 : snipeHedgeMode === 'BETA_ADJUSTED' ? 75 : snipeHedgeMode === 'MOMENTUM_DYNAMIC' ? 90 : 100;
  const notionalHedgeUsd = notionalLongUsd * (hedgeRatio / 100);

  return (
    <div className="space-y-4 font-mono">
      {/* Header notification if any */}
      {feedbackNotice && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-700/60 rounded-xl text-xs text-cyan-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
          {onNavigateToPositions && (
            <button
              onClick={onNavigateToPositions}
              className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-bold cursor-pointer transition-colors"
            >
              View Active Snipes →
            </button>
          )}
        </div>
      )}

      {/* FILTER & SEARCH BAR CONTROLS */}
      <div className="bg-[#0b101a] border border-[#1b2230] p-4 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Solana Pool Explorer</span>
                <span className="text-[9px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800/60">
                  REAL-TIME LIQUIDITY
                </span>
              </h3>
              <p className="text-[11px] text-[#94a3b8] font-sans">
                Deep liquidity pools across Raydium, Meteora, and Orca. Click any pool to configure and launch an automated hedged snipe.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#64748b]">Total Pools Monitored:</span>
            <span className="text-white font-bold bg-[#141b28] px-2 py-0.5 rounded border border-[#1b2230]">
              {pools.length}
            </span>
            <span className="text-[#64748b]">Matching:</span>
            <span className="text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
              {filteredPools.length}
            </span>
          </div>
        </div>

        {/* Search & Selectors Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748b] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search token, pair, or contract..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#070a12] border border-[#1b2230] pl-9 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#64748b] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* DEX Filter */}
          <select
            value={selectedDex}
            onChange={(e) => setSelectedDex(e.target.value)}
            className="bg-[#070a12] border border-[#1b2230] px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Solana DEXes</option>
            <option value="Meteora_DLMM">Meteora DLMM</option>
            <option value="Raydium_CPMM">Raydium CPMM</option>
            <option value="Raydium_AMM">Raydium AMM</option>
            <option value="Orca_Whirlpool">Orca Whirlpool</option>
            <option value="Pump_Fun">Pump.fun Bonding</option>
          </select>

          {/* Quote Currency Filter */}
          <select
            value={selectedQuote}
            onChange={(e) => setSelectedQuote(e.target.value)}
            className="bg-[#070a12] border border-[#1b2230] px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Pairs (SOL & USDC)</option>
            <option value="SOL">SOL Paired Only</option>
            <option value="USDC">USDC Paired Only</option>
          </select>

          {/* Safety Threshold */}
          <select
            value={minSafetyScore}
            onChange={(e) => setMinSafetyScore(Number(e.target.value))}
            className="bg-[#070a12] border border-[#1b2230] px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value={0}>Safety Score: Any</option>
            <option value={85}>Safety Score: 85+ (Safe)</option>
            <option value={90}>Safety Score: 90+ (High Conviction)</option>
            <option value={95}>Safety Score: 95+ (Institutional)</option>
          </select>
        </div>
      </div>

      {/* POOLS TABLE */}
      <div className="overflow-x-auto border border-[#1b2230] rounded-xl bg-[#0e131d]">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1b2230] text-[#64748b] uppercase text-[10px] bg-[#090d16]">
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('rank')}>
                <div className="flex items-center gap-1">
                  <span># Pair</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">DEX / Type</th>
              <th className="py-2.5 px-3">Price</th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('priceChange24h')}>
                <div className="flex items-center gap-1">
                  <span>24h Change</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('tvl')}>
                <div className="flex items-center gap-1">
                  <span>TVL (Liquidity)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('volume24h')}>
                <div className="flex items-center gap-1">
                  <span>24h Volume</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('volume1h')}>
                <div className="flex items-center gap-1">
                  <span>1h Velocity</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('apr')}>
                <div className="flex items-center gap-1">
                  <span>Fee APR</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3">Safety Audit</th>
              <th className="py-2.5 px-3 text-right">Sniper Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b2230]">
            {filteredPools.map((pool) => {
              const isPositive24h = pool.priceChange24hPct >= 0;
              const isHighVelocity = pool.volumeVelocityMultiplier >= 2.5;

              return (
                <tr
                  key={pool.id}
                  className="hover:bg-[#141b28] transition-colors cursor-pointer group"
                  onClick={() => handleOpenConfigureSnipe(pool)}
                >
                    {/* Pair & Rank */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#64748b] text-[10px] w-4">{pool.trendingRank}</span>
                        <div className="w-7 h-7 rounded bg-gradient-to-br from-indigo-900 to-cyan-900 border border-indigo-700/50 flex items-center justify-center font-bold text-white text-[10px]">
                          {pool.baseTokenSymbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{pool.baseTokenSymbol}</span>
                            <span className="text-[#64748b] text-[10px]">/ {pool.quoteTokenSymbol}</span>
                          </div>
                          <span className="text-[10px] text-[#64748b] block truncate max-w-[130px]">
                            {pool.baseTokenName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* DEX Badge */}
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[#0c1018] text-[#94a3b8] border border-[#1b2230] block w-fit">
                        {pool.dex.replace('_', ' ')}
                      </span>
                      {pool.isConcentrated && (
                        <span className="text-[9px] text-cyan-400 block mt-0.5">
                          Concentrated {pool.binStep ? `(Bin ${pool.binStep})` : ''}
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="py-3 px-3">
                      <span className="text-white font-semibold block">
                        ${pool.currentPriceUsd >= 1 ? pool.currentPriceUsd.toFixed(2) : pool.currentPriceUsd.toFixed(6)}
                      </span>
                      <span className="text-[10px] text-[#64748b] block">
                        {pool.currentPriceSol >= 0.001 ? pool.currentPriceSol.toFixed(4) : pool.currentPriceSol.toFixed(7)} SOL
                      </span>
                    </td>

                    {/* 24h Change */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-0.5 font-bold ${
                          isPositive24h ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isPositive24h ? '+' : ''}{pool.priceChange24hPct.toFixed(1)}%
                      </span>
                      <span className="text-[9px] text-[#64748b] block">
                        1h: {pool.priceChange1hPct >= 0 ? '+' : ''}{pool.priceChange1hPct.toFixed(1)}%
                      </span>
                    </td>

                    {/* TVL */}
                    <td className="py-3 px-3">
                      <span className="text-white font-semibold">
                        ${(pool.tvlUsd / 1000000).toFixed(2)}M
                      </span>
                      <span className="text-[10px] text-[#64748b] block">
                        {pool.solLiquidity.toLocaleString()} SOL
                      </span>
                    </td>

                    {/* 24h Volume */}
                    <td className="py-3 px-3">
                      <span className="text-white font-semibold">
                        ${(pool.volume24hUsd / 1000000).toFixed(2)}M
                      </span>
                      <span className="text-[10px] text-[#64748b] block">
                        {pool.transactions24h.toLocaleString()} txns
                      </span>
                    </td>

                    {/* 1h Volume & Velocity */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-cyan-300 font-semibold">
                          ${(pool.volume1hUsd / 1000000).toFixed(2)}M
                        </span>
                        {isHighVelocity && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" />
                            <span>{pool.volumeVelocityMultiplier}x</span>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fee APR */}
                    <td className="py-3 px-3">
                      <span className="text-emerald-400 font-bold">
                        {pool.aprPct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-[#64748b] block">
                        Fee: {pool.feeTierPct}%
                      </span>
                    </td>

                    {/* Safety Audit */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-7 text-center py-0.5 rounded font-bold text-[10px] ${
                            pool.safetyAudit.safetyScore >= 95
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : pool.safetyAudit.safetyScore >= 85
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}
                        >
                          {pool.safetyAudit.safetyScore}
                        </div>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenConfigureSnipe(pool);
                        }}
                        className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-[11px] font-bold cursor-pointer transition-all shadow-sm flex items-center gap-1 ml-auto"
                      >
                        <Crosshair className="w-3 h-3" />
                        <span>Configure & Snipe</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* MODAL: INSTANT CONFIGURE SNIPER ENGINE & CONTINUOUS HEDGE */}
      {selectedPoolForSnipe && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0f1422] border border-cyan-500/50 w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4 font-mono relative">
            {/* Close Button */}
              <button
                onClick={() => setSelectedPoolForSnipe(null)}
                className="absolute top-4 right-4 text-[#64748b] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                  {selectedPoolForSnipe.baseTokenSymbol.slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Configure Snipe: {selectedPoolForSnipe.baseTokenSymbol}</span>
                    <span className="text-[10px] bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800">
                      {selectedPoolForSnipe.dex.replace('_', ' ')}
                    </span>
                  </h3>
                  <p className="text-xs text-[#94a3b8] font-sans">
                    Sub-slot Jito MEV execution paired with continuous inverse SOL short perp hedge.
                  </p>
                </div>
              </div>

              {/* Pool Snapshot Strip */}
              <div className="grid grid-cols-3 gap-2 text-xs bg-[#080c14] p-3 rounded-lg border border-[#1b2230]">
                <div>
                  <span className="text-[#64748b] text-[10px] block">Current Price:</span>
                  <span className="text-white font-bold">
                    ${selectedPoolForSnipe.currentPriceUsd >= 1 ? selectedPoolForSnipe.currentPriceUsd.toFixed(2) : selectedPoolForSnipe.currentPriceUsd.toFixed(6)}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748b] text-[10px] block">Pool TVL:</span>
                  <span className="text-emerald-400 font-bold">
                    ${(selectedPoolForSnipe.tvlUsd / 1000000).toFixed(2)}M
                  </span>
                </div>
                <div>
                  <span className="text-[#64748b] text-[10px] block">Safety Audit:</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 inline text-emerald-400" />
                    <span>{selectedPoolForSnipe.safetyAudit.safetyScore}/100</span>
                  </span>
                </div>
              </div>

              {/* Snipe Size (SOL) */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94a3b8]">Snipe Allocation (SOL):</span>
                  <span className="text-white font-bold">
                    ~${notionalLongUsd.toFixed(2)} USD
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={snipeSizeSol}
                    onChange={(e) => setSnipeSizeSol(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                    className="flex-1 bg-[#080c14] border border-[#1b2230] px-3 py-2 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-white font-bold text-xs">SOL</span>
                </div>

                {/* Quick Amount Chips */}
                <div className="flex gap-1.5 pt-1 text-xs">
                  {[0.2, 0.5, 1.0, 2.5, 5.0].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSnipeSizeSol(amt)}
                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                        snipeSizeSol === amt
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-[#141b28] text-[#94a3b8] hover:text-white border border-[#1b2230]'
                      }`}
                    >
                      {amt} SOL
                    </button>
                  ))}
                </div>
              </div>

              {/* Continuous Hedge Mode Architecture */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#94a3b8]">Continuous Short SOL Hedge Architecture:</span>
                  <span className="text-indigo-400 font-bold">{hedgeRatio}% Hedge Ratio</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(
                    [
                      { id: 'DELTA_NEUTRAL', label: 'Delta Neutral (100%)', desc: 'Full SOL beta neutralized' },
                      { id: 'BETA_ADJUSTED', label: 'Beta Adjusted (75%)', desc: 'Scaled by token correlation' },
                      { id: 'CONSERVATIVE_50', label: 'Conservative (50%)', desc: 'Partial downside shield' },
                      { id: 'MOMENTUM_DYNAMIC', label: 'Dynamic (90%)', desc: 'Ratchets with profit gains' }
                    ] as { id: HedgeMode; label: string; desc: string }[]
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setSnipeHedgeMode(mode.id)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        snipeHedgeMode === mode.id
                          ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md shadow-indigo-950'
                          : 'bg-[#080c14] border-[#1b2230] text-[#94a3b8] hover:border-[#2b3548]'
                      }`}
                    >
                      <span className="text-[11px] font-bold block">{mode.label}</span>
                      <span className="text-[9px] text-[#64748b] block">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trailing Stop Loss Slider */}
              <div className="space-y-1 bg-[#080c14] p-3 rounded-lg border border-[#1b2230] text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#94a3b8]">Trailing Stop-Loss Distance:</span>
                  <span className="text-indigo-400 font-bold">{trailingStopPct}% off peak</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  step="1"
                  value={trailingStopPct}
                  onChange={(e) => setTrailingStopPct(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
                <span className="text-[10px] text-[#64748b] block">
                  Automatically ratchets upward behind price peaks to guarantee locking in breakout gains.
                </span>
              </div>

              {/* Financial Execution Summary Strip */}
              <div className="p-3 bg-[#080c14] border border-cyan-800/40 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between text-[#94a3b8]">
                  <span>Long Meme Exposure:</span>
                  <span className="text-white font-bold">${notionalLongUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-indigo-400">
                  <span>Short SOL Perp Hedge (Hyperliquid):</span>
                  <span className="font-bold">${notionalHedgeUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-cyan-400 font-bold pt-1 border-t border-[#1b2230]">
                  <span>Net Market Delta:</span>
                  <span>~0.00 SOL (Neutralized)</span>
                </div>
              </div>

              {/* Launch Action Button */}
              <button
                onClick={handleExecuteConfigureAndSnipe}
                disabled={isExecuting}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg shadow-cyan-950"
              >
                <Zap className="w-4 h-4" />
                <span>EXECUTE JITO SNIPE & CONTINUOUS HEDGE</span>
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
