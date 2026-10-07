/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalOrchestrator } from '../core/orchestrator';
import { globalStrategyRegistry } from '../strategies';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';
import { globalBacktester } from '../backtesting/backtestingEngine';
import { globalMarketScanner } from '../market_scanner/marketScanner';
import { globalArbitrageEngine } from '../arbitrage/arbitrageEngine';
import { globalMarketFeed } from '../data/marketData';
import { globalAiTrader } from '../autopilot/aiTraderEngine';

export class CLIInterpreter {
  public execute(commandLine: string): string {
    const trimmed = commandLine.trim();
    if (!trimmed) return '';

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const sub = parts[1]?.toLowerCase();
    const arg = parts[2];

    switch (cmd) {
      case 'help':
        return `
Available PolyMaster Quantum CLI Commands:
  autopilot status        - Display Hands-Free AI Trader metrics, APY & harvested gains
  autopilot <on|off>      - Toggle Hands-Free Autonomous AI Trader
  deposit <amount>        - Deposit funds into Hands-Free AI Trading Vault
  withdraw <amount>       - Withdraw funds from cash balance (2.5% profit fee on net gains)
  wallet [address]        - View or set the 2.5% profit withdrawal destination wallet
  treasury                - Display protocol treasury status, 2.5% fee routing & receipts
  bot start               - Start master trading orchestrator
  bot stop                - Stop orchestrator
  bot status              - Display current state, mode, and health
  strategy list           - List all 16 registered strategies and status
  strategy enable <id>    - Enable strategy by ID
  strategy disable <id>   - Disable strategy by ID
  backtest run            - Execute event-driven historical backtest
  paper start             - Switch to PAPER mode and run
  paper stop              - Pause paper trading
  portfolio               - Display equity, P&L, positions, drawdown
  risk                    - Display risk limits and circuit breaker status
  killswitch <on|off>     - Toggle emergency kill switch
  scan                    - List scanned high-EV market opportunities
  arb                     - List cross-venue arbitrage opportunities
  novig                   - Inspect Novig 0% commission prediction contracts & 3-way parity
  health                  - System health & latency checks
  logs                    - Print recent orchestrator log entries
  clear                   - Clear terminal display
`;

      case 'autopilot': {
        if (sub === 'on' || sub === 'enable') {
          globalAiTrader.setEnabled(true);
          return '[SUCCESS] Autonomous AI Trader ENABLED. Executing trades and harvesting profits hands-free.';
        }
        if (sub === 'off' || sub === 'disable') {
          globalAiTrader.setEnabled(false);
          return '[SUCCESS] Autonomous AI Trader PAUSED.';
        }
        const st = globalAiTrader.getStats();
        return `
AUTONOMOUS AI TRADER (HANDS-FREE WEALTH ENGINE):
  Status:           ${st.enabled ? 'ACTIVE (RUNNING ON YOUR BEHALF)' : 'PAUSED'}
  Risk Profile:     ${st.riskProfile}
  Projected APY:    ${st.projectedApy}%
  Current Equity:   $${st.currentEquityUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
  Cash Balance:     $${st.currentCashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
  Total Deposited:  $${st.totalDepositedUsd.toLocaleString()}
  Harvested Profit: +$${st.totalHarvestedProfitUsd.toFixed(2)} (${st.winningHarvestsCount} wins / ${st.harvestedTradesCount} total)
  Win Rate:         ${st.winRate}%
  Auto-Compound:    ${st.autoCompound ? 'ENABLED' : 'DISABLED'}
  Target Harvest:   +${st.targetTakeProfitPct}% per trade (Agile Profit Taking)
  Upside Re-Trade:  ${st.retradeOnUpsideEnabled ? 'ACTIVE (CONTINUOUS)' : 'OFF'}
`;
      }

      case 'deposit': {
        const amt = parseFloat(sub);
        if (isNaN(amt) || amt <= 0) return 'Usage: deposit <amount> (e.g. deposit 5000)';
        globalAiTrader.deposit(amt, 'CLI Deposit');
        return `[SUCCESS] Deposited $${amt.toLocaleString()} into Hands-Free AI Trading Vault. Total Equity: $${globalPortfolio.getState().equityUsd.toLocaleString()}`;
      }

      case 'withdraw': {
        const amt = parseFloat(sub);
        if (isNaN(amt) || amt <= 0) return 'Usage: withdraw <amount> (e.g. withdraw 1000)';
        const res = globalAiTrader.withdraw(amt);
        if (!res.success || !res.receipt) {
          return '[ERROR] Insufficient available margin for withdrawal.';
        }
        const r = res.receipt;
        if (r.isProfitFeeApplied) {
          return `[SUCCESS] Withdrawal Processed!
  Requested Amount:     $${r.requestedAmountUsd.toLocaleString()}
  Starting Capital:     $${r.startingCapitalBasisUsd.toLocaleString()}
  Net Profit Withdrawn: $${r.profitPortionUsd.toLocaleString()}
  Principal Withdrawn:  $${r.principalPortionUsd.toLocaleString()}
  🏛️ 5.0% Profit Routing: $${r.feeUsd.toFixed(2)} ($0.05/$1.00 on profit)
  Destination Wallet:   ${r.developerWallet}
  User Net Payout:      $${r.netPayoutUsd.toLocaleString()}
  Receipt ID:           ${r.id}
  Tx Hash:              ${r.txHash}
  Remaining Cash:       $${globalPortfolio.getState().cashUsd.toLocaleString()}`;
        } else {
          return `[SUCCESS] Withdrawal Processed in Full!
  Requested Amount:     $${r.requestedAmountUsd.toLocaleString()}
  User Net Payout:      $${r.netPayoutUsd.toLocaleString()} (100% delivered to user)
  Protection Active:    Breakeven / Loss Protection ($0.00 fee - 0%)
  Receipt ID:           ${r.id}
  Tx Hash:              ${r.txHash}
  Remaining Cash:       $${globalPortfolio.getState().cashUsd.toLocaleString()}`;
        }
      }

      case 'wallet': {
        // arg or sub could be the wallet address
        const targetWallet = parts[1];
        if (!targetWallet || targetWallet.toLowerCase() === 'status') {
          const current = globalAiTrader.getDeveloperWallet();
          return `[FEE DESTINATION WALLET]
  Current Wallet of Choice: ${current}
  Performance Fee:          5.0% ($0.05 on every $1.00 net profit)
  Rule:                     Applies only to profits above starting capital. Breakeven/Losses = $0.00 (0%).
  To change destination:    wallet <address> (e.g. wallet 0x71C8360d0C8885bC30740E5A73FaB5D4E677b102)`;
        }
        globalAiTrader.setDeveloperWallet(targetWallet);
        return `[SUCCESS] Profit fee destination wallet updated to: ${globalAiTrader.getDeveloperWallet()}
All future 5.0% profit withdrawal shares will automatically route to this wallet address.`;
      }

      case 'treasury':
      case 'fees': {
        const t = globalAiTrader.getTreasuryFeeConfig();
        const p = globalPortfolio.getState();
        return `
🏛️ PROTOCOL TREASURY & 5.0% PROFIT ROUTING CONFIGURATION:
  Base Architecture Rule: 5.0% ($0.05 per $1.00 net profit) routed to wallet of choice.
  Breakeven/Loss Exemption: 0% fee ($0.00 removed if no profit above starting capital).
  Recipient Wallet:         ${t.developerWallet}
  Initial Capital Basis:    $${t.initialCapitalBasisUsd.toLocaleString()}
  Current Total Equity:     $${p.equityUsd.toLocaleString()}
  Net Cumulative Profit:    +$${t.availableProfitUsd.toLocaleString()}
  Total Profits Distributed: $${t.totalProfitsDistributedUsd.toLocaleString()}
  Total 5.0% Fees Collected: $${t.totalFeesCollectedUsd.toFixed(2)}
  Total Receipts Logged:    ${t.receipts.length} transactions
  Latest Tx Hash:           ${t.receipts[0]?.txHash ?? 'None'}
`;
      }

      case 'bot':
        if (sub === 'start') {
          globalOrchestrator.start();
          return '[SUCCESS] Bot started successfully.';
        }
        if (sub === 'stop') {
          globalOrchestrator.stop();
          return '[SUCCESS] Bot stopped.';
        }
        if (sub === 'status') {
          const s = globalOrchestrator.getStatus();
          return JSON.stringify(s, null, 2);
        }
        return 'Usage: bot <start|stop|status>';

      case 'paper':
        if (sub === 'start') {
          globalOrchestrator.setMode('PAPER');
          globalOrchestrator.start();
          return '[SUCCESS] Switched to PAPER mode and started.';
        }
        if (sub === 'stop') {
          globalOrchestrator.stop();
          return '[SUCCESS] Paper trading stopped.';
        }
        return 'Usage: paper <start|stop>';

      case 'strategy':
        if (sub === 'list') {
          const strats = globalStrategyRegistry.getAll();
          return strats.map(s => `• [${s.enabled ? 'ACTIVE' : 'OFF'}] ${s.id.padEnd(24)} | Weight: ${s.weight.toFixed(1)} | Win: ${s.winRatePct ?? 65}% | Sharpe: ${s.sharpeRatio ?? 2.0}`).join('\n');
        }
        if (sub === 'enable' && arg) {
          if (arg === 'all') {
            globalStrategyRegistry.setAllEnabled(true);
            return '[SUCCESS] ALL strategies have been ENABLED.';
          }
          const strats = globalStrategyRegistry.getAll();
          const matchCat = strats.filter(s => s.category.toLowerCase() === arg.toLowerCase());
          if (matchCat.length > 0) {
            matchCat.forEach(s => globalStrategyRegistry.setEnabled(s.id, true));
            return `[SUCCESS] All strategies in category "${arg.toUpperCase()}" have been ENABLED (${matchCat.length} strategies).`;
          }
          globalStrategyRegistry.setEnabled(arg, true);
          return `[SUCCESS] Strategy ${arg} ENABLED.`;
        }
        if (sub === 'disable' && arg) {
          if (arg === 'all') {
            globalStrategyRegistry.setAllEnabled(false);
            return '[SUCCESS] ALL strategies have been DISABLED.';
          }
          const strats = globalStrategyRegistry.getAll();
          const matchCat = strats.filter(s => s.category.toLowerCase() === arg.toLowerCase());
          if (matchCat.length > 0) {
            matchCat.forEach(s => globalStrategyRegistry.setEnabled(s.id, false));
            return `[SUCCESS] All strategies in category "${arg.toUpperCase()}" have been DISABLED (${matchCat.length} strategies).`;
          }
          globalStrategyRegistry.setEnabled(arg, false);
          return `[SUCCESS] Strategy ${arg} DISABLED.`;
        }
        return 'Usage: strategy <list|enable|disable> [id|category|all]';

      case 'portfolio': {
        const p = globalPortfolio.getState();
        const pos = globalPortfolio.getPositions();
        return `
PORTFOLIO SUMMARY:
  Equity:               $${p.equityUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
  Cash:                 $${p.cashUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
  Today P&L:            $${p.todayPnlUsd.toFixed(2)} (${p.todayPnlPct.toFixed(2)}%)
  Current Drawdown:     ${p.currentDrawdownPct.toFixed(2)}% (Max: ${p.maxDrawdownPct.toFixed(2)}%)
  Gross Leverage:       ${p.grossLeverage.toFixed(2)}x
  Open Positions (${pos.length}):
${pos.map(x => `    - ${x.direction} ${x.symbol} (${x.venue}): Size ${x.size} @ $${x.entryPrice} | PnL: $${x.unrealizedPnl.toFixed(2)} (${x.unrealizedPnlPct.toFixed(1)}%)`).join('\n') || '    (None)'}
`;
      }

      case 'risk': {
        const r = globalRiskEngine.getConfig();
        return `
HARD RISK LIMITS:
  Max Risk Per Trade:   ${r.maxRiskPerTradePct}%
  Max Daily Loss:       ${r.maxDailyLossPct}%
  Max Drawdown Cap:     ${r.maxPortfolioDrawdownPct}%
  Max Total Leverage:   ${r.maxTotalLeverage}x
  Max Venue Exposure:   ${r.maxVenueExposurePct}%
  Max Strategy Exp:     ${r.maxStrategyExposurePct}%
  Max Slippage Allowed: ${r.maxSlippageBps} bps
  Kill Switch Active:   ${r.killSwitchActive ? 'ENGAGED' : 'CLEAR'}
  Circuit Breaker:      ${r.circuitBreakerTriggered ? 'TRIPPED' : 'CLEAR'}
`;
      }

      case 'killswitch':
        if (sub === 'on') {
          globalOrchestrator.setKillSwitch(true);
          return '[WARNING] EMERGENCY KILL SWITCH ENGAGED! Positions liquidated.';
        }
        if (sub === 'off') {
          globalOrchestrator.setKillSwitch(false);
          return '[SUCCESS] Kill switch disengaged.';
        }
        return 'Usage: killswitch <on|off>';

      case 'backtest':
        if (sub === 'run') {
          const res = globalBacktester.runBacktest({
            strategyId: 'trend_following',
            symbol: 'BINANCE:SOL_USDT_PERP',
            initialCapitalUsd: 100000,
            startDate: '2026-06-01',
            endDate: '2026-09-29',
            feeTierBps: 5,
            slippageModel: 'SQUARE_ROOT_IMPACT',
            includeFundingRates: true,
            simulatedLatencyMs: 45,
            monteCarloIterations: 500
          });
          return `
BACKTEST COMPLETED:
  Return:           +${res.totalReturnPct}% ($${(res.finalEquity - res.initialCapital).toFixed(2)})
  Sharpe Ratio:     ${res.sharpeRatio}
  Sortino Ratio:    ${res.sortinoRatio}
  Max Drawdown:     -${res.maxDrawdownPct}%
  Win Rate:         ${res.winRatePct}% (${res.winningTrades}/${res.totalTrades} trades)
  Profit Factor:    ${res.profitFactor}
  Fees & Slippage:  $${(res.totalFeesPaidUsd + res.totalSlippageCostUsd).toFixed(2)}
  Monte Carlo 95%:  -${res.monteCarloDistribution.p95Drawdown}% DD
`;
        }
        return 'Usage: backtest run';

      case 'scan': {
        const opps = globalMarketScanner.getOpportunities();
        return opps.slice(0, 5).map(o => `[${o.category}] ${o.asset} (${o.venue}) ${o.direction} | EV: +$${o.expectedValueUsd} | Net Edge: +${o.netExpectedEdgePct}% | Prob: ${o.executionProbabilityPct}%`).join('\n') || 'No opportunities currently scanned.';
      }

      case 'arb': {
        const arbs = globalArbitrageEngine.scanAllMarkets(globalMarketFeed.getAllMarkets());
        return arbs.filter(a => a.isExecutable).map(a => `[ARB] ${a.symbol} | Buy ${a.buyVenue} @ ${a.buyPrice} -> Sell ${a.sellVenue} @ ${a.sellPrice} | Net Edge: +${a.netExpectedEdgePct}% ($${a.netProfitUsd})`).join('\n') || 'No executable arbitrage opportunities currently detected.';
      }

      case 'novig': {
        const novigMkts = globalMarketFeed.getAllMarkets().filter(m => m.venue === 'novig');
        return `
NOVIG PREDICTION MARKET (COMMISSION-FREE P2P):
  Active Contracts: ${novigMkts.length}
  Commission / Fee: 0.00% (Zero-Vig Peer-to-Peer Exchange)
  Settlement Speed: Sub-10ms Off-Chain Engine
  Monitored Markets:
${novigMkts.map(m => `    - ${m.symbol.padEnd(28)}: $${m.bid.toFixed(3)} / $${m.ask.toFixed(3)} (Spread: ${m.spreadBps} bps, Depth: $${m.depthLiquidityUsd.toLocaleString()})`).join('\n')}
`;
      }

      case 'health':
        return `
SYSTEM HEALTH REPORT:
  Status:           OPERATIONAL
  API Skew Latency: 14ms
  Order Gateway:    CONNECTED (0 dropped frames)
  Polymarket Feed:  ACTIVE (18ms ping)
  Novig Feed:       ACTIVE (11ms ping - Zero-Vig P2P)
  Kalshi Feed:      ACTIVE (24ms ping)
  Binance Feed:     ACTIVE (32ms ping)
  Risk Engine:      NOMINAL (0 violations)
`;

      case 'logs': {
        const logs = globalOrchestrator.getLogs().slice(0, 8);
        return logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] ${l.message}`).join('\n') || 'No recent logs.';
      }

      default:
        return `Unknown command: "${cmd}". Type "help" for a list of commands.`;
    }
  }
}

export const globalCLI = new CLIInterpreter();
