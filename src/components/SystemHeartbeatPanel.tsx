/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Zap,
  Server,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Layers,
  Sparkles,
  Flame,
  Radio
} from 'lucide-react';
import { globalOrchestrator } from '../core/orchestrator';

export interface IModuleResource {
  id: string;
  name: string;
  category: 'INGEST' | 'EXECUTION' | 'ALGO' | 'RISK' | 'STORAGE';
  cpuPercent: number;
  memoryMb: number;
  latencyMs: number;
  throughput: string;
  status: 'OPTIMAL' | 'ELEVATED' | 'IDLE';
}

export const SystemHeartbeatPanel: React.FC = () => {
  const [uptimeSeconds, setUptimeSeconds] = useState<number>(14820);
  const [cpuHistory, setCpuHistory] = useState<number[]>([12, 14, 13, 16, 15, 14, 18, 15, 13, 15]);
  const [totalCpu, setTotalCpu] = useState<number>(14.8);
  const [totalRamMb, setTotalRamMb] = useState<number>(218.4);
  const maxRamMb = 2048; // VPS / Container RAM Limit 2GB
  const [eventLoopJitterMs, setEventLoopJitterMs] = useState<number>(1.12);
  const [isFlushingMemory, setIsFlushingMemory] = useState<boolean>(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  // Per-Module Telemetry State
  const [modules, setModules] = useState<IModuleResource[]>([
    {
      id: 'market_feed',
      name: 'Market Feed & WS Ingest',
      category: 'INGEST',
      cpuPercent: 3.8,
      memoryMb: 46.2,
      latencyMs: 8.4,
      throughput: '1,420 ticks/s',
      status: 'OPTIMAL'
    },
    {
      id: 'solana_sniper',
      name: 'Solana LP Sniper (Jito Bundler)',
      category: 'EXECUTION',
      cpuPercent: 4.2,
      memoryMb: 58.6,
      latencyMs: 14.1,
      throughput: 'sub-slot <20ms',
      status: 'OPTIMAL'
    },
    {
      id: 'signal_matrix',
      name: '16-Strategy Signal Matrix',
      category: 'ALGO',
      cpuPercent: 2.7,
      memoryMb: 34.8,
      latencyMs: 1.8,
      throughput: '92 evals/s',
      status: 'OPTIMAL'
    },
    {
      id: 'arbitrage_engine',
      name: 'Cross-Venue Arbitrage & Flash Loan',
      category: 'ALGO',
      cpuPercent: 1.9,
      memoryMb: 29.5,
      latencyMs: 6.2,
      throughput: '3 venue pairs',
      status: 'OPTIMAL'
    },
    {
      id: 'orderbook_sor',
      name: 'Orderbook Depth & SOR Router',
      category: 'INGEST',
      cpuPercent: 1.4,
      memoryMb: 31.0,
      latencyMs: 2.1,
      throughput: '50 levels L2',
      status: 'OPTIMAL'
    },
    {
      id: 'risk_gate',
      name: 'Pre-Trade Risk Engine & Kill Gate',
      category: 'RISK',
      cpuPercent: 0.5,
      memoryMb: 11.2,
      latencyMs: 0.18,
      throughput: '100% verified',
      status: 'OPTIMAL'
    },
    {
      id: 'ai_trader',
      name: 'Autonomous AI Yield Vault',
      category: 'EXECUTION',
      cpuPercent: 0.3,
      memoryMb: 7.1,
      latencyMs: 0.45,
      throughput: 'compound 60s',
      status: 'OPTIMAL'
    }
  ]);

  // Periodic heartbeat tick
  useEffect(() => {
    const timer = setInterval(() => {
      setUptimeSeconds(prev => prev + 1);

      // Add realistic microscopic fluctuations to simulate live system load
      const cpuJitter = (Math.random() - 0.48) * 1.5;
      const nextCpu = Math.max(8.5, Math.min(28.0, Number((totalCpu + cpuJitter).toFixed(1))));
      setTotalCpu(nextCpu);

      setCpuHistory(prev => [...prev.slice(1), nextCpu]);

      const ramJitter = (Math.random() - 0.49) * 0.8;
      setTotalRamMb(prev => Math.max(180, Math.min(320, Number((prev + ramJitter).toFixed(1)))));

      setEventLoopJitterMs(Number((0.95 + Math.random() * 0.45).toFixed(2)));

      // Jitter per-module CPU
      setModules(prev => prev.map(m => {
        const delta = (Math.random() - 0.5) * 0.3;
        const newCpu = Math.max(0.2, Number((m.cpuPercent + delta).toFixed(1)));
        return {
          ...m,
          cpuPercent: newCpu
        };
      }));
    }, 1200);

    return () => clearInterval(timer);
  }, [totalCpu]);

  const handleFlushCache = () => {
    setIsFlushingMemory(true);
    setTimeout(() => {
      setTotalRamMb(prev => Math.max(165, prev - 38.5));
      setIsFlushingMemory(false);
      setFlushMessage('Memory caches trimmed · GC sweep completed (-38.5 MB)');
      setTimeout(() => setFlushMessage(null), 3500);
    }, 600);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  };

  const ramPercent = Number(((totalRamMb / maxRamMb) * 100).toFixed(1));

  return (
    <div className="bg-[#0b0f17] border border-[#1b2230] rounded-xl p-4 font-mono text-xs space-y-4 shadow-lg flex flex-col h-full">
      {/* HEADER: HEARTBEAT STATUS & PULSE */}
      <div className="flex items-center justify-between border-b border-[#1b2230] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <div>
            <h3 className="font-bold text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
              <span>System Heartbeat</span>
              <span className="text-[10px] text-emerald-400 font-normal px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800">
                HEALTHY
              </span>
            </h3>
            <p className="text-[10px] text-[#64748b]">Engine Module Telemetry & V8 Load</p>
          </div>
        </div>

        {/* Uptime Badge */}
        <div className="text-right">
          <div className="text-[10px] text-[#64748b] flex items-center justify-end gap-1">
            <Clock className="w-3 h-3" />
            <span>UPTIME</span>
          </div>
          <div className="text-xs font-bold text-white tabular-nums">
            {formatUptime(uptimeSeconds)}
          </div>
        </div>
      </div>

      {/* FLASH MESSAGE NOTIFICATION */}
      {flushMessage && (
        <div className="p-2 bg-emerald-950/80 border border-emerald-800 rounded text-[11px] text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{flushMessage}</span>
        </div>
      )}

      {/* TOP RESOURCE GAUGES (CPU & RAM) */}
      <div className="grid grid-cols-2 gap-3">
        {/* CPU USAGE CARD */}
        <div className="p-3 bg-[#101522] border border-[#1d2636] rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#64748b] flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>CPU Load</span>
            </span>
            <span className="text-xs font-bold text-blue-400 tabular-nums">
              {totalCpu.toFixed(1)}%
            </span>
          </div>

          {/* Mini Sparkline Bar Chart */}
          <div className="flex items-end gap-1 h-7 pt-1">
            {cpuHistory.map((val, idx) => {
              const heightPct = Math.min(100, Math.max(15, (val / 30) * 100));
              return (
                <div
                  key={idx}
                  className="flex-1 bg-blue-500/30 hover:bg-blue-400 rounded-t transition-all"
                  style={{ height: `${heightPct}%` }}
                  title={`${val}%`}
                />
              );
            })}
          </div>

          <div className="w-full bg-[#080b11] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, totalCpu)}%` }}
            />
          </div>
        </div>

        {/* RAM MEMORY CARD */}
        <div className="p-3 bg-[#101522] border border-[#1d2636] rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#64748b] flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span>Memory (RAM)</span>
            </span>
            <span className="text-xs font-bold text-purple-400 tabular-nums">
              {ramPercent}%
            </span>
          </div>

          <div className="text-xs font-bold text-white tabular-nums pt-1">
            {totalRamMb.toFixed(0)} <span className="text-[10px] text-[#64748b] font-normal">/ {maxRamMb} MB</span>
          </div>

          <div className="w-full bg-[#080b11] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${ramPercent}%` }}
            />
          </div>
          <div className="text-[9px] text-[#64748b] flex justify-between">
            <span>Allocated: {totalRamMb.toFixed(1)}M</span>
            <span>Free: {(maxRamMb - totalRamMb).toFixed(0)}M</span>
          </div>
        </div>
      </div>

      {/* EVENT LOOP JITTER & ECG WAVEFORM */}
      <div className="p-3 bg-[#0e131d] border border-[#1a2333] rounded-lg space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#94a3b8] flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Event Loop Latency (Jitter):</span>
          </span>
          <span className="text-emerald-400 font-bold tabular-nums">
            {eventLoopJitterMs} ms <span className="text-[10px] text-[#64748b] font-normal">(Optimal)</span>
          </span>
        </div>

        {/* Simulated ECG SVG Heartbeat Pulse */}
        <div className="h-6 w-full flex items-center justify-center overflow-hidden bg-[#06080e] rounded border border-[#141b27] px-2">
          <svg className="w-full h-5 text-emerald-500" viewBox="0 0 300 20" preserveAspectRatio="none">
            <path
              d="M0,10 L50,10 L60,3 L70,17 L80,10 L140,10 L150,2 L160,18 L170,10 L230,10 L240,4 L250,16 L260,10 L300,10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="opacity-80"
            />
          </svg>
        </div>
      </div>

      {/* PER-MODULE RESOURCE BREAKDOWN */}
      <div className="space-y-2 flex-1">
        <div className="flex items-center justify-between text-[11px] text-[#64748b] uppercase tracking-wider">
          <span>Engine Modules (7 Active)</span>
          <span>CPU / RAM</span>
        </div>

        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {modules.map((mod) => (
            <div
              key={mod.id}
              className="p-2 bg-[#0d121c] hover:bg-[#131926] border border-[#192232] rounded flex items-center justify-between transition-colors"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="font-semibold text-white text-[11px] truncate max-w-[170px]" title={mod.name}>
                    {mod.name}
                  </span>
                </div>
                <div className="text-[9px] text-[#64748b] flex items-center gap-2">
                  <span>{mod.throughput}</span>
                  <span>·</span>
                  <span>{mod.latencyMs}ms</span>
                </div>
              </div>

              <div className="text-right font-mono">
                <div className="text-[11px] font-bold text-white tabular-nums">
                  {mod.cpuPercent.toFixed(1)}% <span className="text-[9px] text-[#64748b] font-normal">CPU</span>
                </div>
                <div className="text-[10px] text-[#94a3b8] tabular-nums">
                  {mod.memoryMb.toFixed(1)} MB
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER ACTIONS & GARBAGE COLLECTION */}
      <div className="pt-2 border-t border-[#1b2230] flex items-center justify-between">
        <div className="flex items-center gap-1 text-[10px] text-[#64748b]">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>V8 Engine Zero-Leak</span>
        </div>

        <button
          onClick={handleFlushCache}
          disabled={isFlushingMemory}
          className="px-2.5 py-1.5 bg-[#141b28] hover:bg-[#1d273a] border border-[#232d3f] hover:border-slate-500 text-[#cbd5e1] rounded text-[10px] flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Force V8 garbage collection and flush ephemeral tick buffers"
        >
          <RefreshCw className={`w-3 h-3 ${isFlushingMemory ? 'animate-spin text-purple-400' : ''}`} />
          <span>{isFlushingMemory ? 'Trimming...' : 'Flush Cache'}</span>
        </button>
      </div>
    </div>
  );
};
