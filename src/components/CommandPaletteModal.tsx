/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Zap,
  Play,
  Square,
  Flame,
  ArrowDownToLine,
  Layers,
  FileText,
  Volume2,
  VolumeX,
  Compass,
  TrendingUp,
  Cpu,
  Crosshair,
  Scale,
  Sparkles,
  Command,
  X,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { globalOrchestrator } from '../core/orchestrator';
import { globalStrategyRegistry } from '../strategies';
import { IStrategy } from '../types/strategy';
import { globalSoundFX } from '../audio/soundFX';
import { globalRiskEngine } from '../risk/riskEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tabId: string) => void;
  onOpenDeposit: () => void;
  onOpenReport: () => void;
  onOpenLogin: () => void;
}

export const CommandPaletteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onNavigateToTab,
  onOpenDeposit,
  onOpenReport,
  onOpenLogin
}) => {
  const [query, setQuery] = useState('');
  const [isMuted, setIsMuted] = useState(globalSoundFX.getIsMuted());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const strategies: IStrategy[] = globalStrategyRegistry.getAll();
  const botStatus = globalOrchestrator.getStatus();
  const riskConfig = globalRiskEngine.getConfig();

  // Quick Action List
  const actions = [
    {
      id: 'toggle_bot',
      title: botStatus.state === 'RUNNING' ? 'Pause Trading Bot' : 'Start Trading Bot',
      category: 'ENGINE EXECUTION',
      icon: botStatus.state === 'RUNNING' ? Square : Play,
      badge: botStatus.state,
      badgeColor: botStatus.state === 'RUNNING' ? 'text-emerald-400 bg-emerald-950' : 'text-amber-400 bg-amber-950',
      run: () => {
        if (botStatus.state === 'RUNNING') globalOrchestrator.stop();
        else globalOrchestrator.start();
        onClose();
      }
    },
    {
      id: 'kill_switch',
      title: riskConfig.killSwitchActive ? 'Disengage Emergency Kill Switch' : 'ENGAGE EMERGENCY KILL SWITCH',
      category: 'RISK CONTROL',
      icon: Flame,
      badge: riskConfig.killSwitchActive ? 'ACTIVE' : 'READY',
      badgeColor: 'text-rose-400 bg-rose-950',
      run: () => {
        globalOrchestrator.setKillSwitch(!riskConfig.killSwitchActive);
        if (!riskConfig.killSwitchActive) globalSoundFX.playKillSwitch();
        onClose();
      }
    },
    {
      id: 'open_deposit',
      title: 'Deposit Trading Capital (Solana, Polygon, Ethereum)',
      category: 'VAULT CAPITAL',
      icon: ArrowDownToLine,
      run: () => {
        onOpenDeposit();
        onClose();
      }
    },
    {
      id: 'open_reports',
      title: 'Institutional Audit & Export Center (CSV / JSON)',
      category: 'COMPLIANCE',
      icon: FileText,
      run: () => {
        onOpenReport();
        onClose();
      }
    },
    {
      id: 'toggle_audio',
      title: isMuted ? 'Unmute Audio Alerts & Execution Chimes' : 'Mute Sound FX Engine',
      category: 'SYSTEM SETTINGS',
      icon: isMuted ? VolumeX : Volume2,
      run: () => {
        const next = globalSoundFX.toggleMute();
        setIsMuted(next);
      }
    },
    {
      id: 'nav_autopilot',
      title: 'Navigate: Autonomous AI Trader (Default Autopilot)',
      category: 'VIEW NAVIGATION',
      icon: Sparkles,
      run: () => {
        onNavigateToTab('autopilot');
        onClose();
      }
    },
    {
      id: 'nav_solana',
      title: 'Navigate: Solana LP Sniper & Hedged Sub-Slot Execution',
      category: 'VIEW NAVIGATION',
      icon: Crosshair,
      run: () => {
        onNavigateToTab('solana_sniper');
        onClose();
      }
    },
    {
      id: 'nav_novig',
      title: 'Navigate: Novig Prediction Market (0% Vig)',
      category: 'VIEW NAVIGATION',
      icon: Scale,
      run: () => {
        onNavigateToTab('novig');
        onClose();
      }
    },
    {
      id: 'nav_arbitrage',
      title: 'Navigate: Cross-Venue Arbitrage & Flash Loan Sim',
      category: 'VIEW NAVIGATION',
      icon: Zap,
      run: () => {
        onNavigateToTab('arbitrage');
        onClose();
      }
    },
    {
      id: 'nav_risk',
      title: 'Navigate: Risk & Circuit Breaker Settings',
      category: 'VIEW NAVIGATION',
      icon: Sliders,
      run: () => {
        onNavigateToTab('risk');
        onClose();
      }
    }
  ];

  // Filter actions and strategies based on query
  const filteredActions = actions.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.category.toLowerCase().includes(query.toLowerCase())
  );

  const filteredStrategies = strategies.filter((s: IStrategy) =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.id.toLowerCase().includes(query.toLowerCase()) ||
    s.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
      <div className="bg-[#0f1422] border border-[#232d3f] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden font-mono text-xs flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-[#1b2230] bg-[#121827] flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, strategy, or navigation target (e.g. 'deposit', 'sniper', 'arbitrage')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-white font-mono text-sm outline-none placeholder:text-[#64748b]"
          />
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-white p-1 rounded-lg hover:bg-[#1b2333] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-4 flex-1">
          {/* Actions */}
          {filteredActions.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 mb-1.5">
                Commands & Shortcuts
              </div>
              <div className="space-y-1">
                {filteredActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={action.run}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#162032] border border-transparent hover:border-[#232e44] transition-colors cursor-pointer text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-[#0d121c] border border-[#1b2230] text-[#94a3b8] group-hover:text-indigo-400 group-hover:border-indigo-500/40 transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-white font-medium text-xs">{action.title}</div>
                          <div className="text-[10px] text-[#64748b]">{action.category}</div>
                        </div>
                      </div>
                      {action.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border border-[#232d3f] ${action.badgeColor || 'text-white'}`}>
                          {action.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Strategies */}
          {filteredStrategies.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between">
                <span>Strategies ({filteredStrategies.length})</span>
                <span className="text-[9px] text-indigo-400">Click to Toggle Enable/Disable</span>
              </div>
              <div className="space-y-1">
                {filteredStrategies.map((strat: IStrategy) => (
                  <button
                    key={strat.id}
                    onClick={() => {
                      globalStrategyRegistry.setEnabled(strat.id, !strat.enabled);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[#162032] border border-transparent hover:border-[#232e44] transition-colors cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg border ${
                        strat.enabled
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                          : 'bg-[#10141e] border-[#1e2738] text-[#64748b]'
                      }`}>
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-white font-medium text-xs flex items-center gap-2">
                          <span>{strat.name}</span>
                          <span className="text-[10px] text-[#64748b]">({strat.category})</span>
                        </div>
                        <div className="text-[10px] text-[#64748b] truncate max-w-md">
                          Weight: {strat.weight.toFixed(1)}x · Category: {strat.category}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      strat.enabled
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border-rose-800'
                    }`}>
                      {strat.enabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Hotkey Guide */}
        <div className="p-3 border-t border-[#1b2230] bg-[#0c101a] flex flex-wrap items-center justify-between text-[11px] text-[#64748b] gap-2">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-[#141b26] border border-[#232d3f] rounded text-white">Cmd+K</kbd> to Open</span>
            <span><kbd className="px-1.5 py-0.5 bg-[#141b26] border border-[#232d3f] rounded text-white">Esc</kbd> to Close</span>
          </div>
          <span>PolyMaster Pro Command Interface</span>
        </div>
      </div>
    </div>
  );
};
