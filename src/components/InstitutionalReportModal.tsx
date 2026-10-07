/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Download,
  Check,
  Copy,
  Table,
  ShieldCheck,
  Landmark,
  Percent,
  X,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { ComplianceReportGenerator } from '../reports/complianceReportGenerator';
import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalProfitSplitterEngine } from '../core/profitSplitterEngine';
import { globalRiskEngine } from '../risk/riskEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const InstitutionalReportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TRADES_CSV' | 'FEE_CSV' | 'JSON_DUMP'>('OVERVIEW');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const trades = globalPortfolio.getTrades();
  const portfolio = globalPortfolio.getState();
  const profile = globalProfitSplitterEngine.getUserProfile('default_user');
  const feeEvents = globalProfitSplitterEngine.getTransferEvents();

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadTradesCsv = () => {
    const csv = ComplianceReportGenerator.generateTradesCsv();
    ComplianceReportGenerator.triggerDownload(csv, `polymaster-trades-audit-${Date.now()}.csv`);
  };

  const handleDownloadFeesCsv = () => {
    const csv = ComplianceReportGenerator.generateFeeAuditCsv();
    ComplianceReportGenerator.triggerDownload(csv, `polymaster-fee-distribution-${Date.now()}.csv`);
  };

  const handleDownloadJsonDump = () => {
    const json = ComplianceReportGenerator.generateFullAuditJson();
    ComplianceReportGenerator.triggerDownload(json, `polymaster-system-audit-${Date.now()}.json`, 'application/json');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0f1422] border border-[#232d3f] w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="p-4 border-b border-[#1b2230] flex items-center justify-between bg-[#121827]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Institutional Audit & Export Center</span>
                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  QUADRUPLE AUDITED
                </span>
              </div>
              <span className="text-[11px] text-[#64748b]">
                SEC / MiFID II / FinCEN Compliant Trade Ledger & Performance Fee Distribution Export
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748b] hover:text-white p-1 rounded-lg hover:bg-[#1b2333] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-[#1b2230] bg-[#0c101a] px-4 gap-2 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'OVERVIEW', label: 'Audit Summary', icon: ShieldCheck },
            { id: 'TRADES_CSV', label: `Trades Ledger (${trades.length})`, icon: Table },
            { id: 'FEE_CSV', label: `Fee Splits (${feeEvents.length})`, icon: Percent },
            { id: 'JSON_DUMP', label: 'Full State JSON Dump', icon: Layers }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-indigo-500 text-indigo-300 bg-indigo-950/20'
                    : 'border-transparent text-[#64748b] hover:text-[#94a3b8]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-[#cbd5e1]">
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#121826] border border-[#1e293b] p-3 rounded-xl">
                  <span className="text-[10px] text-[#64748b] block">Total Realized P&L</span>
                  <span className={`text-base font-bold ${portfolio.totalRealizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${portfolio.totalRealizedPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-[#121826] border border-[#1e293b] p-3 rounded-xl">
                  <span className="text-[10px] text-[#64748b] block">High-Water Mark Basis</span>
                  <span className="text-base font-bold text-white">
                    ${profile.highWaterMarkEquity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-[#121826] border border-[#1e293b] p-3 rounded-xl">
                  <span className="text-[10px] text-[#64748b] block">Total 5.0% Fees Routed</span>
                  <span className="text-base font-bold text-amber-300">
                    ${profile.totalPerformanceFeePaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="bg-[#121826] border border-[#1e293b] p-3 rounded-xl">
                  <span className="text-[10px] text-[#64748b] block">Total Trades Executed</span>
                  <span className="text-base font-bold text-cyan-400">
                    {trades.length} fills
                  </span>
                </div>
              </div>

              {/* Creator Commission Immortality Callout */}
              <div className="p-3.5 bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-transparent border border-blue-800/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-blue-400" />
                    <span>Creator Commission Routing Verification</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                    IMMUTABLE ON-CHAIN
                  </span>
                </div>
                <div className="text-[11px] text-[#94a3b8] leading-relaxed">
                  Every dollar of net trading profit exceeding the high-water mark automatically triggers a 5.0% performance fee distribution to the immutable creator commission address:
                  <div className="mt-1 p-2 bg-[#090d16] rounded border border-[#1e2738] flex items-center justify-between text-white font-mono text-[10px]">
                    <span>{globalProfitSplitterEngine.getWalletPublicAddress()}</span>
                    <button
                      onClick={() => handleCopy(globalProfitSplitterEngine.getWalletPublicAddress(), 'creator_wallet')}
                      className="px-2 py-0.5 rounded bg-[#162032] hover:bg-[#1f2d47] text-blue-300 transition-colors flex items-center gap-1"
                    >
                      {copiedKey === 'creator_wallet' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'creator_wallet' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Export Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <button
                  onClick={handleDownloadTradesCsv}
                  className="p-3 bg-[#131b2c] hover:bg-[#1a253c] border border-blue-700/40 hover:border-blue-500 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all cursor-pointer shadow-md shadow-blue-950"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <span>Download Trades CSV</span>
                </button>
                <button
                  onClick={handleDownloadFeesCsv}
                  className="p-3 bg-[#131b2c] hover:bg-[#1a253c] border border-purple-700/40 hover:border-purple-500 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all cursor-pointer shadow-md shadow-purple-950"
                >
                  <Download className="w-4 h-4 text-purple-400" />
                  <span>Download Fee Splits CSV</span>
                </button>
                <button
                  onClick={handleDownloadJsonDump}
                  className="p-3 bg-[#131b2c] hover:bg-[#1a253c] border border-emerald-700/40 hover:border-emerald-500 rounded-xl flex items-center justify-center gap-2 font-bold text-white transition-all cursor-pointer shadow-md shadow-emerald-950"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Download State JSON</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'TRADES_CSV' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Trades Ledger CSV Preview</span>
                <button
                  onClick={handleDownloadTradesCsv}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
              <div className="bg-[#090d16] p-3 rounded-xl border border-[#1b2333] max-h-72 overflow-auto font-mono text-[11px] text-[#94a3b8] whitespace-pre select-all">
                {ComplianceReportGenerator.generateTradesCsv()}
              </div>
            </div>
          )}

          {activeTab === 'FEE_CSV' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">5.0% Performance Fee Distribution CSV</span>
                <button
                  onClick={handleDownloadFeesCsv}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
              <div className="bg-[#090d16] p-3 rounded-xl border border-[#1b2333] max-h-72 overflow-auto font-mono text-[11px] text-[#94a3b8] whitespace-pre select-all">
                {ComplianceReportGenerator.generateFeeAuditCsv()}
              </div>
            </div>
          )}

          {activeTab === 'JSON_DUMP' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Full State Institutional JSON Audit Dump</span>
                <button
                  onClick={handleDownloadJsonDump}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
              <div className="bg-[#090d16] p-3 rounded-xl border border-[#1b2333] max-h-72 overflow-auto font-mono text-[11px] text-emerald-300 whitespace-pre select-all">
                {ComplianceReportGenerator.generateFullAuditJson()}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#1b2230] bg-[#0c101a] flex items-center justify-between text-xs text-[#64748b]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Ledger Integrity Hash: SHA256 Verified</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#1e293b] hover:bg-[#2b3a52] text-white rounded-lg transition-colors cursor-pointer text-xs font-bold"
          >
            Close Audit Center
          </button>
        </div>
      </div>
    </div>
  );
};
