/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalTestRunner } from './runAllTests';
import { globalBacktester } from '../backtesting/backtestingEngine';
import { globalCLI } from '../cli/cliInterpreter';

async function main() {
  console.log('=====================================================');
  console.log('POLYMASTER QUANTUM - AUTOMATED VERIFICATION SUITE');
  console.log('=====================================================');

  const { passedCount, failedCount, results } = await globalTestRunner.runAllTests();

  for (const r of results) {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${r.category.padEnd(28)} | ${r.name.padEnd(45)} (${r.durationMs}ms)`);
    if (!r.passed) {
      console.error(`       Error: ${r.message}`);
    }
  }

  console.log('\n-----------------------------------------------------');
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('-----------------------------------------------------\n');

  console.log('[BACKTEST] Running historical event-driven backtest...');
  const bRes = globalBacktester.runBacktest({
    strategyId: 'trend_following',
    symbol: 'BINANCE:SOL_USDT_PERP',
    initialCapitalUsd: 100000,
    startDate: '2026-06-01',
    endDate: '2026-09-29',
    feeTierBps: 5,
    slippageModel: 'SQUARE_ROOT_IMPACT',
    includeFundingRates: true,
    simulatedLatencyMs: 35,
    monteCarloIterations: 1000
  });

  console.log(`[BACKTEST] Final Equity: $${bRes.finalEquity.toFixed(2)} (+${bRes.totalReturnPct}%)`);
  console.log(`[BACKTEST] Sharpe: ${bRes.sharpeRatio} | Sortino: ${bRes.sortinoRatio} | MaxDD: -${bRes.maxDrawdownPct}%`);
  console.log(`[BACKTEST] Win Rate: ${bRes.winRatePct}% | Profit Factor: ${bRes.profitFactor}`);
  console.log(`[BACKTEST] Monte Carlo 95th Percentile Drawdown: -${bRes.monteCarloDistribution.p95Drawdown}%`);

  console.log('\n[CLI TEST] Testing embedded CLI interpreter...');
  const cliStatus = globalCLI.execute('bot status');
  console.log('[CLI TEST] bot status output:');
  console.log(cliStatus);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    console.log('\n✓ ALL AUTOMATED VERIFICATION TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
