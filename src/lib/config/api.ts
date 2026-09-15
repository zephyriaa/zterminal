/**
 * Centralized runtime API and service configuration for ZTerminal.
 * Consolidates backend endpoints, environment modes, and public service credentials.
 */

export interface AppConfig {
  apiUrl: string;
  quantApiUrl: string;
  marketProvider: "binance" | "gateio" | "bybit" | "coinbase";
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  environment: "development" | "preview" | "production";
}

export function getAppConfig(): AppConfig {
  const env =
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.CF_PAGES_BRANCH ||
    (process.env.NODE_ENV === "production" ? "production" : "development");

  const environment = env === "production" ? "production" : env === "preview" ? "preview" : "development";

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "";
  const quantApiUrl =
    process.env.NEXT_PUBLIC_QUANT_API_URL?.replace(/\/+$/, "") ||
    (apiUrl ? `${apiUrl}/v1` : "/api/research");

  const rawProvider = (process.env.NEXT_PUBLIC_MARKET_PROVIDER || "binance").toLowerCase();
  const marketProvider =
    rawProvider === "gateio" || rawProvider === "bybit" || rawProvider === "coinbase"
      ? rawProvider
      : "binance";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;

  return {
    apiUrl,
    quantApiUrl,
    marketProvider,
    supabaseUrl,
    supabaseAnonKey,
    environment,
  };
}

export const appConfig = getAppConfig();
