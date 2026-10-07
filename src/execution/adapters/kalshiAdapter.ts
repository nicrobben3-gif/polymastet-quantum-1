/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from '../../types/market';
import { IVenueAdapter, IVenueOrderParams, IVenueExecutionResult, IVenueCredentialsStatus } from './types';
import { globalLogger } from '../../observability/logger';

export class KalshiAdapter implements IVenueAdapter {
  public readonly venue: VenueId = 'kalshi';
  private apiUrl: string;
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private isConfigured: boolean = false;
  private missingVariables: string[] = [];

  constructor() {
    this.apiUrl = (typeof process !== 'undefined' && process.env?.KALSHI_API_URL) || 'https://api.elections.kalshi.com/trade-api/v2';
    this.checkCredentials();
  }

  private checkCredentials(): void {
    this.missingVariables = [];
    if (typeof process === 'undefined' || !process.env) {
      this.isConfigured = false;
      this.missingVariables = ['KALSHI_API_KEY', 'KALSHI_RSA_PRIVATE_KEY'];
      return;
    }

    this.apiKey = process.env.KALSHI_API_KEY || null;
    this.apiSecret = process.env.KALSHI_RSA_PRIVATE_KEY || process.env.KALSHI_API_SECRET || null;

    if (!this.apiKey) this.missingVariables.push('KALSHI_API_KEY');
    if (!this.apiSecret) this.missingVariables.push('KALSHI_RSA_PRIVATE_KEY');

    this.isConfigured = this.missingVariables.length === 0;
  }

  public getName(): string {
    return 'Kalshi CFTC-Regulated Exchange';
  }

  public getCredentialsStatus(): IVenueCredentialsStatus {
    this.checkCredentials();
    return {
      venue: this.venue,
      configured: this.isConfigured,
      missingVariables: [...this.missingVariables],
      endpoint: this.apiUrl,
      isTestnet: this.apiUrl.includes('demo')
    };
  }

  public async ping(): Promise<{ alive: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.apiUrl}/exchange/status`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      return { alive: res.ok, latencyMs: Date.now() - start };
    } catch {
      return { alive: false, latencyMs: Date.now() - start };
    }
  }

  public async submitOrder(order: IVenueOrderParams): Promise<IVenueExecutionResult> {
    const start = Date.now();
    this.checkCredentials();

    // FAIL-SAFE: Missing credentials must NEVER be replaced with fake values
    if (!this.isConfigured) {
      const missingStr = this.missingVariables.join(', ');
      globalLogger.warn(`[KALSHI_LIVE_REJECTED] Order rejected: Missing authentic credentials (${missingStr})`);
      return {
        success: false,
        status: 'REJECTED',
        filledSize: 0,
        avgFillPrice: 0,
        feeUsd: 0,
        message: `[KALSHI_AUTH_MISSING] Live order blocked: Missing required venue credentials (${missingStr}). Live execution requires authentic API keys.`,
        latencyMs: Date.now() - start
      };
    }

    try {
      const ticker = order.symbol.replace('KALSHI:', '');
      const action = order.direction === 'BUY' ? 'buy' : 'sell';
      const count = Math.max(1, Math.round(order.size));
      const priceCents = order.price ? Math.round(order.price * 100) : 50;

      const payload = {
        action,
        client_order_id: order.clientOrderId,
        count,
        side: 'yes',
        ticker,
        type: order.orderType === 'LIMIT' ? 'limit' : 'market',
        yes_price: priceCents
      };

      const res = await fetch(`${this.apiUrl}/portfolio/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      const latencyMs = Date.now() - start;
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errMsg = data.error?.message || data.message || `HTTP ${res.status}`;
        globalLogger.error(`[KALSHI_ORDER_REJECTION] Order ${order.clientOrderId} failed: ${errMsg}`);
        return {
          success: false,
          status: 'REJECTED',
          filledSize: 0,
          avgFillPrice: 0,
          feeUsd: 0,
          message: `Kalshi rejected order: ${errMsg}`,
          rawResponse: data,
          latencyMs
        };
      }

      const orderData = data.order || {};
      const status = orderData.status === 'executed' ? 'FILLED' : 'SUBMITTED';
      const filledSize = orderData.fill_count || 0;
      const avgFillPrice = orderData.avg_fill_price ? (orderData.avg_fill_price / 100) : (priceCents / 100);
      const feeUsd = Number((orderData.total_cost ? (orderData.total_cost * 0.001) : 0).toFixed(4));

      return {
        success: true,
        venueOrderId: orderData.order_id || `KALSHI_${Date.now()}`,
        status,
        filledSize,
        avgFillPrice,
        feeUsd,
        message: `Kalshi order acknowledged: ${status}`,
        rawResponse: data,
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const msg = `Kalshi network error: ${err.message}`;
      globalLogger.error(`[KALSHI_NETWORK_ERROR] ${msg}`);
      return {
        success: false,
        status: 'REJECTED',
        filledSize: 0,
        avgFillPrice: 0,
        feeUsd: 0,
        message: msg,
        latencyMs
      };
    }
  }

  public async cancelOrder(venueOrderId: string, _symbol: string): Promise<{ success: boolean; message: string }> {
    this.checkCredentials();
    if (!this.isConfigured) return { success: false, message: 'Missing credentials for Kalshi cancellation' };

    try {
      const res = await fetch(`${this.apiUrl}/portfolio/orders/${venueOrderId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      return { success: res.ok, message: res.ok ? 'Order canceled on Kalshi' : `Cancel failed: ${res.statusText}` };
    } catch (err: any) {
      return { success: false, message: `Cancel error: ${err.message}` };
    }
  }

  public async getOrderStatus(venueOrderId: string, _symbol: string): Promise<IVenueExecutionResult | null> {
    this.checkCredentials();
    if (!this.isConfigured) return null;

    const start = Date.now();
    try {
      const res = await fetch(`${this.apiUrl}/portfolio/orders/${venueOrderId}`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const o = data.order || {};
      return {
        success: true,
        venueOrderId,
        status: o.status === 'executed' ? 'FILLED' : o.status === 'canceled' ? 'CANCELLED' : 'SUBMITTED',
        filledSize: o.fill_count || 0,
        avgFillPrice: (o.avg_fill_price || 0) / 100,
        feeUsd: 0,
        message: `Status: ${o.status}`,
        latencyMs: Date.now() - start
      };
    } catch {
      return null;
    }
  }
}
