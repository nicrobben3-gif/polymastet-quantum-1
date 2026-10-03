/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  AlertTriangle,
  ShieldAlert,
  Zap,
  Filter,
  Search,
  RefreshCw,
  Download,
  Trash2,
  Lock,
  ChevronRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  BarChart2,
  ExternalLink,
  Info
} from 'lucide-react';
import { globalRiskEngine } from '../risk/riskEngine';
import { IRiskEvent, RiskViolationType } from '../types/risk';

interface Props {
  className?: string;
  onNavigateToStrategy?: (strategyId: string) => void;
}

// Strategy display metadata with distinct color badges
export const STRATEGY_THEMES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SOLANA_LP_SNIPER: { label: 'Solana LP Sniper', color: '#10b981', bg: 'bg-emerald-950/70', border: 'border-emerald-700/60' },
  CROSS_EXCHANGE_ARB: { label: 'Cross-Exchange Arb', color: '#38bdf8', bg: 'bg-sky-950/70', border: 'border-sky-700/60' },
  VOLATILITY_SQUEEZE: { label: 'Volatility Squeeze', color: '#a855f7', bg: 'bg-purple-950/70', border: 'border-purple-700/60' },
  MOMENTUM_TREND: { label: 'Momentum Trend', color: '#6366f1', bg: 'bg-indigo-950/70', border: 'border-indigo-700/60' },
  PREDICTION_LOGICAL_ARB: { label: 'Logical Arb (Polymarket)', color: '#f59e0b', bg: 'bg-amber-950/70', border: 'border-amber-700/60' },
  STAT_ARB: { label: 'Statistical Arb', color: '#ec4899', bg: 'bg-pink-950/70', border: 'border-pink-700/60' },
  MEAN_REVERSION: { label: 'Mean Reversion', color: '#3b82f6', bg: 'bg-blue-950/70', border: 'border-blue-700/60' },
  ORDERBOOK_IMBALANCE: { label: 'Orderbook Imbalance', color: '#f43f5e', bg: 'bg-rose-950/70', border: 'border-rose-700/60' },
  UNKNOWN_STRATEGY: { label: 'System / Manual', color: '#94a3b8', bg: 'bg-slate-900', border: 'border-slate-700' }
};

export const VIOLATION_COLORS: Record<string, { label: string; color: string }> = {
  SLIPPAGE_EXCEEDED: { label: 'Slippage Exceeded', color: '#f43f5e' },
  SPREAD_TOO_WIDE: { label: 'Spread Too Wide', color: '#f59e0b' },
  INSUFFICIENT_LIQUIDITY: { label: 'Insufficient Liquidity', color: '#fb923c' },
  POSITION_SIZE_EXCEEDED: { label: 'Position Size Exceeded', color: '#a855f7' },
  LEVERAGE_EXCEEDED: { label: 'Leverage Exceeded', color: '#ef4444' },
  CORRELATED_EXPOSURE_EXCEEDED: { label: 'Correlated Exposure', color: '#e879f9' },
  VENUE_EXPOSURE_EXCEEDED: { label: 'Venue Exposure Cap', color: '#38bdf8' },
  STRATEGY_EXPOSURE_EXCEEDED: { label: 'Strategy Exposure Cap', color: '#818cf8' },
  DRAWDOWN_EXCEEDED: { label: 'Drawdown Cap Exceeded', color: '#eab308' },
  DAILY_LOSS_EXCEEDED: { label: 'Daily Loss Limit', color: '#dc2626' },
  STALE_MARKET_DATA: { label: 'Stale Market Data', color: '#06b6d4' },
  MISSING_STOP_LOSS: { label: 'Missing Stop Loss', color: '#fb7185' },
  KILL_SWITCH_ENGAGED: { label: 'Kill Switch Engaged', color: '#991b1b' },
  CIRCUIT_BREAKER_ACTIVE: { label: 'Circuit Breaker Active', color: '#7f1d1d' }
};

interface ITimeBucket {
  start: number;
  end: number;
  label: string;
  totalViolations: number;
  events: IRiskEvent[];
  strategyBreakdown: Record<string, number>;
  violationBreakdown: Record<string, number>;
}

export const RiskAlertFeedD3: React.FC<Props> = ({
  className = '',
  onNavigateToStrategy
}) => {
  const [events, setEvents] = useState<IRiskEvent[]>(() => globalRiskEngine.getRecentRiskEvents());
  const [selectedStrategyFilter, setSelectedStrategyFilter] = useState<string>('ALL');
  const [selectedViolationFilter, setSelectedViolationFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<{ start: number; end: number } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<ITimeBucket | null>(null);
  const [hoveredStrategy, setHoveredStrategy] = useState<{ strategy: string; count: number; pct: number } | null>(null);

  // SVG Chart References
  const timelineSvgRef = useRef<SVGSVGElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);
  const strategySvgRef = useRef<SVGSVGElement | null>(null);
  const strategyContainerRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to live risk events from the engine
  useEffect(() => {
    const unsubscribe = globalRiskEngine.onRiskEvent((newEvent) => {
      setEvents(globalRiskEngine.getRecentRiskEvents());
    });
    return () => unsubscribe();
  }, []);

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Compute aggregated strategy freeze counts
  const strategyFreezeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of events) {
      const s = ev.strategy || 'UNKNOWN_STRATEGY';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [events]);

  const sortedStrategyRankings = useMemo(() => {
    return Object.entries(strategyFreezeCounts)
      .map(([strategy, count]) => ({
        strategy,
        count,
        pct: events.length > 0 ? (count / events.length) * 100 : 0,
        meta: STRATEGY_THEMES[strategy] || STRATEGY_THEMES.UNKNOWN_STRATEGY
      }))
      .sort((a, b) => b.count - a.count);
  }, [strategyFreezeCounts, events.length]);

  // Aggregate events into time buckets for the D3 spike timeline
  const timeBuckets = useMemo<ITimeBucket[]>(() => {
    const now = Date.now();
    const windowDurationMs = 30 * 60 * 1000; // last 30 minutes
    const bucketDurationMs = 90 * 1000; // 90-second intervals (20 bars total)
    const numBuckets = 20;
    const windowStart = now - windowDurationMs;

    const buckets: ITimeBucket[] = [];
    for (let i = 0; i < numBuckets; i++) {
      const bStart = windowStart + i * bucketDurationMs;
      const bEnd = bStart + bucketDurationMs;
      const date = new Date(bStart);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      buckets.push({
        start: bStart,
        end: bEnd,
        label: timeStr,
        totalViolations: 0,
        events: [],
        strategyBreakdown: {},
        violationBreakdown: {}
      });
    }

    for (const ev of events) {
      if (ev.timestamp < windowStart || ev.timestamp > now) continue;
      const bucketIdx = Math.min(
        numBuckets - 1,
        Math.max(0, Math.floor((ev.timestamp - windowStart) / bucketDurationMs))
      );
      const b = buckets[bucketIdx];
      if (b) {
        b.totalViolations += 1;
        b.events.push(ev);
        const strat = ev.strategy || 'UNKNOWN_STRATEGY';
        b.strategyBreakdown[strat] = (b.strategyBreakdown[strat] || 0) + 1;
        b.violationBreakdown[ev.violation] = (b.violationBreakdown[ev.violation] || 0) + 1;
      }
    }

    return buckets;
  }, [events]);

  // Top triggering strategy
  const topStrategy = sortedStrategyRankings[0];

  // Filtered Alert List for the interactive feed
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedStrategyFilter !== 'ALL' && ev.strategy !== selectedStrategyFilter) {
        return false;
      }
      if (selectedViolationFilter !== 'ALL' && ev.violation !== selectedViolationFilter) {
        return false;
      }
      if (selectedTimeRange) {
        if (ev.timestamp < selectedTimeRange.start || ev.timestamp > selectedTimeRange.end) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDetail = ev.details.toLowerCase().includes(q);
        const matchesStrat = (ev.strategy || '').toLowerCase().includes(q);
        const matchesViol = ev.violation.toLowerCase().includes(q);
        const matchesVenue = (ev.venue || '').toLowerCase().includes(q);
        if (!matchesDetail && !matchesStrat && !matchesViol && !matchesVenue) {
          return false;
        }
      }
      return true;
    });
  }, [events, selectedStrategyFilter, selectedViolationFilter, selectedTimeRange, searchQuery]);

  // =========================================================================
  // D3 RENDERING 1: TIME-SERIES RISK-GATE VIOLATION SPIKE TIMELINE
  // =========================================================================
  useEffect(() => {
    if (!timelineSvgRef.current || !timelineContainerRef.current) return;

    const containerWidth = timelineContainerRef.current.clientWidth || 650;
    const height = 180;
    const margin = { top: 25, right: 25, bottom: 35, left: 38 };
    const innerWidth = Math.max(280, containerWidth - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(timelineSvgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', containerWidth)
      .attr('height', height)
      .attr('viewBox', `0 0 ${containerWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Discrete bands for each 90-sec time bucket
    const xScale = d3
      .scaleBand<number>()
      .domain(timeBuckets.map((_, i) => i))
      .range([0, innerWidth])
      .padding(0.22);

    // Y Scale: Violation Count
    const maxViolations = Math.max(4, d3.max(timeBuckets, (d) => d.totalViolations) || 4);
    const yScale = d3
      .scaleLinear()
      .domain([0, maxViolations + 1])
      .range([innerHeight, 0])
      .nice();

    // Defs for gradients & shadow filters
    const defs = svg.append('defs');

    // Spike gradient (Rose to Amber to Indigo)
    const spikeGradient = defs
      .append('linearGradient')
      .attr('id', 'spikeBarGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    spikeGradient.append('stop').attr('offset', '0%').attr('stop-color', '#f43f5e').attr('stop-opacity', 0.95);
    spikeGradient.append('stop').attr('offset', '60%').attr('stop-color', '#e11d48').attr('stop-opacity', 0.7);
    spikeGradient.append('stop').attr('offset', '100%').attr('stop-color', '#881337').attr('stop-opacity', 0.2);

    // Elevated Spike Warning Zone Gradient (> 2 violations)
    const dangerGradient = defs
      .append('linearGradient')
      .attr('id', 'dangerSpikeGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    dangerGradient.append('stop').attr('offset', '0%').attr('stop-color', '#ff0055').attr('stop-opacity', 1);
    dangerGradient.append('stop').attr('offset', '100%').attr('stop-color', '#fb7185').attr('stop-opacity', 0.8);

    // Grid lines (horizontal)
    const yAxisGrid = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    g.append('g')
      .attr('class', 'grid')
      .call(yAxisGrid)
      .selectAll('line')
      .attr('stroke', '#1e293b')
      .attr('stroke-dasharray', '2,2')
      .attr('stroke-opacity', 0.6);

    g.select('.grid .domain').remove();

    // Protective Throttle Threshold reference line (at 2 violations)
    const thresholdY = yScale(2);
    if (thresholdY >= 0 && thresholdY <= innerHeight) {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', thresholdY)
        .attr('y2', thresholdY)
        .attr('stroke', '#f43f5e')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', thresholdY - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#f43f5e')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .text('THROTTLE THRESHOLD (2+ VIO)');
    }

    // Render Histogram Bars for Time Buckets
    const barGroups = g
      .selectAll('.bar-group')
      .data(timeBuckets)
      .enter()
      .append('g')
      .attr('class', 'bar-group')
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => {
        setHoveredBucket(d);
      })
      .on('mouseleave', () => {
        setHoveredBucket(null);
      })
      .on('click', (event, d) => {
        if (selectedTimeRange && selectedTimeRange.start === d.start) {
          setSelectedTimeRange(null);
        } else {
          setSelectedTimeRange({ start: d.start, end: d.end });
        }
      });

    // Bar background track
    barGroups
      .append('rect')
      .attr('x', (d, i) => xScale(i) || 0)
      .attr('y', 0)
      .attr('width', xScale.bandwidth())
      .attr('height', innerHeight)
      .attr('fill', '#0c1018')
      .attr('rx', 2)
      .attr('opacity', 0.6);

    // Active violation bars with transition animation
    barGroups
      .append('rect')
      .attr('x', (d, i) => xScale(i) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', innerHeight)
      .attr('height', 0)
      .attr('rx', 3)
      .attr('fill', (d) => (d.totalViolations >= 3 ? 'url(#dangerSpikeGradient)' : 'url(#spikeBarGradient)'))
      .attr('stroke', (d) => {
        if (selectedTimeRange && selectedTimeRange.start === d.start) return '#38bdf8';
        return d.totalViolations >= 3 ? '#f43f5e' : d.totalViolations > 0 ? '#e11d48' : 'transparent';
      })
      .attr('stroke-width', (d) => (selectedTimeRange && selectedTimeRange.start === d.start ? 2 : 1))
      .transition()
      .duration(500)
      .delay((_, i) => i * 18)
      .attr('y', (d) => yScale(d.totalViolations))
      .attr('height', (d) => Math.max(0, innerHeight - yScale(d.totalViolations)));

    // Pulse dot atop spike bars (violations >= 2)
    barGroups
      .filter((d) => d.totalViolations >= 2)
      .append('circle')
      .attr('cx', (d, i) => (xScale(i) || 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.totalViolations))
      .attr('r', 3)
      .attr('fill', '#ffffff')
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.5);

    // Numerical counter on bars that have violations
    barGroups
      .filter((d) => d.totalViolations > 0)
      .append('text')
      .attr('x', (d, i) => (xScale(i) || 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => Math.max(12, yScale(d.totalViolations) - 5))
      .attr('text-anchor', 'middle')
      .attr('fill', (d) => (d.totalViolations >= 3 ? '#ff2a5f' : '#cbd5e1'))
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text((d) => d.totalViolations);

    // X Axis with formatted timestamps
    const xAxisTicks = [0, 4, 9, 14, 19];
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(xAxisTicks)
      .tickFormat((idx) => {
        const b = timeBuckets[Number(idx)];
        return b ? b.label : '';
      });

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    g.selectAll('.domain').attr('stroke', '#1e293b');
    g.selectAll('.tick line').attr('stroke', '#1e293b');

    // Y Axis (left)
    const yAxis = d3.axisLeft(yScale).ticks(3);
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#64748b')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');
  }, [timeBuckets, selectedTimeRange]);

  // =========================================================================
  // D3 RENDERING 2: STRATEGY ATTRIBUTION BAR CHART (RANKED PROTECTIVE FREEZES)
  // =========================================================================
  useEffect(() => {
    if (!strategySvgRef.current || !strategyContainerRef.current) return;

    const containerWidth = strategyContainerRef.current.clientWidth || 320;
    const height = 180;
    const margin = { top: 20, right: 35, bottom: 25, left: 110 };
    const innerWidth = Math.max(120, containerWidth - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(strategySvgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('width', containerWidth)
      .attr('height', height)
      .attr('viewBox', `0 0 ${containerWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const topStrategies = sortedStrategyRankings.slice(0, 5);
    if (topStrategies.length === 0) {
      g.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '11px')
        .text('No freeze events recorded');
      return;
    }

    const yScale = d3
      .scaleBand<string>()
      .domain(topStrategies.map((d) => d.strategy))
      .range([0, innerHeight])
      .padding(0.25);

    const maxCount = Math.max(2, d3.max(topStrategies, (d) => d.count) || 2);
    const xScale = d3
      .scaleLinear()
      .domain([0, maxCount * 1.15])
      .range([0, innerWidth]);

    // Horizontal bars
    const barGroups = g
      .selectAll('.strat-bar-group')
      .data(topStrategies)
      .enter()
      .append('g')
      .attr('class', 'strat-bar-group')
      .attr('cursor', 'pointer')
      .on('mouseenter', (event, d) => setHoveredStrategy(d))
      .on('mouseleave', () => setHoveredStrategy(null))
      .on('click', (event, d) => {
        setSelectedStrategyFilter(d.strategy === selectedStrategyFilter ? 'ALL' : d.strategy);
      });

    // Background track
    barGroups
      .append('rect')
      .attr('y', (d) => yScale(d.strategy) || 0)
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', innerWidth)
      .attr('fill', '#0c1018')
      .attr('rx', 3);

    // Active fill bar
    barGroups
      .append('rect')
      .attr('y', (d) => yScale(d.strategy) || 0)
      .attr('x', 0)
      .attr('height', yScale.bandwidth())
      .attr('width', 0)
      .attr('rx', 3)
      .attr('fill', (d) => d.meta.color)
      .attr('stroke', (d) => (d.strategy === selectedStrategyFilter ? '#38bdf8' : 'none'))
      .attr('stroke-width', 1.5)
      .transition()
      .duration(500)
      .delay((_, i) => i * 40)
      .attr('width', (d) => xScale(d.count));

    // Value text
    barGroups
      .append('text')
      .attr('x', (d) => xScale(d.count) + 5)
      .attr('y', (d) => (yScale(d.strategy) || 0) + yScale.bandwidth() / 2 + 3.5)
      .attr('fill', '#ffffff')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text((d) => `${d.count}`);

    // Y Axis Strategy Labels (truncated)
    g.selectAll('.strat-label')
      .data(topStrategies)
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d) => (yScale(d.strategy) || 0) + yScale.bandwidth() / 2 + 3.5)
      .attr('text-anchor', 'end')
      .attr('fill', (d) => (d.strategy === selectedStrategyFilter ? '#38bdf8' : '#cbd5e1'))
      .attr('font-size', '9.5px')
      .attr('font-family', 'monospace')
      .attr('font-weight', (d) => (d.strategy === selectedStrategyFilter ? 'bold' : 'normal'))
      .text((d) => {
        const name = d.meta.label;
        return name.length > 15 ? `${name.slice(0, 14)}…` : name;
      });
  }, [sortedStrategyRankings, selectedStrategyFilter]);

  // Handle Export Audit Log
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `risk_gate_audit_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    triggerNotice('Risk gate audit log exported to JSON.');
  };

  // Handle Trigger Simulated Spike
  const handleSimulateSpike = (targetStrategy?: string) => {
    const newEvents = globalRiskEngine.simulateViolationSpike(targetStrategy, 4);
    setEvents(globalRiskEngine.getRecentRiskEvents());
    triggerNotice(`Simulated risk violation spike (+${newEvents.length} events) injected.`);
  };

  // Handle Clear Log
  const handleClear = () => {
    globalRiskEngine.clearRiskEvents();
    setEvents([]);
    setSelectedTimeRange(null);
    triggerNotice('Risk event log cleared.');
  };

  return (
    <div className={`space-y-5 ${className}`}>
      {/* HEADER & EXECUTIVE SUMMARY BANNER */}
      <div className="bg-[#10141e] border border-[#1b2333] p-5 rounded-xl space-y-4 shadow-lg shadow-black/40">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide uppercase">
                  Protective Risk-Gate Alert Feed & D3 Spike Visualizer
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800/80 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3 text-rose-400" />
                  <span>ZERO BYPASS ENFORCED</span>
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Real-time telemetry of automated trade rejections, circuit trips, and risk limits. Trace which individual strategies trigger protective freezes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              onClick={() => handleSimulateSpike()}
              className="px-3 py-1.5 bg-rose-950/70 hover:bg-rose-900 border border-rose-800/70 text-rose-200 rounded font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>Simulate Spike Burst</span>
            </button>

            <button
              onClick={handleExportJson}
              className="px-2.5 py-1.5 bg-[#131924] hover:bg-[#1c2434] text-[#cbd5e1] border border-[#1f293d] rounded flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#94a3b8]" />
              <span>Export Audit</span>
            </button>

            <button
              onClick={handleClear}
              className="p-1.5 bg-[#131924] hover:bg-rose-950/50 text-[#64748b] hover:text-rose-400 border border-[#1f293d] rounded transition-colors cursor-pointer"
              title="Clear event log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* FEEDBACK NOTICE */}
        {actionNotice && (
          <div className="p-2.5 bg-rose-950/60 border border-rose-800/60 rounded text-xs font-mono text-rose-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* KPI TELEMETRY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#1b2230]">
          <div className="bg-[#090d16] border border-[#1b2333] p-3 rounded-lg">
            <span className="text-[10px] font-mono text-[#64748b] uppercase block">Total Freezes Logged</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-white">{events.length}</span>
              <span className="text-[10px] font-mono text-rose-400">Blocked Trades</span>
            </div>
          </div>

          <div className="bg-[#090d16] border border-[#1b2333] p-3 rounded-lg">
            <span className="text-[10px] font-mono text-[#64748b] uppercase block">Top Trigger Strategy</span>
            <div className="flex items-center gap-1.5 mt-1 truncate">
              {topStrategy ? (
                <>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: topStrategy.meta.color }}
                  />
                  <span className="text-xs font-mono font-bold text-white truncate">
                    {topStrategy.meta.label}
                  </span>
                  <span className="text-[10px] font-mono text-rose-400 font-bold shrink-0">
                    ({topStrategy.count})
                  </span>
                </>
              ) : (
                <span className="text-xs font-mono text-[#64748b]">Nominal (0)</span>
              )}
            </div>
          </div>

          <div className="bg-[#090d16] border border-[#1b2333] p-3 rounded-lg">
            <span className="text-[10px] font-mono text-[#64748b] uppercase block">Peak Spike Cluster</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-amber-400">
                {d3.max(timeBuckets, (d) => d.totalViolations) || 0}
              </span>
              <span className="text-[10px] font-mono text-[#94a3b8]">/ 90s window</span>
            </div>
          </div>

          <div className="bg-[#090d16] border border-[#1b2333] p-3 rounded-lg">
            <span className="text-[10px] font-mono text-[#64748b] uppercase block">Protection Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-emerald-300">GATES ARMED (100%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* D3 VISUALIZATION DUAL-PANE: SPIKE TIMELINE & STRATEGY ATTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* PANE 1 (2 Cols): D3 Violation Spike Timeline */}
        <div
          ref={timelineContainerRef}
          className="lg:col-span-2 bg-[#10141e] border border-[#1b2230] p-4 rounded-xl space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Risk-Gate Violation Spike Timeline (Last 30 Min)
              </h4>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#64748b]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" />
                <span>Spike Cluster</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 bg-rose-950 border border-rose-500 rounded-sm" />
                <span>Violation Baseline</span>
              </span>
            </div>
          </div>

          {/* D3 Timeline SVG */}
          <div className="relative overflow-hidden bg-[#090d16] border border-[#161d2b] rounded-lg p-1">
            <svg ref={timelineSvgRef} className="w-full h-auto block" />

            {/* Hover Tooltip Overlay */}
            {hoveredBucket && (
              <div className="absolute top-2 right-2 bg-[#0c1018]/95 border border-[#232d3f] p-2.5 rounded shadow-xl pointer-events-none text-xs font-mono z-10 max-w-xs backdrop-blur-sm">
                <div className="flex items-center justify-between border-b border-[#1b2230] pb-1 mb-1 text-[11px]">
                  <span className="text-[#94a3b8]">Bucket: {hoveredBucket.label}</span>
                  <span className="text-rose-400 font-bold">{hoveredBucket.totalViolations} Freezes</span>
                </div>
                {hoveredBucket.totalViolations > 0 ? (
                  <div className="space-y-1 text-[10px]">
                    <div className="text-[#64748b] font-semibold">Strategies Blocked:</div>
                    {Object.entries(hoveredBucket.strategyBreakdown).map(([strat, count]) => (
                      <div key={strat} className="flex justify-between text-slate-300">
                        <span>{STRATEGY_THEMES[strat]?.label || strat}:</span>
                        <span className="text-white font-bold">{count}</span>
                      </div>
                    ))}
                    <div className="text-[9px] text-cyan-400 mt-1 italic">Click bar to filter feed to this time slice.</div>
                  </div>
                ) : (
                  <div className="text-[10px] text-[#64748b]">All trading signals nominal.</div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#64748b]">
            <span>Hover bars for time-slice breakdown. Click a spike bar to isolate that time window.</span>
            {selectedTimeRange && (
              <button
                onClick={() => setSelectedTimeRange(null)}
                className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline"
              >
                Clear Time Filter
              </button>
            )}
          </div>
        </div>

        {/* PANE 2 (1 Col): D3 Strategy Freeze Ranking Attribution */}
        <div
          ref={strategyContainerRef}
          className="bg-[#10141e] border border-[#1b2230] p-4 rounded-xl space-y-3 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Top Trigger Strategies
                </h4>
              </div>
              <span className="text-[10px] font-mono text-[#64748b]">Protective Freezes</span>
            </div>
            <p className="text-[11px] text-[#94a3b8] mt-1">
              Ranks which algorithmic strategies triggered the most pre-trade protective risk gates.
            </p>

            {/* D3 Strategy SVG */}
            <div className="relative mt-2 bg-[#090d16] border border-[#161d2b] rounded-lg p-1">
              <svg ref={strategySvgRef} className="w-full h-auto block" />
            </div>
          </div>

          {/* Quick Trace Tip */}
          <div className="p-2.5 bg-[#0a0e17] border border-[#1b2333] rounded text-[11px] font-mono text-[#94a3b8] flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              Click any strategy bar above or tag below to trace its exact trade rejection reasons.
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & TRACEABILITY TOOLBAR */}
      <div className="bg-[#10141e] border border-[#1b2230] p-3.5 rounded-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Strategy Selector Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
            <span className="text-[#64748b] text-[11px] mr-1 uppercase">Filter Strategy:</span>
            <button
              onClick={() => setSelectedStrategyFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                selectedStrategyFilter === 'ALL'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-[#141b27] hover:bg-[#1e283a] text-[#94a3b8]'
              }`}
            >
              All Strategies ({events.length})
            </button>

            {sortedStrategyRankings.map(({ strategy, count, meta }) => {
              const isActive = selectedStrategyFilter === strategy;
              return (
                <button
                  key={strategy}
                  onClick={() => setSelectedStrategyFilter(isActive ? 'ALL' : strategy)}
                  className={`px-2.5 py-1 rounded text-xs flex items-center gap-1.5 transition-colors cursor-pointer border ${
                    isActive
                      ? `${meta.bg} text-white font-bold border-white/60 shadow`
                      : 'bg-[#141b27] hover:bg-[#1e283a] text-[#cbd5e1] border-[#1f293d]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span>{meta.label}</span>
                  <span className="text-[10px] text-rose-400 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative flex items-center min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search symbol, violation, venue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1f293d] text-white text-xs font-mono pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Violation Gate Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1b2230] text-xs font-mono">
          <span className="text-[#64748b] text-[11px] uppercase">Violation Gate:</span>
          <select
            value={selectedViolationFilter}
            onChange={(e) => setSelectedViolationFilter(e.target.value)}
            className="bg-[#090d16] border border-[#1f293d] text-[#cbd5e1] text-xs font-mono px-2.5 py-1 rounded focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">All Violation Gates</option>
            {Object.entries(VIOLATION_COLORS).map(([type, info]) => (
              <option key={type} value={type}>
                {info.label} ({events.filter((e) => e.violation === type).length})
              </option>
            ))}
          </select>

          {/* Active Filter Badges */}
          {(selectedStrategyFilter !== 'ALL' || selectedViolationFilter !== 'ALL' || selectedTimeRange || searchQuery) && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[11px] text-amber-400 font-semibold">Active Filter Trace:</span>
              <button
                onClick={() => {
                  setSelectedStrategyFilter('ALL');
                  setSelectedViolationFilter('ALL');
                  setSelectedTimeRange(null);
                  setSearchQuery('');
                }}
                className="px-2 py-0.5 bg-amber-950/70 hover:bg-amber-900 border border-amber-700/60 text-amber-300 rounded text-[10px] cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ALERT FEED LIST */}
      <div className="bg-[#10141e] border border-[#1b2230] rounded-xl overflow-hidden shadow-lg shadow-black/30">
        <div className="p-3.5 bg-[#0c1018] border-b border-[#1b2230] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Enforcement Log ({filteredEvents.length} Events)
            </h4>
          </div>
          <span className="text-[10px] font-mono text-[#64748b]">
            Showing most recent pre-trade blocks & circuit engagements
          </span>
        </div>

        <div className="divide-y divide-[#1b2230] max-h-[460px] overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
              <p className="text-sm font-mono text-[#cbd5e1]">No Risk Gate Violations Found</p>
              <p className="text-xs text-[#64748b]">
                {events.length > 0
                  ? 'No events match the current filter selection.'
                  : 'All trading algorithms are operating strictly within safety margins.'}
              </p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const stratMeta = STRATEGY_THEMES[ev.strategy || 'UNKNOWN_STRATEGY'] || STRATEGY_THEMES.UNKNOWN_STRATEGY;
              const violMeta = VIOLATION_COLORS[ev.violation] || { label: ev.violation, color: '#f43f5e' };
              const dateObj = new Date(ev.timestamp);
              const timeDisplay = `${dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.${dateObj.getMilliseconds().toString().padStart(3, '0')}`;

              return (
                <div
                  key={ev.id}
                  className="p-3.5 hover:bg-[#131924]/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Timestamp */}
                      <span className="text-[11px] text-[#64748b] flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-[#475569]" />
                        <span>{timeDisplay}</span>
                      </span>

                      {/* Strategy Badge with Trace Action */}
                      <button
                        onClick={() => setSelectedStrategyFilter(ev.strategy || 'ALL')}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer flex items-center gap-1 ${stratMeta.bg} ${stratMeta.border}`}
                        style={{ color: stratMeta.color }}
                        title="Click to isolate this strategy"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stratMeta.color }} />
                        <span>{stratMeta.label}</span>
                      </button>

                      {/* Violation Type Badge */}
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-semibold border"
                        style={{
                          color: violMeta.color,
                          backgroundColor: `${violMeta.color}15`,
                          borderColor: `${violMeta.color}50`
                        }}
                      >
                        {violMeta.label}
                      </span>

                      {/* Venue Badge */}
                      {ev.venue && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#162030] text-[#94a3b8] uppercase">
                          {ev.venue}
                        </span>
                      )}
                    </div>

                    {/* Details explanation */}
                    <div className="text-slate-200 text-xs font-mono break-words leading-relaxed">
                      {ev.details}
                    </div>
                  </div>

                  {/* Action Taken & Trace Strategy Button */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono tracking-wider ${
                        ev.actionTaken === 'BLOCKED'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : ev.actionTaken === 'HALTED_VENUE'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-red-950 text-red-200 border border-red-700'
                      }`}
                    >
                      {ev.actionTaken}
                    </span>

                    <button
                      onClick={() => setSelectedStrategyFilter(ev.strategy || 'ALL')}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Trace Strategy</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
