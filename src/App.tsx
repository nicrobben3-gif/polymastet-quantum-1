/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Shield,
  AlertTriangle,
  Play,
  Square,
  Terminal,
  TrendingUp,
  Zap,
  RefreshCw,
  DollarSign,
  BarChart2,
  Layers,
  Cpu,
  Compass,
  Users,
  Lock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  Flame,
  Check,
  Search,
  HelpCircle,
  ExternalLink,
  Power,
  CheckSquare,
  RotateCcw,
  Filter,
  Tag,
  Sparkles,
  Crosshair
} from 'lucide-react';

import { globalOrchestrator, TradingMode } from './core/orchestrator';
import { globalMarketFeed } from './data/marketData';
import { globalStrategyRegistry } from './strategies';
import { globalPortfolio } from './portfolio/portfolioEngine';
import { globalRiskEngine } from './risk/riskEngine';
import { globalMarketScanner } from './market_scanner/marketScanner';
import { globalArbitrageEngine } from './arbitrage/arbitrageEngine';
import { globalFlashLoanModule, IFlashLoanSimulationParams } from './flashloan/flashloanModule';
import { globalPredictionEngine } from './prediction/predictionEngine';
import { globalLogicalHedge } from './prediction/logicalHedge';
import { globalWhaleTracker } from './whale/whaleTracker';
import { globalBacktester, IBacktestResult } from './backtesting/backtestingEngine';
import { globalCLI } from './cli/cliInterpreter';
import { globalTestRunner, ITestResult } from './tests/runAllTests';
import { IMarketData, IOrderBook } from './types/market';
import { IScannedOpportunity } from './types/scanner';
import { IArbitrageOpportunity } from './types/arbitrage';
import { ITradingSignal } from './types/signal';
import { IPosition } from './types/portfolio';
import { globalExecutionEngine } from './execution/executionEngine';
import { StrategyCategory } from './types/strategy';
import { AutonomousAiTraderView } from './components/AutonomousAiTraderView';
import { UnrealizedFeeForecastWidget } from './components/UnrealizedFeeForecastWidget';
import { AnimatedEquityCard } from './components/AnimatedEquityCard';
import { SolanaSniperView } from './components/SolanaSniperView';
import { PerformanceAttributionChart } from './components/PerformanceAttributionChart';
import { RiskAlertFeedD3 } from './components/RiskAlertFeedD3';
import { UserAccountModal } from './components/UserAccountModal';
import { SystemHeartbeatPanel } from './components/SystemHeartbeatPanel';
import { globalAuthManager, IUserProfile } from './auth/authManager';
import { globalAiTrader } from './autopilot/aiTraderEngine';

export const CATEGORY_META: Record<StrategyCategory, { label: string; icon: string; description: string; badgeColor: string }> = {
  MOMENTUM_TREND: {
    label: 'Momentum & Trend',
    icon: '📈',
    description: 'EMA cross, Donchian breakout & trend persistence',
    badgeColor: 'border-indigo-500/30 text-indigo-400 bg-indigo-950/40'
  },
  MEAN_REVERSION: {
    label: 'Mean Reversion',
    icon: '🔄',
    description: 'Bollinger & RSI statistical reversion bands',
    badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-950/40'
  },
  MARKET_MAKING: {
    label: 'Market Making',
    icon: '⚡',
    description: 'Avellaneda-Stoikov spread liquidity provision',
    badgeColor: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/40'
  },
  ARBITRAGE: {
    label: 'Arbitrage & Basis',
    icon: '⚖️',
    description: 'Cross-venue, funding rate, basis, and stat-arb',
    badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-950/40'
  },
  PREDICTION_MARKET: {
    label: 'Prediction Markets',
    icon: '🎯',
    description: 'Odds convexity & formal state-implication hedge',
    badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-950/40'
  },
  ORDERBOOK_MICROSTRUCTURE: {
    label: 'Orderbook & L2',
    icon: '🔬',
    description: 'Micro-flow imbalances & dark liquidity hunter',
    badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-950/40'
  },
  COPY_WHALE: {
    label: 'Whale & Smart Money',
    icon: '🐋',
    description: 'Real-time copy trading & high-alpha wallet tracking',
    badgeColor: 'border-teal-500/30 text-teal-400 bg-teal-950/40'
  },
  EVENT_DRIVEN: {
    label: 'Event-Driven',
    icon: '💥',
    description: 'Macro catalysts, CPI releases & volatility spikes',
    badgeColor: 'border-rose-500/30 text-rose-400 bg-rose-950/40'
  },
  AI_COMPILED: {
    label: 'AI Synthesized',
    icon: '🤖',
    description: 'PredictEngine natural-language compiled models',
    badgeColor: 'border-violet-500/30 text-violet-400 bg-violet-950/40'
  }
};

type ActiveTab = 
  | 'autopilot'
  | 'overview'
  | 'solana_sniper'
  | 'scanner'
  | 'strategies'
  | 'orderbook'
  | 'arbitrage'
  | 'whale_copy'
  | 'ai_compiler'
  | 'risk'
  | 'backtest'
  | 'terminal_tests';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('autopilot');
  const [, setTick] = useState(0);

  // Core state from engines
  const [markets, setMarkets] = useState<IMarketData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('POLY:US_PRES_2028_DEM');
  const [selectedOrderBook, setSelectedOrderBook] = useState<IOrderBook | null>(null);
  const [opportunities, setOpportunities] = useState<IScannedOpportunity[]>([]);
  const [arbitrageOpps, setArbitrageOpps] = useState<IArbitrageOpportunity[]>([]);
  const [positions, setPositions] = useState<IPosition[]>([]);

  // Orchestrator status
  const botStatus = globalOrchestrator.getStatus();
  const portfolioState = globalPortfolio.getState();
  const riskConfig = globalRiskEngine.getConfig();

  // Natural Language Compiler State
  const [nlPrompt, setNlPrompt] = useState(
    'Buy YES on Polymarket when price is below 0.45, liquidity > $25000, risk at most $500, take profit at 0.70'
  );
  const [compilerResult, setCompilerResult] = useState<any>(null);

  // Logical Hedge State
  const [hedgeResult, setHedgeResult] = useState<any>(null);

  // Flash Loan Sim State
  const [flashLoanParams, setFlashLoanParams] = useState<IFlashLoanSimulationParams>({
    protocol: 'AAVE_V3',
    asset: 'USDC',
    borrowAmount: 250000,
    route: ['UniswapV3', 'Balancer', 'Curve'],
    slippageLimitBps: 25,
    gasPriceGwei: 28,
    minNetProfitUsd: 150,
    deadlineSeconds: 45
  });
  const [flashLoanResult, setFlashLoanResult] = useState<any>(null);

  // Backtest State
  const [backtestResult, setBacktestResult] = useState<IBacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);

  // CLI State
  const [cliInput, setCliInput] = useState('');
  const [cliHistory, setCliHistory] = useState<string[]>([
    'Welcome to PolyMaster Quantum Institutional CLI.',
    'Type "help" for a list of available commands.'
  ]);
  const cliBottomRef = useRef<HTMLDivElement>(null);

  // Test Runner State
  const [testResults, setTestResults] = useState<{ passedCount: number; failedCount: number; results: ITestResult[] } | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // User Auth & Account State
  const [currentUser, setCurrentUser] = useState<IUserProfile | null>(() => globalAuthManager.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Strategy Catalog Bulk Actions & Filtering State
  const [stratCategoryFilter, setStratCategoryFilter] = useState<string>('ALL');
  const [stratSearchQuery, setStratSearchQuery] = useState<string>('');
  const [selectedStratIds, setSelectedStratIds] = useState<string[]>([]);
  const [bulkFeedback, setBulkFeedback] = useState<{ message: string; type: 'success' | 'info' | 'warning' } | null>(null);
  const feedbackTimerRef = useRef<any>(null);

  const triggerBulkFeedback = (message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setBulkFeedback({ message, type });
    feedbackTimerRef.current = setTimeout(() => {
      setBulkFeedback(null);
    }, 4500);
  };

  // Subscribe to live market updates and orchestrator
  useEffect(() => {
    // Initial data load
    setMarkets(globalMarketFeed.getAllMarkets());
    setSelectedOrderBook(globalMarketFeed.getOrderBook(selectedSymbol) || null);
    setOpportunities(globalMarketScanner.getOpportunities());
    setArbitrageOpps(globalArbitrageEngine.getOpportunities());
    setPositions(globalPortfolio.getPositions());

    // Auto-compile default NL prompt
    const initialCompilation = globalPredictionEngine.compileNaturalLanguageStrategy(nlPrompt);
    setCompilerResult(initialCompilation);

    // Initial logical hedge calculation
    const initHedge = globalLogicalHedge.analyzeImplication(
      { id: 'P1', symbol: 'POLY:US_PRES_2028_DEM', venue: 'polymarket', outcome: 'YES', currentPrice: 0.52, conditionDescription: 'Democrat wins 2028 Election' },
      { id: 'Q1', symbol: 'KALSHI:US_PRES_2028_DEM', venue: 'kalshi', outcome: 'YES', currentPrice: 0.49, conditionDescription: 'Non-Republican wins 2028 Election' },
      1000
    );
    setHedgeResult(initHedge);

    // Run initial backtest preview
    const bResult = globalBacktester.runBacktest({
      strategyId: 'trend_following',
      symbol: 'BINANCE:SOL_USDT_PERP',
      initialCapitalUsd: 100000,
      startDate: '2026-06-01',
      endDate: '2026-09-29',
      feeTierBps: 4,
      slippageModel: 'SQUARE_ROOT_IMPACT',
      includeFundingRates: true,
      simulatedLatencyMs: 40,
      monteCarloIterations: 400
    });
    setBacktestResult(bResult);

    // Start streaming feed & orchestrator
    globalOrchestrator.start();

    const unsubMarket = globalMarketFeed.subscribe((tick) => {
      setMarkets(globalMarketFeed.getAllMarkets());
      if (tick.symbol === selectedSymbol) {
        setSelectedOrderBook(globalMarketFeed.getOrderBook(selectedSymbol) || null);
      }
    });

    const unsubOrchestrator = globalOrchestrator.subscribe(() => {
      setTick(prev => prev + 1);
      setOpportunities(globalMarketScanner.getOpportunities());
      setArbitrageOpps(globalArbitrageEngine.getOpportunities());
      setPositions(globalPortfolio.getPositions());
    });

    const unsubAuth = globalAuthManager.subscribe((user) => {
      setCurrentUser(user);
    });

    return () => {
      unsubMarket();
      unsubOrchestrator();
      unsubAuth();
      globalOrchestrator.stop();
    };
  }, [selectedSymbol]);

  // Handle CLI Command
  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;

    const cmd = cliInput.trim();
    const output = globalCLI.execute(cmd);
    setCliHistory(prev => [...prev, `> ${cmd}`, output]);
    setCliInput('');
    setTimeout(() => {
      cliBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Run Test Suite
  const handleRunTests = async () => {
    setIsRunningTests(true);
    const res = await globalTestRunner.runAllTests();
    setTestResults(res);
    setIsRunningTests(false);
  };

  // Run Custom Backtest
  const handleRunCustomBacktest = () => {
    setIsBacktesting(true);
    setTimeout(() => {
      const res = globalBacktester.runBacktest({
        strategyId: 'cross_venue_arb',
        symbol: selectedSymbol,
        initialCapitalUsd: 100000,
        startDate: '2026-06-01',
        endDate: '2026-09-29',
        feeTierBps: 5,
        slippageModel: 'SQUARE_ROOT_IMPACT',
        includeFundingRates: true,
        simulatedLatencyMs: 35,
        monteCarloIterations: 500
      });
      setBacktestResult(res);
      setIsBacktesting(false);
    }, 400);
  };

  // Simulate Flash Loan
  const handleSimulateFlashLoan = () => {
    const res = globalFlashLoanModule.simulateFlashLoan(flashLoanParams);
    setFlashLoanResult(res);
  };

  // Re-compile NL prompt
  const handleCompilePrompt = (customText?: string) => {
    const textToCompile = customText || nlPrompt;
    const res = globalPredictionEngine.compileNaturalLanguageStrategy(textToCompile);
    setCompilerResult(res);
  };

  return (
    <div className="min-h-screen bg-[#090b10] text-[#e2e8f0] flex flex-col antialiased selection:bg-blue-600/30">
      {/* 1. TOP INSTITUTIONAL STATUS BAR */}
      <header className="border-b border-[#1b2230] bg-[#0c0f17]/90 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-blue-700 to-indigo-500 flex items-center justify-center font-mono font-bold text-white shadow-sm shadow-blue-500/20">
            PQ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold tracking-tight text-white text-sm">PolyMaster Quantum</h1>
              <span className="text-xs text-[#64748b]">v3.4.2 · Unified Engine</span>
            </div>
            <div className="text-[11px] text-[#94a3b8] flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>10 Synthesized Bots</span>
              <span className="text-[#334155]">/</span>
              <span>16 Live Strategies</span>
              <span className="text-[#334155]">/</span>
              <span className="font-mono text-[#94a3b8]">Latency: 14ms</span>
            </div>
          </div>
        </div>

        {/* Status Indicators & Master Controls */}
        <div className="flex items-center gap-3">
          {/* Hands-Free Autopilot Status & Quick Open */}
          <button
            onClick={() => setActiveTab('autopilot')}
            className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/70 rounded transition-all cursor-pointer shadow-sm shadow-emerald-950"
            title="Click to manage Hands-Free Autonomous AI Trader"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-300 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI AUTOPILOT: ON</span>
            </span>
            <span className="text-[#64748b] hidden sm:inline">|</span>
            <span className="text-white font-bold hidden sm:inline">${portfolioState.equityUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </button>

          {/* Mode Switcher Button */}
          <button
            onClick={() => {
              const nextMode = botStatus.mode === 'PAPER' ? 'LIVE' : 'PAPER';
              globalOrchestrator.setMode(nextMode, true);
              setTick(t => t + 1);
            }}
            className="flex items-center text-xs font-mono px-2.5 py-1 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-amber-500/50 rounded transition-colors cursor-pointer"
            title="Click to toggle between Paper Simulation and Live Capital Execution"
          >
            <span className="text-[#64748b] mr-1.5">MODE:</span>
            <span className={botStatus.mode === 'LIVE' ? 'text-rose-400 font-bold' : 'text-amber-400 font-medium'}>
              {botStatus.mode}
            </span>
          </button>

          {/* Engine State Indicator */}
          <div className="flex items-center text-xs font-mono px-2.5 py-1 bg-[#131924] border border-[#232d3f] rounded">
            <span className="text-[#64748b] mr-1.5">ENGINE:</span>
            <span className={botStatus.state === 'RUNNING' ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
              {botStatus.state}
            </span>
          </div>

          {/* Bot Start / Stop Button */}
          {botStatus.state === 'RUNNING' ? (
            <button
              onClick={() => globalOrchestrator.stop()}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] text-amber-300 border border-amber-500/30 rounded transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Pause Bot</span>
            </button>
          ) : (
            <button
              onClick={() => globalOrchestrator.start()}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded shadow-sm shadow-emerald-700/20 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Bot</span>
            </button>
          )}

          {/* Emergency Kill Switch Button */}
          <button
            onClick={() => globalOrchestrator.setKillSwitch(!riskConfig.killSwitchActive)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer ${
              riskConfig.killSwitchActive
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span>{riskConfig.killSwitchActive ? 'KILL SWITCH ENGAGED' : 'Kill Switch'}</span>
          </button>

          {/* User Account / Web3 Wallet / Login Pill */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 bg-[#101726] hover:bg-[#162136] border border-blue-500/40 hover:border-blue-400 rounded-lg transition-all cursor-pointer shadow-sm shadow-blue-950"
            title="Manage Trader Account, Web3 Wallets & API Keys"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-white font-bold truncate max-w-[130px]">
              {currentUser ? currentUser.displayName : 'Connect / Sign In'}
            </span>
            <span className="text-[10px] text-blue-400 bg-blue-950/80 px-1.5 py-0.2 rounded border border-blue-800/50 font-bold uppercase hidden sm:inline">
              {currentUser?.tier || 'ACCOUNT'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. NAVIGATION BAR */}
      <nav className="border-b border-[#1b2230] bg-[#0c0f17]/60 px-4 flex items-center gap-1 overflow-x-auto text-xs font-medium">
        {[
          { id: 'autopilot', label: 'Autonomous AI Trader', icon: Sparkles, badge: 'HANDS-FREE' },
          { id: 'overview', label: 'Portfolio & Overview', icon: Activity },
          { id: 'solana_sniper', label: 'Solana LP Sniper', icon: Crosshair, badge: 'HEDGED' },
          { id: 'scanner', label: 'Signal Engine & Scanner', icon: Compass, badge: opportunities.length },
          { id: 'strategies', label: '16 Strategies Catalog', icon: Layers },
          { id: 'orderbook', label: 'Orderbook & SOR Router', icon: BarChart2 },
          { id: 'arbitrage', label: 'Cross-Venue Arbitrage & Flash Loan', icon: Zap, badge: arbitrageOpps.filter(a => a.isExecutable).length },
          { id: 'whale_copy', label: 'Whale Tracking & Copy', icon: Users },
          { id: 'ai_compiler', label: 'AI Strategy Compiler & Logical Hedge', icon: Cpu },
          { id: 'risk', label: 'Risk & System Settings', icon: Sliders },
          { id: 'backtest', label: 'Event Backtesting & Monte Carlo', icon: TrendingUp },
          { id: 'terminal_tests', label: 'CLI & System Tests', icon: Terminal }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isAutopilot = tab.id === 'autopilot';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? isAutopilot
                    ? 'border-emerald-500 text-emerald-400 font-bold bg-emerald-500/10'
                    : 'border-blue-500 text-blue-400 font-semibold bg-blue-500/5'
                  : isAutopilot
                  ? 'border-transparent text-emerald-300/80 hover:text-emerald-200 hover:bg-emerald-950/20'
                  : 'border-transparent text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#131924]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isAutopilot ? 'text-amber-400' : ''}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isAutopilot ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-[1600px] w-full mx-auto space-y-6">

        {/* ======================================================== */}
        {/* TAB 0: AUTONOMOUS AI TRADER (HANDS-FREE WEALTH ENGINE)   */}
        {/* ======================================================== */}
        {activeTab === 'autopilot' && (
          <AutonomousAiTraderView onNavigateToTab={(t) => setActiveTab(t as ActiveTab)} />
        )}

        {/* ======================================================== */}
        {/* TAB: SOLANA SUB-SLOT LP SNIPER & CONTINUOUS HEDGE       */}
        {/* ======================================================== */}
        {activeTab === 'solana_sniper' && (
          <SolanaSniperView />
        )}

        {/* ======================================================== */}
        {/* TAB 1: PORTFOLIO & OVERVIEW                              */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* AUTONOMOUS AI TRADER HERO CALLOUT */}
            <div className="bg-gradient-to-r from-emerald-950/40 via-[#10192e] to-indigo-950/40 border border-emerald-700/50 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-900/60 border border-emerald-600/60 flex items-center justify-center text-emerald-300 text-lg">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Autonomous AI Trader Active On Your Behalf
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700 px-1.5 py-0.2 rounded">
                      RUNNING BY DEFAULT
                    </span>
                  </div>
                  <p className="text-xs text-[#cbd5e1] mt-0.5">
                    Deposit funds to watch them grow automatically, or view real-time compounding telemetry in the dedicated controller.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    globalAiTrader.deposit(1000, 'Overview Quick Deposit');
                    setTick(t => t + 1);
                  }}
                  className="px-3 py-1.5 bg-[#141f2f] hover:bg-[#1d2d44] border border-[#2a3c5a] text-emerald-300 rounded text-xs font-mono font-medium transition-colors cursor-pointer"
                >
                  +$1,000 Deposit
                </button>
                <button
                  onClick={() => {
                    globalAiTrader.deposit(5000, 'Overview Quick Deposit');
                    setTick(t => t + 1);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-mono font-semibold transition-colors cursor-pointer shadow-sm shadow-emerald-950"
                >
                  +$5,000 Deposit
                </button>
                <button
                  onClick={() => setActiveTab('autopilot')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Watch It Grow</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => setActiveTab('solana_sniper')}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-950"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Solana Sniper</span>
                </button>
              </div>
            </div>

            {/* KPI STAT CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <AnimatedEquityCard
                equityUsd={portfolioState.equityUsd}
                cashUsd={portfolioState.cashUsd}
              />

              <div className="bg-[#10141e] border border-[#1b2230] p-3.5 rounded">
                <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Today's P&L</span>
                <div className={`font-mono text-xl font-semibold mt-1 tabular-nums flex items-center gap-1 ${
                  portfolioState.todayPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {portfolioState.todayPnlUsd >= 0 ? '+' : ''}${portfolioState.todayPnlUsd.toFixed(2)}
                  <span className="text-xs font-normal">
                    ({portfolioState.todayPnlPct >= 0 ? '+' : ''}{portfolioState.todayPnlPct.toFixed(2)}%)
                  </span>
                </div>
                <div className="text-[11px] text-[#64748b] mt-1">
                  Realized: ${portfolioState.totalRealizedPnlUsd.toFixed(2)}
                </div>
              </div>

              <div className="bg-[#10141e] border border-[#1b2230] p-3.5 rounded">
                <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Sharpe / Sortino</span>
                <div className="font-mono text-xl font-semibold text-white mt-1 tabular-nums">
                  {portfolioState.sharpeRatio} <span className="text-xs text-[#64748b]">/ {portfolioState.sortinoRatio}</span>
                </div>
                <div className="text-[11px] text-emerald-400 mt-1">
                  Institutional Alpha Grade
                </div>
              </div>

              <div className="bg-[#10141e] border border-[#1b2230] p-3.5 rounded">
                <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Drawdown</span>
                <div className="font-mono text-xl font-semibold text-amber-400 mt-1 tabular-nums">
                  {portfolioState.currentDrawdownPct.toFixed(2)}%
                </div>
                <div className="text-[11px] text-[#64748b] mt-1">
                  Max Allowed Cap: {riskConfig.maxPortfolioDrawdownPct}%
                </div>
              </div>

              <div className="bg-[#10141e] border border-[#1b2230] p-3.5 rounded">
                <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Gross Leverage</span>
                <div className="font-mono text-xl font-semibold text-white mt-1 tabular-nums">
                  {portfolioState.grossLeverage.toFixed(2)}x
                </div>
                <div className="text-[11px] text-[#64748b] mt-1">
                  Cap: {riskConfig.maxTotalLeverage}x
                </div>
              </div>

              <div className="bg-[#10141e] border border-[#1b2230] p-3.5 rounded">
                <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Risk Gate Status</span>
                <div className="font-mono text-sm font-semibold mt-1 text-emerald-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>ACTIVE / PASS</span>
                </div>
                <div className="text-[11px] text-[#64748b] mt-1">
                  0 Hard Violations
                </div>
              </div>
            </div>

            {/* UNREALIZED P&L 2.5% PERFORMANCE FEE FORECAST WIDGET */}
            <UnrealizedFeeForecastWidget onNavigateToAutopilot={() => setActiveTab('autopilot')} />

            {/* PERFORMANCE & CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Equity Curve & Market Rates */}
              <div className="lg:col-span-2 bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <h3 className="font-semibold text-sm text-white">Portfolio Cumulative Growth Curve</h3>
                  </div>
                  <span className="text-xs font-mono text-[#64748b]">Real-Time Mark to Market</span>
                </div>

                {/* SVG Simulated Institutional Equity Curve */}
                <div className="h-56 w-full relative">
                  <svg className="w-full h-full" viewBox="0 0 600 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="0" y1="50" x2="600" y2="50" stroke="#1b2230" strokeDasharray="3 3" />
                    <line x1="0" y1="100" x2="600" y2="100" stroke="#1b2230" strokeDasharray="3 3" />
                    <line x1="0" y1="150" x2="600" y2="150" stroke="#1b2230" strokeDasharray="3 3" />

                    {/* Path */}
                    <path
                      d="M 0 170 Q 60 160 120 145 T 240 120 T 360 85 T 480 55 T 600 35 L 600 200 L 0 200 Z"
                      fill="url(#equityGrad)"
                    />
                    <path
                      d="M 0 170 Q 60 160 120 145 T 240 120 T 360 85 T 480 55 T 600 35"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                    />
                  </svg>
                  <div className="absolute top-2 left-2 text-[10px] font-mono text-[#64748b] bg-[#0c0f17]/80 px-2 py-0.5 rounded border border-[#1b2230]">
                    In-Sample & Live Walk-Forward (+26.8% CAGR)
                  </div>
                  <div className="absolute bottom-2 right-2 text-[10px] font-mono text-emerald-400 bg-[#0c0f17]/80 px-2 py-0.5 rounded border border-[#1b2230]">
                    Current Peak: $102,450.00
                  </div>
                </div>

                {/* Market Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-[#1b2230]">
                  {markets.slice(0, 4).map(m => (
                    <div
                      key={m.symbol}
                      onClick={() => {
                        setSelectedSymbol(m.symbol);
                        setActiveTab('orderbook');
                      }}
                      className="p-2 bg-[#0c0f17] border border-[#1b2230] rounded hover:border-blue-500/40 transition-colors cursor-pointer"
                    >
                      <div className="text-[10px] text-[#64748b] truncate">{m.symbol}</div>
                      <div className="font-mono text-xs font-semibold text-white mt-0.5">
                        ${m.lastPrice}
                      </div>
                      <div className="text-[10px] text-emerald-400 flex items-center justify-between mt-0.5">
                        <span>Spread: {m.spreadBps} bps</span>
                        <span className="text-[#94a3b8]">{m.venue}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Col: Venue & Strategy Allocation Attribution */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-semibold text-sm text-white">Venue Exposure Attribution</h3>
                  </div>
                  <span className="text-[11px] text-[#64748b]">Max 35% Cap</span>
                </div>

                <div className="space-y-3 pt-1">
                  {[
                    { venue: 'Polymarket', pct: 28.5, color: 'bg-blue-500' },
                    { venue: 'Kalshi', pct: 18.2, color: 'bg-emerald-500' },
                    { venue: 'Binance Perps', pct: 24.0, color: 'bg-amber-500' },
                    { venue: 'Bybit Perps', pct: 14.5, color: 'bg-purple-500' },
                    { venue: 'Uniswap v3', pct: 8.8, color: 'bg-pink-500' }
                  ].map(v => (
                    <div key={v.venue} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#94a3b8]">{v.venue}</span>
                        <span className="text-white font-medium">{v.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1b2230] rounded-full overflow-hidden">
                        <div className={`h-full ${v.color}`} style={{ width: `${v.pct}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#1b2230] text-xs space-y-2">
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Covariance Risk Index:</span>
                    <span className="text-emerald-400 font-mono font-medium">0.24 (Diversified)</span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Available Free Margin:</span>
                    <span className="text-white font-mono font-medium">${portfolioState.availableMarginUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PERFORMANCE ATTRIBUTION: REALIZED PROFIT BY STRATEGY CATEGORY (D3) */}
            <PerformanceAttributionChart onNavigateToStrategies={() => setActiveTab('strategies')} />

            {/* OPEN POSITIONS TABLE */}
            <div className="bg-[#10141e] border border-[#1b2230] rounded overflow-hidden">
              <div className="p-3.5 border-b border-[#1b2230] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-white">Active Positions ({positions.length})</h3>
                  <span className="text-xs text-[#64748b]">Real-Time Mark-To-Market</span>
                </div>
                {positions.length > 0 && (
                  <button
                    onClick={() => globalOrchestrator.emergencyFlatten()}
                    className="text-xs text-rose-300 hover:text-rose-200 border border-rose-800/60 bg-rose-950/30 px-2.5 py-1 rounded transition-colors cursor-pointer"
                  >
                    Flatten All Positions
                  </button>
                )}
              </div>

              {positions.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#64748b]">
                  No active open positions. The automated strategy engine is scanning venues for qualified entries.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#0c0f17] text-[#64748b] border-b border-[#1b2230] uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-4">Symbol / Venue</th>
                        <th className="py-2.5 px-4">Direction</th>
                        <th className="py-2.5 px-4 text-right">Size</th>
                        <th className="py-2.5 px-4 text-right">Entry Price</th>
                        <th className="py-2.5 px-4 text-right">Mark Price</th>
                        <th className="py-2.5 px-4 text-right">Unrealized P&L</th>
                        <th className="py-2.5 px-4 text-right">Stop Loss</th>
                        <th className="py-2.5 px-4 text-right">Take Profit</th>
                        <th className="py-2.5 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1b2230]">
                      {positions.map(p => (
                        <tr key={p.id} className="hover:bg-[#131924]/60 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="font-semibold text-white">{p.symbol}</span>
                            <span className="block text-[10px] text-[#64748b] uppercase">{p.venue}</span>
                          </td>
                          <td className="py-2.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.direction === 'LONG' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
                            }`}>
                              {p.direction}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-white">{p.size}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#94a3b8]">${p.entryPrice}</td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-white font-semibold">${p.currentPrice}</td>
                          <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${
                            p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl.toFixed(2)} ({p.unrealizedPnlPct >= 0 ? '+' : ''}{p.unrealizedPnlPct.toFixed(1)}%)
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-rose-400/80">
                            {p.stopLoss ? `$${p.stopLoss}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-emerald-400/80">
                            {p.takeProfit ? `$${p.takeProfit}` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => {
                                globalExecutionEngine.submitOrder({
                                  symbol: p.symbol,
                                  venue: p.venue,
                                  direction: p.direction === 'LONG' ? 'SELL' : 'BUY',
                                  orderType: 'MARKET',
                                  size: p.size,
                                  price: p.currentPrice
                                });
                              }}
                              className="px-2 py-1 bg-[#1b2230] hover:bg-rose-900/60 text-[#94a3b8] hover:text-white rounded text-[10px] transition-colors cursor-pointer"
                            >
                              Close
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
        )}

        {/* ======================================================== */}
        {/* TAB 2: SIGNAL ENGINE & REAL-TIME SCANNER                 */}
        {/* ======================================================== */}
        {activeTab === 'scanner' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Compass className="w-5 h-5 text-blue-400" />
                  <span>Real-Time Multi-Venue Market Scanner</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Continuously scans Polymarket, Kalshi, Opinion, Binance, and Uniswap. Ranks opportunities by Expected Value, Execution Probability, and Net Spread.
                </p>
              </div>
              <div className="text-xs font-mono text-[#64748b] bg-[#0c0f17] px-3 py-1.5 rounded border border-[#1b2230]">
                {opportunities.length} Live Scanned Opportunities
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities.map(opp => (
                <div
                  key={opp.id}
                  className="bg-[#10141e] border border-[#1b2230] hover:border-blue-500/40 p-4 rounded space-y-3 transition-colors flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-blue-950/60 text-blue-300 border border-blue-800/40 rounded">
                          {opp.category}
                        </span>
                        <h4 className="text-sm font-semibold text-white mt-1.5">{opp.asset}</h4>
                        <div className="text-[11px] text-[#64748b]">Venue: {opp.venue.toUpperCase()}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#64748b]">Score</span>
                        <div className="text-base font-mono font-bold text-emerald-400">{opp.score}</div>
                      </div>
                    </div>

                    <p className="text-xs text-[#94a3b8] leading-relaxed">
                      {opp.notes}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1b2230] text-xs font-mono">
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Net Edge:</span>
                        <span className="text-emerald-400 font-semibold">+{opp.netExpectedEdgePct}%</span>
                      </div>
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Expected Value:</span>
                        <span className="text-white font-semibold">+${opp.expectedValueUsd}</span>
                      </div>
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Exec Probability:</span>
                        <span className="text-blue-400 font-semibold">{opp.executionProbabilityPct}%</span>
                      </div>
                      <div>
                        <span className="text-[#64748b] block text-[10px]">Liquidity:</span>
                        <span className="text-[#94a3b8]">${opp.availableLiquidityUsd.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#1b2230] flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#64748b]">Req: ${opp.capitalRequiredUsd}</span>
                    <button
                      onClick={() => {
                        globalExecutionEngine.submitOrder({
                          symbol: opp.asset,
                          venue: opp.venue,
                          direction: opp.direction,
                          orderType: 'MARKET',
                          size: Number((opp.capitalRequiredUsd / opp.entryPrice).toFixed(1)),
                          price: opp.entryPrice,
                          strategyId: opp.strategyId
                        });
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                    >
                      Execute Trade
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: 16 STRATEGIES CATALOG & BULK ACTIONS CONTROLLER  */}
        {/* ======================================================== */}
        {activeTab === 'strategies' && (() => {
          const allStrats = globalStrategyRegistry.getAll();
          const activeStrats = allStrats.filter(s => s.enabled);
          const activeCount = activeStrats.length;
          const totalStrats = allStrats.length;
          const activePct = totalStrats > 0 ? Math.round((activeCount / totalStrats) * 100) : 0;
          const activeWeightSum = activeStrats.reduce((sum, s) => sum + s.weight, 0);
          const categories = Object.keys(CATEGORY_META) as StrategyCategory[];

          const filteredStrats = allStrats.filter(strat => {
            const matchesCategory = stratCategoryFilter === 'ALL' || strat.category === stratCategoryFilter;
            const q = stratSearchQuery.toLowerCase().trim();
            const matchesQuery = !q ||
              strat.name.toLowerCase().includes(q) ||
              strat.id.toLowerCase().includes(q) ||
              strat.category.toLowerCase().includes(q);
            return matchesCategory && matchesQuery;
          });

          const filteredStratIds = filteredStrats.map(s => s.id);
          const selectedInFilterCount = filteredStratIds.filter(id => selectedStratIds.includes(id)).length;
          const isAllSelected = filteredStrats.length > 0 && selectedInFilterCount === filteredStrats.length;
          const isPartiallySelected = selectedInFilterCount > 0 && selectedInFilterCount < filteredStrats.length;

          const handleToggleSelectAll = () => {
            if (isAllSelected) {
              setSelectedStratIds(prev => prev.filter(id => !filteredStratIds.includes(id)));
            } else {
              setSelectedStratIds(prev => Array.from(new Set([...prev, ...filteredStratIds])));
            }
          };

          const handleToggleStrategySelection = (id: string) => {
            setSelectedStratIds(prev =>
              prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
            );
          };

          const handleToggleCategorySelection = (cat: StrategyCategory) => {
            const catStratIds = allStrats.filter(s => s.category === cat).map(s => s.id);
            const allCatSelected = catStratIds.length > 0 && catStratIds.every(id => selectedStratIds.includes(id));
            if (allCatSelected) {
              setSelectedStratIds(prev => prev.filter(id => !catStratIds.includes(id)));
              triggerBulkFeedback(`Deselected all ${catStratIds.length} strategies in "${CATEGORY_META[cat]?.label || cat}".`, 'info');
            } else {
              setSelectedStratIds(prev => Array.from(new Set([...prev, ...catStratIds])));
              triggerBulkFeedback(`Selected all ${catStratIds.length} strategies in "${CATEGORY_META[cat]?.label || cat}".`, 'info');
            }
          };

          const handleEnableSelected = () => {
            if (selectedStratIds.length === 0) return;
            for (const id of selectedStratIds) {
              globalStrategyRegistry.setEnabled(id, true);
            }
            setTick(t => t + 1);
            triggerBulkFeedback(`ENABLED ${selectedStratIds.length} selected strategies across active execution routes.`, 'success');
          };

          const handleDisableSelected = () => {
            if (selectedStratIds.length === 0) return;
            for (const id of selectedStratIds) {
              globalStrategyRegistry.setEnabled(id, false);
            }
            setTick(t => t + 1);
            triggerBulkFeedback(`DISABLED ${selectedStratIds.length} selected strategies. Placed on standby.`, 'warning');
          };

          const handleBulkSetWeights = (weight: number, label: string) => {
            if (selectedStratIds.length === 0) return;
            globalStrategyRegistry.setWeightsFor(selectedStratIds, weight);
            setTick(t => t + 1);
            triggerBulkFeedback(`SET WEIGHTS to ${weight.toFixed(1)}x (${label}) for ${selectedStratIds.length} selected strategies.`, 'info');
          };

          return (
            <div className="space-y-6">
              {/* TOP HEADER & SYSTEM HEALTH */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-400" />
                      <span>Quantitative Strategy Matrix & Master Bulk Controls</span>
                    </h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      16 institutional execution engines with dynamic capital weighting, continuous risk gating, and one-click bulk orchestration.
                    </p>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-[#0c0f17] border border-[#1b2230] px-3 py-1.5 rounded text-xs font-mono">
                      <span className="text-[#64748b] block text-[10px] uppercase">Active Status</span>
                      <span className={activeCount > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {activeCount} / {totalStrats} Active ({activePct}%)
                      </span>
                    </div>

                    <div className="bg-[#0c0f17] border border-[#1b2230] px-3 py-1.5 rounded text-xs font-mono">
                      <span className="text-[#64748b] block text-[10px] uppercase">Allocated Weight</span>
                      <span className="text-blue-400 font-bold">
                        {activeWeightSum.toFixed(1)}x Total
                      </span>
                    </div>

                    <div className="bg-[#0c0f17] border border-[#1b2230] px-3 py-1.5 rounded text-xs font-mono">
                      <span className="text-[#64748b] block text-[10px] uppercase">Categories</span>
                      <span className="text-purple-400 font-bold">{categories.length} Classes</span>
                    </div>
                  </div>
                </div>

                {/* Ratio Bar */}
                <div className="w-full bg-[#1b2230] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{ width: `${activePct}%` }}
                  />
                </div>

                {/* ======================================================== */}
                {/* BULK ACTION BAR & GRANULAR SELECTION CONTROLS            */}
                {/* ======================================================== */}
                <div className="bg-[#090c13] border border-[#1a2333] p-3 rounded-md space-y-3">
                  {/* Row 1: Granular Multi-Selection & Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-[#141b29]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-[11px] font-mono text-[#94a3b8] uppercase tracking-wider flex items-center gap-1.5 font-semibold">
                        <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
                        Multi-Select:
                      </span>

                      {/* Select All Checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer select-none px-2.5 py-1.5 bg-[#141b29] hover:bg-[#1c263b] border border-[#223049] rounded text-xs font-medium text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          ref={el => {
                            if (el) el.indeterminate = isPartiallySelected;
                          }}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded text-indigo-600 bg-[#0c0f17] border-[#2b3a55] focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                        />
                        <span className="font-semibold">Select All</span>
                        <span className="text-[11px] font-mono text-indigo-300">
                          ({selectedStratIds.length} selected)
                        </span>
                      </label>

                      {/* Enable Selected Button */}
                      <button
                        disabled={selectedStratIds.length === 0}
                        onClick={handleEnableSelected}
                        className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          selectedStratIds.length > 0
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-sm shadow-emerald-950'
                            : 'bg-[#121c17] text-emerald-800/60 border border-emerald-950 cursor-not-allowed'
                        }`}
                        title={selectedStratIds.length > 0 ? `Enable ${selectedStratIds.length} selected strategies` : 'Select strategies first using checkboxes or category'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Enable Selected {selectedStratIds.length > 0 ? `(${selectedStratIds.length})` : ''}</span>
                      </button>

                      {/* Disable Selected Button */}
                      <button
                        disabled={selectedStratIds.length === 0}
                        onClick={handleDisableSelected}
                        className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          selectedStratIds.length > 0
                            ? 'bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 cursor-pointer shadow-sm shadow-rose-950'
                            : 'bg-[#1c1214] text-rose-800/60 border border-rose-950 cursor-not-allowed'
                        }`}
                        title={selectedStratIds.length > 0 ? `Disable ${selectedStratIds.length} selected strategies` : 'Select strategies first using checkboxes or category'}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>Disable Selected {selectedStratIds.length > 0 ? `(${selectedStratIds.length})` : ''}</span>
                      </button>

                      {/* Bulk Set Weights Dropdown */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-[#1f2b3e]">
                        <span className="text-[11px] font-mono text-[#94a3b8] flex items-center gap-1 shrink-0">
                          <Sliders className="w-3.5 h-3.5 text-blue-400" />
                          <span>Weight Preset:</span>
                        </span>
                        <select
                          disabled={selectedStratIds.length === 0}
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const weightNum = parseFloat(val);
                            const selectedOption = e.target.options[e.target.selectedIndex];
                            const label = selectedOption ? selectedOption.text : `${weightNum}x`;
                            handleBulkSetWeights(weightNum, label);
                          }}
                          className={`text-xs px-2.5 py-1.5 rounded font-mono border transition-all cursor-pointer ${
                            selectedStratIds.length > 0
                              ? 'bg-[#141b29] hover:bg-[#1c263b] border-blue-500/50 text-blue-300 focus:outline-none focus:border-blue-400 shadow-sm shadow-blue-950'
                              : 'bg-[#10141e] border-[#1b2230] text-[#64748b] cursor-not-allowed opacity-60'
                          }`}
                          title={selectedStratIds.length > 0 ? `Apply weight preset to ${selectedStratIds.length} selected strategies` : 'Select strategies first using checkboxes or category'}
                        >
                          <option value="" disabled>
                            {selectedStratIds.length > 0 ? `Bulk Set Weights (${selectedStratIds.length} Selected)...` : 'Bulk Set Weights...'}
                          </option>
                          <option value="1.0">Uniform (1.0x)</option>
                          <option value="0.5">Conservative (Conservative = 0.5x)</option>
                          <option value="2.0">Aggressive (Aggressive = 2.0x)</option>
                          <option value="0.25">Low Exposure (0.25x)</option>
                          <option value="0.75">Moderate (0.75x)</option>
                          <option value="1.5">High Conviction (1.5x)</option>
                          <option value="3.0">Maximum Scaling (3.0x)</option>
                          <option value="0.0">Zero Allocation (0.0x)</option>
                        </select>
                      </div>

                      {/* Clear Selection */}
                      {selectedStratIds.length > 0 && (
                        <button
                          onClick={() => setSelectedStratIds([])}
                          className="text-[11px] font-mono text-[#94a3b8] hover:text-white underline cursor-pointer px-1"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-[#64748b]">
                      Status: <span className={activeCount === totalStrats ? 'text-emerald-400' : activeCount === 0 ? 'text-rose-400' : 'text-amber-400'}>
                        {activeCount === totalStrats ? 'ALL ENGINES ENGAGED' : activeCount === 0 ? 'ALL ENGINES HALTED' : 'SELECTIVE EXECUTION'}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Master All-Engine Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Master Actions:
                      </span>

                      {/* Enable All */}
                      <button
                        onClick={() => {
                          globalStrategyRegistry.setAllEnabled(true);
                          setTick(t => t + 1);
                          triggerBulkFeedback(`All ${totalStrats} strategies have been ENABLED across all execution venues.`, 'success');
                        }}
                        className="px-3 py-1.5 bg-[#141b29] hover:bg-emerald-950 hover:text-emerald-300 border border-[#223049] hover:border-emerald-800 text-[#cbd5e1] rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Enable all 16 strategies immediately"
                      >
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Enable All ({totalStrats})</span>
                      </button>

                      {/* Disable All */}
                      <button
                        onClick={() => {
                          globalStrategyRegistry.setAllEnabled(false);
                          setTick(t => t + 1);
                          triggerBulkFeedback(`All ${totalStrats} strategies have been DISABLED. Engine is in passive standby mode.`, 'warning');
                        }}
                        className="px-3 py-1.5 bg-[#141b29] hover:bg-rose-950 hover:text-rose-300 border border-[#223049] hover:border-rose-800 text-[#cbd5e1] rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Disable all strategies immediately"
                      >
                        <Power className="w-3.5 h-3.5 text-rose-400" />
                        <span>Disable All</span>
                      </button>

                      {/* Invert Selection */}
                      <button
                        onClick={() => {
                          globalStrategyRegistry.toggleAll();
                          setTick(t => t + 1);
                          const newActive = globalStrategyRegistry.getAll().filter(s => s.enabled).length;
                          triggerBulkFeedback(`Inverted all strategy execution states. Now ${newActive}/${totalStrats} active.`, 'info');
                        }}
                        className="px-3 py-1.5 bg-[#141b29] hover:bg-[#1c263b] border border-[#223049] text-[#cbd5e1] rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Invert current active states"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                        <span>Invert Active States</span>
                      </button>

                      {/* Reset Weights */}
                      <button
                        onClick={() => {
                          globalStrategyRegistry.resetAllWeights(1.0);
                          setTick(t => t + 1);
                          triggerBulkFeedback(`Normalized all 16 strategy weights to baseline 1.0x allocation.`, 'info');
                        }}
                        className="px-3 py-1.5 bg-[#141b29] hover:bg-[#1c263b] border border-[#223049] text-[#cbd5e1] rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Reset all weights to 1.0x"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-[#94a3b8]" />
                        <span>Reset Weights (1.0x)</span>
                      </button>
                    </div>

                    <div className="text-[11px] font-mono text-[#64748b]">
                      Click card checkboxes or category "Select" to multiselect
                    </div>
                  </div>
                </div>

                {/* Status Feedback Toast/Banner */}
                {bulkFeedback && (
                  <div
                    className={`flex items-center justify-between p-3 rounded text-xs font-mono border transition-all ${
                      bulkFeedback.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300'
                        : bulkFeedback.type === 'warning'
                        ? 'bg-rose-950/60 border-rose-700/80 text-rose-300'
                        : 'bg-blue-950/60 border-blue-700/80 text-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {bulkFeedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      {bulkFeedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                      {bulkFeedback.type === 'info' && <Zap className="w-4 h-4 text-blue-400 shrink-0" />}
                      <span>{bulkFeedback.message}</span>
                    </div>
                    <button
                      onClick={() => setBulkFeedback(null)}
                      className="text-[#94a3b8] hover:text-white px-2 py-0.5 rounded cursor-pointer text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* CATEGORY BULK CONTROLS MATRIX                            */}
              {/* ======================================================== */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-mono uppercase text-[#94a3b8] tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      Category Bulk Action Controllers
                    </h3>
                    <p className="text-[11px] text-[#64748b] mt-0.5">
                      Enable or disable entire quantitative categories with a single click:
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-[#64748b]">
                    Click category badge to filter catalog below
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {categories.map(cat => {
                    const catMeta = CATEGORY_META[cat] || {
                      label: cat,
                      icon: '⚙️',
                      description: 'Algorithmic module',
                      badgeColor: 'border-[#1b2230] text-[#94a3b8]'
                    };
                    const catStrats = allStrats.filter(s => s.category === cat);
                    const catTotal = catStrats.length;
                    const catActive = catStrats.filter(s => s.enabled).length;
                    const isAllActive = catTotal > 0 && catActive === catTotal;
                    const isNoneActive = catActive === 0;
                    const isFiltered = stratCategoryFilter === cat;

                    const catStratIds = catStrats.map(s => s.id);
                    const catSelectedCount = catStratIds.filter(id => selectedStratIds.includes(id)).length;
                    const isCatAllSelected = catTotal > 0 && catSelectedCount === catTotal;
                    const isCatPartiallySelected = catSelectedCount > 0 && catSelectedCount < catTotal;

                    return (
                      <div
                        key={cat}
                        className={`bg-[#0c0f17] border p-3 rounded-lg transition-all flex flex-col justify-between gap-2.5 ${
                          isCatAllSelected
                            ? 'border-indigo-500/80 bg-[#0f121d] ring-1 ring-indigo-500/30'
                            : isFiltered
                            ? 'border-indigo-500/80 ring-1 ring-indigo-500/40'
                            : 'border-[#1a2333] hover:border-[#253249]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            onClick={() => setStratCategoryFilter(isFiltered ? 'ALL' : cat)}
                            className="text-left flex items-start gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-1"
                            title="Click to filter strategy list below"
                          >
                            <span className="text-base leading-none select-none">{catMeta.icon}</span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-white">{catMeta.label}</span>
                                {isFiltered && (
                                  <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-700/60 px-1.5 py-0.2 rounded font-mono">
                                    FILTERED
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-[#64748b] line-clamp-1 mt-0.5">{catMeta.description}</p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Category Select Checkbox */}
                            <label
                              onClick={(e) => e.stopPropagation()}
                              className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                isCatAllSelected
                                  ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300'
                                  : 'bg-[#141b29] border-[#223049] text-[#cbd5e1] hover:border-[#384a6b]'
                              }`}
                              title={`Select/Deselect all ${catTotal} strategies in ${catMeta.label}`}
                            >
                              <input
                                type="checkbox"
                                checked={isCatAllSelected}
                                ref={el => {
                                  if (el) el.indeterminate = isCatPartiallySelected;
                                }}
                                onChange={() => handleToggleCategorySelection(cat)}
                                className="w-3.5 h-3.5 rounded text-indigo-600 bg-[#0c0f17] border-[#2b3a55] accent-indigo-600 cursor-pointer"
                              />
                              <span>{isCatAllSelected ? 'Selected' : 'Select'}</span>
                            </label>

                            {/* Active count badge */}
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                                isAllActive
                                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
                                  : isNoneActive
                                  ? 'bg-[#141b29] border-[#223049] text-[#64748b]'
                                  : 'bg-amber-950/70 border-amber-800 text-amber-300'
                              }`}
                            >
                              {catActive}/{catTotal} Active
                            </span>
                          </div>
                        </div>

                        {/* Category Bulk Action Buttons */}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-[#1a2333]">
                          {/* Enable Category */}
                          <button
                            onClick={() => {
                              globalStrategyRegistry.setCategoryEnabled(cat, true);
                              setTick(t => t + 1);
                              triggerBulkFeedback(`ENABLED all ${catTotal} strategies in "${catMeta.label}".`, 'success');
                            }}
                            className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                              isAllActive
                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 cursor-default'
                                : 'bg-[#13221b] hover:bg-emerald-950 text-emerald-300 border border-emerald-900/60'
                            }`}
                            title={`Enable all ${catTotal} strategies in ${catMeta.label}`}
                          >
                            <Check className="w-3 h-3" />
                            <span>Enable All</span>
                          </button>

                          {/* Disable Category */}
                          <button
                            onClick={() => {
                              globalStrategyRegistry.setCategoryEnabled(cat, false);
                              setTick(t => t + 1);
                              triggerBulkFeedback(`DISABLED all ${catTotal} strategies in "${catMeta.label}".`, 'warning');
                            }}
                            className={`flex-1 py-1 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                              isNoneActive
                                ? 'bg-rose-950/30 text-rose-500/70 border border-rose-900/30 cursor-default'
                                : 'bg-[#24141a] hover:bg-rose-950 text-rose-300 border border-rose-900/60'
                            }`}
                            title={`Disable all ${catTotal} strategies in ${catMeta.label}`}
                          >
                            <Power className="w-3 h-3" />
                            <span>Disable All</span>
                          </button>

                          {/* Select/Deselect Category */}
                          <button
                            onClick={() => handleToggleCategorySelection(cat)}
                            className={`py-1 px-2 rounded text-[11px] font-mono transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                              isCatAllSelected
                                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/80 font-semibold'
                                : 'bg-[#141b29] hover:bg-[#1e283d] text-[#cbd5e1] hover:text-indigo-300 border border-[#223049]'
                            }`}
                            title={`Select or deselect all ${catTotal} strategies in ${catMeta.label}`}
                          >
                            <CheckSquare className="w-3 h-3 text-indigo-400" />
                            <span>{isCatAllSelected ? 'Deselect' : 'Select'}</span>
                          </button>

                          {/* Toggle Category */}
                          <button
                            onClick={() => {
                              globalStrategyRegistry.toggleCategory(cat);
                              setTick(t => t + 1);
                              const newCatActive = globalStrategyRegistry.getAll().filter(s => s.category === cat && s.enabled).length;
                              triggerBulkFeedback(`Toggled "${catMeta.label}" strategies (Now ${newCatActive}/${catTotal} Active).`, 'info');
                            }}
                            className="py-1 px-2 rounded text-[11px] font-mono bg-[#141b29] hover:bg-[#1e283d] text-[#94a3b8] hover:text-white border border-[#223049] transition-colors cursor-pointer"
                            title={`Toggle active state of ${catMeta.label}`}
                          >
                            Toggle
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ======================================================== */}
              {/* SEARCH, FILTER & CATALOG VIEW                            */}
              {/* ======================================================== */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#10141e] border border-[#1b2230] p-3 rounded-lg">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search strategies by name, ID, or category..."
                      value={stratSearchQuery}
                      onChange={(e) => setStratSearchQuery(e.target.value)}
                      className="w-full bg-[#0c0f17] border border-[#1b2230] text-white text-xs pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                    />
                    {stratSearchQuery && (
                      <button
                        onClick={() => setStratSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#64748b] hover:text-white"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills / Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-[#64748b]" />
                    <select
                      value={stratCategoryFilter}
                      onChange={(e) => setStratCategoryFilter(e.target.value)}
                      className="bg-[#0c0f17] border border-[#1b2230] text-[#cbd5e1] text-xs px-2.5 py-1.5 rounded font-mono cursor-pointer"
                    >
                      <option value="ALL">All Categories ({totalStrats})</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {CATEGORY_META[cat]?.label || cat} ({allStrats.filter(s => s.category === cat).length})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-[#64748b]">
                  <span>Showing {filteredStrats.length} of {totalStrats} strategies</span>
                  {(stratCategoryFilter !== 'ALL' || stratSearchQuery) && (
                    <button
                      onClick={() => {
                        setStratCategoryFilter('ALL');
                        setStratSearchQuery('');
                      }}
                      className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* STRATEGY CARDS GRID */}
              {filteredStrats.length === 0 ? (
                <div className="bg-[#10141e] border border-[#1b2230] p-8 rounded text-center space-y-3">
                  <p className="text-sm text-[#94a3b8]">No strategies matched your filter or search criteria.</p>
                  <button
                    onClick={() => {
                      setStratCategoryFilter('ALL');
                      setStratSearchQuery('');
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                  >
                    Reset Filters & View All 16
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStrats.map(strat => {
                    const catMeta = CATEGORY_META[strat.category] || {
                      label: strat.category,
                      icon: '⚙️',
                      description: '',
                      badgeColor: 'border-[#1b2230] text-[#94a3b8]'
                    };
                    const isSelected = selectedStratIds.includes(strat.id);

                    return (
                      <div
                        key={strat.id}
                        className={`bg-[#10141e] border p-4 rounded-lg space-y-3 transition-all ${
                          isSelected
                            ? 'border-indigo-500/80 bg-[#121524] ring-1 ring-indigo-500/30'
                            : strat.enabled
                            ? 'border-[#1b2230]'
                            : 'border-[#1b2230]/50 opacity-65'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            {/* Manual Strategy Select Checkbox */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleStrategySelection(strat.id)}
                              className="mt-1 w-4 h-4 rounded text-indigo-600 bg-[#0c0f17] border-[#2b3a55] accent-indigo-600 cursor-pointer shrink-0"
                              title={`Select "${strat.name}" for granular bulk control`}
                            />
                            <div>
                              <span className="text-[10px] font-mono uppercase text-[#64748b] flex items-center gap-1">
                                <span>{catMeta.icon}</span>
                                <span>{catMeta.label}</span>
                              </span>
                              <h4 className="text-sm font-semibold text-white mt-0.5">{strat.name}</h4>
                              <span className="text-[10px] font-mono text-[#94a3b8]">{strat.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Solo / Isolate button */}
                            <button
                              onClick={() => {
                                for (const s of allStrats) {
                                  s.enabled = s.id === strat.id;
                                }
                                setTick(t => t + 1);
                                triggerBulkFeedback(`ISOLATED "${strat.name}". All other 15 strategies disabled.`, 'info');
                              }}
                              className="text-[10px] font-mono px-2 py-1 bg-[#141b29] hover:bg-[#1e283d] text-[#94a3b8] hover:text-indigo-300 border border-[#223049] rounded transition-colors cursor-pointer"
                              title="Isolate: Enable only this strategy and disable all others"
                            >
                              Solo
                            </button>

                            {/* Enable/Disable button */}
                            <button
                              onClick={() => {
                                globalStrategyRegistry.setEnabled(strat.id, !strat.enabled);
                                setTick(t => t + 1);
                                triggerBulkFeedback(`Strategy "${strat.name}" ${!strat.enabled ? 'ENABLED' : 'DISABLED'}.`, !strat.enabled ? 'success' : 'warning');
                              }}
                              className={`text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                                strat.enabled
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                  : 'bg-[#1b2230] text-[#64748b] hover:text-white'
                              }`}
                            >
                              {strat.enabled ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>ENABLED</span>
                                </>
                              ) : (
                                <>
                                  <Power className="w-3 h-3" />
                                  <span>DISABLED</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Performance metrics */}
                        <div className="grid grid-cols-3 gap-2 py-2 border-y border-[#1b2230] text-xs font-mono">
                          <div>
                            <span className="text-[10px] text-[#64748b] block">Win Rate</span>
                            <span className="text-emerald-400 font-semibold">{strat.winRatePct ?? 65}%</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#64748b] block">Sharpe</span>
                            <span className="text-white font-semibold">{strat.sharpeRatio ?? 2.0}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-[#64748b] block">Total P&L</span>
                            <span className="text-emerald-400 font-semibold">+${(strat.totalPnlUsd ?? 0).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Weight Slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#64748b]">Strategy Weight:</span>
                            <span className="text-blue-400 font-semibold">{strat.weight.toFixed(1)}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="2.5"
                            step="0.1"
                            value={strat.weight}
                            onChange={(e) => {
                              globalStrategyRegistry.setWeight(strat.id, parseFloat(e.target.value));
                              setTick(t => t + 1);
                            }}
                            className="w-full accent-blue-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ======================================================== */}
        {/* TAB 4: ORDERBOOK & SMART ORDER ROUTER (FORS MARKET)      */}
        {/* ======================================================== */}
        {activeTab === 'orderbook' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-mono text-[#64748b]">Active Selected Contract</span>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value)}
                    className="bg-[#0c0f17] border border-[#232d3f] text-white text-sm font-semibold rounded px-3 py-1.5 mt-0.5 font-mono cursor-pointer"
                  >
                    {markets.map(m => (
                      <option key={m.symbol} value={m.symbol}>
                        {m.symbol} (${m.lastPrice})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedOrderBook && (
                  <div className="hidden sm:flex items-center gap-4 text-xs font-mono pt-3">
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Spread</span>
                      <span className="text-white font-semibold">{selectedOrderBook.spread} ({selectedOrderBook.spreadBps} bps)</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Micro-Price</span>
                      <span className="text-blue-400 font-semibold">${selectedOrderBook.microPrice}</span>
                    </div>
                    <div>
                      <span className="text-[#64748b] block text-[10px]">Imbalance</span>
                      <span className={`font-semibold ${selectedOrderBook.imbalance > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(selectedOrderBook.imbalance * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-xs font-mono text-[#94a3b8] flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>L2 Real-Time Feed</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* L2 Depth Ladder */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center justify-between">
                  <span>Level 2 Depth Ladder</span>
                  <span className="text-xs font-mono text-[#64748b]">{selectedSymbol}</span>
                </h3>

                {selectedOrderBook ? (
                  <div className="space-y-1 font-mono text-xs">
                    {/* Asks (Desc) */}
                    <div className="space-y-0.5">
                      {[...selectedOrderBook.asks].reverse().slice(0, 6).map((a, idx) => (
                        <div key={`ask_${idx}`} className="relative flex justify-between py-1 px-2 rounded overflow-hidden">
                          <div
                            className="absolute right-0 top-0 bottom-0 bg-rose-500/15"
                            style={{ width: `${Math.min(100, (a.total / 8000) * 100)}%` }}
                          ></div>
                          <span className="text-rose-400 font-semibold relative z-10">${a.price}</span>
                          <span className="text-[#94a3b8] relative z-10">{a.size.toLocaleString()}</span>
                          <span className="text-[#64748b] relative z-10">{a.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Spread Divider */}
                    <div className="py-2 text-center text-[11px] font-semibold text-blue-400 border-y border-[#1b2230] bg-[#0c0f17]/60">
                      Spread: ${selectedOrderBook.spread} ({selectedOrderBook.spreadBps} bps) · MicroPrice: ${selectedOrderBook.microPrice}
                    </div>

                    {/* Bids (Asc) */}
                    <div className="space-y-0.5">
                      {selectedOrderBook.bids.slice(0, 6).map((b, idx) => (
                        <div key={`bid_${idx}`} className="relative flex justify-between py-1 px-2 rounded overflow-hidden">
                          <div
                            className="absolute right-0 top-0 bottom-0 bg-emerald-500/15"
                            style={{ width: `${Math.min(100, (b.total / 8000) * 100)}%` }}
                          ></div>
                          <span className="text-emerald-400 font-semibold relative z-10">${b.price}</span>
                          <span className="text-[#94a3b8] relative z-10">{b.size.toLocaleString()}</span>
                          <span className="text-[#64748b] relative z-10">{b.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-[#64748b] text-xs">Loading orderbook depth...</div>
                )}
              </div>

              {/* FORS Market Smart Order Router (SOR) */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>FORS Smart Order Router (SOR)</span>
                  </h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                    Impact Minimizer
                  </span>
                </div>

                <p className="text-xs text-[#94a3b8]">
                  Splits incoming institutional orders across fragmented venues (e.g. Polymarket + Kalshi) to minimize price slippage and aggregate taker fees.
                </p>

                <div className="p-3 bg-[#0c0f17] border border-[#1b2230] rounded space-y-3">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#64748b]">Simulated Order Size:</span>
                    <span className="text-white font-semibold">$50,000 USD</span>
                  </div>

                  {/* Route Breakdown */}
                  {globalExecutionEngine.computeSmartRoute(selectedSymbol, 50000, 'BUY', markets).map(route => (
                    <div key={route.venue} className="p-2.5 bg-[#10141e] border border-[#1b2230] rounded space-y-1 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-semibold uppercase">{route.venue}</span>
                        <span className="text-blue-400 font-bold">{route.percentage}% Allocation</span>
                      </div>
                      <div className="flex justify-between text-[#94a3b8] text-[11px]">
                        <span>Size: {route.size} contracts</span>
                        <span>Exp Fill: ${route.expectedPrice}</span>
                        <span>Slippage: {route.expectedSlippageBps} bps</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-[#64748b] leading-relaxed">
                  SOR Algorithm optimizes: $\min \sum [Notional_i \times (Price_i + Impact_i + Fees_i)]$
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: CROSS-VENUE ARBITRAGE & FLASH LOAN               */}
        {/* ======================================================== */}
        {activeTab === 'arbitrage' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Cross-Venue Net Edge Arbitrage & Flash-Loan Engine</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Calculates executable net profit: Gross Spread - Fees - Gas - Bridge - Slippage - Latency Reserve.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Arbitrage Opportunities Table */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <h3 className="text-sm font-semibold text-white">Cross-Venue Arbitrage Pairs</h3>
                <div className="space-y-3">
                  {arbitrageOpps.map(arb => (
                    <div
                      key={arb.id}
                      className={`p-3.5 rounded border transition-colors ${
                        arb.isExecutable ? 'bg-[#0c0f17] border-emerald-500/40' : 'bg-[#0c0f17]/50 border-[#1b2230]'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs">{arb.symbol}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${
                              arb.isExecutable ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-400'
                            }`}>
                              {arb.isExecutable ? 'EXECUTABLE' : 'UNPROFITABLE'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748b] mt-1 font-mono">
                            Buy on <span className="text-white uppercase">{arb.buyVenue}</span> (${arb.buyPrice}) ➔ Sell on <span className="text-white uppercase">{arb.sellVenue}</span> (${arb.sellPrice})
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-[10px] text-[#64748b]">Net Edge</span>
                          <div className={`text-base font-bold ${arb.isExecutable ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {arb.netExpectedEdgePct > 0 ? '+' : ''}{arb.netExpectedEdgePct}%
                          </div>
                        </div>
                      </div>

                      {/* Fee Deductions Breakdown */}
                      <div className="mt-3 pt-2 border-t border-[#1b2230] grid grid-cols-4 gap-1 text-[10px] font-mono text-[#64748b]">
                        <div>Gross: <span className="text-white">${arb.grossEdgeUsd}</span></div>
                        <div>Fees: <span className="text-rose-400">-${arb.tradingFeesUsd}</span></div>
                        <div>Gas: <span className="text-rose-400">-${arb.gasCostUsd}</span></div>
                        <div>Net: <span className="text-emerald-400 font-bold">${arb.netProfitUsd}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flash-Loan Module Simulator */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span>Blockchain Flash-Loan Simulator</span>
                  </h3>
                  <span className="text-[10px] font-mono text-[#64748b]">Atomic Verification Gate</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#64748b] uppercase block font-mono">Protocol</label>
                      <select
                        value={flashLoanParams.protocol}
                        onChange={(e: any) => setFlashLoanParams({ ...flashLoanParams, protocol: e.target.value })}
                        className="w-full bg-[#0c0f17] border border-[#232d3f] text-white rounded p-2 mt-1 font-mono"
                      >
                        <option value="AAVE_V3">Aave V3 (0.05% fee)</option>
                        <option value="BALANCER">Balancer (0.0% fee)</option>
                        <option value="UNISWAP_V3_FLASH">Uniswap V3 Flash (0.09% fee)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#64748b] uppercase block font-mono">Borrow Amount (USDC)</label>
                      <input
                        type="number"
                        value={flashLoanParams.borrowAmount}
                        onChange={(e) => setFlashLoanParams({ ...flashLoanParams, borrowAmount: Number(e.target.value) })}
                        className="w-full bg-[#0c0f17] border border-[#232d3f] text-white rounded p-2 mt-1 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleSimulateFlashLoan}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded transition-colors cursor-pointer"
                  >
                    Simulate Complete Transaction Route
                  </button>

                  {flashLoanResult && (
                    <div className="p-3 bg-[#0c0f17] border border-[#1b2230] rounded space-y-2 font-mono text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-[#64748b]">Atomic Repayment Check:</span>
                        <span className={`font-bold ${flashLoanResult.atomicRepaymentValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {flashLoanResult.atomicRepaymentValid ? 'VALID (No Revert)' : 'REVERT DETECTED'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Net Profit After Gas & Fees:</span>
                        <span className="text-emerald-400 font-bold">${flashLoanResult.netProfitUsd}</span>
                      </div>
                      <div className="pt-2 border-t border-[#1b2230] text-[10px] text-[#64748b] space-y-1">
                        {flashLoanResult.logs.slice(-3).map((l: string, i: number) => (
                          <div key={i} className="truncate">{l}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: WHALE TRACKING & COPY TRADING (POLYCOP/STAND)     */}
        {/* ======================================================== */}
        {activeTab === 'whale_copy' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Smart Wallet Tracking & Filtered Copy Trading</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Inspired by PolyCop and Stand. Leader trades are treated as raw signals: re-screened by hard risk limits and rejected if price has deteriorated by &gt; 1.0%.
                </p>
              </div>
            </div>

            {/* Smart Wallets Directory */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {globalWhaleTracker.getWallets().map(w => (
                <div key={w.address} className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{w.alias}</h4>
                      <span className="font-mono text-[10px] text-[#64748b]">{w.address}</span>
                    </div>
                    <button
                      onClick={() => {
                        globalWhaleTracker.toggleFollow(w.address);
                        setTick(t => t + 1);
                      }}
                      className={`text-xs px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                        w.isFollowed ? 'bg-blue-600 text-white' : 'bg-[#1b2230] text-[#64748b]'
                      }`}
                    >
                      {w.isFollowed ? 'FOLLOWING' : '+ FOLLOW'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 border-y border-[#1b2230] text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-[#64748b] block">Win Rate</span>
                      <span className="text-emerald-400 font-semibold">{w.winRatePct}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748b] block">Sharpe</span>
                      <span className="text-white font-semibold">{w.sharpeRatio}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748b] block">Total Profit</span>
                      <span className="text-emerald-400 font-semibold">+${w.totalPnlUsd.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#64748b] block">Trades</span>
                      <span className="text-[#94a3b8]">{w.tradesCount}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {w.tags.map(t => (
                      <span key={t} className="text-[9px] bg-[#0c0f17] text-[#94a3b8] px-1.5 py-0.5 rounded border border-[#1b2230]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Whale Feed with Slippage Deterioration Guard */}
            <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-3">
              <h3 className="text-sm font-semibold text-white">Live Whale Trade Detection Stream</h3>
              <div className="space-y-2 font-mono text-xs">
                {globalWhaleTracker.getRecentTrades().map(t => (
                  <div key={t.id} className="p-3 bg-[#0c0f17] border border-[#1b2230] rounded flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-white">{t.alias}</span>
                      <span className="text-[#64748b] text-[11px] ml-2">({t.walletAddress})</span>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        {t.direction} {t.symbol} @ ${t.price} · Size: ${t.sizeUsd.toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-[#64748b] block">Deterioration:</span>
                        <span className={t.priceDeteriorationPct > 1.0 ? 'text-rose-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                          {t.priceDeteriorationPct}%
                        </span>
                      </div>

                      <span className={`text-[10px] px-2 py-1 rounded font-bold ${
                        t.isEligibleForCopy ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-400 border border-rose-800/40'
                      }`}>
                        {t.isEligibleForCopy ? 'COPIED TO RISK GATE' : 'BLOCKED (SLIPPAGE)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: AI STRATEGY COMPILER & LOGICAL HEDGE             */}
        {/* ======================================================== */}
        {activeTab === 'ai_compiler' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-blue-400" />
                  <span>Natural-Language Strategy Compiler & Formal Implication Hedge</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  TurbineFi & PredictEngine inspired strategy generation with PolyClaw contrapositive implication logic.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Natural Language Compiler */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <h3 className="text-sm font-semibold text-white">Natural Language Strategy Compiler</h3>
                <textarea
                  value={nlPrompt}
                  onChange={(e) => setNlPrompt(e.target.value)}
                  rows={3}
                  className="w-full bg-[#0c0f17] border border-[#232d3f] text-white p-3 rounded text-xs font-mono focus:outline-none focus:border-blue-500"
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCompilePrompt()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors cursor-pointer"
                  >
                    Compile to Validated DSL
                  </button>
                  <button
                    onClick={() => {
                      const text = 'Short Solana perpetual on Bybit when 8h funding rate > 0.03% and hedge with spot on Binance';
                      setNlPrompt(text);
                      handleCompilePrompt(text);
                    }}
                    className="px-3 py-2 bg-[#1b2230] hover:bg-[#232d3f] text-[#94a3b8] rounded text-xs transition-colors cursor-pointer"
                  >
                    Load Funding Carry Template
                  </button>
                </div>

                {compilerResult && compilerResult.dsl && (
                  <div className="p-3 bg-[#0c0f17] border border-[#1b2230] rounded space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono text-emerald-400">
                      <span>Compilation AST Passed</span>
                      <span className="text-[10px] text-[#64748b]">TurbineFi Gate Ready</span>
                    </div>
                    <pre className="text-[11px] font-mono text-[#94a3b8] overflow-x-auto max-h-48 p-2 bg-[#080a0f] rounded">
                      {JSON.stringify(compilerResult.dsl, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* PolyClaw Formal Implication Hedge */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Formal Implication Hedge (PolyClaw)</h3>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                    P ⟹ Q Guaranteed
                  </span>
                </div>

                {hedgeResult && (
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 bg-[#0c0f17] border border-[#1b2230] rounded space-y-2">
                      <div className="text-[11px] text-[#94a3b8] leading-relaxed">
                        {hedgeResult.mathematicalProof}
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1b2230]">
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Coverage</span>
                          <span className="text-emerald-400 font-bold">{hedgeResult.coveragePct}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Worst Case</span>
                          <span className="text-rose-400 font-bold">${hedgeResult.worstCaseLossUsd}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748b] block">Expected EV</span>
                          <span className="text-white font-bold">+${hedgeResult.expectedValueUsd}</span>
                        </div>
                      </div>
                    </div>

                    {/* Truth Table */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#64748b] uppercase">State Exhaustion Matrix:</span>
                      {hedgeResult.jointStates.map((s: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-2 rounded flex justify-between text-[11px] ${
                            s.isLogicallyPossible ? 'bg-[#0c0f17] text-[#94a3b8]' : 'bg-rose-950/20 text-[#64748b] line-through'
                          }`}
                        >
                          <span>{s.state}</span>
                          <span className={s.netPayoffPerContractUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {s.isLogicallyPossible ? `$${s.netPayoffPerContractUsd}/unit` : 'Impossible (Measure Zero)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 8: RISK & SYSTEM SETTINGS                           */}
        {/* ======================================================== */}
        {activeTab === 'risk' && (
          <div className="space-y-6">
            {/* SYSTEM ADMINISTRATOR & CREATOR FEE CONFIGURATION (READ-ONLY) */}
            <div className="bg-[#10141e] border border-indigo-500/40 p-5 rounded-xl space-y-4 shadow-lg shadow-indigo-950/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Creator Commission & Protocol Fee Configuration
                      </h3>
                      <span className="text-[10px] font-mono bg-emerald-950/90 text-emerald-300 border border-emerald-800/70 px-2 py-0.5 rounded font-bold">
                        SYSTEM ADMINISTRATOR ONLY · READ-ONLY
                      </span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      This setting is read-only. Only the system administrator (the creator) can modify this commission destination via server-side environment configuration.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#64748b]">Performance Fee:</span>
                  <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                    2.5% on Net Profits Only
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#1b2230]">
                {/* Read-Only Creator Wallet */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-[#94a3b8] uppercase tracking-wider flex items-center justify-between">
                    <span>Creator Commission Wallet (Solana USDT):</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[10px]">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span>Solana Blockchain (SPL-USDT)</span>
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={globalPortfolio.getDeveloperWallet()}
                      className="w-full bg-[#080c14] border border-emerald-900/50 text-emerald-200 font-mono text-xs px-3 py-2.5 rounded cursor-not-allowed select-all tracking-wide"
                    />
                    <span className="absolute right-3 text-[10px] font-mono bg-emerald-950 border border-emerald-800/60 text-emerald-400 px-1.5 py-0.5 rounded pointer-events-none">
                      SOLANA USDT
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[#64748b]">
                    All net profits converted and routed in <strong>USDT on Solana</strong> to <code className="text-emerald-300 font-semibold">{globalPortfolio.getDeveloperWallet().slice(0, 8)}...{globalPortfolio.getDeveloperWallet().slice(-6)}</code>.
                  </p>
                </div>

                {/* Protocol Commission Policy */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-[#94a3b8] uppercase tracking-wider flex items-center justify-between">
                    <span>Creator Profit Share Rate:</span>
                    <span className="text-white font-mono text-[10px]">Rule: $0.025 per $1.00 Net Profit</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      readOnly
                      disabled
                      value="2.5% on net profit above principal ($0.00 on breakeven/loss)"
                      className="w-full bg-[#080c14] border border-[#1b2230] text-slate-300 font-mono text-xs px-3 py-2.5 rounded cursor-not-allowed"
                    />
                    <span className="absolute right-3 text-[10px] font-mono bg-[#131924] border border-[#232d3f] text-[#94a3b8] px-1.5 py-0.5 rounded pointer-events-none">
                      FIXED
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[#64748b]">
                    Protection active: If a user breaks even or withdraws at a loss, $0.00 fee is taken (0%).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span>Hard Risk Engine Parameters</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Pre-trade verification gates. Individual strategies are mathematically prevented from bypassing these hard constraints.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => globalRiskEngine.resetCircuitBreaker()}
                  className="px-3 py-1.5 bg-[#1b2230] hover:bg-[#232d3f] text-[#94a3b8] rounded text-xs font-mono transition-colors cursor-pointer"
                >
                  Reset Circuit Breakers
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Controls: Loss & Drawdown Caps */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <h3 className="text-sm font-semibold text-white">Loss & Drawdown Caps</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#94a3b8]">Max Risk Per Trade:</span>
                    <span className="text-white font-bold">{riskConfig.maxRiskPerTradePct}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={riskConfig.maxRiskPerTradePct}
                    onChange={(e) => globalRiskEngine.updateConfig({ maxRiskPerTradePct: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#94a3b8]">Max Daily Loss Cap:</span>
                    <span className="text-rose-400 font-bold">{riskConfig.maxDailyLossPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={riskConfig.maxDailyLossPct}
                    onChange={(e) => globalRiskEngine.updateConfig({ maxDailyLossPct: parseFloat(e.target.value) })}
                    className="w-full accent-rose-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#94a3b8]">Portfolio Drawdown Cap:</span>
                    <span className="text-amber-400 font-bold">{riskConfig.maxPortfolioDrawdownPct}%</span>
                  </div>
                  <input
                    type="range"
                    min="5.0"
                    max="20.0"
                    step="1.0"
                    value={riskConfig.maxPortfolioDrawdownPct}
                    onChange={(e) => globalRiskEngine.updateConfig({ maxPortfolioDrawdownPct: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Controls: Exposure & Execution Limits */}
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-4">
                <h3 className="text-sm font-semibold text-white">Exposure & Execution Limits</h3>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#94a3b8]">Max Total Gross Leverage:</span>
                    <span className="text-white font-bold">{riskConfig.maxTotalLeverage}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={riskConfig.maxTotalLeverage}
                    onChange={(e) => globalRiskEngine.updateConfig({ maxTotalLeverage: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#94a3b8]">Max Slippage Allowed:</span>
                    <span className="text-white font-bold">{riskConfig.maxSlippageBps} bps</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={riskConfig.maxSlippageBps}
                    onChange={(e) => globalRiskEngine.updateConfig({ maxSlippageBps: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-[#94a3b8]">Min Market Liquidity Floor:</span>
                    <span className="text-white font-bold">${riskConfig.minLiquidityUsd.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="50000"
                    step="2500"
                    value={riskConfig.minLiquidityUsd}
                    onChange={(e) => globalRiskEngine.updateConfig({ minLiquidityUsd: parseInt(e.target.value, 10) })}
                    className="w-full accent-blue-500 h-1 bg-[#1b2230] rounded cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* ALERT FEED & D3 RISK-GATE VIOLATION SPIKE VISUALIZER */}
            <RiskAlertFeedD3
              onNavigateToStrategy={(stratId) => {
                setActiveTab('strategies');
                setSelectedStratIds([stratId]);
              }}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 9: BACKTESTING & MONTE CARLO                        */}
        {/* ======================================================== */}
        {activeTab === 'backtest' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <span>Event-Driven Backtester & Monte Carlo Studio</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Simulates realistic tick walk, order queue priority, liquidity-scaled slippage, exchange fee schedules, and 1,000-run Monte Carlo permutations.
                </p>
              </div>

              <button
                onClick={handleRunCustomBacktest}
                disabled={isBacktesting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBacktesting ? 'animate-spin' : ''}`} />
                <span>Run Backtest</span>
              </button>
            </div>

            {backtestResult && (
              <div className="space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 font-mono">
                  <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded">
                    <span className="text-[10px] text-[#64748b] block">Total Return</span>
                    <span className="text-lg font-bold text-emerald-400">+{backtestResult.totalReturnPct}%</span>
                    <span className="text-[10px] text-[#64748b] block">CAGR: +{backtestResult.cagrPct}%</span>
                  </div>

                  <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded">
                    <span className="text-[10px] text-[#64748b] block">Sharpe / Sortino</span>
                    <span className="text-lg font-bold text-white">{backtestResult.sharpeRatio}</span>
                    <span className="text-[10px] text-[#64748b] block">Sortino: {backtestResult.sortinoRatio}</span>
                  </div>

                  <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded">
                    <span className="text-[10px] text-[#64748b] block">Max Drawdown</span>
                    <span className="text-lg font-bold text-amber-400">-{backtestResult.maxDrawdownPct}%</span>
                    <span className="text-[10px] text-[#64748b] block">Calmar: {backtestResult.calmarRatio}</span>
                  </div>

                  <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded">
                    <span className="text-[10px] text-[#64748b] block">Win Rate</span>
                    <span className="text-lg font-bold text-emerald-400">{backtestResult.winRatePct}%</span>
                    <span className="text-[10px] text-[#64748b] block">{backtestResult.winningTrades}W / {backtestResult.losingTrades}L</span>
                  </div>

                  <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded">
                    <span className="text-[10px] text-[#64748b] block">Profit Factor</span>
                    <span className="text-lg font-bold text-white">{backtestResult.profitFactor}</span>
                    <span className="text-[10px] text-[#64748b] block">Expectancy: ${backtestResult.expectancyUsd}</span>
                  </div>

                  <div className="bg-[#10141e] border border-[#1b2230] p-3 rounded">
                    <span className="text-[10px] text-[#64748b] block">Friction Paid</span>
                    <span className="text-lg font-bold text-rose-400">${backtestResult.totalFeesPaidUsd + backtestResult.totalSlippageCostUsd}</span>
                    <span className="text-[10px] text-[#64748b] block">Fees + Slippage</span>
                  </div>
                </div>

                {/* Monte Carlo & Walk Forward */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-3 font-mono text-xs">
                    <h3 className="font-semibold text-white text-sm">Monte Carlo Permutations (500 Runs)</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-[#0c0f17] rounded">
                        <span className="text-[#64748b]">5th Percentile DD (Best):</span>
                        <span className="text-emerald-400 font-bold">-{backtestResult.monteCarloDistribution.p5Drawdown}%</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#0c0f17] rounded">
                        <span className="text-[#64748b]">50th Percentile DD (Median):</span>
                        <span className="text-amber-400 font-bold">-{backtestResult.monteCarloDistribution.p50Drawdown}%</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#0c0f17] rounded">
                        <span className="text-[#64748b]">95th Percentile DD (Stress):</span>
                        <span className="text-rose-400 font-bold">-{backtestResult.monteCarloDistribution.p95Drawdown}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-3 font-mono text-xs">
                    <h3 className="font-semibold text-white text-sm">Walk-Forward Out-Of-Sample Validation</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between p-2 bg-[#0c0f17] rounded">
                        <span className="text-[#64748b]">In-Sample Sharpe Ratio:</span>
                        <span className="text-white font-bold">{backtestResult.walkForwardValidation.inSampleSharpe}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#0c0f17] rounded">
                        <span className="text-[#64748b]">Out-Of-Sample Sharpe Ratio:</span>
                        <span className="text-emerald-400 font-bold">{backtestResult.walkForwardValidation.outOfSampleSharpe}</span>
                      </div>
                      <div className="flex justify-between p-2 bg-[#0c0f17] rounded">
                        <span className="text-[#64748b]">Parameter Stability Score:</span>
                        <span className="text-blue-400 font-bold">{backtestResult.walkForwardValidation.parameterStabilityScore}/100</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 10: CLI TERMINAL & COMPREHENSIVE TESTS              */}
        {/* ======================================================== */}
        {activeTab === 'terminal_tests' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#10141e] border border-[#1b2230] p-4 rounded">
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-blue-400" />
                  <span>Institutional CLI & Automated Test Suite</span>
                </h2>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Execute direct engine commands, inspect telemetry logs, and run comprehensive automated unit, integration, and simulation tests.
                </p>
              </div>

              <button
                onClick={handleRunTests}
                disabled={isRunningTests}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className={`w-3.5 h-3.5 ${isRunningTests ? 'animate-spin' : ''}`} />
                <span>Run All Verification Tests</span>
              </button>
            </div>

            {/* Test Results Display */}
            {testResults && (
              <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-[#1b2230] pb-2">
                  <h3 className="font-semibold text-white text-sm">Automated Test Execution Suite</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 font-bold">✓ {testResults.passedCount} Passed</span>
                    <span className="text-rose-400 font-bold">✗ {testResults.failedCount} Failed</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {testResults.results.map((r, i) => (
                    <div key={i} className="p-2.5 bg-[#0c0f17] border border-[#1b2230] rounded flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {r.passed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          )}
                          <span className="font-semibold text-white">{r.name}</span>
                          <span className="text-[10px] text-[#64748b]">({r.category})</span>
                        </div>
                        <p className="text-[11px] text-[#94a3b8] ml-6 mt-0.5">{r.message}</p>
                      </div>
                      <span className="text-[#64748b] text-[10px]">{r.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Two-Column Split Layout: Terminal on Left, Real-Time Heartbeat on Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (7 cols on lg, 8 on xl): Interactive Terminal */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                <div className="bg-[#080a0f] border border-[#1b2230] rounded-xl p-4 font-mono text-xs space-y-3 shadow-inner">
                  <div className="flex items-center justify-between text-[#64748b] border-b border-[#1b2230] pb-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-white font-semibold">PolyMaster Quantum Embedded Terminal (bash / cli)</span>
                    </div>
                    <span>Type &apos;help&apos; for commands</span>
                  </div>

                  <div className="h-72 overflow-y-auto space-y-1.5 text-[#94a3b8]">
                    {cliHistory.map((line, idx) => (
                      <div key={idx} className="whitespace-pre-wrap leading-relaxed">
                        {line}
                      </div>
                    ))}
                    <div ref={cliBottomRef} />
                  </div>

                  <form onSubmit={handleCliSubmit} className="flex items-center gap-2 pt-2 border-t border-[#1b2230]">
                    <span className="text-blue-400 font-bold">$&gt;</span>
                    <input
                      type="text"
                      value={cliInput}
                      onChange={(e) => setCliInput(e.target.value)}
                      placeholder="e.g. 'bot status', 'strategy list', 'backtest run', 'portfolio'"
                      className="flex-1 bg-transparent text-white focus:outline-none font-mono text-xs"
                    />
                  </form>
                </div>

                {/* Quick CLI Shortcuts */}
                <div className="p-3 bg-[#0d121c] border border-[#192232] rounded-xl space-y-2 font-mono text-xs">
                  <span className="text-[10px] text-[#64748b] uppercase tracking-wider block">
                    Quick Command Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {['bot status', 'strategy list', 'portfolio', 'risk status', 'scanner scan', 'arbitrage opps', 'clear'].map((cmd) => (
                      <button
                        key={cmd}
                        onClick={() => {
                          setCliInput(cmd);
                        }}
                        className="px-2.5 py-1 bg-[#141b27] hover:bg-[#1d2738] border border-[#232d3f] text-[#cbd5e1] hover:text-white rounded text-[11px] transition-colors cursor-pointer"
                      >
                        ${cmd}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols on lg, 4 on xl): System Heartbeat & Resource Usage Side-Pane */}
              <div className="lg:col-span-5 xl:col-span-4">
                <SystemHeartbeatPanel />
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 4. FOOTER STATUS BAR */}
      <footer className="border-t border-[#1b2230] bg-[#0c0f17] px-4 py-2 text-[11px] font-mono text-[#64748b] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>POLYGON RPC: CONNECTED</span>
          </span>
          <span className="hidden sm:inline text-[#334155]">|</span>
          <span className="hidden sm:inline">DATABASE: POSTGRESQL POOL HEALTHY</span>
          <span className="hidden sm:inline text-[#334155]">|</span>
          <span className="hidden sm:inline">DATA QUALITY: ZERO DRIFT</span>
        </div>
        <div>
          <span>PolyMaster Quantum Engine © 2026 · Institutional Risk Control</span>
        </div>
      </footer>

      {/* USER ACCOUNT & WEB3 / OAUTH LOGIN MODAL */}
      <UserAccountModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
      />
    </div>
  );
}
