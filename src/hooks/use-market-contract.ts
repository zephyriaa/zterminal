"use client";
import { useSyncExternalStore } from "react";
import { getContract, subscribeContracts } from "@/lib/market/contracts";

/** History and catalogue updates share the existing provider-qualified registry. */
export function useMarketContract(symbol: string, provider?: string) {
  return useSyncExternalStore(subscribeContracts, () => getContract(symbol, provider), () => getContract(symbol));
}
