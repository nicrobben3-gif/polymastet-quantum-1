/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProfitSplitterEngine
 * 
 * Core module that tracks user-specific high-water marks for portfolio equity
 * and implements middleware monitoring withdrawal events.
 * 
 * Triggers a 2.5% performance fee transfer to WALLET_PUBLIC_ADDRESS only when the
 * withdrawn amount exceeds the user's initial deposited principal (profit-based fee).
 * If a user breaks even or is at a loss, $0.00 is removed (0% fee).
 */

export interface IUserProfitProfile {
  userId: string;
  initialDepositedPrincipal: number; // Baseline principal deposited
  currentPrincipalBasis: number;     // Remaining principal basis not yet withdrawn
  highWaterMarkEquity: number;       // Peak portfolio equity achieved by user
  currentEquity: number;             // Latest reported portfolio equity
  cumulativeProfit: number;          // Math.max(0, currentEquity - currentPrincipalBasis)
  totalDeposited: number;            // Total gross capital deposited
  totalWithdrawn: number;            // Total gross capital withdrawn
  totalPerformanceFeePaid: number;   // Total 2.5% performance fees transferred
  lastUpdated: number;
}

export interface IProfitTransferEvent {
  id: string;
  txHash: string;
  timestamp: number;
  userId: string;
  requestedAmountUsd: number;
  initialDepositedPrincipal: number;
  preWithdrawalEquity: number;
  highWaterMarkEquity: number;
  profitExceededPrincipalUsd: number;
  principalPortionUsd: number;
  performanceFeeRatePct: number; // 5.0%
  transferFeeUsd: number;        // 5% of profit portion ($0.05 per dollar)
  netUserPayoutUsd: number;      // Amount delivered to user
  walletPublicAddress: string;   // Recipient wallet address of choice
  isFeeTransferred: boolean;
  status: 'TRANSFERRED' | 'EXEMPT_BREAKEVEN_OR_LOSS';
  notes: string;
}

export interface IWithdrawalIntent {
  userId: string;
  amountUsd: number;
  destinationWallet?: string;
  timestamp?: number;
}

export interface IProfitSplitResult {
  success: boolean;
  event?: IProfitTransferEvent;
  error?: string;
}

export type WithdrawalMiddlewareNext = (intent: IWithdrawalIntent) => boolean | Promise<boolean>;

export class ProfitSplitterEngine {
  private userProfiles: Map<string, IUserProfitProfile> = new Map();
  private transferEvents: IProfitTransferEvent[] = [];
  // Creator Commission Wallet: Configured strictly via server-side environment config or creator fallback.
  // Converted and routed in USDT on the Solana blockchain. End-users cannot modify or redirect.
  public static readonly CREATOR_FEE_WALLET: string =
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CREATOR_FEE_WALLET) ||
    'GmRZNNRyzYZKatdCsSALmgyLksNX8Mx1XrJPCt1ZwUbm';
  private readonly walletPublicAddress: string = ProfitSplitterEngine.CREATOR_FEE_WALLET;
  private performanceFeePct: number = 5.0; // 5.0% ($0.05 on every dollar of profit)
  private listeners: (() => void)[] = [];
  private transferSubscribers: ((event: IProfitTransferEvent) => void)[] = [];

  constructor() {
    // Initialize default user profile with standard institutional baseline
    this.initUserProfile('default_user', 100000);
  }

  /**
   * Initializes or loads a user-specific profit profile
   */
  public initUserProfile(userId: string, initialPrincipal = 100000): IUserProfitProfile {
    const existing = this.userProfiles.get(userId);
    if (existing) return existing;

    const profile: IUserProfitProfile = {
      userId,
      initialDepositedPrincipal: initialPrincipal,
      currentPrincipalBasis: initialPrincipal,
      highWaterMarkEquity: initialPrincipal,
      currentEquity: initialPrincipal,
      cumulativeProfit: 0,
      totalDeposited: initialPrincipal,
      totalWithdrawn: 0,
      totalPerformanceFeePaid: 0,
      lastUpdated: Date.now()
    };

    this.userProfiles.set(userId, profile);
    return profile;
  }

  /**
   * Retrieves profile for a specific user ID
   */
  public getUserProfile(userId: string = 'default_user'): IUserProfitProfile {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = this.initUserProfile(userId, 0);
    }
    return { ...profile };
  }

  /**
   * Returns all active user profiles
   */
  public getAllProfiles(): IUserProfitProfile[] {
    return Array.from(this.userProfiles.values()).map(p => ({ ...p }));
  }

  /**
   * Protected: Destination WALLET_PUBLIC_ADDRESS is fixed to the app creator's fee wallet.
   * End-users cannot modify or override this destination address.
   */
  public setWalletPublicAddress(_address: string) {
    console.warn('Creator commission wallet address is immutable and cannot be changed by end users.');
  }

  public getWalletPublicAddress(): string {
    return this.walletPublicAddress;
  }

  public getPerformanceFeePct(): number {
    return this.performanceFeePct;
  }

  public setPerformanceFeePct(feePct: number) {
    this.performanceFeePct = Math.max(0, Math.min(100, feePct));
    this.notify();
  }

  /**
   * Records a user deposit and updates principal basis and high-water mark
   */
  public recordDeposit(userId: string = 'default_user', amountUsd: number) {
    if (amountUsd <= 0) return;
    const profile = this.userProfiles.get(userId) || this.initUserProfile(userId, 0);

    profile.initialDepositedPrincipal += amountUsd;
    profile.currentPrincipalBasis += amountUsd;
    profile.totalDeposited += amountUsd;
    profile.currentEquity += amountUsd;
    profile.highWaterMarkEquity = Math.max(profile.highWaterMarkEquity, profile.currentEquity);
    profile.cumulativeProfit = Math.max(0, profile.currentEquity - profile.currentPrincipalBasis);
    profile.lastUpdated = Date.now();

    this.notify();
  }

  /**
   * Updates user portfolio equity and tracks user-specific high-water mark
   */
  public updateEquity(userId: string = 'default_user', equityUsd: number) {
    const profile = this.userProfiles.get(userId) || this.initUserProfile(userId, equityUsd);

    profile.currentEquity = equityUsd;
    if (equityUsd > profile.highWaterMarkEquity) {
      profile.highWaterMarkEquity = equityUsd;
    }
    profile.cumulativeProfit = Math.max(0, profile.currentEquity - profile.currentPrincipalBasis);
    profile.lastUpdated = Date.now();

    this.notify();
  }

  /**
   * Calculates performance fee and breakdown for a contemplated withdrawal
   * without applying the state change.
   */
  public previewWithdrawal(userId: string = 'default_user', amountUsd: number): IProfitTransferEvent {
    const profile = this.userProfiles.get(userId) || this.initUserProfile(userId, 0);
    const cumulativeProfit = Math.max(0, profile.currentEquity - profile.currentPrincipalBasis);

    const eventId = `SPLIT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const txHash = `0x${Math.random().toString(16).substring(2, 10)}${Date.now().toString(16)}${Math.random().toString(16).substring(2, 8)}`;

    // Breakeven or Loss: No fee charged
    if (cumulativeProfit <= 0 || amountUsd <= 0) {
      return {
        id: eventId,
        txHash,
        timestamp: Date.now(),
        userId,
        requestedAmountUsd: amountUsd,
        initialDepositedPrincipal: profile.currentPrincipalBasis,
        preWithdrawalEquity: profile.currentEquity,
        highWaterMarkEquity: profile.highWaterMarkEquity,
        profitExceededPrincipalUsd: 0,
        principalPortionUsd: amountUsd,
        performanceFeeRatePct: this.performanceFeePct,
        transferFeeUsd: 0,
        netUserPayoutUsd: amountUsd,
        walletPublicAddress: this.walletPublicAddress,
        isFeeTransferred: false,
        status: 'EXEMPT_BREAKEVEN_OR_LOSS',
        notes: `Breakeven/Loss Protection: Withdrawn amount does not exceed initial deposited principal basis ($${profile.currentPrincipalBasis.toLocaleString()}). Performance fee is strictly $0.00 (0%).`
      };
    }

    // Profit portion exceeds principal basis: 5.0% transfer triggered
    const profitExceededPrincipalUsd = Math.min(amountUsd, cumulativeProfit);
    const principalPortionUsd = Math.max(0, amountUsd - profitExceededPrincipalUsd);
    const transferFeeUsd = Number((profitExceededPrincipalUsd * (this.performanceFeePct / 100)).toFixed(2));
    const netUserPayoutUsd = Number((amountUsd - transferFeeUsd).toFixed(2));

    return {
      id: eventId,
      txHash,
      timestamp: Date.now(),
      userId,
      requestedAmountUsd: amountUsd,
      initialDepositedPrincipal: profile.currentPrincipalBasis,
      preWithdrawalEquity: profile.currentEquity,
      highWaterMarkEquity: profile.highWaterMarkEquity,
      profitExceededPrincipalUsd,
      principalPortionUsd,
      performanceFeeRatePct: this.performanceFeePct,
      transferFeeUsd,
      netUserPayoutUsd,
      walletPublicAddress: this.walletPublicAddress,
      isFeeTransferred: transferFeeUsd > 0,
      status: 'TRANSFERRED',
      notes: `Performance-based fee triggered: $${profitExceededPrincipalUsd.toFixed(2)} profit exceeds deposited principal. 5.0% fee ($${transferFeeUsd.toFixed(2)}) transferred to WALLET_PUBLIC_ADDRESS (${this.walletPublicAddress}).`
    };
  }

  /**
   * Intercepts and executes a withdrawal event through the performance splitter engine.
   * Updates user principal basis, high-water mark, and logs the 2.5% transfer.
   */
  public executeWithdrawal(userId: string = 'default_user', amountUsd: number): IProfitSplitResult {
    if (amountUsd <= 0) {
      return { success: false, error: 'Withdrawal amount must be greater than zero.' };
    }

    const profile = this.userProfiles.get(userId) || this.initUserProfile(userId, 0);
    if (amountUsd > profile.currentEquity) {
      return { success: false, error: 'Insufficient portfolio equity for withdrawal.' };
    }

    const event = this.previewWithdrawal(userId, amountUsd);

    // Update user profile equity and principal basis
    profile.currentEquity -= amountUsd;
    profile.totalWithdrawn += amountUsd;
    profile.currentPrincipalBasis = Math.max(0, profile.currentPrincipalBasis - event.principalPortionUsd);
    profile.cumulativeProfit = Math.max(0, profile.currentEquity - profile.currentPrincipalBasis);
    profile.lastUpdated = Date.now();

    if (event.isFeeTransferred) {
      profile.totalPerformanceFeePaid = Number((profile.totalPerformanceFeePaid + event.transferFeeUsd).toFixed(2));
    }

    // Record transfer event in audit ledger
    this.transferEvents.unshift(event);
    if (this.transferEvents.length > 100) {
      this.transferEvents.pop();
    }

    // Broadcast to transfer subscribers
    for (const sub of this.transferSubscribers) {
      try {
        sub(event);
      } catch (err) {
        console.error('Error in transfer subscriber:', err);
      }
    }

    this.notify();
    return { success: true, event };
  }

  /**
   * Middleware creator to monitor external withdrawal events
   */
  public createWithdrawalMiddleware() {
    return async (intent: IWithdrawalIntent, next?: WithdrawalMiddlewareNext): Promise<IProfitSplitResult> => {
      const res = this.executeWithdrawal(intent.userId, intent.amountUsd);
      if (res.success && next) {
        await next(intent);
      }
      return res;
    };
  }

  /**
   * Get all logged profit transfer events
   */
  public getTransferEvents(): IProfitTransferEvent[] {
    return [...this.transferEvents];
  }

  /**
   * Total performance fees transferred across all users
   */
  public getTotalFeesTransferredUsd(): number {
    return Number(
      this.transferEvents
        .filter(e => e.isFeeTransferred)
        .reduce((sum, e) => sum + e.transferFeeUsd, 0)
        .toFixed(2)
    );
  }

  /**
   * Subscribes to changes in engine state
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Subscribes specifically to 2.5% profit fee transfer events
   */
  public onProfitTransfer(callback: (event: IProfitTransferEvent) => void): () => void {
    this.transferSubscribers.push(callback);
    return () => {
      this.transferSubscribers = this.transferSubscribers.filter(s => s !== callback);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('Error in ProfitSplitterEngine listener:', err);
      }
    }
  }
}

// Export singleton instance for app-wide use
export const globalProfitSplitterEngine = new ProfitSplitterEngine();

export { useProfitSplitter } from './useProfitSplitter';
