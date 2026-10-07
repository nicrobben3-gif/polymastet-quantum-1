/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';
import { globalOrchestrator } from '../core/orchestrator';

export interface IMetricsSnapshot {
  timestamp: number;
  ordersSubmitted: number;
  ordersFilled: number;
  ordersRejected: number;
  riskViolationsTotal: number;
  totalVolumeUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number;
  equityUsd: number;
  grossLeverage: number;
  currentDrawdownPct: number;
  activePositions: number;
  avgExecutionLatencyMs: number;
}

export class MetricsCollector {
  private ordersSubmitted = 0;
  private ordersFilled = 0;
  private ordersRejected = 0;
  private riskViolationsCount = 0;
  private totalVolumeUsd = 0;
  private latencies: number[] = [];

  public recordOrderSubmitted(notionalUsd: number) {
    this.ordersSubmitted++;
    this.totalVolumeUsd += notionalUsd;
  }

  public recordOrderFilled(latencyMs: number) {
    this.ordersFilled++;
    this.latencies.push(latencyMs);
    if (this.latencies.length > 200) this.latencies.shift();
  }

  public recordOrderRejected() {
    this.ordersRejected++;
  }

  public recordRiskViolation() {
    this.riskViolationsCount++;
  }

  public getSnapshot(): IMetricsSnapshot {
    const portfolio = globalPortfolio.getState();
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 32;

    return {
      timestamp: Date.now(),
      ordersSubmitted: this.ordersSubmitted,
      ordersFilled: this.ordersFilled,
      ordersRejected: this.ordersRejected,
      riskViolationsTotal: this.riskViolationsCount,
      totalVolumeUsd: Number(this.totalVolumeUsd.toFixed(2)),
      realizedPnlUsd: Number(portfolio.totalRealizedPnlUsd.toFixed(2)),
      unrealizedPnlUsd: Number(portfolio.totalUnrealizedPnlUsd.toFixed(2)),
      equityUsd: Number(portfolio.equityUsd.toFixed(2)),
      grossLeverage: Number(portfolio.grossLeverage.toFixed(2)),
      currentDrawdownPct: Number(portfolio.currentDrawdownPct.toFixed(2)),
      activePositions: portfolio.positionsCount,
      avgExecutionLatencyMs: Number(avgLatency.toFixed(1))
    };
  }

  /**
   * Generates standard Prometheus exposition format string.
   */
  public toPrometheusFormat(): string {
    const s = this.getSnapshot();
    const status = globalOrchestrator.getStatus();
    const mode = status.mode.toLowerCase();

    return `# HELP polymaster_orders_total Total number of orders submitted
# TYPE polymaster_orders_total counter
polymaster_orders_total{mode="${mode}",status="submitted"} ${s.ordersSubmitted}
polymaster_orders_total{mode="${mode}",status="filled"} ${s.ordersFilled}
polymaster_orders_total{mode="${mode}",status="rejected"} ${s.ordersRejected}

# HELP polymaster_risk_violations_total Total pre-trade risk engine violations
# TYPE polymaster_risk_violations_total counter
polymaster_risk_violations_total{mode="${mode}"} ${s.riskViolationsTotal}

# HELP polymaster_equity_usd Current total portfolio equity in USD
# TYPE polymaster_equity_usd gauge
polymaster_equity_usd{mode="${mode}"} ${s.equityUsd}

# HELP polymaster_drawdown_pct Current drawdown percentage from high-water mark
# TYPE polymaster_drawdown_pct gauge
polymaster_drawdown_pct{mode="${mode}"} ${s.currentDrawdownPct}

# HELP polymaster_positions_active Active open positions count
# TYPE polymaster_positions_active gauge
polymaster_positions_active{mode="${mode}"} ${s.activePositions}

# HELP polymaster_execution_latency_ms Moving average execution latency in milliseconds
# TYPE polymaster_execution_latency_ms gauge
polymaster_execution_latency_ms{mode="${mode}"} ${s.avgExecutionLatencyMs}

# HELP polymaster_kill_switch_active Kill switch status (1 = engaged, 0 = normal)
# TYPE polymaster_kill_switch_active gauge
polymaster_kill_switch_active{mode="${mode}"} ${status.killSwitchActive ? 1 : 0}
`;
  }
}

export const globalMetrics = new MetricsCollector();
