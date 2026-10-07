/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, Activity, ChevronDown, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { globalNetworkMonitor, INetworkEndpoint } from '../network/networkMonitor';

export const NetworkStatusBadge: React.FC = () => {
  const [endpoints, setEndpoints] = useState<INetworkEndpoint[]>(() => globalNetworkMonitor.getEndpoints());
  const [avgLatency, setAvgLatency] = useState<number>(() => globalNetworkMonitor.getAverageLatencyMs());
  const [overallStatus, setOverallStatus] = useState(() => globalNetworkMonitor.getOverallStatus());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsub = globalNetworkMonitor.subscribe(() => {
      setEndpoints(globalNetworkMonitor.getEndpoints());
      setAvgLatency(globalNetworkMonitor.getAverageLatencyMs());
      setOverallStatus(globalNetworkMonitor.getOverallStatus());
    });
    return () => unsub();
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#101726] hover:bg-[#162136] border border-[#232d3f] hover:border-cyan-500/40 text-xs font-mono transition-all cursor-pointer shadow-sm"
        title="View RPC & WebSocket Live Latency"
      >
        <span className={`w-2 h-2 rounded-full ${
          overallStatus === 'OPTIMAL' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
        }`}></span>
        <span className="text-[#94a3b8] hidden md:inline">NET:</span>
        <span className="text-white font-bold">{avgLatency}ms</span>
        <ChevronDown className="w-3 h-3 text-[#64748b]" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 z-50 w-80 bg-[#0f1422] border border-[#232d3f] rounded-xl shadow-2xl p-3 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#1b2230] pb-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                <span>Live RPC & WebSocket Health</span>
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#64748b] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              {endpoints.map(ep => (
                <div key={ep.id} className="bg-[#121826] p-2 rounded-lg border border-[#1a2335] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-[11px] truncate max-w-[180px]">{ep.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                      ep.latencyMs < 30
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {ep.latencyMs}ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748b]">
                    <span>{ep.type} · {ep.packetsPerSec} pkt/s</span>
                    <span className="text-cyan-400">
                      {ep.venue === 'SOLANA' ? `Slot ${ep.blockOrSlot.toLocaleString()}` : `Block #${ep.blockOrSlot.toLocaleString()}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-1 border-t border-[#1b2230] flex items-center justify-between text-[10px] text-[#64748b]">
              <span>Uptime: 99.98%</span>
              <span className="text-emerald-400 font-bold">ZERO PACKET LOSS</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
