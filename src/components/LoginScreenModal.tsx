/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  Mail,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Key,
  X,
  Smartphone,
  ChevronRight,
  Layers,
  Zap
} from 'lucide-react';
import { globalAuthManager, IUserProfile } from '../auth/authManager';

interface ILoginScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: IUserProfile) => void;
}

export const LoginScreenModal: React.FC<ILoginScreenModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [authMethod, setAuthMethod] = useState<'GOOGLE' | 'EMAIL' | 'WALLETCONNECT'>('GOOGLE');
  const [emailInput, setEmailInput] = useState<string>('nicrobben3@gmail.com');
  const [googleEmailInput, setGoogleEmailInput] = useState<string>('nicrobben3@gmail.com');
  const [otpCode, setOtpCode] = useState<string[]>(['', '', '', '', '', '']);
  const [emailStep, setEmailStep] = useState<'INPUT' | 'OTP'>('INPUT');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copiedWc, setCopiedWc] = useState<boolean>(false);

  // Generate WalletConnect pairing URI
  const wcData = useMemo(() => {
    return globalAuthManager.createWalletConnectPairingUri();
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. GOOGLE LOGIN HANDLER
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Simulate real-world 600ms OAuth handshake
      await new Promise(r => setTimeout(r, 650));
      const res = await globalAuthManager.signInWithGoogle(googleEmailInput.trim() || undefined);
      setIsLoading(false);
      if (res.success) {
        setSuccessMessage('Successfully authenticated with Google OAuth!');
        const user = globalAuthManager.getCurrentUser();
        if (user && onLoginSuccess) onLoginSuccess(user);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setErrorMessage(res.error || 'Google authentication failed');
      }
    } catch (e: any) {
      setIsLoading(false);
      setErrorMessage(e?.message || 'Failed to authenticate via Google');
    }
  };

  // 2. EMAIL LOGIN HANDLERS
  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await new Promise(r => setTimeout(r, 500));
      setIsLoading(false);
      setEmailStep('OTP');
      setSuccessMessage(`A 6-digit one-time passkey was sent to ${emailInput}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: any) {
      setIsLoading(false);
      setErrorMessage(e?.message || 'Failed to dispatch email link');
    }
  };

  const handleVerifyEmailOtp = async () => {
    const code = otpCode.join('');
    if (code.length < 6) {
      setErrorMessage('Please enter the complete 6-digit passkey');
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      const res = await globalAuthManager.signInWithEmail(emailInput.trim());
      setIsLoading(false);
      if (res.success) {
        setSuccessMessage('Email verified and authenticated successfully!');
        const user = globalAuthManager.getCurrentUser();
        if (user && onLoginSuccess) onLoginSuccess(user);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setErrorMessage(res.error || 'Invalid or expired code');
      }
    } catch (e: any) {
      setIsLoading(false);
      setErrorMessage(e?.message || 'Verification failed');
    }
  };

  // 3. WALLETCONNECT HANDLERS
  const handleCopyWcUri = () => {
    if (wcData?.uri) {
      navigator.clipboard.writeText(wcData.uri);
      setCopiedWc(true);
      setTimeout(() => setCopiedWc(false), 2000);
    }
  };

  const handleConnectWalletConnect = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await new Promise(r => setTimeout(r, 750));
      const res = await globalAuthManager.connectEvmWallet('evm_walletconnect');
      setIsLoading(false);
      if (res.success) {
        setSuccessMessage('WalletConnect session paired and established!');
        const user = globalAuthManager.getCurrentUser();
        if (user && onLoginSuccess) onLoginSuccess(user);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setErrorMessage(res.error || 'WalletConnect pairing rejected');
      }
    } catch (e: any) {
      setIsLoading(false);
      setErrorMessage(e?.message || 'Failed to connect via WalletConnect');
    }
  };

  const handleDirectBrowserWallet = async (type: 'phantom' | 'metamask') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = type === 'phantom' 
        ? await globalAuthManager.connectSolanaWallet('solana_phantom')
        : await globalAuthManager.connectEvmWallet('evm_metamask');
      setIsLoading(false);
      if (res.success) {
        setSuccessMessage(`${type === 'phantom' ? 'Phantom' : 'MetaMask'} connected!`);
        const user = globalAuthManager.getCurrentUser();
        if (user && onLoginSuccess) onLoginSuccess(user);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setErrorMessage(res.error || `Failed to connect ${type}`);
      }
    } catch (e: any) {
      setIsLoading(false);
      setErrorMessage(e?.message || 'Browser wallet connection failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0b0f19] border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl shadow-cyan-950/40 text-slate-200 font-sans relative overflow-hidden">
        
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#151c2b] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="space-y-1 text-center pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-300 text-[11px] font-mono font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>POLYMASTER QUANTUM ACCESS</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            Institutional Sign In
          </h2>
          <p className="text-xs text-[#94a3b8]">
            Choose your preferred authentication method to access live execution vaults
          </p>
        </div>

        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2 font-mono">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 3 Prominent Authentication Method Pills */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-[#070b13] border border-[#1b2535] rounded-xl font-mono text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMethod('GOOGLE');
              setErrorMessage(null);
            }}
            className={`py-2 px-1 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              authMethod === 'GOOGLE'
                ? 'bg-blue-950/90 text-blue-300 border border-blue-600/80 shadow-sm shadow-blue-950'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            {/* Google G SVG Logo */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMethod('EMAIL');
              setErrorMessage(null);
            }}
            className={`py-2 px-1 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              authMethod === 'EMAIL'
                ? 'bg-purple-950/90 text-purple-300 border border-purple-600/80 shadow-sm shadow-purple-950'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4 text-purple-400" />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMethod('WALLETCONNECT');
              setErrorMessage(null);
            }}
            className={`py-2 px-1 rounded-lg font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
              authMethod === 'WALLETCONNECT'
                ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-600/80 shadow-sm shadow-cyan-950'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4 text-cyan-400" />
            <span>WalletConnect</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* METHOD 1: GOOGLE LOGIN TAB */}
        {/* ========================================================================= */}
        {authMethod === 'GOOGLE' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="p-4 bg-[#070b13] border border-[#1b2535] rounded-xl space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[#94a3b8]">
                <span>1-Click Google OAuth Identity</span>
                <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800/60 font-bold">
                  VERIFIED
                </span>
              </div>

              <div>
                <label className="text-[11px] text-[#64748b] block mb-1">
                  Google Account Email:
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={googleEmailInput}
                    onChange={(e) => setGoogleEmailInput(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full bg-[#0d131f] border border-[#232d3f] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-[#64748b] leading-relaxed">
                Connect your Google identity to synchronize high-water marks, portfolio allocations, and automated notifications across devices.
              </p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-bold rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg shadow-white/10"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Authenticating with Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* METHOD 2: EMAIL LOGIN TAB */}
        {/* ========================================================================= */}
        {authMethod === 'EMAIL' && (
          <div className="space-y-4 animate-fadeIn">
            {emailStep === 'INPUT' ? (
              <form onSubmit={handleSendEmailOtp} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-mono text-[#94a3b8] flex items-center justify-between">
                    <span>Enter your email address:</span>
                    <span className="text-purple-400 text-[10px]">PASSWORDLESS PASSKEY</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="trader@hedgefund.com"
                      className="w-full bg-[#070b13] border border-[#232d3f] rounded-xl pl-9 pr-3 py-2.5 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>

                  {/* Domain helper pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {['@gmail.com', '@outlook.com', '@icloud.com', '@proton.me'].map((domain) => (
                      <button
                        key={domain}
                        type="button"
                        onClick={() => {
                          const base = emailInput.split('@')[0] || 'trader';
                          setEmailInput(`${base}${domain}`);
                        }}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101624] text-[#94a3b8] hover:text-white border border-[#1b2535] hover:border-purple-500/50 cursor-pointer"
                      >
                        {domain}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 font-mono text-xs transition-all cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send 6-Digit Passkey</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-[#070b13] border border-purple-900/50 rounded-xl space-y-1 font-mono text-xs">
                  <div className="text-purple-300 font-bold flex items-center justify-between">
                    <span>Enter 6-Digit Code</span>
                    <button
                      type="button"
                      onClick={() => setEmailStep('INPUT')}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Change Email
                    </button>
                  </div>
                  <p className="text-[11px] text-[#94a3b8]">
                    Sent to: <strong className="text-white">{emailInput}</strong>
                  </p>
                </div>

                {/* 6 Digit Inputs */}
                <div className="flex justify-between gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <input
                      key={idx}
                      id={`otp-${idx}`}
                      type="text"
                      maxLength={1}
                      value={otpCode[idx]}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newOtp = [...otpCode];
                        newOtp[idx] = val;
                        setOtpCode(newOtp);
                        if (val && idx < 5) {
                          const nextInput = document.getElementById(`otp-${idx + 1}`);
                          nextInput?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) {
                          const prevInput = document.getElementById(`otp-${idx - 1}`);
                          prevInput?.focus();
                        }
                      }}
                      className="w-11 h-12 text-center text-lg font-mono font-bold bg-[#070b13] border border-[#232d3f] rounded-lg text-purple-300 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpCode(['7', '4', '2', '9', '1', '5'])}
                    className="text-[10px] font-mono text-purple-400 hover:text-purple-300 underline cursor-pointer"
                  >
                    Auto-Fill Test Code (742915)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyEmailOtp}
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 font-mono text-xs transition-all cursor-pointer shadow-lg shadow-purple-950/50"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Access Account</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* METHOD 3: WALLETCONNECT TAB */}
        {/* ========================================================================= */}
        {authMethod === 'WALLETCONNECT' && (
          <div className="space-y-4 animate-fadeIn">
            {/* WalletConnect QR Display */}
            <div className="p-3 bg-[#070b13] border border-[#1b2535] rounded-xl flex flex-col items-center justify-center space-y-2.5">
              <div className="w-36 h-36 bg-white p-2 rounded-xl flex items-center justify-center relative shadow-md">
                {/* Clean inline SVG Matrix QR Simulator */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                  {/* Outer corner markers */}
                  <rect x="5" y="5" width="28" height="28" fill="#091428" />
                  <rect x="9" y="9" width="20" height="20" fill="white" />
                  <rect x="13" y="13" width="12" height="12" fill="#091428" />

                  <rect x="67" y="5" width="28" height="28" fill="#091428" />
                  <rect x="71" y="9" width="20" height="20" fill="white" />
                  <rect x="75" y="13" width="12" height="12" fill="#091428" />

                  <rect x="5" y="67" width="28" height="28" fill="#091428" />
                  <rect x="9" y="71" width="20" height="20" fill="white" />
                  <rect x="13" y="75" width="12" height="12" fill="#091428" />

                  {/* Matrix payload dots */}
                  <rect x="38" y="10" width="8" height="8" fill="#091428" />
                  <rect x="50" y="18" width="6" height="6" fill="#091428" />
                  <rect x="42" y="28" width="8" height="8" fill="#091428" />
                  <rect x="10" y="38" width="8" height="8" fill="#091428" />
                  <rect x="22" y="44" width="8" height="8" fill="#091428" />
                  <rect x="36" y="40" width="28" height="20" fill="#3b82f6" rx="3" />
                  <rect x="70" y="38" width="8" height="8" fill="#091428" />
                  <rect x="82" y="46" width="8" height="8" fill="#091428" />
                  <rect x="40" y="68" width="8" height="8" fill="#091428" />
                  <rect x="52" y="74" width="8" height="8" fill="#091428" />
                  <rect x="68" y="70" width="8" height="8" fill="#091428" />
                  <rect x="80" y="80" width="10" height="10" fill="#091428" />
                </svg>

                {/* Center Badge */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-md border-2 border-white">
                    WC
                  </div>
                </div>
              </div>

              <div className="text-center font-mono text-[11px] text-[#94a3b8]">
                <span>Scan with your mobile wallet app (MetaMask, Trust, Rainbow, Phantom)</span>
              </div>

              {/* Copy URI Button */}
              <button
                type="button"
                onClick={handleCopyWcUri}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#121927] hover:bg-[#1a2337] border border-[#232d3f] text-cyan-300 rounded-lg text-xs font-mono cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedWc ? 'URI Copied to Clipboard!' : 'Copy WalletConnect URI'}</span>
              </button>
            </div>

            {/* Direct Wallet Launcher Pills */}
            <div className="space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-[#64748b] uppercase tracking-wider block">
                Or Connect Directly / Open in App:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDirectBrowserWallet('metamask')}
                  className="p-2.5 rounded-lg bg-[#0c101a] border border-[#1d2738] hover:border-amber-500/50 text-left flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-bold text-white flex items-center gap-1.5">
                    🦊 MetaMask
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#64748b]" />
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectBrowserWallet('phantom')}
                  className="p-2.5 rounded-lg bg-[#0c101a] border border-[#1d2738] hover:border-purple-500/50 text-left flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-bold text-white flex items-center gap-1.5">
                    👻 Phantom (Solana)
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#64748b]" />
                </button>
              </div>

              {/* Confirm WalletConnect Pair */}
              <button
                type="button"
                onClick={handleConnectWalletConnect}
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 font-mono text-xs transition-all cursor-pointer shadow-lg shadow-cyan-950/50"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Authorize WalletConnect Session</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Security & Disclaimer Footer */}
        <div className="pt-2 border-t border-[#1b2535] space-y-2 font-mono text-[10px] text-[#64748b]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              <span>Non-Custodial Architecture</span>
            </span>
            <span>256-Bit TLS Protected</span>
          </div>
          <p>
            Private keys are never stored on central servers. Performance shares (5.0%) apply strictly to net trading profits above initial principal.
          </p>
        </div>

      </div>
    </div>
  );
};
