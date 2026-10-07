/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  equityUsd: number;
  cashUsd: number;
  className?: string;
}

export const AnimatedEquityCard: React.FC<Props> = ({ equityUsd, cashUsd, className = '' }) => {
  const [displayedEquity, setDisplayedEquity] = useState<number>(equityUsd);
  const prevEquityRef = useRef<number>(equityUsd);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const prev = prevEquityRef.current;
    if (equityUsd !== prev) {
      setDirection(equityUsd > prev ? 'up' : 'down');
      const timer = setTimeout(() => setDirection(null), 1500);

      const startTime = performance.now();
      const duration = 600;
      const startVal = prev;
      const endVal = equityUsd;

      let rafId: number;
      const step = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - (1 - progress) * (1 - progress);
        const current = startVal + (endVal - startVal) * ease;
        setDisplayedEquity(current);

        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          setDisplayedEquity(endVal);
        }
      };

      rafId = requestAnimationFrame(step);
      prevEquityRef.current = equityUsd;

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timer);
      };
    }
  }, [equityUsd]);

  return (
    <div
      className={`border p-3.5 rounded relative overflow-hidden transition-all duration-300 ${
        direction === 'up'
          ? 'border-emerald-500 bg-emerald-950/20'
          : direction === 'down'
          ? 'border-rose-500 bg-rose-950/20'
          : 'border-[#1b2230] bg-[#10141e]'
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Portfolio Equity</span>
        {direction && (
          <span
            className={`text-[10px] font-mono font-bold flex items-center gap-0.5 px-1.5 py-0.2 rounded border transition-all duration-200 ${
              direction === 'up'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-rose-800'
            }`}
          >
            {direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{direction === 'up' ? 'GROWTH' : 'DRAWDOWN'}</span>
          </span>
        )}
      </div>

      {/* Smoothly Animated Equity Number */}
      <div className="font-mono text-xl font-semibold text-white mt-1 tabular-nums flex items-baseline gap-1">
        <div>
          ${displayedEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>

      <div className="text-[11px] text-[#64748b] mt-1 flex items-center justify-between">
        <span>Cash: ${cashUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <span className="text-[9px] text-emerald-400/80 font-mono">Live MTM</span>
      </div>

      {/* Subtle indicator glow line on count up */}
      {direction === 'up' && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-pulse" />
      )}
    </div>
  );
};
