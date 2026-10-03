/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Wallet,
  Shield,
  Check,
  Lock,
  ExternalLink,
  LogOut,
  Mail,
  Key,
  Smartphone,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  QrCode,
  FileSignature,
  ArrowRight,
  RefreshCw,
  Layers,
  Send
} from 'lucide-react';
import { globalAuthManager, IUserProfile, AuthProviderType } from '../auth/authManager';
import { globalProfitSplitterEngine } from '../core/profitSplitterEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: IUserProfile | null;
}

export const UserAccountModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'WALLETS' | 'SIGNING' | 'SOCIAL' | 'EMAIL'>('WALLETS');
  const [emailInput, setEmailInput] = useState<string>('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // WalletConnect Modal State
  const [showWcModal, setShowWcModal] = useState<boolean>(false);
  const [wcUriData, setWcUriData] = useState<{
    uri: string;
    deepLinkMetamask: string;
    deepLinkTrust: string;
    deepLinkPhantom: string;
    deepLinkRainbow: string;
  } | null>(null);
  const [copiedWc, setCopiedWc] = useState<boolean>(false);

  // Signing Playground State
  const [isSigning, setIsSigning] = useState<boolean>(false);
  const [lastSignature, setLastSignature] = useState<string | null>(currentUser?.authSignature || null);
  const [lastSignedMsg, setLastSignedMsg] = useState<string | null>(currentUser?.signedMessage || null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const userProfileInSplitter = currentUser
    ? globalProfitSplitterEngine.getUserProfile(currentUser.id)
    : null;

  const handleConnectSolana = async (provider: 'solana_phantom' | 'solana_solflare') => {
    setLoadingProvider(provider);
    setErrorMessage(null);
    const res = await globalAuthManager.connectSolanaWallet(provider);
    setLoadingProvider(null);
    if (res.success) {
      setSuccessMessage('Solana wallet connected successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        setActiveTab('SIGNING');
      }, 700);
    } else {
      setErrorMessage(res.error || 'Failed to connect Solana wallet');
    }
  };

  const handleConnectEvm = async (provider: 'evm_metamask' | 'evm_walletconnect') => {
    setLoadingProvider(provider);
    setErrorMessage(null);
    const res = await globalAuthManager.connectEvmWallet(provider);
    setLoadingProvider(null);
    if (res.success) {
      setSuccessMessage('Web3 wallet connected successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        setActiveTab('SIGNING');
      }, 700);
    } else {
      setErrorMessage(res.error || 'Failed to connect EVM wallet');
    }
  };

  const handleOpenWalletConnect = () => {
    const data = globalAuthManager.createWalletConnectPairingUri();
    setWcUriData(data);
    setShowWcModal(true);
  };

  const handleCopyWcUri = () => {
    if (wcUriData?.uri) {
      navigator.clipboard.writeText(wcUriData.uri);
      setCopiedWc(true);
      setTimeout(() => setCopiedWc(false), 2000);
    }
  };

  const handleConfirmWcPairing = async () => {
    await handleConnectEvm('evm_walletconnect');
    setShowWcModal(false);
  };

  const handleSignAuthChallenge = async () => {
    setIsSigning(true);
    setErrorMessage(null);
    const res = await globalAuthManager.signAuthChallenge();
    setIsSigning(false);
    if (res.success && res.signature) {
      setLastSignature(res.signature);
      setLastSignedMsg(res.message || null);
      setSuccessMessage('Cryptographic challenge signed and verified!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } else {
      setErrorMessage(res.error || 'Failed to sign challenge');
    }
  };

  const handleSignTestTx = async () => {
    setIsSigning(true);
    setErrorMessage(null);
    const res = await globalAuthManager.signWeb3Transaction({
      to: '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch Aggregator
      valueEth: '0.00',
      dataHex: '0x095ea7b3000000000000000000000000'
    });
    setIsSigning(false);
    if (res.success && res.txHash) {
      setLastTxHash(res.txHash);
      setSuccessMessage('Transaction signed and execution authorization broadcasted!');
      setTimeout(() => setSuccessMessage(null), 3500);
    } else {
      setErrorMessage(res.error || 'Failed to sign transaction');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google');
    setErrorMessage(null);
    const res = await globalAuthManager.signInWithGoogle();
    setLoadingProvider(null);
    if (res.success) {
      setSuccessMessage('Signed in with Google successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.error || 'Google authentication failed');
    }
  };

  const handleAppleSignIn = async () => {
    setLoadingProvider('apple');
    setErrorMessage(null);
    const res = await globalAuthManager.signInWithApple();
    setLoadingProvider(null);
    if (res.success) {
      setSuccessMessage('Signed in with Apple successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.error || 'Apple authentication failed');
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    setLoadingProvider('email');
    setErrorMessage(null);
    const res = await globalAuthManager.signInWithEmail(emailInput);
    setLoadingProvider(null);
    if (res.success) {
      setSuccessMessage('Authenticated successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1000);
    } else {
      setErrorMessage(res.error || 'Email authentication failed');
    }
  };

  const handleSignOut = () => {
    globalAuthManager.signOut();
    setLastSignature(null);
    setLastSignedMsg(null);
    setLastTxHash(null);
    setSuccessMessage('Signed out of trading session.');
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0f1420] border border-[#232d3f] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="p-4 bg-[#0a0e17] border-b border-[#1b2333] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                {currentUser ? 'Trader Account & Web3 Authentication' : 'Sign In to PolyMaster Quantum'}
              </h3>
              <p className="text-[11px] text-[#64748b] font-mono">
                Isolated Non-Custodial Sessions · Web3 Wallets & OAuth
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#64748b] hover:text-white rounded-lg hover:bg-[#1a2333] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FEEDBACK BANNERS */}
        {successMessage && (
          <div className="p-3 bg-emerald-950/80 border-b border-emerald-800 text-xs font-mono text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/80 border-b border-rose-800 text-xs font-mono text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ACTIVE USER SESSION SUMMARY */}
        {currentUser && (
          <div className="p-4 bg-[#121927] border-b border-[#1b2333] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  {currentUser.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">
                      {currentUser.displayName}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-blue-950 text-blue-300 border border-blue-800">
                      {currentUser.tier}
                    </span>
                    {currentUser.authSignature && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" />
                        <span>SIWE VERIFIED</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[#64748b]">
                    {currentUser.walletAddress
                      ? `${currentUser.walletAddress.slice(0, 8)}...${currentUser.walletAddress.slice(-6)} (${currentUser.walletChain?.toUpperCase()})`
                      : currentUser.email || 'Isolated Session'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 bg-[#1b2230] hover:bg-rose-950/70 hover:text-rose-300 border border-[#232d3f] text-[#94a3b8] rounded text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>

            {/* User Isolated Capital & High-Water Mark */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1b2333]/80 text-xs font-mono">
              <div className="bg-[#090d16] p-2 rounded">
                <span className="text-[10px] text-[#64748b] block">Initial Principal Basis:</span>
                <span className="text-white font-bold">
                  ${userProfileInSplitter?.initialDepositedPrincipal.toLocaleString() || '100,000'}
                </span>
              </div>
              <div className="bg-[#090d16] p-2 rounded">
                <span className="text-[10px] text-[#64748b] block">High-Water Mark:</span>
                <span className="text-emerald-400 font-bold">
                  ${userProfileInSplitter?.highWaterMarkEquity.toLocaleString() || '100,000'}
                </span>
              </div>
              <div className="bg-[#090d16] p-2 rounded">
                <span className="text-[10px] text-[#64748b] block">Net Realized Profit:</span>
                <span className="text-cyan-400 font-bold">
                  +${userProfileInSplitter?.cumulativeProfit.toFixed(2) || '0.00'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* AUTH TABS */}
        <div className="flex border-b border-[#1b2333] bg-[#0c1018] text-xs font-mono">
          <button
            onClick={() => setActiveTab('WALLETS')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'WALLETS'
                ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Connect Wallets</span>
          </button>

          <button
            onClick={() => setActiveTab('SIGNING')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'SIGNING'
                ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>Sign & Verify (SIWE)</span>
          </button>

          <button
            onClick={() => setActiveTab('SOCIAL')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'SOCIAL'
                ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Google & Apple</span>
          </button>

          <button
            onClick={() => setActiveTab('EMAIL')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'EMAIL'
                ? 'border-blue-500 text-blue-400 font-bold bg-blue-500/5'
                : 'border-transparent text-[#94a3b8] hover:text-white'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Passkey</span>
          </button>
        </div>

        {/* TAB CONTENTS */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: WEB3 WALLETS */}
          {activeTab === 'WALLETS' && (
            <div className="space-y-4 font-mono">
              <div className="text-xs text-[#94a3b8]">
                Authenticate directly using your non-custodial Web3 wallet. Each wallet is cryptographically isolated and maintains its own private order execution pipeline.
              </div>

              {/* Solana Wallets */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>Solana Web3 Wallets (Sub-Slot & Memecoin Sniping)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleConnectSolana('solana_phantom')}
                    disabled={loadingProvider === 'solana_phantom'}
                    className="p-3 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-purple-500/50 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-300 font-bold">
                        👻
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-white group-hover:text-purple-300">
                          Phantom Wallet
                        </div>
                        <div className="text-[10px] text-[#64748b]">Solana / SPL Tokens</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-white" />
                  </button>

                  <button
                    onClick={() => handleConnectSolana('solana_solflare')}
                    disabled={loadingProvider === 'solana_solflare'}
                    className="p-3 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-amber-500/50 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center text-amber-300 font-bold">
                        ☀️
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-white group-hover:text-amber-300">
                          Solflare Wallet
                        </div>
                        <div className="text-[10px] text-[#64748b]">Solana / Staking</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-white" />
                  </button>
                </div>
              </div>

              {/* EVM & WalletConnect */}
              <div className="space-y-2 pt-1">
                <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>EVM & WalletConnect (Polymarket & Cross-Chain Arb)</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleConnectEvm('evm_metamask')}
                    disabled={loadingProvider === 'evm_metamask'}
                    className="p-3 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-orange-500/50 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-950 border border-orange-800 flex items-center justify-center text-orange-400 font-bold">
                        🦊
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-white group-hover:text-orange-300">
                          MetaMask / Rabby
                        </div>
                        <div className="text-[10px] text-[#64748b]">Polygon & Ethereum</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-white" />
                  </button>

                  <button
                    onClick={handleOpenWalletConnect}
                    className="p-3 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-blue-500/50 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400 font-bold">
                        🔗
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-white group-hover:text-blue-300">
                          WalletConnect v2
                        </div>
                        <div className="text-[10px] text-[#64748b]">QR Code & Mobile Apps</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 font-bold">
                      PAIR
                    </span>
                  </button>
                </div>
              </div>

              {/* WALLETCONNECT QR & DEEP LINK POPUP INSET */}
              {showWcModal && wcUriData && (
                <div className="p-4 bg-[#090d16] border border-blue-500/50 rounded-xl space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#1b2333] pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <QrCode className="w-4 h-4 text-blue-400" />
                      <span>WalletConnect Universal Pairing</span>
                    </div>
                    <button
                      onClick={() => setShowWcModal(false)}
                      className="text-[#64748b] hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#94a3b8]">
                    Scan the pairing code or click your mobile wallet app to connect instantly via WalletConnect:
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <a
                      href={wcUriData.deepLinkMetamask}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#141b28] hover:bg-[#1d273a] border border-[#232d3f] rounded-lg text-center text-xs text-white flex flex-col items-center gap-1 transition-colors"
                    >
                      <span>🦊</span>
                      <span className="text-[10px]">MetaMask</span>
                    </a>

                    <a
                      href={wcUriData.deepLinkTrust}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#141b28] hover:bg-[#1d273a] border border-[#232d3f] rounded-lg text-center text-xs text-white flex flex-col items-center gap-1 transition-colors"
                    >
                      <span>🛡️</span>
                      <span className="text-[10px]">Trust Wallet</span>
                    </a>

                    <a
                      href={wcUriData.deepLinkRainbow}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#141b28] hover:bg-[#1d273a] border border-[#232d3f] rounded-lg text-center text-xs text-white flex flex-col items-center gap-1 transition-colors"
                    >
                      <span>🌈</span>
                      <span className="text-[10px]">Rainbow</span>
                    </a>

                    <a
                      href={wcUriData.deepLinkPhantom}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#141b28] hover:bg-[#1d273a] border border-[#232d3f] rounded-lg text-center text-xs text-white flex flex-col items-center gap-1 transition-colors"
                    >
                      <span>👻</span>
                      <span className="text-[10px]">Phantom</span>
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={wcUriData.uri}
                      className="flex-1 bg-[#05070c] border border-[#1b2230] text-[10px] text-slate-400 px-2 py-1.5 rounded truncate"
                    />
                    <button
                      onClick={handleCopyWcUri}
                      className="px-2.5 py-1.5 bg-[#1b2230] hover:bg-[#28354c] text-white text-[11px] rounded flex items-center gap-1 cursor-pointer"
                    >
                      {copiedWc ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWc ? 'Copied' : 'Copy URI'}</span>
                    </button>
                    <button
                      onClick={handleConfirmWcPairing}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded cursor-pointer"
                    >
                      Confirm Pair
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SIGN & VERIFY (SIWE / CRYPTOGRAPHIC PROOF) */}
          {activeTab === 'SIGNING' && (
            <div className="space-y-4 font-mono">
              <div className="text-xs text-[#94a3b8]">
                Sign cryptographic challenges to prove private key ownership (Sign-In with Ethereum SIWE / Sign-In with Solana SIWS) or authorize trading executions.
              </div>

              {currentUser?.walletAddress ? (
                <div className="space-y-3">
                  {/* Active Wallet Details */}
                  <div className="p-3 bg-[#090d16] border border-[#1b2333] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748b]">Connected Wallet:</span>
                      <span className="text-white font-bold select-all">
                        {currentUser.walletAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#64748b]">Chain Environment:</span>
                      <span className="text-cyan-400 font-bold uppercase">
                        {currentUser.walletChain} (Mainnet / Tier 1 RPC)
                      </span>
                    </div>
                  </div>

                  {/* Actions: Sign SIWE & Sign Tx */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={handleSignAuthChallenge}
                      disabled={isSigning}
                      className="p-3 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-700/70 text-blue-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
                    >
                      <FileSignature className="w-4 h-4 text-blue-400" />
                      <span>{isSigning ? 'Requesting Sign...' : 'Sign SIWE Challenge'}</span>
                    </button>

                    <button
                      onClick={handleSignTestTx}
                      disabled={isSigning}
                      className="p-3 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700/70 text-emerald-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
                    >
                      <Send className="w-4 h-4 text-emerald-400" />
                      <span>{isSigning ? 'Signing...' : 'Sign Test Trade Authorization'}</span>
                    </button>
                  </div>

                  {/* SIWE Signature Output */}
                  {lastSignature && (
                    <div className="p-3 bg-[#0a0f19] border border-emerald-900/60 rounded-xl space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Cryptographic Signature Verified</span>
                        </span>
                        <span className="text-[10px] text-[#64748b]">Ed25519 / Secp256k1</span>
                      </div>
                      <div className="text-[10px] bg-[#04060a] p-2 rounded text-emerald-300 break-all select-all font-mono border border-emerald-950">
                        {lastSignature}
                      </div>
                      {lastSignedMsg && (
                        <div className="text-[9px] text-[#64748b] leading-tight pt-1">
                          Message: {lastSignedMsg.split('\n')[0]} · Verified at {new Date().toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Transaction Hash Output */}
                  {lastTxHash && (
                    <div className="p-3 bg-[#0a0f19] border border-cyan-900/60 rounded-xl space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Transaction Broadcast Hash</span>
                        </span>
                        <span className="text-[10px] text-[#64748b]">BLOCK CONFIRMED</span>
                      </div>
                      <div className="text-[10px] bg-[#04060a] p-2 rounded text-cyan-300 break-all select-all font-mono border border-cyan-950">
                        {lastTxHash}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-[#090d16] border border-[#1b2333] rounded-xl text-center space-y-2">
                  <Wallet className="w-8 h-8 text-[#64748b] mx-auto" />
                  <p className="text-xs font-bold text-white">No Web3 Wallet Connected</p>
                  <p className="text-[11px] text-[#64748b]">
                    Switch to the "Connect Wallets" tab to pair MetaMask, Phantom, or WalletConnect first.
                  </p>
                  <button
                    onClick={() => setActiveTab('WALLETS')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Go to Wallet Connect
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SOCIAL OAUTH (GOOGLE & APPLE) */}
          {activeTab === 'SOCIAL' && (
            <div className="space-y-3 font-mono">
              <div className="text-xs text-[#94a3b8]">
                Sign in with enterprise OAuth identity. Ideal for cloud-backed institutional sessions across desktop and mobile devices.
              </div>

              <div className="space-y-2.5 pt-1">
                {/* Google Sign In */}
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loadingProvider === 'google'}
                  className="w-full p-3 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-slate-500 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm shadow">
                      G
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white group-hover:text-blue-300">
                        Continue with Google
                      </div>
                      <div className="text-[10px] text-[#64748b]">Google Workspace / OAuth 2.0</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-white" />
                </button>

                {/* Apple Sign In */}
                <button
                  onClick={handleAppleSignIn}
                  disabled={loadingProvider === 'apple'}
                  className="w-full p-3 bg-[#131924] hover:bg-[#1a2333] border border-[#232d3f] hover:border-slate-500 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-bold text-sm shadow">
                      
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold text-white group-hover:text-slate-300">
                        Continue with Apple
                      </div>
                      <div className="text-[10px] text-[#64748b]">Apple ID & iCloud Keychain Passkey</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#64748b] group-hover:text-white" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: EMAIL PASSKEY */}
          {activeTab === 'EMAIL' && (
            <form onSubmit={handleEmailSignIn} className="space-y-4 font-mono">
              <div className="text-xs text-[#94a3b8]">
                Passwordless login via email magic link or WebAuthn hardware passkey.
              </div>

              <div className="space-y-2">
                <label className="text-[11px] text-[#64748b] uppercase block">
                  Trader Email Address:
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#64748b] absolute left-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="trader@hedgefund.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full bg-[#090d16] border border-[#232d3f] text-white text-xs font-mono pl-9 pr-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loadingProvider === 'email'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Send Magic Link & Authenticate
              </button>
            </form>
          )}

          {/* CREATOR COMMISSION ROUTING NOTICE (IMMUTABLE PROTECTION) */}
          <div className="p-3 bg-[#0a0e17] border border-[#1b2333] rounded-lg space-y-1.5 font-mono text-[11px] text-[#94a3b8]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Creator Commission Auto-Routing (Solana USDT)</span>
            </div>
            <p>
              Regardless of the login method selected (Web3, OAuth, or Passkey), all 2.5% creator commission shares on net profits are automatically routed in <strong>USDT on Solana</strong> to your locked creator address:
            </p>
            <div className="p-1.5 bg-[#070a10] rounded text-[10px] text-emerald-300 font-semibold select-all break-all border border-emerald-900/30">
              DME5GLjjttYLoMcRcd7HjCUZHoMhKoYE2uMusefXcQET
            </div>
            <p className="text-[10px] text-[#64748b]">
              If a user breaks even or withdraws at a loss, $0.00 fee is taken (100% exempt).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
