/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, animate, useMotionValue } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react';

interface Props {
  equityUsd: number;
  cashUsd: number;
  className?: string;
}

export const AnimatedEquityCard: React.FC<Props> = ({ equityUsd, cashUsd, className = '' }) => {
  const numberRef = useRef<HTMLDivElement>(null);
  const motionVal = useMotionValue(equityUsd);
  const prevEquityRef = useRef(equityUsd);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const prev = prevEquityRef.current;
    if (equityUsd !== prev) {
      if (equityUsd > prev) {
        setDirection('up');
      } else {
        setDirection('down');
      }
      const timer = setTimeout(() => setDirection(null), 1500);

      // Smooth count-up / count-down animation over 1.2s using Framer Motion
      const controls = animate(motionVal, equityUsd, {
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1], // Institutional cubic bezier
        onUpdate: (latest) => {
          if (numberRef.current) {
            numberRef.current.textContent = `$${latest.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })}`;
          }
        }
      });

      prevEquityRef.current = equityUsd;

      return () => {
        controls.stop();
        clearTimeout(timer);
      };
    }
  }, [equityUsd, motionVal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        borderColor: direction === 'up' ? '#10b981' : direction === 'down' ? '#f43f5e' : '#1b2230',
        backgroundColor: direction === 'up' ? 'rgba(16, 185, 129, 0.06)' : direction === 'down' ? 'rgba(244, 63, 94, 0.06)' : '#10141e'
      }}
      transition={{ duration: 0.4 }}
      className={`border p-3.5 rounded relative overflow-hidden transition-colors ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-[#64748b]">Portfolio Equity</span>
        {direction && (
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`text-[10px] font-mono font-bold flex items-center gap-0.5 px-1.5 py-0.2 rounded border ${
              direction === 'up'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-rose-800'
            }`}
          >
            {direction === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{direction === 'up' ? 'GROWTH' : 'DRAWDOWN'}</span>
          </motion.span>
        )}
      </div>

      {/* Smoothly Animated Equity Number */}
      <motion.div
        animate={direction ? { scale: [1, 1.03, 1] } : { scale: 1 }}
        transition={{ duration: 0.45 }}
        className="font-mono text-xl font-semibold text-white mt-1 tabular-nums flex items-baseline gap-1"
      >
        <div ref={numberRef}>
          ${equityUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </motion.div>

      <div className="text-[11px] text-[#64748b] mt-1 flex items-center justify-between">
        <span>Cash: ${cashUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <span className="text-[9px] text-emerald-400/80 font-mono">Live MTM</span>
      </div>

      {/* Subtle indicator glow line on count up */}
      {direction === 'up' && (
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1, ease: 'easeInOut' }}
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
        />
      )}
    </motion.div>
  );
};
