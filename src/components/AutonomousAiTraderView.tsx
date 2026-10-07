/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Zap,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  RefreshCw,
  Power,
  RotateCcw,
  Sliders,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Info,
  Clock,
  Activity,
  Wallet,
  Check,
  Copy,
  ExternalLink,
  Receipt,
  AlertCircle,
  Percent,
  Landmark,
  Lock,
  ShieldCheck,
  ArrowDownToLine
} from 'lucide-react';
import { globalAiTrader, AiRiskProfile } from '../autopilot/aiTraderEngine';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { IPosition, ITreasuryWithdrawalReceipt } from '../types/portfolio';
import { globalExecutionEngine } from '../execution/executionEngine';
import { useProfitSplitter } from '../core/profitSplitterEngine';

interface Props {
  onNavigateToTab?: (tab: string) => void;
  onOpenDepositModal?: () => void;
}

export const AutonomousAiTraderView: React.FC<Props> = ({
  onNavigateToTab,
  onOpenDepositModal
}) => {
  const [stats, setStats] = useState(globalAiTrader.getStats());
  const [snapshots, setSnapshots] = useState(globalAiTrader.getEquitySnapshots());
  const [logs, setLogs] = useState(globalAiTrader.getDecisionLogs());
  const [positions, setPositions] = useState<IPosition[]>(globalPortfolio.getPositions());

  // Deposit / Withdraw form state
  const [depositAmount, setDepositAmount] = useState<string>('5000');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('1000');
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const feedbackTimer = useRef<any>(null);

  // Creator Commission & Treasury State
  const { profile: splitterProfile } = useProfitSplitter('default_user');
  const [copiedWallet, setCopiedWallet] = useState<boolean>(false);
  const [selectedReceipt, setSelectedReceipt] = useState<ITreasuryWithdrawalReceipt | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<string | null>(null);

  // Simulation State
  const [simDays, setSimDays] = useState<number>(30);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<{
    startingUsd: number;
    projectedUsd: number;
    netGainUsd: number;
    projectedPct: number;
    dailyCompoundedRatePct: number;
  } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setActionFeedback({ message, type });
    feedbackTimer.current = setTimeout(() => setActionFeedback(null), 4500);
  };

  useEffect(() => {
    const unsub = globalAiTrader.subscribe(() => {
      setStats(globalAiTrader.getStats());
      setSnapshots(globalAiTrader.getEquitySnapshots());
      setLogs(globalAiTrader.getDecisionLogs());
      setPositions(globalPortfolio.getPositions());
    });

    // Refresh telemetry every 1.5s
    const timer = setInterval(() => {
      setStats(globalAiTrader.getStats());
      setSnapshots(globalAiTrader.getEquitySnapshots());
      setLogs(globalAiTrader.getDecisionLogs());
      setPositions(globalPortfolio.getPositions());
    }, 1500);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const handleCopyWallet = (addr: string) => {
    navigator.clipboard?.writeText(addr);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2500);
  };

  const handleDeposit = (amount: number) => {
    if (isNaN(amount) || amount <= 0) {
      showFeedback('Please enter a valid deposit amount', 'error');
      return;
    }
    globalAiTrader.deposit(amount, 'Hands-Free Vault Deposit');
    showFeedback(`✓ Deposited $${amount.toLocaleString()} into your Hands-Free AI Trading Vault! Capital is now actively compounding.`, 'success');
  };

  const handleWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      showFeedback('Please enter a valid withdrawal amount', 'error');
      return;
    }
    const res = globalAiTrader.withdraw(amt);
    if (res.success && res.receipt) {
      setSelectedReceipt(res.receipt);
      if (res.receipt.isProfitFeeApplied) {
        showFeedback(
          `✓ Processed $${amt.toLocaleString()} withdrawal! Net payout: $${res.receipt.netPayoutUsd.toLocaleString()}. 🏛️ 2.5% Profit Share ($${res.receipt.feeUsd.toFixed(2)}) routed to Wallet: ${res.receipt.developerWallet.slice(0, 6)}...${res.receipt.developerWallet.slice(-4)}`,
          'success'
        );
      } else {
        showFeedback(
          `✓ Processed $${amt.toLocaleString()} withdrawal in full! Breakeven / Loss Protection Active: $0.00 fee (0%). 100% payout delivered.`,
          'info'
        );
      }
      setWithdrawAmount('');
    } else {
      showFeedback('Withdrawal failed: insufficient available cash margin.', 'error');
    }
  };

  const handleInstantHarvest = async (pos: IPosition) => {
    const exitDirection = pos.direction === 'LONG' ? 'SELL' : 'BUY';
    await globalExecutionEngine.submitOrder({
      symbol: pos.symbol,
      venue: pos.venue,
      direction: exitDirection,
      orderType: 'MARKET',
      size: pos.size,
      price: pos.currentPrice,
      strategyId: 'ai_manual_harvest',
      algorithm: 'DIRECT'
    });
    showFeedback(`💰 Instantly harvested position on ${pos.symbol} at ${pos.unrealizedPnl >= 0 ? '+' : ''}$${pos.unrealizedPnl.toFixed(2)}.`, 'success');
  };

  // Run Compound Growth Simulator
  const runCompoundSimulation = (days: number) => {
    setIsSimulating(true);
    setSimDays(days);
    setTimeout(() => {
      const starting = stats.currentEquityUsd;
      // Convert projected APY to daily compound rate
      const annualRate = stats.projectedApy / 100;
      const dailyRate = Math.pow(1 + annualRate, 1 / 365) - 1;
      const projected = starting * Math.pow(1 + dailyRate, days);
      const netGain = projected - starting;
      const projectedPct = (netGain / starting) * 100;

      setSimResult({
        startingUsd: Math.round(starting),
        projectedUsd: Math.round(projected),
        netGainUsd: Math.round(netGain),
        projectedPct: Number(projectedPct.toFixed(1)),
        dailyCompoundedRatePct: Number((dailyRate * 100).toFixed(3))
      });
      setIsSimulating(false);
    }, 300);
  };

  // Quick deposit presets
  const depositPresets = [500, 1000, 2500, 5000, 10000, 25000];

  // SVG Chart points calculation
  const chartPoints = snapshots.map((s, idx) => {
    const minVal = Math.min(...snapshots.map(p => p.equityUsd)) * 0.998;
    const maxVal = Math.max(...snapshots.map(p => p.equityUsd)) * 1.002;
    const range = Math.max(1, maxVal - minVal);
    const x = (idx / Math.max(1, snapshots.length - 1)) * 560 + 20;
    const y = 140 - ((s.equityUsd - minVal) / range) * 110;
    return { x, y, ...s };
  });

  const svgPolylinePoints = chartPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="space-y-6">
      {/* 1. HERO AUTOPILOT BANNER */}
      <div className="bg-gradient-to-r from-[#0d1424] via-[#10192e] to-[#0d1424] border border-indigo-500/30 rounded-xl p-5 md:p-6 shadow-lg shadow-indigo-950/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stats.enabled ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${stats.enabled ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
              </span>
              <span className="text-xs font-mono font-semibold tracking-wider uppercase text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Hands-Free Autonomous Wealth Engine
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                stats.enabled
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {stats.enabled ? 'ACTIVE ON YOUR BEHALF (RUNNING BY DEFAULT)' : 'PAUSED'}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight mt-1.5 flex items-center gap-2">
              <span>Put in your money and watch it grow</span>
            </h2>
            <p className="text-xs md:text-sm text-[#94a3b8] mt-1 max-w-2xl">
              The AI Trader continuously scans 7 venues and 16 quantitative engines, executes high-probability trades on your behalf, takes profits automatically, and compounds your balance hands-free.
            </p>
          </div>

          {/* Autopilot Master Switch */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => globalAiTrader.toggleEnabled()}
              className={`px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md ${
                stats.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>{stats.enabled ? 'AI Autopilot: ON' : 'Resume Autopilot'}</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {actionFeedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-mono border flex items-center justify-between animate-fadeIn ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-700/70 text-emerald-300'
                : actionFeedback.type === 'info'
                ? 'bg-blue-950/70 border-blue-700/70 text-blue-300'
                : 'bg-rose-950/70 border-rose-700/70 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Info className="w-4 h-4 text-blue-400" />}
              <span>{actionFeedback.message}</span>
            </div>
            <button onClick={() => setActionFeedback(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}
      </div>

      {/* 2. REAL-TIME GROWTH TELEMETRY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {/* Total Vault Equity */}
        <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#64748b]">
            <span className="flex items-center gap-1.5">
              <span>Total Vault Balance</span>
              <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                globalPortfolio.getTradingMode() === 'LIVE'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                  : 'bg-amber-950 text-amber-300 border border-amber-800/60'
              }`}>
                {globalPortfolio.getTradingMode()}
              </span>
            </span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">
            ${stats.currentEquityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#64748b] mt-1 flex items-center justify-between font-mono">
            <span>Cash: <strong className="text-[#cbd5e1]">${stats.currentCashUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></span>
            {globalPortfolio.getTradingMode() === 'LIVE' && stats.currentCashUsd === 0 && (
              <span className="text-[9px] text-amber-400 font-bold bg-amber-950/70 border border-amber-800/50 px-1 rounded">
                DEPOSIT REQUIRED
              </span>
            )}
          </div>
        </div>

        {/* Realized Profits Harvested */}
        <div className="bg-[#10141e] border border-emerald-900/40 p-4 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-emerald-400">
            <span>Harvested Profits</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-emerald-400 mt-1 tabular-nums flex items-baseline gap-1">
            <span>+${stats.totalHarvestedProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="text-[11px] text-[#94a3b8] mt-1 font-mono">
            <span>{stats.winningHarvestsCount} winning trades locked</span>
          </div>
        </div>

        {/* Projected Annualized Return (APY) */}
        <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-indigo-400">
            <span>Compound APY</span>
            <TrendingUp className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-indigo-300 mt-1 tabular-nums">
            {stats.projectedApy}%
          </div>
          <div className="text-[11px] text-[#64748b] mt-1 font-mono">
            <span>Dynamic compound yield</span>
          </div>
        </div>

        {/* Autopilot Win Rate */}
        <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#64748b]">
            <span>Autopilot Win Rate</span>
            <Shield className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-mono text-2xl font-bold text-amber-300 mt-1 tabular-nums">
            {stats.winRate}%
          </div>
          <div className="text-[11px] text-[#64748b] mt-1 font-mono">
            <span>{stats.harvestedTradesCount} total closed trades</span>
          </div>
        </div>

        {/* Net Growth Session Return */}
        <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-[#10141e] border border-[#1b2230] p-4 rounded-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-[#64748b]">
            <span>Net Session Gain</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className={`font-mono text-2xl font-bold mt-1 tabular-nums ${stats.netProfitUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {stats.netProfitUsd >= 0 ? '+' : ''}${stats.netProfitUsd.toFixed(2)}
          </div>
          <div className="text-[11px] text-[#64748b] mt-1 font-mono">
            <span className={stats.netProfitPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              {stats.netProfitPct >= 0 ? '+' : ''}{stats.netProfitPct.toFixed(2)}% ROI
            </span>
          </div>
        </div>
      </div>

      {/* 3. DEPOSIT MONEY WIDGET & REAL-TIME COMPOUND GROWTH CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: PUT IN YOUR MONEY (DEPOSIT / REBALANCE VAULT) */}
        <div className="lg:col-span-5 bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 font-bold text-xs">
                $
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Deposit & Fund Vault</h3>
                <p className="text-xs text-[#94a3b8]">Add capital into the AI Trader. Funds are automatically deployed into active strategies.</p>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider">Quick Deposit Presets</span>
            <div className="grid grid-cols-3 gap-2">
              {depositPresets.map(preset => (
                <button
                  key={preset}
                  onClick={() => {
                    setDepositAmount(preset.toString());
                    handleDeposit(preset);
                  }}
                  className="py-2 px-3 bg-[#0c0f17] hover:bg-[#161d2b] border border-[#1b2230] hover:border-emerald-600/50 rounded text-xs font-mono font-medium text-[#e2e8f0] transition-colors cursor-pointer flex items-center justify-center gap-1 group"
                >
                  <span className="text-emerald-400 group-hover:scale-110 transition-transform">+</span>
                  <span>${preset >= 1000 ? `${preset / 1000}k` : preset}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Deposit Input */}
          <div className="space-y-2 pt-2 border-t border-[#1b2230]">
            <label className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider block">Custom Deposit Amount ($ USD)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] font-mono text-sm">$</span>
                <input
                  type="number"
                  min="50"
                  step="100"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-[#0c0f17] border border-[#1b2230] text-white font-mono text-sm pl-7 pr-3 py-2 rounded focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => handleDeposit(parseFloat(depositAmount))}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>Deposit</span>
              </button>
            </div>

            {onOpenDepositModal && (
              <button
                type="button"
                onClick={onOpenDepositModal}
                className="w-full py-2 bg-gradient-to-r from-emerald-950 via-[#101c24] to-blue-950 hover:border-emerald-500/70 border border-emerald-700/40 text-emerald-300 rounded font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-emerald-950 mt-1"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                <span>On-Chain Deposit Hub (Solana, Polygon & QR Code)</span>
              </button>
            )}
          </div>

          {/* Withdraw Form with 2.5% Base Architecture Profit Fee Preview */}
          <div className="space-y-2 pt-2 border-t border-[#1b2230]">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                <span>Withdraw to External Cash</span>
              </label>
              <span className="text-[10px] font-mono text-[#64748b]">Available: ${stats.currentCashUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] font-mono text-sm">$</span>
                <input
                  type="number"
                  min="50"
                  step="100"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full bg-[#0c0f17] border border-[#1b2230] text-white font-mono text-sm pl-7 pr-3 py-2 rounded focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={handleWithdraw}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-md shadow-indigo-950"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>Withdraw</span>
              </button>
            </div>

            {/* Live Fee Calculation Preview */}
            {(() => {
              const parsedAmt = parseFloat(withdrawAmount) || 0;
              if (parsedAmt <= 0) return null;
              const initialBasis = stats.initialCapitalBasisUsd ?? 100000;
              const currentEquity = stats.currentEquityUsd ?? 100000;
              const cumulativeProfit = Math.max(0, currentEquity - initialBasis);
              const previewProfitWithdrawn = Math.min(parsedAmt, cumulativeProfit);
              const previewPrincipalWithdrawn = Math.max(0, parsedAmt - previewProfitWithdrawn);
              const previewFeeUsd = Number((previewProfitWithdrawn * 0.05).toFixed(2));
              const previewNetPayout = Number((parsedAmt - previewFeeUsd).toFixed(2));
              const isProfitTaxed = previewFeeUsd > 0;

              return (
                <div className="mt-2 p-3 bg-[#0a0e17] border border-indigo-900/40 rounded-lg space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px] pb-1.5 border-b border-[#1b2230]">
                    <span className="text-indigo-300 font-semibold flex items-center gap-1">
                      <Percent className="w-3 h-3 text-indigo-400" />
                      <span>5.0% Base Architecture Profit Routing</span>
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isProfitTaxed ? 'bg-amber-950/80 text-amber-300 border border-amber-800' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    }`}>
                      {isProfitTaxed ? '5.0% FEE ON PROFIT' : '0% FEE (BREAKEVEN/LOSS)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Starting Basis:</span>
                      <span className="text-white font-semibold">${initialBasis.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Net Profit Eligible:</span>
                      <span className={`font-semibold ${cumulativeProfit > 0 ? 'text-emerald-400' : 'text-[#94a3b8]'}`}>
                        {cumulativeProfit > 0 ? `+$${cumulativeProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '$0.00 (Breakeven)'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Profit Withdrawn:</span>
                      <span className="text-emerald-400 font-semibold">${previewProfitWithdrawn.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Principal Withdrawn:</span>
                      <span className="text-[#cbd5e1] font-semibold">${previewPrincipalWithdrawn.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">5.0% Fee to Wallet:</span>
                      <span className="text-amber-400 font-bold">${previewFeeUsd.toFixed(2)} <span className="text-[9px] text-[#64748b]">($0.05/$1)</span></span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Net Payout to You:</span>
                      <span className="text-emerald-300 font-bold">${previewNetPayout.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-[#1b2230] text-[10px] text-[#94a3b8] flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate">
                      <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Creator Solana Wallet (USDT): </span>
                      <span className="text-emerald-300 font-mono font-semibold">{stats.developerWallet.slice(0, 6)}...{stats.developerWallet.slice(-4)}</span>
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.2 rounded">
                      FIXED BY CREATOR
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Autopilot Risk Profile Presets */}
          <div className="space-y-2 pt-2 border-t border-[#1b2230]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider">Growth & Risk Profile</span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">Agile Harvest: +{stats.targetTakeProfitPct}% Target</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as AiRiskProfile[]).map((prof) => {
                const isSelected = stats.riskProfile === prof;
                const labels: Record<AiRiskProfile, { name: string; apy: string; color: string; harvest: string }> = {
                  CONSERVATIVE: { name: 'Conservative', apy: '~28% APY', color: 'border-blue-500/50 bg-blue-950/30 text-blue-300', harvest: 'TP: +0.8%' },
                  BALANCED: { name: 'Balanced Alpha', apy: '~56% APY', color: 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300', harvest: 'TP: +1.2%' },
                  AGGRESSIVE: { name: 'Aggressive', apy: '~108% APY', color: 'border-purple-500/50 bg-purple-950/30 text-purple-300', harvest: 'TP: +1.8%' }
                };
                const item = labels[prof];
                return (
                  <button
                    key={prof}
                    onClick={() => globalAiTrader.setRiskProfile(prof)}
                    className={`p-2.5 rounded border text-left transition-all cursor-pointer ${
                      isSelected ? item.color + ' ring-1 ring-emerald-500/30' : 'bg-[#0c0f17] border-[#1b2230] text-[#94a3b8] hover:border-[#2a364d]'
                    }`}
                  >
                    <div className="text-xs font-semibold">{item.name}</div>
                    <div className="text-[10px] font-mono text-white/70 mt-0.5">{item.apy}</div>
                    <div className="text-[9px] font-mono text-emerald-400/90 mt-0.5">{item.harvest}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Automated Switches */}
          <div className="bg-[#090c13] border border-[#1b2230] p-3 rounded-lg space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8] flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Compound Harvested Gains:</span>
              </span>
              <button
                onClick={() => globalAiTrader.setAutoCompound(!stats.autoCompound)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  stats.autoCompound ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {stats.autoCompound ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                <span>Re-Trade on Significant Upside:</span>
              </span>
              <button
                onClick={() => globalAiTrader.setRetradeOnUpsideEnabled(!stats.retradeOnUpsideEnabled)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                  stats.retradeOnUpsideEnabled ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {stats.retradeOnUpsideEnabled ? 'ACTIVE (CONTINUOUS)' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#94a3b8] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Trailing Stop Profit Lock:</span>
              </span>
              <span className="text-amber-400 font-bold">{stats.trailingStopPct}% retrace</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: WATCH IT GROW (LIVE EQUITY CHART & COMPOUND SIMULATOR) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Real-Time Live Growth SVG Chart */}
          <div className="bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Real-Time Capital Growth Curve</span>
                </h3>
                <p className="text-xs text-[#94a3b8]">Live tracking of your deposited vault capital as AI trades harvest gains.</p>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-semibold">Ticking Live</span>
                <span className="text-[#64748b]">({snapshots.length} snapshots)</span>
              </div>
            </div>

            {/* SVG Chart Graphic */}
            <div className="h-44 w-full bg-[#090c13] border border-[#1a2333] rounded-lg p-2 relative flex items-center justify-center">
              {snapshots.length < 2 ? (
                <div className="text-center text-xs text-[#64748b]">
                  <Activity className="w-6 h-6 text-indigo-400 mx-auto mb-1 animate-pulse" />
                  <span>Accumulating live telemetry ticks... Chart updating every 1.5s.</span>
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 600 160">
                  <defs>
                    <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  <line x1="20" y1="30" x2="580" y2="30" stroke="#1f293d" strokeDasharray="3 3" />
                  <line x1="20" y1="80" x2="580" y2="80" stroke="#1f293d" strokeDasharray="3 3" />
                  <line x1="20" y1="130" x2="580" y2="130" stroke="#1f293d" strokeDasharray="3 3" />

                  {/* Shaded Area under Curve */}
                  <polygon
                    points={`20,150 ${svgPolylinePoints} 580,150`}
                    fill="url(#equityGradient)"
                  />

                  {/* Main Line */}
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={svgPolylinePoints}
                  />

                  {/* Current Tip Marker */}
                  {chartPoints.length > 0 && (
                    <circle
                      cx={chartPoints[chartPoints.length - 1].x}
                      cy={chartPoints[chartPoints.length - 1].y}
                      r="4.5"
                      fill="#34d399"
                      stroke="#064e3b"
                      strokeWidth="2"
                    />
                  )}
                </svg>
              )}

              {/* Ticker HUD Overlay */}
              <div className="absolute top-3 right-3 bg-[#0c1018]/90 border border-[#1b2230] px-2.5 py-1 rounded text-[11px] font-mono">
                <span className="text-[#64748b]">Current: </span>
                <span className="text-white font-bold">${stats.currentEquityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
              <span>Session Initial: ${stats.totalDepositedUsd.toLocaleString()}</span>
              <span className="text-emerald-400 font-semibold">Net Realized Harvests: +${stats.totalHarvestedProfitUsd.toFixed(2)}</span>
            </div>
          </div>

          {/* COMPOUND GROWTH SIMULATOR / FAST FORWARD TOOL */}
          <div className="bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Compound Growth Projector</span>
                </h3>
                <p className="text-xs text-[#94a3b8]">Simulate how your current vault balance compounds with the 16 institutional strategies.</p>
              </div>

              {/* Preset Days Buttons */}
              <div className="flex items-center gap-1.5">
                {[7, 30, 90, 365].map(d => (
                  <button
                    key={d}
                    onClick={() => runCompoundSimulation(d)}
                    className={`px-2.5 py-1 rounded text-xs font-mono cursor-pointer transition-colors ${
                      simDays === d
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-[#0c0f17] text-[#94a3b8] hover:text-white border border-[#1b2230]'
                    }`}
                  >
                    {d === 365 ? '1 Year' : `${d} Days`}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulation Preview Card */}
            {simResult && (
              <div className="bg-[#090c13] border border-indigo-900/40 p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                <div>
                  <span className="text-[10px] text-[#64748b] block uppercase">Starting Capital</span>
                  <span className="text-white text-base font-semibold">${simResult.startingUsd.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748b] block uppercase">Projected in {simDays}d</span>
                  <span className="text-emerald-400 text-base font-bold">${simResult.projectedUsd.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748b] block uppercase">Compound Gain</span>
                  <span className="text-emerald-400 text-base font-bold">+${simResult.netGainUsd.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#64748b] block uppercase">Projected ROI</span>
                  <span className="text-indigo-300 text-base font-bold">+{simResult.projectedPct}%</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. CURRENT AUTONOMOUS POSITIONS & INSTANT HARVEST */}
      <div className="bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>Active Hands-Free Positions Managed by AI</span>
            </h3>
            <p className="text-xs text-[#94a3b8]">Live positions actively targeted for automated profit harvesting.</p>
          </div>
          <span className="text-xs font-mono text-[#64748b]">{positions.length} Active Positions</span>
        </div>

        {positions.length === 0 ? (
          <div className="bg-[#0c0f17] border border-[#1b2230] p-6 rounded-lg text-center text-xs text-[#94a3b8] space-y-2">
            <p>No open positions right now. The AI Trader is continuously evaluating signals and will enter high-probability trades automatically.</p>
            <p className="text-[11px] text-[#64748b]">Tip: Deposit more funds above to increase concurrent allocation size.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[#1b2230] text-[#64748b] uppercase text-[10px]">
                  <th className="py-2.5 px-3">Symbol & Venue</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Entry Price</th>
                  <th className="py-2.5 px-3">Current Price</th>
                  <th className="py-2.5 px-3">Unrealized P&L</th>
                  <th className="py-2.5 px-3">Target Harvest Progress</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2230]">
                {positions.map(pos => {
                  const pnl = pos.unrealizedPnl;
                  const pnlPct = pos.unrealizedPnlPct;
                  const targetPct = stats.targetTakeProfitPct;
                  const progressPct = Math.max(0, Math.min(100, (pnlPct / targetPct) * 100));

                  return (
                    <tr key={pos.id} className="hover:bg-[#131924] transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-white block">{pos.symbol}</span>
                        <span className="text-[10px] text-[#64748b] uppercase">{pos.venue}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          pos.direction === 'LONG' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}>
                          {pos.direction}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#cbd5e1]">${pos.entryPrice.toFixed(3)}</td>
                      <td className="py-3 px-3 text-white font-semibold">${pos.currentPrice.toFixed(3)}</td>
                      <td className="py-3 px-3">
                        <span className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 w-48">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-[#64748b]">
                            <span>Harvest Goal: +{targetPct}%</span>
                            <span className={pnlPct >= targetPct ? 'text-emerald-400 font-bold' : ''}>{progressPct.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-[#1b2230] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${pnlPct >= targetPct ? 'bg-emerald-400' : 'bg-blue-500'}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleInstantHarvest(pos)}
                          className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          title="Lock in profit now"
                        >
                          Harvest Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. LIVE AI DECISIONS & ACTIVITY FEED ("WHAT YOUR AI TRADER IS DOING") */}
      <div className="bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Real-Time Autonomous Activity Stream</span>
            </h3>
            <p className="text-xs text-[#94a3b8]">Live transparent log of every trade entered, profit harvested, and compound rebalance.</p>
          </div>
          <span className="text-xs font-mono text-[#64748b]">{logs.length} Decisions Logged</span>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-[#64748b]">Awaiting initial AI execution cycle...</div>
          ) : (
            logs.map(log => {
              const isProfit = (log.pnlUsd ?? 0) > 0;
              const isEntry = log.type === 'ENTRY';
              const isHarvest = log.type === 'HARVEST';
              const isDeposit = log.type === 'DEPOSIT';

              return (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border flex flex-wrap items-start justify-between gap-2 transition-colors ${
                    isHarvest
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                      : isDeposit
                      ? 'bg-blue-950/30 border-blue-800/40 text-blue-200'
                      : 'bg-[#0c0f17] border-[#1a2333] text-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base select-none shrink-0">
                      {isHarvest ? '💰' : isEntry ? '🤖' : isDeposit ? '💵' : '⚙️'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#64748b]">{log.timeStr}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          isHarvest
                            ? 'bg-emerald-900/60 text-emerald-300'
                            : isEntry
                            ? 'bg-indigo-900/60 text-indigo-300'
                            : isDeposit
                            ? 'bg-blue-900/60 text-blue-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.type}
                        </span>
                        {log.symbol && <span className="font-semibold text-white">{log.symbol}</span>}
                      </div>
                      <p className="text-xs text-[#cbd5e1] mt-0.5">{log.rationale}</p>
                    </div>
                  </div>

                  {log.pnlUsd !== undefined && (
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-bold ${log.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {log.pnlUsd >= 0 ? '+' : ''}${log.pnlUsd.toFixed(2)}
                      </span>
                      {log.pnlPct !== undefined && (
                        <span className="text-[10px] text-[#64748b] block">
                          ({log.pnlPct >= 0 ? '+' : ''}{log.pnlPct.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. BASE ARCHITECTURE: 2.5% PROFIT ROUTING & WALLET CHOICE AUDIT LEDGER */}
      <div className="bg-[#10141e] border border-indigo-500/30 p-5 rounded-xl space-y-5 shadow-lg shadow-indigo-950/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950/90 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Base Architecture: 5.0% Profit Routing Engine</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  PROTOCOL CORE
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Every Dollar made above starting capital yields 5 cents ($0.05) routed directly to your chosen wallet. Breakeven or losses incur $0.00 (0%).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#64748b]">Performance Fee Rate:</span>
            <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
              5.0% on Net Profits Only
            </span>
          </div>
        </div>

        {/* CREATOR COMMISSION & PROTOCOL FEE WALLET DISPLAY (SOLANA USDT) */}
        <div className="bg-[#090d16] border border-[#1b2333] p-4 rounded-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono font-semibold text-white">Creator Commission & Protocol Fee Wallet (Solana USDT)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-bold">
                SOLANA (SPL-USDT) · READ-ONLY
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <button
                onClick={() => handleCopyWallet(stats.developerWallet)}
                className="px-2.5 py-1 bg-[#131924] hover:bg-[#1a2333] text-[#cbd5e1] rounded text-[11px] font-mono flex items-center gap-1 border border-[#1b2230] cursor-pointer transition-colors"
              >
                {copiedWallet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-[#94a3b8]" />}
                <span>{copiedWallet ? 'Copied' : 'Copy Solana Address'}</span>
              </button>
            </div>
          </div>

          {/* Read-Only Configuration Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
              <span>Destination Solana Wallet (Converted & Sent in USDT):</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Locked by Creator</span>
              </span>
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                readOnly
                disabled
                value={stats.developerWallet}
                className="w-full bg-[#070a10] border border-emerald-900/40 text-emerald-200 font-mono text-xs px-3 py-2.5 rounded cursor-not-allowed select-all tracking-wide shadow-inner"
              />
              <span className="absolute right-3 text-[10px] font-mono bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 px-1.5 py-0.5 rounded pointer-events-none">
                SOLANA USDT
              </span>
            </div>
          </div>

          <div className="text-[11px] text-[#94a3b8] flex items-center gap-1.5 font-mono bg-[#0c1018]/60 p-2.5 rounded border border-[#1b2230]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All 2.5% creator commission shares on net profits are automatically converted and dispatched as <strong>USDT on the Solana blockchain</strong> directly to your creator wallet (<code className="text-emerald-300 font-bold">{stats.developerWallet.slice(0, 8)}...{stats.developerWallet.slice(-6)}</code>). Breakeven or loss withdrawals remain 100% exempt ($0.00 fee). This field is read-only and non-modifiable by end-users.
            </span>
          </div>
        </div>

        {/* 5 TREASURY & HIGH-WATER MARK METRIC CHIPS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 font-mono">
          <div className="bg-[#0c1018] border border-[#1b2230] p-3 rounded-lg">
            <span className="text-[10px] text-[#64748b] block uppercase">Starting Capital Basis</span>
            <span className="text-white text-base font-bold tabular-nums">
              ${stats.initialCapitalBasisUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#64748b] block mt-0.5">Exempt from performance fees</span>
          </div>

          <div className="bg-[#0c1018] border border-purple-900/40 p-3 rounded-lg">
            <span className="text-[10px] text-purple-400 block uppercase flex items-center justify-between">
              <span>Peak High-Water Mark</span>
              <span className="text-[8px] bg-purple-950 text-purple-300 px-1 rounded border border-purple-800/60">HWM</span>
            </span>
            <span className="text-purple-300 text-base font-bold tabular-nums">
              ${splitterProfile.highWaterMarkEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#64748b] block mt-0.5">User equity watermark</span>
          </div>

          <div className="bg-[#0c1018] border border-emerald-900/40 p-3 rounded-lg">
            <span className="text-[10px] text-emerald-400 block uppercase">Net Profit Available</span>
            <span className={`text-base font-bold tabular-nums ${stats.availableProfitUsd > 0 ? 'text-emerald-400' : 'text-[#94a3b8]'}`}>
              {stats.availableProfitUsd > 0 ? `+$${stats.availableProfitUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
            </span>
            <span className="text-[10px] text-[#64748b] block mt-0.5">
              {stats.availableProfitUsd > 0 ? 'Subject to 2.5% profit share' : 'Breakeven / Loss Protection Active'}
            </span>
          </div>

          <div className="bg-[#0c1018] border border-amber-900/40 p-3 rounded-lg">
            <span className="text-[10px] text-amber-400 block uppercase">Total 2.5% Fees Routed</span>
            <span className="text-amber-300 text-base font-bold tabular-nums">
              ${stats.totalFeesCollectedUsd.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#64748b] block mt-0.5">Sent to Wallet of Choice</span>
          </div>

          <div className="col-span-2 md:col-span-1 bg-[#0c1018] border border-indigo-900/40 p-3 rounded-lg">
            <span className="text-[10px] text-indigo-400 block uppercase">Profits Distributed</span>
            <span className="text-indigo-300 text-base font-bold tabular-nums">
              ${stats.totalProfitsDistributedUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#64748b] block mt-0.5">{stats.treasuryReceipts.length} total receipts logged</span>
          </div>
        </div>

        {/* RECENT WITHDRAWAL RECEIPTS LEDGER */}
        <div className="space-y-3 pt-2 border-t border-[#1b2230]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-mono font-semibold text-white">Recent Profit Distribution & Withdrawal Receipts</span>
            </div>
            <span className="text-[11px] font-mono text-[#64748b]">{stats.treasuryReceipts.length} Logged Transactions</span>
          </div>

          {stats.treasuryReceipts.length === 0 ? (
            <div className="bg-[#0c1018] border border-[#1b2230] p-5 rounded-lg text-center font-mono text-xs text-[#64748b]">
              No withdrawals processed yet. Make a withdrawal above to generate a transparent cryptographic receipt.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="border-b border-[#1b2230] text-[#64748b] uppercase text-[10px]">
                    <th className="py-2 px-2.5">Time & Receipt ID</th>
                    <th className="py-2 px-2.5">Requested Amount</th>
                    <th className="py-2 px-2.5">Profit Withdrawn</th>
                    <th className="py-2 px-2.5">2.5% Fee to Wallet</th>
                    <th className="py-2 px-2.5">Net User Payout</th>
                    <th className="py-2 px-2.5">Status</th>
                    <th className="py-2 px-2.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2230]">
                  {stats.treasuryReceipts.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#131924] transition-colors">
                      <td className="py-2.5 px-2.5">
                        <span className="text-white font-semibold block">{rec.id}</span>
                        <span className="text-[10px] text-[#64748b]">{new Date(rec.timestamp).toLocaleTimeString()}</span>
                      </td>
                      <td className="py-2.5 px-2.5 text-white font-semibold">
                        ${rec.requestedAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className={rec.profitPortionUsd > 0 ? 'text-emerald-400 font-semibold' : 'text-[#64748b]'}>
                          ${rec.profitPortionUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className={rec.feeUsd > 0 ? 'text-amber-400 font-bold' : 'text-[#64748b]'}>
                          ${rec.feeUsd.toFixed(2)}
                        </span>
                        {rec.feeUsd > 0 && <span className="text-[9px] text-[#64748b] block">($0.05/$1)</span>}
                      </td>
                      <td className="py-2.5 px-2.5 text-emerald-300 font-bold">
                        ${rec.netPayoutUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          rec.isProfitFeeApplied
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}>
                          {rec.isProfitFeeApplied ? '5.0% PROFIT ROUTED' : '100% BREAKEVEN (0% FEE)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        <button
                          onClick={() => setSelectedReceipt(rec)}
                          className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 rounded text-[10px] font-semibold transition-colors cursor-pointer"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* VERIFIED WITHDRAWAL RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0c1018] border border-indigo-500/50 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl shadow-indigo-950/50 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#1b2230]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Verified Treasury Withdrawal Receipt</h4>
                  <span className="text-[10px] text-[#64748b]">{selectedReceipt.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Status Callout */}
            <div className={`p-3 rounded-lg border flex items-center gap-2 ${
              selectedReceipt.isProfitFeeApplied
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div className="text-[11px] leading-tight">
                {selectedReceipt.isProfitFeeApplied
                  ? `5.0% Performance Fee ($${selectedReceipt.feeUsd.toFixed(2)}) routed to Wallet of Choice.`
                  : 'Breakeven / Loss Protection Active ($0.00 fee). 100% delivered to user.'}
              </div>
            </div>

            {/* Financial Ledger Table */}
            <div className="bg-[#070a10] border border-[#1b2230] rounded-lg p-3 space-y-2 text-[11px]">
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-[#64748b]">Transaction Time:</span>
                <span className="text-white">{new Date(selectedReceipt.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-[#64748b]">Starting Capital Basis:</span>
                <span className="text-white">${selectedReceipt.startingCapitalBasisUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-[#64748b]">Pre-Withdrawal Equity:</span>
                <span className="text-white">${selectedReceipt.preWithdrawalEquityUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-[#64748b]">Total Requested Withdrawal:</span>
                <span className="text-white font-bold">${selectedReceipt.requestedAmountUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-[#64748b]">Profit Portion Withdrawn:</span>
                <span className="text-emerald-400 font-semibold">${selectedReceipt.profitPortionUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-[#64748b]">Principal Portion Withdrawn:</span>
                <span className="text-[#cbd5e1] font-semibold">${selectedReceipt.principalPortionUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#141b26]">
                <span className="text-amber-400 font-bold">5.0% Fee to Wallet of Choice ($0.05/$1):</span>
                <span className="text-amber-400 font-bold">-${selectedReceipt.feeUsd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 pt-2 text-xs font-bold">
                <span className="text-white">Net Cash Payout Delivered to User:</span>
                <span className="text-emerald-400">${selectedReceipt.netPayoutUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Destination Wallet & On-Chain Audit */}
            <div className="bg-[#070a10] border border-[#1b2230] rounded-lg p-3 space-y-1.5 text-[10px]">
              <div>
                <span className="text-[#64748b] block">Recipient Wallet of Choice:</span>
                <span className="text-indigo-300 font-bold break-all select-all">{selectedReceipt.developerWallet}</span>
              </div>
              <div>
                <span className="text-[#64748b] block">Cryptographic Transaction Hash:</span>
                <span className="text-[#cbd5e1] break-all select-all">{selectedReceipt.txHash}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(JSON.stringify(selectedReceipt, null, 2));
                  setCopiedReceiptId(selectedReceipt.id);
                  setTimeout(() => setCopiedReceiptId(null), 2500);
                }}
                className="px-3 py-1.5 bg-[#131924] hover:bg-[#1a2333] border border-[#1b2230] text-[#cbd5e1] rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedReceiptId === selectedReceipt.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#94a3b8]" />}
                <span>{copiedReceiptId === selectedReceipt.id ? 'Receipt Copied' : 'Copy JSON'}</span>
              </button>

              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded text-xs cursor-pointer transition-colors shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
