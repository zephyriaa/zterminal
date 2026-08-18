import { COOKIE_NAME } from "@shared/const";
import axios from "axios";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { finiteNumber, normalizePublicBars } from "./marketData";
import { alignRange, classifyProviderFailure, coverageForBars, MARKET_INTERVALS, normalizeGatePerpetualSymbol } from "./marketContracts";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const GATE_TICKERS_URL = "https://api.gateio.ws/api/v4/futures/usdt/tickers";
const GATE_CANDLES_URL = "https://api.gateio.ws/api/v4/futures/usdt/candlesticks";
const DEFAULT_SYMBOL = "QQQX_USDT";
const MAX_CANDLE_LIMIT = 2_000;

const SnapshotInput = z.object({ symbol: z.string().trim().min(1).max(40).optional() }).optional();
const CandleInput = z.object({
  interval: z.enum(MARKET_INTERVALS),
  symbol: z.string().trim().min(1).max(40).optional(),
  from: z.number().int().nonnegative().optional(),
  to: z.number().int().positive().optional(),
  limit: z.number().int().min(2).max(MAX_CANDLE_LIMIT).optional(),
}).superRefine((value, ctx) => {
  const hasFrom = value.from !== undefined;
  const hasTo = value.to !== undefined;
  if (hasFrom !== hasTo) ctx.addIssue({ code: "custom", message: "from and to must be supplied together" });
  if (hasFrom && hasTo && value.from! >= value.to!) ctx.addIssue({ code: "custom", message: "from must be earlier than to" });
});

function resolveSymbol(requested: string | undefined) {
  return normalizeGatePerpetualSymbol(requested ?? DEFAULT_SYMBOL);
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  market: router({
    capabilities: publicProcedure.query(() => ({
      provider: "gateio" as const,
      environment: "public-read-only" as const,
      state: "CONNECTED" as const,
      instruments: { search: "provider-verified-on-request", aliases: true },
      history: { ranges: true, maximumBarsPerRequest: MAX_CANDLE_LIMIT, intervals: MARKET_INTERVALS },
      orderFlow: { state: "UNAVAILABLE" as const, reason: "Verified public trade-tape coverage is required." },
      gex: { state: "UNAVAILABLE" as const, reason: "Verified options-chain and Greek data are required." },
    })),
    snapshot: publicProcedure.input(SnapshotInput).query(async ({ input }) => {
      const at = Date.now();
      const symbol = resolveSymbol(input?.symbol);
      if (!symbol) return {
        provider: "gateio" as const, environment: "public-read-only" as const, state: "UNAVAILABLE" as const, dataStatus: "UNAVAILABLE" as const,
        symbol: input?.symbol ?? null, price: null, changePercent: null, dayHigh: null, dayLow: null, quoteVolume: null, bid: null, ask: null, sourceTimestamp: null, at,
        reasonCode: "UNSUPPORTED_INSTRUMENT" as const, reason: "The requested instrument is not a Gate.io USDT perpetual symbol.", retryable: false,
      };
      try {
        const response = await axios.get<unknown>(GATE_TICKERS_URL, { params: { contract: symbol }, headers: { Accept: "application/json" }, timeout: 12_000, responseType: "json" });
        const payload: unknown = response.data;
        const ticker = Array.isArray(payload) ? payload[0] : payload;
        if (!ticker || typeof ticker !== "object") throw new Error("Gate.io returned an invalid ticker payload");
        const data = ticker as Record<string, unknown>;
        const price = finiteNumber(data.last);
        if (price === null) throw new Error("Gate.io ticker did not include a finite last price");
        return {
          provider: "gateio" as const, environment: "public-read-only" as const, state: "CONNECTED" as const, dataStatus: "LIVE" as const, symbol, price,
          changePercent: finiteNumber(data.change_percentage), dayHigh: finiteNumber(data.high_24h), dayLow: finiteNumber(data.low_24h), quoteVolume: finiteNumber(data.volume_24h_quote ?? data.volume_24h), bid: finiteNumber(data.highest_bid), ask: finiteNumber(data.lowest_ask), sourceTimestamp: null, at, retryable: false,
        };
      } catch (error) {
        const failure = classifyProviderFailure(error);
        return {
          provider: "gateio" as const, environment: "public-read-only" as const, state: "UNAVAILABLE" as const, dataStatus: "UNAVAILABLE" as const, symbol,
          price: null, changePercent: null, dayHigh: null, dayLow: null, quoteVolume: null, bid: null, ask: null, sourceTimestamp: null, at, ...failure,
        };
      }
    }),
    bars: publicProcedure.input(CandleInput).query(async ({ input }) => {
      const fetchedAt = Date.now();
      const symbol = resolveSymbol(input.symbol);
      if (!symbol) return {
        provider: "gateio" as const, environment: "public-read-only" as const, state: "UNAVAILABLE" as const, dataStatus: "UNAVAILABLE" as const,
        symbol: input.symbol, interval: input.interval, sourceTimestamp: null, fetchedAt, coverage: coverageForBars(input.interval, [], { from: null, to: null }), bars: [],
        reasonCode: "UNSUPPORTED_INSTRUMENT" as const, reason: "The requested instrument is not a Gate.io USDT perpetual symbol.", retryable: false,
      };
      const requested = input.from === undefined || input.to === undefined ? { from: null, to: null } : alignRange(input.from, input.to, input.interval);
      if (!requested) return {
        provider: "gateio" as const, environment: "public-read-only" as const, state: "UNAVAILABLE" as const, dataStatus: "UNAVAILABLE" as const,
        symbol, interval: input.interval, sourceTimestamp: null, fetchedAt, coverage: coverageForBars(input.interval, [], { from: null, to: null }), bars: [],
        reasonCode: "INVALID_RANGE" as const, reason: "The requested historical range is invalid for the selected interval.", retryable: false,
      };
      try {
        const response = await axios.get<unknown>(GATE_CANDLES_URL, {
          params: { contract: symbol, interval: input.interval, limit: input.limit ?? 120, ...(requested.from === null ? {} : { from: Math.floor(requested.from / 1_000) }), ...(requested.to === null ? {} : { to: Math.floor(requested.to / 1_000) }) },
          headers: { Accept: "application/json" }, timeout: 12_000, responseType: "json",
        });
        if (!Array.isArray(response.data)) throw new Error("Gate.io returned an invalid historical-candle payload");
        const normalized = normalizePublicBars(response.data);
        const bars = requested.from === null ? normalized : normalized.filter((bar) => bar.t >= requested.from! && bar.t <= requested.to!);
        if (!bars.length) throw new Error("Gate.io returned insufficient verified historical bars for the requested coverage");
        const coverage = coverageForBars(input.interval, bars, requested);
        return {
          provider: "gateio" as const, environment: "public-read-only" as const, state: coverage.complete || requested.from === null ? "CONNECTED" as const : "DEGRADED" as const,
          dataStatus: "HISTORICAL" as const, symbol, interval: input.interval, sourceTimestamp: bars.at(-1)?.t ?? null, fetchedAt, coverage, bars, retryable: false,
          ...(coverage.complete || requested.from === null ? {} : { reasonCode: "INSUFFICIENT_COVERAGE" as const, reason: "The provider returned only part of the requested historical window." }),
        };
      } catch (error) {
        const failure = classifyProviderFailure(error);
        return {
          provider: "gateio" as const, environment: "public-read-only" as const, state: "UNAVAILABLE" as const, dataStatus: "UNAVAILABLE" as const,
          symbol, interval: input.interval, sourceTimestamp: null, fetchedAt, coverage: coverageForBars(input.interval, [], requested), bars: [], ...failure,
        };
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
