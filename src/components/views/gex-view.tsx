"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  RefreshCw,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { DeribitGexSummary, StrikeGexData } from "@/lib/market/deribit-gex";

export function GexView() {
  const [currency, setCurrency] = useState<"BTC" | "ETH">("BTC");
  const [data, setData] = useState<DeribitGexSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredStrike, setHoveredStrike] = useState<StrikeGexData | null>(null);

  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadGex() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/gex?currency=${currency}`);
        if (!res.ok) {
          throw new Error(`Failed to load options GEX (${res.status})`);
        }
        const json: DeribitGexSummary = await res.json();
        if (!isCancelled) {
          setData(json);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Error fetching GEX data");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadGex();
    const interval = setInterval(() => {
      void loadGex();
    }, 45_000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [currency, refreshIndex]);

  // Determine scaling for strike GEX bars
  const maxAbsGex = useMemo(() => {
    if (!data || data.strikes.length === 0) return 1;
    let max = 0;
    for (const s of data.strikes) {
      if (Math.abs(s.callGexUsd) > max) max = Math.abs(s.callGexUsd);
      if (Math.abs(s.putGexUsd) > max) max = Math.abs(s.putGexUsd);
    }
    return max || 1;
  }, [data]);

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0e14] text-[#e2e8f0] select-none overflow-hidden font-mono">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e293b] bg-[#0f172a]/60 backdrop-blur shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-[#38bdf8]/10 text-[#38bdf8]">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-xs tracking-wider text-[#f8fafc]">
              CRYPTO GAMMA EXPOSURE (GEX)
            </span>
            <span className="text-[10px] text-[#64748b] ml-2">
              Deribit Real-Time Options Orderflow
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Currency Switcher */}
          <div className="flex rounded bg-[#1e293b] p-0.5 border border-[#334155]">
            <button
              type="button"
              onClick={() => setCurrency("BTC")}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                currency === "BTC"
                  ? "bg-[#38bdf8] text-[#0f172a] shadow-sm font-semibold"
                  : "text-[#94a3b8] hover:text-[#f8fafc]"
              }`}
            >
              BTC
            </button>
            <button
              type="button"
              onClick={() => setCurrency("ETH")}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                currency === "ETH"
                  ? "bg-[#38bdf8] text-[#0f172a] shadow-sm font-semibold"
                  : "text-[#94a3b8] hover:text-[#f8fafc]"
              }`}
            >
              ETH
            </button>
          </div>

          <button
            type="button"
            onClick={() => setRefreshIndex((k) => k + 1)}
            disabled={isLoading}
            className="p-1 rounded hover:bg-[#1e293b] text-[#94a3b8] hover:text-[#f8fafc] transition-colors"
            title="Refresh GEX calculation"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#38bdf8]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-rose-950/40 border-b border-rose-800/40 text-rose-300 text-xs flex items-center justify-between">
          <span>Error loading Gamma Exposure: {error}</span>
          <button
            type="button"
            onClick={() => setRefreshIndex((k) => k + 1)}
            className="underline hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-2.5 bg-[#090d16] border-b border-[#1e293b] text-[11px] shrink-0">
        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">SPOT INDEX</span>
          <span className="font-bold text-sm text-[#f8fafc]">
            ${data ? data.spotPrice.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "---"}
          </span>
          <span className="text-[9px] text-[#94a3b8]">Live Deribit Index</span>
        </div>

        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">NET GEX</span>
          <span
            className={`font-bold text-sm flex items-center gap-1 ${
              (data?.netGexMillions ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {(data?.netGexMillions ?? 0) >= 0 ? "+" : ""}
            {data ? `${data.netGexMillions}M` : "---"}
            {(data?.netGexMillions ?? 0) >= 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
          </span>
          <span className="text-[9px] text-[#94a3b8] capitalize">
            {data ? data.regime.toLowerCase().replace("_", " ") : "Calculating..."}
          </span>
        </div>

        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">GAMMA FLIP</span>
          <span className="font-bold text-sm text-[#38bdf8]">
            ${data ? data.gammaFlip.toLocaleString() : "---"}
          </span>
          <span className="text-[9px] text-[#64748b]">
            {data
              ? `${(((data.gammaFlip - data.spotPrice) / data.spotPrice) * 100).toFixed(2)}% from spot`
              : "---"}
          </span>
        </div>

        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">CALL WALL (RESIST)</span>
          <span className="font-bold text-sm text-emerald-400">
            ${data ? data.callWall.toLocaleString() : "---"}
          </span>
          <span className="text-[9px] text-[#64748b]">Max Positive Gamma</span>
        </div>

        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">PUT WALL (SUPPORT)</span>
          <span className="font-bold text-sm text-rose-400">
            ${data ? data.putWall.toLocaleString() : "---"}
          </span>
          <span className="text-[9px] text-[#64748b]">Max Put Gamma</span>
        </div>

        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">MAX PAIN</span>
          <span className="font-bold text-sm text-amber-400">
            ${data ? data.maxPain.toLocaleString() : "---"}
          </span>
          <span className="text-[9px] text-[#64748b]">Option Expiry Magnet</span>
        </div>

        <div className="flex flex-col p-1.5 rounded bg-[#111827] border border-[#1f2937]">
          <span className="text-[#64748b] text-[10px]">PUT / CALL RATIO</span>
          <span className="font-bold text-sm text-[#e2e8f0]">
            {data ? data.putCallRatioOi : "---"} <span className="text-[9px] text-[#64748b]">OI</span>
          </span>
          <span className="text-[9px] text-[#64748b]">
            Vol PCR: {data ? data.putCallRatioVol : "---"}
          </span>
        </div>
      </div>

      {/* Main GEX Chart Section */}
      <div className="flex-1 flex flex-col p-3 overflow-hidden min-h-0">
        <div className="flex items-center justify-between pb-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-medium text-[#94a3b8]">STRIKE GAMMA DISTRIBUTION ($M)</span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80 inline-block" />
                Call GEX (+)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80 inline-block" />
                Put GEX (-)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 bg-[#38bdf8] inline-block" />
                Spot Level
              </span>
            </div>
          </div>
          {hoveredStrike && (
            <div className="flex items-center gap-3 text-[11px] bg-[#1e293b] px-2 py-0.5 rounded border border-[#334155]">
              <span className="text-[#f8fafc] font-bold">
                Strike: ${hoveredStrike.strike.toLocaleString()}
              </span>
              <span className="text-emerald-400">
                Call GEX: ${(hoveredStrike.callGexUsd / 1_000_000).toFixed(2)}M
              </span>
              <span className="text-rose-400">
                Put GEX: ${(hoveredStrike.putGexUsd / 1_000_000).toFixed(2)}M
              </span>
              <span className="text-[#38bdf8]">
                Net GEX: ${(hoveredStrike.netGexUsd / 1_000_000).toFixed(2)}M
              </span>
              <span className="text-[#94a3b8]">
                Call OI: {hoveredStrike.callOi.toFixed(0)} | Put OI: {hoveredStrike.putOi.toFixed(0)}
              </span>
            </div>
          )}
        </div>

        {/* Bar Visualizer */}
        <div className="flex-1 border border-[#1e293b] rounded bg-[#070a10] relative flex flex-col justify-center overflow-x-auto overflow-y-hidden p-2 min-h-[160px]">
          {data && data.strikes.length > 0 ? (
            <div className="flex items-center h-full gap-[3px] min-w-max mx-auto px-4">
              {data.strikes.map((s) => {
                const callHeightPct = Math.min(100, (s.callGexUsd / maxAbsGex) * 90);
                const putHeightPct = Math.min(100, (Math.abs(s.putGexUsd) / maxAbsGex) * 90);
                const isSpotNearest =
                  Math.abs(s.strike - data.spotPrice) <
                  (data.strikes[1] ? (data.strikes[1].strike - data.strikes[0].strike) / 2 : 500);
                const isCallWall = s.strike === data.callWall;
                const isPutWall = s.strike === data.putWall;
                const isMaxPain = s.strike === data.maxPain;

                return (
                  <div
                    key={s.strike}
                    onMouseEnter={() => setHoveredStrike(s)}
                    onMouseLeave={() => setHoveredStrike(null)}
                    className={`relative flex flex-col items-center justify-center w-5 h-full cursor-pointer transition-opacity group ${
                      hoveredStrike && hoveredStrike.strike !== s.strike ? "opacity-40" : "opacity-100"
                    }`}
                  >
                    {/* Top half: Call GEX (+) */}
                    <div className="flex-1 w-full flex items-end justify-center pb-0.5">
                      <div
                        style={{ height: `${Math.max(2, callHeightPct)}%` }}
                        className={`w-3 rounded-t-sm transition-all ${
                          isCallWall
                            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                            : "bg-emerald-500/70 group-hover:bg-emerald-400"
                        }`}
                      />
                    </div>

                    {/* Center Strike Zero Axis */}
                    <div
                      className={`w-full h-[1px] relative z-10 ${
                        isSpotNearest ? "bg-[#38bdf8] h-[2px]" : "bg-[#334155]"
                      }`}
                    />

                    {/* Bottom half: Put GEX (-) */}
                    <div className="flex-1 w-full flex items-start justify-center pt-0.5">
                      <div
                        style={{ height: `${Math.max(2, putHeightPct)}%` }}
                        className={`w-3 rounded-b-sm transition-all ${
                          isPutWall
                            ? "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]"
                            : "bg-rose-500/70 group-hover:bg-rose-400"
                        }`}
                      />
                    </div>

                    {/* Key Strike Indicator Badges */}
                    {isSpotNearest && (
                      <span className="absolute top-1 text-[8px] font-bold text-[#38bdf8] bg-[#0284c7]/30 px-1 rounded border border-[#38bdf8]/40 pointer-events-none">
                        SPOT
                      </span>
                    )}
                    {isCallWall && (
                      <span className="absolute top-6 text-[8px] font-bold text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-500/40 pointer-events-none">
                        CW
                      </span>
                    )}
                    {isPutWall && (
                      <span className="absolute bottom-6 text-[8px] font-bold text-rose-400 bg-rose-950/80 px-1 rounded border border-rose-500/40 pointer-events-none">
                        PW
                      </span>
                    )}
                    {isMaxPain && !isSpotNearest && (
                      <span className="absolute bottom-1 text-[8px] font-bold text-amber-400 bg-amber-950/80 px-1 rounded border border-amber-500/40 pointer-events-none">
                        MP
                      </span>
                    )}

                    {/* Strike label on hover or sampled */}
                    <div className="absolute -bottom-5 text-[8px] text-[#64748b] group-hover:text-white font-mono pointer-events-none whitespace-nowrap">
                      {s.strike >= 1000 ? `${s.strike / 1000}k` : s.strike}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-[#64748b]">
              {isLoading ? "Calculating option gamma exposures..." : "No GEX data available"}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Insights Footer */}
      <div className="px-3 py-2 border-t border-[#1e293b] bg-[#090d16] flex items-center justify-between text-[10px] text-[#64748b] shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-[#94a3b8]">
            <Shield className="w-3 h-3 text-[#38bdf8]" />
            Positive Gamma Regime = Dealers buy dips & sell rips (lower realized volatility).
          </span>
          <span className="hidden sm:inline text-[#64748b]">
            Negative Gamma = Volatility expansion & trending momentum.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Deribit Options API (Zero Auth / Free Public)</span>
        </div>
      </div>
    </div>
  );
}
