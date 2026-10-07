/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface INetworkEndpoint {
  id: string;
  name: string;
  type: 'WEBSOCKET' | 'RPC' | 'REST';
  venue: 'POLYMARKET' | 'SOLANA' | 'POLYGON' | 'NOVIG';
  url: string;
  status: 'CONNECTED' | 'DEGRADED' | 'CONNECTING' | 'RECONNECTING';
  latencyMs: number;
  lastPingTime: number;
  blockOrSlot: number;
  packetsPerSec: number;
  healthPct: number;
}

class NetworkMonitorEngine {
  private endpoints: INetworkEndpoint[] = [
    {
      id: 'poly_clob_ws',
      name: 'Polymarket CLOB Stream',
      type: 'WEBSOCKET',
      venue: 'POLYMARKET',
      url: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
      status: 'CONNECTED',
      latencyMs: 18,
      lastPingTime: Date.now(),
      blockOrSlot: 62941042,
      packetsPerSec: 142,
      healthPct: 99.98
    },
    {
      id: 'solana_jito_rpc',
      name: 'Solana Jito MEV Relayer',
      type: 'RPC',
      venue: 'SOLANA',
      url: 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
      status: 'CONNECTED',
      latencyMs: 24,
      lastPingTime: Date.now(),
      blockOrSlot: 284918230,
      packetsPerSec: 96,
      healthPct: 99.95
    },
    {
      id: 'polygon_pos_rpc',
      name: 'Polygon PoS Bor RPC',
      type: 'RPC',
      venue: 'POLYGON',
      url: 'https://polygon-rpc.com',
      status: 'CONNECTED',
      latencyMs: 14,
      lastPingTime: Date.now(),
      blockOrSlot: 62941042,
      packetsPerSec: 110,
      healthPct: 100.0
    },
    {
      id: 'novig_gateway_ws',
      name: 'Novig Exchange Feed',
      type: 'WEBSOCKET',
      venue: 'NOVIG',
      url: 'wss://feed.novig.us/v1/clob',
      status: 'CONNECTED',
      latencyMs: 31,
      lastPingTime: Date.now(),
      blockOrSlot: 1083921,
      packetsPerSec: 48,
      healthPct: 99.91
    }
  ];

  private listeners: Set<() => void> = new Set();
  private intervalTimer: any = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      // Small jitter simulation reflecting live network variability
      this.endpoints = this.endpoints.map(ep => {
        const jitter = (Math.random() - 0.48) * 4;
        const newLatency = Math.max(8, Math.min(120, Math.round(ep.latencyMs + jitter)));
        const newBlock = ep.type === 'RPC' && ep.venue === 'SOLANA' 
          ? ep.blockOrSlot + Math.floor(Math.random() * 3) + 1
          : ep.blockOrSlot + (Math.random() > 0.6 ? 1 : 0);

        return {
          ...ep,
          latencyMs: newLatency,
          lastPingTime: Date.now(),
          blockOrSlot: newBlock,
          packetsPerSec: Math.max(10, Math.round(ep.packetsPerSec + (Math.random() - 0.5) * 8))
        };
      });
      this.notify();
    }, 2500);
  }

  public getEndpoints(): INetworkEndpoint[] {
    return [...this.endpoints];
  }

  public getAverageLatencyMs(): number {
    if (this.endpoints.length === 0) return 0;
    const sum = this.endpoints.reduce((acc, ep) => acc + ep.latencyMs, 0);
    return Math.round(sum / this.endpoints.length);
  }

  public getOverallStatus(): 'OPTIMAL' | 'DEGRADED' | 'DISCONNECTED' {
    const hasDisconnected = this.endpoints.some(e => e.status === 'RECONNECTING');
    if (hasDisconnected) return 'DISCONNECTED';
    const avg = this.getAverageLatencyMs();
    if (avg > 80) return 'DEGRADED';
    return 'OPTIMAL';
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch {}
    });
  }
}

export const globalNetworkMonitor = new NetworkMonitorEngine();
