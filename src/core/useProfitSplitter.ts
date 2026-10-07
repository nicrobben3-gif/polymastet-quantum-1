/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  globalProfitSplitterEngine,
  IUserProfitProfile,
  IProfitTransferEvent,
  IProfitSplitResult
} from './profitSplitterEngine';

/**
 * React hook that monitors user-specific high-water mark, profit splits,
 * and withdrawal events with 2.5% fee routing to WALLET_PUBLIC_ADDRESS.
 */
export function useProfitSplitter(userId: string = 'default_user') {
  const [profile, setProfile] = useState<IUserProfitProfile>(() =>
    globalProfitSplitterEngine.getUserProfile(userId)
  );
  const [walletPublicAddress, setWalletAddressState] = useState<string>(() =>
    globalProfitSplitterEngine.getWalletPublicAddress()
  );
  const [transferEvents, setTransferEvents] = useState<IProfitTransferEvent[]>(() =>
    globalProfitSplitterEngine.getTransferEvents()
  );
  const [latestTransfer, setLatestTransfer] = useState<IProfitTransferEvent | null>(null);

  useEffect(() => {
    // Initial sync
    setProfile(globalProfitSplitterEngine.getUserProfile(userId));
    setWalletAddressState(globalProfitSplitterEngine.getWalletPublicAddress());
    setTransferEvents(globalProfitSplitterEngine.getTransferEvents());

    // State change listener
    const unsubState = globalProfitSplitterEngine.subscribe(() => {
      setProfile(globalProfitSplitterEngine.getUserProfile(userId));
      setWalletAddressState(globalProfitSplitterEngine.getWalletPublicAddress());
      setTransferEvents(globalProfitSplitterEngine.getTransferEvents());
    });

    // Transfer event listener
    const unsubTransfer = globalProfitSplitterEngine.onProfitTransfer((event) => {
      if (event.userId === userId) {
        setLatestTransfer(event);
      }
    });

    return () => {
      unsubState();
      unsubTransfer();
    };
  }, [userId]);

  const setWalletPublicAddress = useCallback((addr: string) => {
    globalProfitSplitterEngine.setWalletPublicAddress(addr);
    setWalletAddressState(globalProfitSplitterEngine.getWalletPublicAddress());
  }, []);

  const previewWithdrawal = useCallback((amountUsd: number): IProfitTransferEvent => {
    return globalProfitSplitterEngine.previewWithdrawal(userId, amountUsd);
  }, [userId]);

  const executeWithdrawal = useCallback((amountUsd: number): IProfitSplitResult => {
    return globalProfitSplitterEngine.executeWithdrawal(userId, amountUsd);
  }, [userId]);

  const recordDeposit = useCallback((amountUsd: number) => {
    globalProfitSplitterEngine.recordDeposit(userId, amountUsd);
  }, [userId]);

  const updateEquity = useCallback((equityUsd: number) => {
    globalProfitSplitterEngine.updateEquity(userId, equityUsd);
  }, [userId]);

  return {
    profile,
    walletPublicAddress,
    setWalletPublicAddress,
    performanceFeePct: globalProfitSplitterEngine.getPerformanceFeePct(),
    transferEvents,
    latestTransfer,
    totalFeesTransferredUsd: globalProfitSplitterEngine.getTotalFeesTransferredUsd(),
    previewWithdrawal,
    executeWithdrawal,
    recordDeposit,
    updateEquity
  };
}
