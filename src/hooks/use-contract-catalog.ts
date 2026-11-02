"use client";

import { useEffect, useState } from "react";
import type { ContractMetadata } from "@/lib/market/types";
import { useWorkspace } from "@/stores/workspace";
import { fetchPublicCatalogue, DIRECT_VENUES, type DirectVenue } from "@/lib/market/public-data";
import { registerRuntimeContracts } from "@/lib/market/contracts";

export type ContractCatalogue = {
  provider?: string;
  environment?: string;
  state?: string;
  reason?: string;
  verified?: boolean;
  contracts: ContractMetadata[];
  loading: boolean;
  error?: string;
};

const EMPTY_CATALOGUE: ContractCatalogue = { contracts: [], loading: true };

// Module-level singleton cache to deduplicate simultaneous calls across widgets
const cachedCatalogues = new Map<string, { at: number; catalogue: ContractCatalogue }>();
const inFlightPromises = new Map<string, Promise<ContractCatalogue>>();
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

async function fetchCatalogueSingleton(provider: string): Promise<ContractCatalogue> {
  const cached = cachedCatalogues.get(provider);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.catalogue;
  const pending = inFlightPromises.get(provider);
  if (pending) return pending;
  const request = (async () => {
    try {
      if (process.env.NEXT_PUBLIC_MARKET_TRANSPORT !== "gateway" && (DIRECT_VENUES as readonly string[]).includes(provider)) {
        const contracts = await fetchPublicCatalogue(provider as DirectVenue);
        if (!contracts.length) throw new Error("Selected provider has no verified perpetual contracts");
        registerRuntimeContracts(contracts);
        const catalogue: ContractCatalogue = { provider, environment: "live", state: "verified", verified: true, contracts, loading: false };
        cachedCatalogues.set(provider, { at: Date.now(), catalogue });
        return catalogue;
      }
      const response = await fetch(`/api/contracts?provider=${encodeURIComponent(provider)}`, {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as {
        provider?: string;
        environment?: string;
        state?: string;
        reason?: string;
        verified?: boolean;
        contracts?: ContractMetadata[];
        error?: string;
      };
      const contracts = Array.isArray(payload.contracts) ? payload.contracts : [];
      if (response.ok) registerRuntimeContracts(contracts);

      const result: ContractCatalogue = {
        provider: payload.provider,
        environment: payload.environment,
        state: payload.state,
        reason: payload.reason,
        verified: payload.verified === true,
        contracts,
        loading: false,
        error: response.ok
          ? undefined
          : payload.error ?? payload.reason ?? "Active provider catalogue unavailable",
      };
      cachedCatalogues.set(provider, { catalogue: result, at: Date.now() });
      return result;
    } catch (error) {
      return {
        contracts: [],
        loading: false,
        error: error instanceof Error ? error.message : "Active provider catalogue unavailable",
      };
    } finally {
      inFlightPromises.delete(provider);
    }
  })();

  inFlightPromises.set(provider, request);
  return request;
}

/** Fetches and shares a deduplicated, cached catalogue across all components. */
export function useContractCatalogue(): ContractCatalogue {
  const provider = useWorkspace(state => state.marketProvider);
  const [loaded, setLoaded] = useState<{ provider: string; catalogue: ContractCatalogue } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchCatalogueSingleton(provider).then((data) => {
      if (!cancelled) setLoaded({ provider, catalogue: data });
    });
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return loaded?.provider === provider ? loaded.catalogue : EMPTY_CATALOGUE;
}

let cachedMergedContracts: ContractMetadata[] | null = null;
let mergedCacheTime = 0;
let mergedInFlight: Promise<ContractMetadata[]> | null = null;

export async function fetchAllCryptoContracts(): Promise<ContractMetadata[]> {
  if (cachedMergedContracts && Date.now() - mergedCacheTime < CACHE_TTL_MS) {
    return cachedMergedContracts;
  }
  if (mergedInFlight) return mergedInFlight;
  mergedInFlight = (async () => {
    try {
      const settled = await Promise.allSettled(
        DIRECT_VENUES.map(venue => fetchCatalogueSingleton(venue))
      );
      const all: ContractMetadata[] = [];
      for (const res of settled) {
        if (res.status === "fulfilled" && res.value.contracts.length) {
          all.push(...res.value.contracts);
        }
      }
      cachedMergedContracts = all;
      mergedCacheTime = Date.now();
      return all;
    } finally {
      mergedInFlight = null;
    }
  })();
  return mergedInFlight;
}

/** Fetches and groups contracts across all 4 crypto venues (Binance, Bybit, OKX, Gate.io). */
export function useAllCryptoCatalogues(): { contracts: ContractMetadata[]; loading: boolean } {
  const [data, setData] = useState<{ contracts: ContractMetadata[]; loading: boolean }>({
    contracts: cachedMergedContracts ?? [],
    loading: !cachedMergedContracts,
  });

  useEffect(() => {
    let cancelled = false;
    void fetchAllCryptoContracts().then(contracts => {
      if (!cancelled) setData({ contracts, loading: false });
    });
    return () => { cancelled = true; };
  }, []);

  return data;
}
