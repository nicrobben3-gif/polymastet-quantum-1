/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Percent,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Zap,
  Server
} from 'lucide-react';
import { globalOrchestrator } from '../core/orchestrator';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';

interface IQuadrupleSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDeposit: () => void;
}

export const QuadrupleSafetyModal: React.FC<IQuadrupleSafetyModalProps> = ({
  isOpen,
  onClose,
  onOpenDeposit
}) => {
  const [auditResult, setAuditResult] = useState(() => globalOrchestrator.runQuadrupleSafetyAudit());
  const [isRunningCheck, setIsRunningCheck] = useState(false);

  if (!isOpen) return null;

  const handleRunAudit = () => {
    setIsRunningCheck(true);
    setTimeout(() => {
      setAuditResult(globalOrchestrator.runQuadrupleSafetyAudit());
      setIsRunningCheck(false);
    }, 450);
  };

  const currentMode = globalOrchestrator.getStatus().mode;
  const liveState = globalPortfolio.getLiveState();
  const paperState = globalPortfolio.getPaperState();
  const liveCash = liveState.cashUsd;
  const paperCash = paperState.cashUsd;
  const creatorWallet = globalPortfolio.getDeveloperWallet();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0b0f19] border border-emerald-500/40 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl shadow-emerald-950/40 text-slate-200 font-sans max-h-[92vh] overflow-y-auto">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2535]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 border border-emerald-600/50 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Quadruple Safety Audit & Compliance Checklist
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold">
                  INSTITUTIONAL GRADE
                </span>
              </div>
              <p className="text-xs text-[#94a3b8]">
                Four distinct independent safety barrier layers enforcing strict by-the-books execution
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold cursor-pointer p-1.5 rounded-lg hover:bg-[#151c2b] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Live vs Paper Capital Isolation Notice */}
        <div className="p-3.5 bg-[#080d16] border border-indigo-900/50 rounded-xl space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between text-indigo-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-indigo-400" />
              <span>Capital State & Mode Isolation</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#131924] border border-[#232d3f] text-white">
              ACTIVE MODE: <strong className={currentMode === 'LIVE' ? 'text-rose-400' : 'text-amber-400'}>{currentMode}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px]">
            {/* Live Container */}
            <div className={`p-2.5 rounded-lg border ${currentMode === 'LIVE' ? 'bg-rose-950/30 border-rose-600/60 ring-1 ring-rose-500/40' : 'bg-[#0f1420] border-[#1d273a]'}`}>
              <div className="flex items-center justify-between text-rose-300 font-bold">
                <span>🔴 LIVE TRADING VAULT</span>
                <span>${liveCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8] mt-1">
                Starts strictly at $0.00. Zero orders allowed unless real funds are deposited.
              </p>
              {liveCash === 0 && (
                <div className="mt-1.5 text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center justify-between">
                  <span>Zero-Balance Guard: ACTIVE</span>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDeposit();
                    }}
                    className="underline text-emerald-300 font-bold hover:text-emerald-200 cursor-pointer"
                  >
                    Deposit Funds
                  </button>
                </div>
              )}
            </div>

            {/* Paper Container */}
            <div className={`p-2.5 rounded-lg border ${currentMode === 'PAPER' ? 'bg-amber-950/30 border-amber-600/60 ring-1 ring-amber-500/40' : 'bg-[#0f1420] border-[#1d273a]'}`}>
              <div className="flex items-center justify-between text-amber-300 font-bold">
                <span>🟡 PAPER SIMULATION</span>
                <span>${paperCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8] mt-1">
                Starts with $100,000 virtual capital. 100% risk-free algorithmic testing sandbox.
              </p>
              <div className="mt-1.5 text-[10px] text-emerald-300 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                Simulated Sandbox: READY
              </div>
            </div>
          </div>
        </div>

        {/* 4 SAFETY LAYERS CHECKLIST */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Institutional Safety Matrix Audit</span>
            </span>

            <button
              onClick={handleRunAudit}
              disabled={isRunningCheck}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 rounded text-[11px] font-bold transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRunningCheck ? 'animate-spin' : ''}`} />
              <span>{isRunningCheck ? 'Auditing...' : 'Re-Run Live Audit'}</span>
            </button>
          </div>

          <div className="space-y-2">
            {auditResult.checks.map((check, i) => (
              <div
                key={i}
                className="p-3 bg-[#080d16] border border-[#1b2535] rounded-xl flex items-start gap-3 hover:border-emerald-700/40 transition-colors"
              >
                <div className="pt-0.5">
                  {check.status === 'PASS' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : check.status === 'WARN' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs flex items-center gap-1.5">
                      <span className="text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800/50 px-1 py-0.2 rounded">
                        LAYER {check.layer}
                      </span>
                      <span>{check.name}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        check.status === 'PASS'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : check.status === 'WARN'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-rose-950 text-rose-300 border-rose-800'
                      }`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] leading-relaxed font-sans">
                    {check.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Immutable Creator Wallet Lock Verification */}
        <div className="p-3 bg-[#080c14] border border-[#1b2230] rounded-xl space-y-1 font-mono text-[11px]">
          <div className="flex items-center justify-between text-[#94a3b8]">
            <span className="flex items-center gap-1 text-emerald-400 font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Creator Solana USDT Destination Lock</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800/50">
              IMMUTABLE
            </span>
          </div>
          <div className="p-1.5 bg-[#04060a] rounded text-[10px] text-emerald-300 font-semibold select-all break-all border border-emerald-900/30">
            {creatorWallet}
          </div>
          <p className="text-[10px] text-[#64748b]">
            Locked by base protocol rules. All 5.0% performance shares on net profits are automatically converted and routed to this address. Breakeven or loss withdrawals are 100% exempt ($0.00 fee).
          </p>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-[#1b2535] flex items-center justify-between font-mono text-xs">
          <div className="text-[11px] text-[#64748b]">
            Audit Timestamp: {new Date(auditResult.timestamp).toLocaleTimeString()}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            Acknowledge & Close Checklist
          </button>
        </div>

      </div>
    </div>
  );
};
