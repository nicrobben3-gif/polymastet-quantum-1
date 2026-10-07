/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  Zap,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Percent,
  Sliders,
  Sparkles,
  Trophy,
  Scale
} from 'lucide-react';
import { IMarketData } from '../types/market';
import { globalArbitrageEngine } from '../arbitrage/arbitrageEngine';
import { globalNovigEngine, INovigOrder, INovigTrade } from '../prediction/novigEngine';

interface INovigPredictionMarketViewProps {
  markets: IMarketData[];
  onSelectMarket?: (symbol: string) => void;
}

export const NovigPredictionMarketView: React.FC<INovigPredictionMarketViewProps> = ({
  markets,
  onSelectMarket
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ARBITRAGE' | 'ORDERBOOKS' | 'MARKET_MAKING'>('ARBITRAGE');
  const [simulatedExecutionMessage, setSimulatedExecutionMessage] = useState<string | null>(null);
  const [openOrders, setOpenOrders] = useState<INovigOrder[]>(globalNovigEngine.getOpenOrders());
  const [recentTrades, setRecentTrades] = useState<INovigTrade[]>(globalNovigEngine.getTrades());
  const status = globalNovigEngine.getProtocolStatus();

  // Filter Novig markets
  const novigMarkets = markets.filter(m => m.venue === 'novig');
  const filteredNovigMarkets = selectedCategory === 'ALL'
    ? novigMarkets
    : novigMarkets.filter(m => m.category?.toUpperCase() === selectedCategory);

  // Find 3-way arbitrage pairings between Novig, Polymarket, and Kalshi
  const polyPres = markets.find(m => m.venue === 'polymarket' && m.symbol.includes('US_PRES'));
  const kalshiPres = markets.find(m => m.venue === 'kalshi' && m.symbol.includes('US_PRES'));
  const novigPres = markets.find(m => m.venue === 'novig' && m.symbol.includes('US_PRES'));

  const polyFed = markets.find(m => m.venue === 'polymarket' && m.symbol.includes('FED_RATE'));
  const kalshiFed = markets.find(m => m.venue === 'kalshi' && m.symbol.includes('FED_RATE'));
  const novigFed = markets.find(m => m.venue === 'novig' && m.symbol.includes('FED_RATE'));

  // Calculate 3-way parity opportunity
  const computeThreeWaySpread = (mNovig?: IMarketData, mPoly?: IMarketData, mKalshi?: IMarketData) => {
    if (!mNovig || !mPoly || !mKalshi) return null;
    
    // Find highest bid and lowest ask across all 3
    const venues = [
      { name: 'Novig', bid: mNovig.bid, ask: mNovig.ask, fee: 0.0, gas: 0.0, venueId: 'novig' },
      { name: 'Polymarket', bid: mPoly.bid, ask: mPoly.ask, fee: 0.001, gas: 2.50, venueId: 'polymarket' },
      { name: 'Kalshi', bid: mKalshi.bid, ask: mKalshi.ask, fee: 0.003, gas: 0.0, venueId: 'kalshi' }
    ];

    let bestBuy = venues[0];
    let bestSell = venues[0];

    for (const v of venues) {
      if (v.ask < bestBuy.ask) bestBuy = v;
      if (v.bid > bestSell.bid) bestSell = v;
    }

    const grossSpread = bestSell.bid - bestBuy.ask;
    const grossSpreadPct = Number(((grossSpread / bestBuy.ask) * 100).toFixed(2));
    const notional = 10000;
    const fees = (notional * bestBuy.fee) + (notional * bestSell.fee);
    const gas = bestBuy.gas + bestSell.gas;
    const netEdgeUsd = (grossSpread * (notional / bestBuy.ask)) - fees - gas;
    const netEdgePct = Number(((netEdgeUsd / notional) * 100).toFixed(2));

    return {
      bestBuy,
      bestSell,
      grossSpreadPct,
      netEdgeUsd: Number(netEdgeUsd.toFixed(2)),
      netEdgePct,
      isExecutable: netEdgePct > 0.8 && bestBuy.venueId !== bestSell.venueId
    };
  };

  const presThreeWay = computeThreeWaySpread(novigPres, polyPres, kalshiPres);
  const fedThreeWay = computeThreeWaySpread(novigFed, polyFed, kalshiFed);

  const handleExecuteArb = (title: string, buyVenue: string, sellVenue: string, netProfit: number) => {
    if (buyVenue.toLowerCase().includes('novig') || sellVenue.toLowerCase().includes('novig')) {
      const sym = title.includes('Presidency') ? 'NOVIG:US_PRES_2028_DEM' : 'NOVIG:FED_RATE_CUT_Q4';
      const side = buyVenue.toLowerCase().includes('novig') ? 'BUY' : 'SELL';
      globalNovigEngine.submitP2POrder({
        symbol: sym,
        side,
        orderType: 'MARKET',
        size: 10000
      });
      setOpenOrders(globalNovigEngine.getOpenOrders());
      setRecentTrades(globalNovigEngine.getTrades());
    }

    setSimulatedExecutionMessage(`✓ Executed $10,000 order: BUY on ${buyVenue} and SELL on ${sellVenue} for "${title}". Net Expected Edge: +$${netProfit}`);
    setTimeout(() => setSimulatedExecutionMessage(null), 5000);
  };

  const handleLaunchMarketMakingQuotes = (symbol: string) => {
    const quotes = globalNovigEngine.postMarketMakerQuotes(symbol, 15, 2500);
    setOpenOrders(globalNovigEngine.getOpenOrders());
    setSimulatedExecutionMessage(`✓ Posted 2-sided 0% fee maker quotes for ${symbol} (Bid: $${quotes.bidOrder?.price}, Ask: $${quotes.askOrder?.price})`);
    setTimeout(() => setSimulatedExecutionMessage(null), 5000);
  };

  const handleCancelOrder = (orderId: string) => {
    globalNovigEngine.cancelOrder(orderId);
    setOpenOrders(globalNovigEngine.getOpenOrders());
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 font-bold text-lg">
            N
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Novig Prediction Market Exchange</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700 text-emerald-400">
                  0% COMMISSION · PEER-TO-PEER
                </span>
              </h2>
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              High-velocity peer-to-peer prediction market orderbooks. Zero-vig trading enables frictionless 3-way arbitrage vs Polymarket & Kalshi.
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0a0d14] p-1 rounded-lg border border-[#1b2230] text-xs font-mono">
          <button
            onClick={() => setActiveTab('ARBITRAGE')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'ARBITRAGE'
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            3-Way Cross-Venue Parity
          </button>
          <button
            onClick={() => setActiveTab('ORDERBOOKS')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'ORDERBOOKS'
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Novig Orderbooks ({filteredNovigMarkets.length})
          </button>
          <button
            onClick={() => setActiveTab('MARKET_MAKING')}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === 'MARKET_MAKING'
                ? 'bg-blue-600 text-white font-bold shadow'
                : 'text-[#94a3b8] hover:text-white'
            }`}
          >
            Zero-Fee MM Strategy
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {simulatedExecutionMessage && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-700 rounded-lg text-xs font-mono text-emerald-200 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{simulatedExecutionMessage}</span>
        </div>
      )}

      {/* TAB 1: 3-WAY CROSS-VENUE ARBITRAGE (NOVIG VS POLYMARKET VS KALSHI) */}
      {activeTab === 'ARBITRAGE' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-[#0d121c] border border-[#192232] rounded-lg">
              <span className="text-[10px] text-[#64748b] block font-mono">NOVIG ADVANTAGE</span>
              <span className="text-sm font-bold text-emerald-400">0.00% Taker / Maker Fee</span>
              <p className="text-[11px] text-[#94a3b8] mt-1">
                Zero exchange vig allows taking tighter spreads without fee erosion.
              </p>
            </div>
            <div className="p-3 bg-[#0d121c] border border-[#192232] rounded-lg">
              <span className="text-[10px] text-[#64748b] block font-mono">SETTLEMENT SPEED</span>
              <span className="text-sm font-bold text-white">Sub-10ms Off-Chain Engine</span>
              <p className="text-[11px] text-[#94a3b8] mt-1">
                No on-chain gas ($0.00) allows micro-notional order routing.
              </p>
            </div>
            <div className="p-3 bg-[#0d121c] border border-[#192232] rounded-lg">
              <span className="text-[10px] text-[#64748b] block font-mono">MONITORED VENUES</span>
              <span className="text-sm font-bold text-blue-400">Novig · Polymarket · Kalshi</span>
              <p className="text-[11px] text-[#94a3b8] mt-1">
                Continuous 3-way triangular parity matrix scanning for price divergences.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Opportunity 1: US Presidential 2028 */}
            <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-xl space-y-3 font-mono text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-blue-400 font-bold uppercase">Politics · 3-Way Parity</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Democratic Party wins 2028 US Presidency</h4>
                </div>
                {presThreeWay?.isExecutable ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    +{presThreeWay.netEdgePct}% NET EDGE
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#161c28] text-[#94a3b8]">
                    BELOW HURDLE
                  </span>
                )}
              </div>

              {/* Price Comparison Table */}
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#0a0d14] rounded border border-[#161d2a] text-center">
                <div className="space-y-1">
                  <span className="text-[10px] text-emerald-400 font-bold block">Novig (0% Vig)</span>
                  <div className="text-xs text-white font-bold">${novigPres?.bid.toFixed(3)} / ${novigPres?.ask.toFixed(3)}</div>
                  <span className="text-[9px] text-[#64748b]">Mid: ${novigPres?.midPrice.toFixed(3)}</span>
                </div>
                <div className="space-y-1 border-x border-[#161d2a]">
                  <span className="text-[10px] text-purple-400 font-bold block">Polymarket (USDC)</span>
                  <div className="text-xs text-white font-bold">${polyPres?.bid.toFixed(3)} / ${polyPres?.ask.toFixed(3)}</div>
                  <span className="text-[9px] text-[#64748b]">Mid: ${polyPres?.midPrice.toFixed(3)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-blue-400 font-bold block">Kalshi (USD)</span>
                  <div className="text-xs text-white font-bold">${kalshiPres?.bid.toFixed(3)} / ${kalshiPres?.ask.toFixed(3)}</div>
                  <span className="text-[9px] text-[#64748b]">Mid: ${kalshiPres?.midPrice.toFixed(3)}</span>
                </div>
              </div>

              {presThreeWay && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Optimal Route:</span>
                    <span className="text-white font-bold">
                      BUY on {presThreeWay.bestBuy.name} (${presThreeWay.bestBuy.ask}) → SELL on {presThreeWay.bestSell.name} (${presThreeWay.bestSell.bid})
                    </span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Estimated Net Profit ($10k Size):</span>
                    <span className="text-emerald-400 font-bold">+${presThreeWay.netEdgeUsd.toFixed(2)} USD</span>
                  </div>

                  <button
                    onClick={() => handleExecuteArb('2028 US Presidency', presThreeWay.bestBuy.name, presThreeWay.bestSell.name, presThreeWay.netEdgeUsd)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Execute 3-Way Arbitrage Fill</span>
                  </button>
                </div>
              )}
            </div>

            {/* Opportunity 2: Fed Rate Cut Q4 */}
            <div className="bg-[#10141e] border border-[#1b2230] p-4 rounded-xl space-y-3 font-mono text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-blue-400 font-bold uppercase">Macro · 3-Way Parity</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">Fed Rate Cut &gt;= 50bps in Q4</h4>
                </div>
                {fedThreeWay?.isExecutable ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    +{fedThreeWay.netEdgePct}% NET EDGE
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#161c28] text-[#94a3b8]">
                    MONITORING
                  </span>
                )}
              </div>

              {/* Price Comparison Table */}
              <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#0a0d14] rounded border border-[#161d2a] text-center">
                <div className="space-y-1">
                  <span className="text-[10px] text-emerald-400 font-bold block">Novig (0% Vig)</span>
                  <div className="text-xs text-white font-bold">${novigFed?.bid.toFixed(3)} / ${novigFed?.ask.toFixed(3)}</div>
                  <span className="text-[9px] text-[#64748b]">Mid: ${novigFed?.midPrice.toFixed(3)}</span>
                </div>
                <div className="space-y-1 border-x border-[#161d2a]">
                  <span className="text-[10px] text-purple-400 font-bold block">Polymarket (USDC)</span>
                  <div className="text-xs text-white font-bold">${polyFed?.bid.toFixed(3)} / ${polyFed?.ask.toFixed(3)}</div>
                  <span className="text-[9px] text-[#64748b]">Mid: ${polyFed?.midPrice.toFixed(3)}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-blue-400 font-bold block">Kalshi (USD)</span>
                  <div className="text-xs text-white font-bold">${kalshiFed?.bid.toFixed(3)} / ${kalshiFed?.ask.toFixed(3)}</div>
                  <span className="text-[9px] text-[#64748b]">Mid: ${kalshiFed?.midPrice.toFixed(3)}</span>
                </div>
              </div>

              {fedThreeWay && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Optimal Route:</span>
                    <span className="text-white font-bold">
                      BUY on {fedThreeWay.bestBuy.name} (${fedThreeWay.bestBuy.ask}) → SELL on {fedThreeWay.bestSell.name} (${fedThreeWay.bestSell.bid})
                    </span>
                  </div>
                  <div className="flex justify-between text-[#94a3b8]">
                    <span>Estimated Net Profit ($10k Size):</span>
                    <span className="text-emerald-400 font-bold">+${fedThreeWay.netEdgeUsd.toFixed(2)} USD</span>
                  </div>

                  <button
                    onClick={() => handleExecuteArb('Fed Rate Cut', fedThreeWay.bestBuy.name, fedThreeWay.bestSell.name, fedThreeWay.netEdgeUsd)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Execute 3-Way Arbitrage Fill</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALL NOVIG ACTIVE ORDERBOOKS */}
      {activeTab === 'ORDERBOOKS' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {['ALL', 'POLITICS', 'MACRO', 'SPORTS', 'CRYPTO'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-[#10141e] border border-[#1b2230] text-[#94a3b8] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNovigMarkets.map(m => (
              <div
                key={m.symbol}
                onClick={() => onSelectMarket?.(m.symbol)}
                className="bg-[#10141e] hover:bg-[#131926] border border-[#1b2230] hover:border-emerald-600/50 p-4 rounded-xl space-y-3 font-mono text-xs transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                      {m.category || 'PREDICTION'}
                    </span>
                    <h4 className="text-sm font-bold text-white leading-snug">{m.eventTitle || m.symbol}</h4>
                  </div>
                  <span className="text-[10px] text-[#64748b] bg-[#0c0f17] px-1.5 py-0.5 rounded border border-[#1b2230]">
                    {m.symbol}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 border-y border-[#1b2230] text-center">
                  <div>
                    <span className="text-[10px] text-[#64748b] block">BID</span>
                    <span className="text-emerald-400 font-bold">${m.bid.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748b] block">MID</span>
                    <span className="text-white font-bold">${m.midPrice.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748b] block">ASK</span>
                    <span className="text-rose-400 font-bold">${m.ask.toFixed(3)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
                  <span>Spread: {m.spreadBps} bps</span>
                  <span>Depth: ${m.depthLiquidityUsd.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ZERO-FEE MARKET MAKING STRATEGY */}
      {activeTab === 'MARKET_MAKING' && (
        <div className="bg-[#10141e] border border-[#1b2230] p-5 rounded-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#1b2230] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <span>Novig Peer-to-Peer Market Making & Continuous Spread Harvest</span>
              </h3>
              <p className="text-[#94a3b8] text-[11px] mt-0.5">
                Post resting limit orders at 0% maker fee on Novig, capturing the full bid-ask spread while dynamically hedging adverse inventory deltas on Polymarket.
              </p>
            </div>
            <span className="text-emerald-400 font-bold bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800">
              ZERO-COMMISSION ADVANTAGE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-[#0a0d14] border border-[#161d2a] rounded-lg space-y-1">
              <span className="text-[10px] text-[#64748b]">SPREAD CAPTURE</span>
              <div className="text-sm font-bold text-white">15–25 bps Per Cycle</div>
              <p className="text-[10px] text-[#94a3b8]">Because Novig charges 0% maker/taker, 100% of the bid/ask spread translates into gross P&L.</p>
            </div>
            <div className="p-3 bg-[#0a0d14] border border-[#161d2a] rounded-lg space-y-1">
              <span className="text-[10px] text-[#64748b]">INVENTORY HEDGING</span>
              <div className="text-sm font-bold text-blue-400">Delta-Neutral Offset</div>
              <p className="text-[10px] text-[#94a3b8]">When a Novig bid fills, the engine routes a synthetic hedge to Polymarket or Kalshi if inventory exceeds threshold.</p>
            </div>
            <div className="p-3 bg-[#0a0d14] border border-[#161d2a] rounded-lg space-y-1">
              <span className="text-[10px] text-[#64748b]">RISK PROFILE</span>
              <div className="text-sm font-bold text-emerald-400">Low Directional Exposure</div>
              <p className="text-[10px] text-[#94a3b8]">Protects against macro shocks using micro-second cancellation and re-quoting algorithms.</p>
            </div>
          </div>

          {/* Quick Quoting Controls */}
          <div className="pt-2 border-t border-[#1b2230] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Quick Market-Maker Quote Launcher</h4>
              <span className="text-[10px] text-[#64748b]">Posts resting bid/ask brackets with 0% maker fee</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {novigMarkets.slice(0, 3).map(m => (
                <div key={m.symbol} className="p-3 bg-[#0c1017] border border-[#1b2230] rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-white truncate max-w-[170px]">{m.eventTitle}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                      ${m.midPrice.toFixed(3)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleLaunchMarketMakingQuotes(m.symbol)}
                    className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Post 2-Sided Quotes ($2.5k)</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Live Resting P2P Orders */}
          {openOrders.length > 0 && (
            <div className="pt-2 border-t border-[#1b2230] space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Active Resting P2P Orders ({openOrders.length})
                </h4>
                <button
                  onClick={() => {
                    globalNovigEngine.cancelAllOrders();
                    setOpenOrders([]);
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                >
                  Cancel All
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {openOrders.map(ord => (
                  <div key={ord.id} className="p-2.5 bg-[#0a0d14] border border-[#1b2230] rounded flex items-center justify-between text-[11px]">
                    <div>
                      <span className={`font-bold mr-2 ${ord.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ord.side}
                      </span>
                      <span className="text-white font-medium">{ord.symbol}</span>
                      <span className="text-[#64748b] ml-2">@ ${ord.price} ({ord.size.toLocaleString()} units)</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800">
                        0% FEE
                      </span>
                      <button
                        onClick={() => handleCancelOrder(ord.id)}
                        className="text-rose-400 hover:text-white px-2 py-0.5 bg-[#1b2230] hover:bg-rose-900 rounded text-[10px] transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
