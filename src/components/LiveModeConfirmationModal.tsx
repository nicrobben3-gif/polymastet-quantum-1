/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, ShieldCheck, Wallet, ArrowRight, X } from 'lucide-react';
import { globalPortfolio } from '../portfolio/portfolioEngine';

interface ILiveModeConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenDeposit: () => void;
}

export const LiveModeConfirmationModal: React.FC<ILiveModeConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  onOpenDeposit
}) => {
  if (!isOpen) return null;

  const liveCash = globalPortfolio.getLiveState().cashUsd;
  const hasLiveFunds = liveCash > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0e131f] border border-rose-600/50 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl shadow-rose-950/50 text-slate-200 font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1b2535]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-950 border border-rose-600/60 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Switch to LIVE Capital Execution</h3>
              <p className="text-xs text-rose-300 font-mono">Live trading requires real deposited funds</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#1a2333] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Balance Status */}
        <div className="p-3.5 bg-[#090d16] border border-[#1d273a] rounded-xl space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[#94a3b8]">Live Account Cash Balance:</span>
            <span className={`font-bold text-sm ${hasLiveFunds ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${liveCash.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-[#070a10] border border-[#162030] text-[11px] leading-relaxed text-[#94a3b8]">
            {hasLiveFunds ? (
              <span className="text-emerald-300 flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Live funds verified. Ready for live order execution under Quadruple Safety Gate protection.
              </span>
            ) : (
              <span className="text-amber-300">
                ⚠️ Live account starts strictly at <strong>$0.00</strong>. The Zero-Balance Guard is active: you cannot place live orders until real funds are deposited.
              </span>
            )}
          </div>
        </div>

        {/* Safety Guarantees */}
        <div className="space-y-1.5 font-mono text-[11px] text-[#94a3b8]">
          <div className="flex items-center gap-2 text-white font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Strict Quadruple Safety Rules Enforced:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-[10px] text-[#94a3b8]">
            <li>100% Capital Isolation: Paper simulated gains do not cross over to live account.</li>
            <li>Zero-Balance Blocker: Prohibits unbacked orders when cash is $0.00.</li>
            <li>Pre-Trade VaR & 3.0% Daily Loss Circuit Breaker Active.</li>
            <li>5.0% Creator Commission applies strictly to net profits above initial deposited principal. Breakeven or loss withdrawals incur $0.00 fee.</li>
          </ul>
        </div>

        {/* Buttons */}
        <div className="pt-3 border-t border-[#1b2535] flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] text-[#cbd5e1] rounded-lg transition-colors cursor-pointer"
          >
            Stay in Paper Mode
          </button>

          <div className="flex items-center gap-2">
            {!hasLiveFunds && (
              <button
                onClick={() => {
                  onCancel();
                  onOpenDeposit();
                }}
                className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Deposit First</span>
              </button>
            )}

            <button
              onClick={onConfirm}
              className="flex items-center gap-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              <span>Confirm LIVE Mode</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
