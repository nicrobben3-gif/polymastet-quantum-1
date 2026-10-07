/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { globalPortfolio } from '../portfolio/portfolioEngine';
import { globalRiskEngine } from '../risk/riskEngine';
import { globalProfitSplitterEngine, IProfitTransferEvent } from '../core/profitSplitterEngine';
import { globalOrchestrator } from '../core/orchestrator';
import { IFill } from '../types/execution';

export class ComplianceReportGenerator {
  /**
   * Generates a downloadable CSV of all executed trades
   */
  public static generateTradesCsv(): string {
    const trades: IFill[] = globalPortfolio.getTrades();
    const headers = [
      'Fill ID',
      'Order ID',
      'Timestamp',
      'Date (UTC)',
      'Symbol',
      'Venue',
      'Execution Liquidity',
      'Size (Contracts)',
      'Executed Price ($)',
      'Total Value ($)',
      'Fees Paid ($)'
    ];

    const rows = trades.map((t: IFill) => [
      t.id,
      t.orderId,
      t.timestamp,
      new Date(t.timestamp).toISOString(),
      `"${t.symbol}"`,
      t.venue,
      t.liquidity,
      t.size.toFixed(4),
      t.price.toFixed(4),
      (t.size * t.price).toFixed(2),
      t.feeUsd.toFixed(4)
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generates a downloadable CSV of performance fee deductions & creator routing
   */
  public static generateFeeAuditCsv(): string {
    const events: IProfitTransferEvent[] = globalProfitSplitterEngine.getTransferEvents();
    const headers = [
      'Transfer Event ID',
      'Timestamp (UTC)',
      'User ID',
      'Requested Amount ($)',
      'Baseline Principal ($)',
      'High-Water Mark Peak ($)',
      'Profit Portion ($)',
      'Fee Rate (%)',
      '5.0% Performance Fee ($)',
      'User Net Payout ($)',
      'Recipient Wallet',
      'Tx Hash',
      'Status'
    ];

    const rows = events.map((e: IProfitTransferEvent) => [
      e.id,
      new Date(e.timestamp).toISOString(),
      e.userId,
      e.requestedAmountUsd.toFixed(2),
      e.initialDepositedPrincipal.toFixed(2),
      e.highWaterMarkEquity.toFixed(2),
      e.profitExceededPrincipalUsd.toFixed(2),
      e.performanceFeeRatePct.toFixed(1),
      e.transferFeeUsd.toFixed(2),
      e.netUserPayoutUsd.toFixed(2),
      `"${e.walletPublicAddress}"`,
      e.txHash,
      e.status
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Generates a comprehensive Institutional State JSON Dump
   */
  public static generateFullAuditJson(): string {
    const portfolio = globalPortfolio.getState();
    const positions = globalPortfolio.getPositions();
    const trades = globalPortfolio.getTrades();
    const riskConfig = globalRiskEngine.getConfig();
    const riskEvents = globalRiskEngine.getRecentRiskEvents();
    const userProfile = globalProfitSplitterEngine.getUserProfile('default_user');
    const feeTransfers = globalProfitSplitterEngine.getTransferEvents();
    const botStatus = globalOrchestrator.getStatus();

    const auditPayload = {
      reportMetadata: {
        engine: 'PolyMaster Quantum v2.6-PROD',
        generatedAt: new Date().toISOString(),
        environment: 'INSTITUTIONAL_PRODUCTION',
        jurisdiction: 'Multi-Venue High Frequency Execution',
        protocolCompliance: 'Quadruple Safety Verified'
      },
      systemStatus: botStatus,
      portfolioSnapshot: portfolio,
      activePositions: positions,
      tradeHistoryCount: trades.length,
      tradesSample: trades.slice(0, 50),
      riskAudit: {
        config: riskConfig,
        recentRiskViolations: riskEvents
      },
      profitSplitAudit: {
        creatorLockedCommissionWallet: globalProfitSplitterEngine.getWalletPublicAddress(),
        performanceFeeRate: '5.0%',
        userProfitProfile: userProfile,
        transferHistory: feeTransfers
      }
    };

    return JSON.stringify(auditPayload, null, 2);
  }

  /**
   * Triggers browser download of file
   */
  public static triggerDownload(content: string, filename: string, mimeType: string = 'text/csv;charset=utf-8;'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
