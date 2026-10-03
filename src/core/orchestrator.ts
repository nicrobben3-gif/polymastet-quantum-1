/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalMarketFeed } from '../data/marketData';
import { globalQualityChecker } from '../data/qualityChecker';
import { globalStrategyRegistry } from '../strategies';
import { globalSignalEngine } from '../signals/masterSignalEngine';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';
import { globalExecutionEngine } from '../execution/executionEngine';
import { globalMarketScanner } from '../market_scanner/marketScanner';
import { globalAiTrader } from '../autopilot/aiTraderEngine';
import { ITradingSignal } from '../types/signal';
import { IMarketData, IOrderBook } from '../types/market';
import { IOrder, IFill } from '../types/execution';
import { IRiskEvent } from '../types/risk';

export type BotLifecycleState = 'STOPPED' | 'INITIALIZING' | 'RUNNING' | 'PAUSED' | 'EMERGENCY_HALT';
export type TradingMode = 'BACKTEST' | 'PAPER' | 'LIVE';

export class MasterOrchestrator {
  private state: BotLifecycleState = 'STOPPED';
  private mode: TradingMode = 'PAPER';
  private loopTimer: any = null;
  private tickCounter = 0;
  private logs: { timestamp: number; level: 'INFO' | 'WARN' | 'ERROR'; message: string }[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.log('INFO', 'Master Orchestrator initialized.');
    
    // Wire fills to portfolio update and logging
    globalExecutionEngine.onFill((fill: IFill) => {
      this.log('INFO', `[EXEC] Fill executed: ${fill.symbol} on ${fill.venue} @ $${fill.price} (Size: ${fill.size}, Fee: $${fill.feeUsd})`);
      this.notify();
    });

    // Wire risk events to logs and emergency actions
    globalRiskEngine.onRiskEvent((evt: IRiskEvent) => {
      this.log(evt.actionTaken === 'EMERGENCY_LIQUIDATE' ? 'ERROR' : 'WARN', `[RISK] ${evt.actionTaken}: ${evt.details}`);
      if (evt.actionTaken === 'EMERGENCY_LIQUIDATE') {
        this.emergencyFlatten();
      }
      this.notify();
    });
  }

  public getStatus() {
    return {
      state: this.state,
      mode: this.mode,
      liveTradingEnabled: globalExecutionEngine.isLiveMode(),
      ticksProcessed: this.tickCounter,
      activePositions: globalPortfolio.getPositions().length,
      portfolioEquity: globalPortfolio.getState().equityUsd,
      todayPnl: globalPortfolio.getState().todayPnlUsd,
      currentDrawdown: globalPortfolio.getState().currentDrawdownPct,
      killSwitchActive: globalRiskEngine.getConfig().killSwitchActive,
      circuitBreakerActive: globalRiskEngine.getConfig().circuitBreakerTriggered
    };
  }

  public setMode(newMode: TradingMode, forceConfirm: boolean = true) {
    if (newMode === 'LIVE' && !forceConfirm && process.env.LIVE_TRADING_ENABLED !== 'true') {
      this.log('WARN', 'Cannot switch to LIVE: Confirmation required.');
      return false;
    }
    this.mode = newMode;
    globalExecutionEngine.setLiveTradingEnabled(newMode === 'LIVE');
    this.log('INFO', `Trading mode switched to: ${newMode}`);
    this.notify();
    return true;
  }

  public start() {
    if (this.state === 'RUNNING') return;
    this.state = 'RUNNING';
    globalMarketFeed.startStreaming(800);

    this.log('INFO', `Master Orchestrator started in [${this.mode}] mode.`);

    // Orchestrator Coordinator Cycle (every 1.5s)
    this.loopTimer = setInterval(() => {
      this.step();
    }, 1500);

    this.notify();
  }

  public stop() {
    if (this.state === 'STOPPED') return;
    this.state = 'STOPPED';
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    globalMarketFeed.stopStreaming();
    this.log('INFO', 'Master Orchestrator halted.');
    this.notify();
  }

  /**
   * The Master Execution Loop:
   * Data Ingestion -> Quality Gate -> Strategy Signals -> Master Signal Engine
   * -> Hard Risk Gate -> Position Sizing -> Execution Engine -> Portfolio State
   */
  public async step() {
    if (this.state !== 'RUNNING') return;
    this.tickCounter++;

    const markets = globalMarketFeed.getAllMarkets();
    const marketMap = new Map<string, IMarketData>();
    const orderbookMap = new Map<string, IOrderBook>();

    // 1. Data Quality Gate
    for (const m of markets) {
      const quality = globalQualityChecker.validate(m);
      if (!quality.isValid) {
        if (quality.isStale) {
          this.log('WARN', `Data Quality Violation: ${m.symbol} is stale (${quality.ageMs}ms)`);
        }
        continue;
      }
      marketMap.set(m.symbol, m);
      const ob = globalMarketFeed.getOrderBook(m.symbol);
      if (ob) orderbookMap.set(m.symbol, ob);
      globalPortfolio.updateMarketPrice(m);
    }

    // 1b. Autonomous AI Trader: Active Position Management & Profit Harvesting
    await globalAiTrader.evaluatePositionsForHarvest(marketMap);

    // 2. Market Scanner updates
    globalMarketScanner.scan(markets, orderbookMap);

    // 3. Multi-Strategy Signal Generation
    const rawSignals: ITradingSignal[] = [];
    for (const strat of globalStrategyRegistry.getAll()) {
      if (!strat.enabled) continue;
      for (const m of markets) {
        const ob = orderbookMap.get(m.symbol);
        try {
          const sig = await strat.generate_signal(m, ob);
          if (sig && strat.validate_signal(sig, m)) {
            rawSignals.push(sig);
          }
        } catch (err: any) {
          this.log('ERROR', `Strategy error in ${strat.id}: ${err.message}`);
        }
      }
    }

    // 4. Master Signal Engine scoring & conflict resolution
    const approvedSignals = globalSignalEngine.processSignals(
      rawSignals,
      marketMap,
      globalPortfolio.getState()
    );

    // 5. Autonomous AI Trader Hands-Free Execution Pipeline
    await globalAiTrader.evaluateSignalsForEntry(approvedSignals, marketMap);

    // Periodic equity tracking for growth chart
    if (this.tickCounter % 2 === 0) {
      globalAiTrader.recordEquitySnapshot();
    }

    this.notify();
  }

  public setKillSwitch(active: boolean) {
    globalRiskEngine.setKillSwitch(active);
    if (active) {
      this.state = 'EMERGENCY_HALT';
      globalExecutionEngine.cancelAll();
      this.emergencyFlatten();
      this.log('ERROR', 'EMERGENCY KILL SWITCH ACTIVATED. Open orders canceled and positions liquidated.');
    } else {
      this.state = 'STOPPED';
      this.log('INFO', 'Kill switch cleared. Bot in STOPPED state.');
    }
    this.notify();
  }

  public emergencyFlatten() {
    const closed = globalPortfolio.emergencyFlattenAll();
    this.log('WARN', `Emergency flattened ${closed.length} open positions to cash.`);
    this.notify();
  }

  public log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
    this.logs.unshift({ timestamp: Date.now(), level, message });
    if (this.logs.length > 250) this.logs.pop();
  }

  public getLogs() {
    return [...this.logs];
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }
}

export const globalOrchestrator = new MasterOrchestrator();
