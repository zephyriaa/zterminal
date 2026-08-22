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

/** Fetches only the active gateway's already validated catalogue. */
export function useContractCatalogue(): ContractCatalogue {
  const [catalogue, setCatalogue] = useState<ContractCatalogue>(EMPTY_CATALOGUE);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/contracts", { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as {
          provider?: string; environment?: string; state?: string; reason?: string; contracts?: ContractMetadata[]; error?: string;
        };
        if (cancelled) return;
        const contracts = Array.isArray(payload.contracts) ? payload.contracts : [];
        if (response.ok) registerRuntimeContracts(contracts);
        setCatalogue({
          provider: payload.provider,
          environment: payload.environment,
          state: payload.state,
          reason: payload.reason,
          contracts,
          loading: false,
          error: response.ok ? undefined : payload.error ?? payload.reason ?? "Active provider catalogue unavailable",
        });
      } catch (error) {
        if (!cancelled && (error as Error).name !== "AbortError") {
          setCatalogue({ contracts: [], loading: false, error: error instanceof Error ? error.message : "Active provider catalogue unavailable" });
        }
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  return catalogue;
}
