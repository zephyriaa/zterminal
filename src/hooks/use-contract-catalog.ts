"use client";

import { useEffect, useState } from "react";
import type { ContractMetadata } from "@/lib/market/types";
import { registerRuntimeContracts } from "@/lib/market/contracts";

export type ContractCatalogue = {
  provider?: string;
  environment?: string;
  state?: string;
  reason?: string;
  contracts: ContractMetadata[];
  loading: boolean;
  error?: string;
};

const EMPTY_CATALOGUE: ContractCatalogue = { contracts: [], loading: true };

// Module-level singleton cache to deduplicate simultaneous calls across widgets
let cachedCatalogue: ContractCatalogue | null = null;
let cachedAt = 0;
let inFlightPromise: Promise<ContractCatalogue> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1_000; // 5 minutes

async function fetchCatalogueSingleton(): Promise<ContractCatalogue> {
  const now = Date.now();
  if (cachedCatalogue && now - cachedAt < CACHE_TTL_MS) {
    return cachedCatalogue;
  }
  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const response = await fetch("/api/contracts", {
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json()) as {
        provider?: string;
        environment?: string;
        state?: string;
        reason?: string;
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
        contracts,
        loading: false,
        error: response.ok
          ? undefined
          : payload.error ?? payload.reason ?? "Active provider catalogue unavailable",
      };
      cachedCatalogue = result;
      cachedAt = Date.now();
      return result;
    } catch (error) {
      return {
        contracts: [],
        loading: false,
        error: error instanceof Error ? error.message : "Active provider catalogue unavailable",
      };
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/** Fetches and shares a deduplicated, cached catalogue across all components. */
export function useContractCatalogue(): ContractCatalogue {
  const [catalogue, setCatalogue] = useState<ContractCatalogue>(
    cachedCatalogue && Date.now() - cachedAt < CACHE_TTL_MS ? cachedCatalogue : EMPTY_CATALOGUE
  );

  useEffect(() => {
    let cancelled = false;
    void fetchCatalogueSingleton().then((data) => {
      if (!cancelled) setCatalogue(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return catalogue;
}
