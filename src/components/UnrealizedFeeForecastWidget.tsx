/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Percent,
  Wallet,
  Landmark,
  TrendingUp,
  ShieldCheck,
  Info,
  ArrowRight,
  Sparkles,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useProfitSplitter } from '../core/profitSplitterEngine';
import { globalPortfolio } from '../portfolio/portfolioEngine';

interface Props {
  onNavigateToAutopilot?: () => void;
}

export const UnrealizedFeeForecastWidget: React.FC<Props> = ({ onNavigateToAutopilot }) => {
  const { profile, walletPublicAddress, performanceFeePct } = useProfitSplitter('default_user');
  const portfolioState = globalPortfolio.getState();

  const [isExpanded, setIsExpanded] = useState(false);
  const [simHarvestPct, setSimHarvestPct] = useState<number>(100);

  // Capital basis & equity
  const initialPrincipal = profile?.currentPrincipalBasis ?? globalPortfolio.getInitialCapital();
  const currentEquity = portfolioState.equityUsd;
  const unrealizedPnl = portfolioState.totalUnrealizedPnlUsd;
  const totalNetSurplus = Math.max(0, currentEquity - initialPrincipal);

  // Forecast on unrealized P&L:
  // If open positions are harvested at current mark:
  const simUnrealizedAmount = (unrealizedPnl * simHarvestPct) / 100;
  const potentialHarvestableGain = Math.max(0, Math.min(simUnrealizedAmount, totalNetSurplus));
  
  // 2.5% fee on harvestable gain exceeding principal
  const forecastFeeUsd = Number((potentialHarvestableGain * (performanceFeePct / 100)).toFixed(2));
  const forecastUserPayoutUsd = Number((potentialHarvestableGain - forecastFeeUsd).toFixed(2));
  const isSurplusActive = totalNetSurplus > 0 && potentialHarvestableGain > 0;

  // Total fee on entire existing surplus (unrealized + realized cash gains)
  const totalSurplusFeeForecast = Number((totalNetSurplus * (performanceFeePct / 100)).toFixed(2));

  return (
    <div className="bg-[#10141e] border border-indigo-900/40 hover:border-indigo-500/50 rounded-xl p-4 transition-all duration-200 shadow-lg shadow-indigo-950/20 space-y-3 font-mono">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>5.0% Performance Fee Forecast</span>
                <span className="text-[9px] font-normal text-indigo-300 bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-800/40">
                  Unrealized P&L
                </span>
              </h4>
            </div>
            <p className="text-[11px] text-[#94a3b8] font-sans">
              Upcoming fee obligations on future withdrawals if open positions are closed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              isSurplusActive
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
            }`}
          >
            {isSurplusActive ? '5.0% APPLICABLE ON GAINS' : '0% BREAKEVEN / LOSS EXEMPTION'}
          </span>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-[#64748b] hover:text-white rounded hover:bg-[#1a2333] transition-colors cursor-pointer"
            title={isExpanded ? 'Collapse calculator' : 'Expand calculator'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main 4-Column Forecast Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
        {/* Unrealized P&L */}
        <div className="bg-[#090d16] border border-[#1b2230] p-2.5 rounded-lg">
          <span className="text-[10px] text-[#64748b] block uppercase">Current Unrealized P&L</span>
          <div className={`text-sm font-bold tabular-nums mt-0.5 ${unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {unrealizedPnl >= 0 ? '+' : ''}${unrealizedPnl.toFixed(2)}
          </div>
          <span className="text-[9px] text-[#64748b] block mt-0.5">
            {portfolioState.positionsCount} active positions
          </span>
        </div>

        {/* Starting Principal Basis */}
        <div className="bg-[#090d16] border border-[#1b2230] p-2.5 rounded-lg">
          <span className="text-[10px] text-[#64748b] block uppercase">Principal Capital Basis</span>
          <div className="text-sm font-bold text-white tabular-nums mt-0.5">
            ${initialPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <span className="text-[9px] text-emerald-400 block mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 inline" /> 100% Fee-Exempt
          </span>
        </div>

        {/* Potential 5.0% Fee Obligation */}
        <div className="bg-[#090d16] border border-amber-900/40 p-2.5 rounded-lg">
          <span className="text-[10px] text-amber-400 block uppercase">Forecasted 5.0% Fee</span>
          <div className="text-sm font-bold text-amber-300 tabular-nums mt-0.5">
            {isSurplusActive ? `$${forecastFeeUsd.toFixed(2)}` : '$0.00'}
          </div>
          <span className="text-[9px] text-[#64748b] block mt-0.5">
            {isSurplusActive ? '$0.05 on each dollar of gain' : 'No fee (breakeven/loss)'}
          </span>
        </div>

        {/* Net User Take-Home */}
        <div className="bg-[#090d16] border border-indigo-900/40 p-2.5 rounded-lg">
          <span className="text-[10px] text-indigo-300 block uppercase">Net User Take-Home (95.0%)</span>
          <div className="text-sm font-bold text-emerald-300 tabular-nums mt-0.5">
            {isSurplusActive ? `+$${forecastUserPayoutUsd.toFixed(2)}` : `$0.00`}
          </div>
          <span className="text-[9px] text-[#64748b] block mt-0.5">
            Delivered directly to user
          </span>
        </div>
      </div>

      {/* Progress / Ratio Bar */}
      {isSurplusActive && (
        <div className="space-y-1 pt-1">
          <div className="flex justify-between text-[10px] text-[#64748b]">
            <span className="text-emerald-400">User Share: 97.5% (${forecastUserPayoutUsd.toFixed(2)})</span>
            <span className="text-amber-400">Fee Share: 2.5% (${forecastFeeUsd.toFixed(2)})</span>
          </div>
          <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: '97.5%' }} />
            <div className="bg-amber-400 h-full" style={{ width: '2.5%' }} />
          </div>
        </div>
      )}

      {/* Interactive Harvest & Withdrawal Simulator (Expandable) */}
      {isExpanded && (
        <div className="pt-2 border-t border-[#1b2230] space-y-3 bg-[#0a0e17] p-3 rounded-lg text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              <span>Harvest Simulation Slider</span>
            </span>
            <span className="text-[10px] text-[#94a3b8]">
              Simulate closing {simHarvestPct}% of open unrealized positions
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="10"
              max="100"
              step="10"
              value={simHarvestPct}
              onChange={(e) => setSimHarvestPct(Number(e.target.value))}
              className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-[#1b2230] rounded-lg"
            />
            <span className="font-bold text-white w-12 text-right">{simHarvestPct}%</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
            <div className="bg-[#0c1018] p-2 rounded border border-[#1b2230]">
              <span className="text-[#64748b] block text-[10px]">Harvested Gain:</span>
              <span className="text-white font-semibold">${potentialHarvestableGain.toFixed(2)}</span>
            </div>
            <div className="bg-[#0c1018] p-2 rounded border border-[#1b2230]">
              <span className="text-amber-400 block text-[10px]">2.5% Routed to Wallet:</span>
              <span className="text-amber-300 font-bold">${forecastFeeUsd.toFixed(2)}</span>
            </div>
            <div className="bg-[#0c1018] p-2 rounded border border-[#1b2230] col-span-2 sm:col-span-1">
              <span className="text-emerald-400 block text-[10px]">Net Payout to You:</span>
              <span className="text-emerald-300 font-bold">${forecastUserPayoutUsd.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info & Destination Wallet */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#1b2230] text-[10px] text-[#64748b]">
        <div className="flex items-center gap-1 truncate max-w-sm">
          <Wallet className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Creator Fee (Solana USDT): </span>
          <span className="text-emerald-300 font-semibold select-all truncate">
            {walletPublicAddress.slice(0, 6)}...{walletPublicAddress.slice(-4)}
          </span>
        </div>

        {onNavigateToAutopilot && (
          <button
            onClick={onNavigateToAutopilot}
            className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Protocol Treasury & Withdraw</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
