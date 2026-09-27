"use client";

import { useEffect, useRef, useState } from "react";
import { fetchDeribitOptionsChain } from "./deribit-adapter";
import { computeGexProfile } from "./gex-calculator";
import type { DealerConvention, GexProfile } from "./types";
import type { FeedHealthStatus } from "../market/l2-types";

export interface UseGexSurfaceOptions {
  refreshIntervalMs?: number;
  dealerConvention?: DealerConvention;
}

export function useGexSurface(
  underlying: 'BTC' | 'ETH' = 'BTC',
  options: UseGexSurfaceOptions = {}
) {
  const {
    refreshIntervalMs = 15_000,
    dealerConvention = 'DEALER_LONG_CALLS_SHORT_PUTS',
  } = options;

  const [profile, setProfile] = useState<GexProfile>({
    underlying,
    indexPrice: 0,
    gammaFlip: null,
    totalCallGex: 0,
    totalPutGex: 0,
    netGex: 0,
    totalGrossGamma: 0,
    callOiWall: 0,
    putOiWall: 0,
    timestamp: 0,
    isEstimate: true,
    dealerConvention,
    health: 'CONNECTING',
    strikes: [],
  });

  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadData() {
      try {
        const { contracts, indexPrice } = await fetchDeribitOptionsChain(underlying);
        if (!isMountedRef.current) return;

        if (contracts.length === 0) {
          setProfile(prev => ({
            ...prev,
            underlying,
            health: 'UNAVAILABLE',
            dealerConvention,
          }));
          setError("No active options contracts returned from Deribit");
          return;
        }

        const computed = computeGexProfile(
          underlying,
          indexPrice,
          contracts,
          dealerConvention,
          'LIVE'
        );

        if (isMountedRef.current) {
          setProfile(computed);
          setError(null);
        }
      } catch (err) {
        if (!isMountedRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setProfile(prev => ({
          ...prev,
          underlying,
          health: prev.timestamp > 0 ? 'DEGRADED' : 'UNAVAILABLE',
          dealerConvention,
        }));
      }
    }

    loadData();
    timer = setInterval(loadData, refreshIntervalMs);

    return () => {
      isMountedRef.current = false;
      if (timer) clearInterval(timer);
    };
  }, [underlying, refreshIntervalMs, dealerConvention]);

  return {
    profile,
    error,
    isLoading: profile.health === 'CONNECTING',
    isLive: profile.health === 'LIVE',
    isDegraded: profile.health === 'DEGRADED' || profile.health === 'UNAVAILABLE',
  };
}
