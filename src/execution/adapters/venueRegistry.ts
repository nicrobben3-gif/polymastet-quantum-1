/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VenueId } from '../../types/market';
import { IVenueAdapter, IVenueCredentialsStatus } from './types';
import { PolymarketClobAdapter } from './polymarketClobAdapter';
import { KalshiAdapter } from './kalshiAdapter';
import { SolanaAdapter } from './solanaAdapter';

export class VenueRegistry {
  private adapters: Map<VenueId, IVenueAdapter> = new Map();

  constructor() {
    this.register(new PolymarketClobAdapter());
    this.register(new KalshiAdapter());
    this.register(new SolanaAdapter());
  }

  public register(adapter: IVenueAdapter): void {
    this.adapters.set(adapter.venue, adapter);
  }

  public getAdapter(venue: VenueId): IVenueAdapter | undefined {
    return this.adapters.get(venue);
  }

  public getAllStatuses(): IVenueCredentialsStatus[] {
    return Array.from(this.adapters.values()).map(a => a.getCredentialsStatus());
  }

  public async pingAll(): Promise<{ venue: VenueId; alive: boolean; latencyMs: number }[]> {
    const results = await Promise.all(
      Array.from(this.adapters.values()).map(async a => {
        const res = await a.ping();
        return { venue: a.venue, alive: res.alive, latencyMs: res.latencyMs };
      })
    );
    return results;
  }
}

export const globalVenueRegistry = new VenueRegistry();
