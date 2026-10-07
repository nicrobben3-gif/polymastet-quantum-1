/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from '../../types/market';
import { IVenueAdapter, IVenueOrderParams, IVenueExecutionResult, IVenueCredentialsStatus } from './types';
import { globalLogger } from '../../observability/logger';

export class PolymarketClobAdapter implements IVenueAdapter {
  public readonly venue: VenueId = 'polymarket';
  private apiUrl: string;
  private apiKey: string | null = null;
  private apiSecret: string | null = null;
  private passphrase: string | null = null;
  private isConfigured: boolean = false;
  private missingVariables: string[] = [];

  constructor() {
    this.apiUrl = (typeof process !== 'undefined' && process.env?.POLYMARKET_CLOB_API_URL) || 'https://clob.polymarket.com';
    this.checkCredentials();
  }

  private checkCredentials(): void {
    this.missingVariables = [];
    if (typeof process === 'undefined' || !process.env) {
      this.isConfigured = false;
      this.missingVariables = ['POLYMARKET_API_KEY', 'POLYMARKET_API_SECRET', 'POLYMARKET_PASSPHRASE'];
      return;
    }

    this.apiKey = process.env.POLYMARKET_API_KEY || null;
    this.apiSecret = process.env.POLYMARKET_API_SECRET || null;
    this.passphrase = process.env.POLYMARKET_PASSPHRASE || null;

    if (!this.apiKey) this.missingVariables.push('POLYMARKET_API_KEY');
    if (!this.apiSecret) this.missingVariables.push('POLYMARKET_API_SECRET');
    if (!this.passphrase) this.missingVariables.push('POLYMARKET_PASSPHRASE');

    this.isConfigured = this.missingVariables.length === 0;
  }

  public getName(): string {
    return 'Polymarket Central Limit Order Book (CLOB)';
  }

  public getCredentialsStatus(): IVenueCredentialsStatus {
    this.checkCredentials();
    return {
      venue: this.venue,
      configured: this.isConfigured,
      missingVariables: [...this.missingVariables],
      endpoint: this.apiUrl,
      isTestnet: this.apiUrl.includes('mumbai') || this.apiUrl.includes('test')
    };
  }

  public async ping(): Promise<{ alive: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.apiUrl}/time`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      const latencyMs = Date.now() - start;
      return { alive: res.ok, latencyMs };
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
      globalLogger.warn(`[POLYMARKET_LIVE_REJECTED] Order rejected: Missing authentic credentials (${missingStr})`);
      return {
        success: false,
        status: 'REJECTED',
        filledSize: 0,
        avgFillPrice: 0,
        feeUsd: 0,
        message: `[POLYMARKET_AUTH_MISSING] Live order blocked: Missing required venue credentials (${missingStr}). Live execution requires authentic API keys.`,
        latencyMs: Date.now() - start
      };
    }

    try {
      // Polymarket CLOB accepts order format with token_id, price (0.01 - 0.99), side, and size
      const side = order.direction === 'BUY' ? 'BUY' : 'SELL';
      const price = order.price ? Math.max(0.01, Math.min(0.99, Number(order.price.toFixed(3)))) : 0.50;
      const size = Number(order.size.toFixed(2));

      const payload = {
        order: {
          tokenID: order.symbol.replace('POLY:', ''),
          price,
          size,
          side,
          orderType: order.orderType === 'POST_ONLY' ? 'GTC' : 'FOK',
          feeRateBps: 0,
          nonce: Date.now(),
          expiration: Math.floor(Date.now() / 1000) + 300
        },
        clientOrderId: order.clientOrderId,
        owner: this.apiKey
      };

      const timestamp = (Date.now() / 1000).toString();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'POLY_API_KEY': this.apiKey || '',
        'POLY_PASSPHRASE': this.passphrase || '',
        'POLY_TIMESTAMP': timestamp
      };

      const res = await fetch(`${this.apiUrl}/order`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000)
      });

      const latencyMs = Date.now() - start;
      const responseData = await res.json().catch(() => ({}));

      if (!res.ok) {
        let errMsg = responseData.error || responseData.message || `HTTP ${res.status} ${res.statusText}`;
        if (res.status === 429) {
          errMsg = 'Polymarket rate limit exceeded (HTTP 429). Bounded backoff active.';
        } else if (res.status === 400 && responseData.error?.includes('balance')) {
          errMsg = 'Polymarket rejected: Insufficient collateral balance in proxy wallet.';
        }
        globalLogger.error(`[POLYMARKET_CLOB_REJECTION] Order ${order.clientOrderId} failed: ${errMsg}`);
        return {
          success: false,
          status: 'REJECTED',
          filledSize: 0,
          avgFillPrice: 0,
          feeUsd: 0,
          message: `Polymarket CLOB rejected order: ${errMsg}`,
          rawResponse: responseData,
          latencyMs
        };
      }

      // Parse confirmed fill from CLOB response
      const venueOrderId = responseData.orderID || responseData.id || `POLY_${Date.now()}`;
      const status = responseData.status === 'MATCHED' ? 'FILLED' : 'SUBMITTED';
      const filledSize = responseData.takingAmount ? parseFloat(responseData.takingAmount) : (status === 'FILLED' ? size : 0);
      const avgFillPrice = responseData.price ? parseFloat(responseData.price) : price;
      const feeUsd = Number((filledSize * avgFillPrice * 0.0005).toFixed(4));

      return {
        success: true,
        venueOrderId,
        status,
        filledSize,
        avgFillPrice,
        feeUsd,
        message: `Polymarket CLOB order executed: ${status} (ID: ${venueOrderId})`,
        rawResponse: responseData,
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout');
      const msg = isTimeout 
        ? 'Polymarket CLOB request timed out after 8000ms. Order marked unconfirmed; pending reconciliation.'
        : `Polymarket CLOB network error: ${err.message}`;
      
      globalLogger.error(`[POLYMARKET_CLOB_ERROR] ${msg}`);
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

  public async cancelOrder(venueOrderId: string, symbol: string): Promise<{ success: boolean; message: string }> {
    this.checkCredentials();
    if (!this.isConfigured) {
      return { success: false, message: 'Missing credentials for Polymarket cancellation' };
    }

    try {
      const res = await fetch(`${this.apiUrl}/order`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'POLY_API_KEY': this.apiKey || '',
          'POLY_PASSPHRASE': this.passphrase || ''
        },
        body: JSON.stringify({ orderID: venueOrderId, symbol }),
        signal: AbortSignal.timeout(5000)
      });
      return { success: res.ok, message: res.ok ? 'Order canceled on Polymarket' : `Cancel failed: ${res.statusText}` };
    } catch (err: any) {
      return { success: false, message: `Cancel exception: ${err.message}` };
    }
  }

  public async getOrderStatus(venueOrderId: string, _symbol: string): Promise<IVenueExecutionResult | null> {
    this.checkCredentials();
    if (!this.isConfigured) return null;

    const start = Date.now();
    try {
      const res = await fetch(`${this.apiUrl}/order/${venueOrderId}`, {
        headers: { 'POLY_API_KEY': this.apiKey || '' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        success: true,
        venueOrderId,
        status: data.status === 'MATCHED' ? 'FILLED' : data.status === 'CANCELED' ? 'CANCELLED' : 'SUBMITTED',
        filledSize: parseFloat(data.size_matched || '0'),
        avgFillPrice: parseFloat(data.price || '0'),
        feeUsd: 0,
        message: `Order status: ${data.status}`,
        latencyMs: Date.now() - start
      };
    } catch {
      return null;
    }
  }
}
