import { COOKIE_NAME } from "@shared/const";
import axios from "axios";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { finiteNumber, normalizePublicBars } from "./marketData";
import { alignRange, classifyProviderFailure, coverageForBars, MARKET_INTERVALS, normalizeGatePerpetualSymbol } from "./marketContracts";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, rateLimitedPublicProcedure, router } from "./_core/trpc";
import { listResearchDrafts, saveResearchDraft } from "./researchStore";
import { PROVIDER_CATALOG, gateContractToMarketMetadata } from "@shared/market/providerContracts";
import { gateioTradeStream } from "./gateioTradeStream";
import { gateioDepthStream } from "./gateioDepthStream";
import { multiExchangeTradeStream } from "./multiExchangeTradeStream";
import { compileZS } from "@shared/strategy/zsCompiler";

const GATE_TICKERS_URL = "https://api.gateio.ws/api/v4/futures/usdt/tickers";
const GATE_CANDLES_URL = "https://api.gateio.ws/api/v4/futures/usdt/candlesticks";
const GATE_CONTRACTS_URL = "https://api.gateio.ws/api/v4/futures/usdt/contracts";
const DEFAULT_SYMBOL = "QQQX_USDT";
const MAX_CANDLE_LIMIT = 2_000;

const SnapshotInput = z.object({ symbol: z.string().trim().min(1).max(40).optional() }).optional();
const ContractListInput = z.object({
  symbol: z.string().trim().min(1).max(40).optional(),
  limit: z.number().int().min(1).max(250).default(100),
}).optional();

const TradeTapeInput = z.object({
  symbol: z.string().trim().min(1).max(40).optional(),
  limit: z.number().int().min(1).max(500).default(250),
}).optional();

const DepthInput = z.object({
  symbol: z.string().trim().min(1).max(40).optional(),
  limit: z.number().int().min(5).max(50).default(20),
}).optional();

const MultiExchangeTradeTapeInput = z.object({
  provider: z.enum(["binance_usdm", "bybit_linear", "coinbase_exchange"]),
  symbol: z.string().trim().min(1).max(40).optional(),
  limit: z.number().int().min(1).max(500).default(250),
});
const FeedHealthInput = z.object({ symbol: z.string().trim().min(1).max(40).optional() }).optional();

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

function toCoinbaseUsdSpotSymbol(requested: string | undefined) {
  const canonical = (requested ?? "BTC_USDT").trim().toUpperCase().replace("-", "_");
  const match = canonical.match(/^([A-Z0-9]+)_(?:USDT|USD)$/);
  return match ? `${match[1]}_USD` : canonical;
}

const ResearchDatasetInput = z.object({
  provider: z.literal("gateio"),
  symbol: z.string().trim().min(1).max(40),
  interval: z.string().trim().min(1).max(12),
  requestedFrom: z.number().int().nullable(),
  requestedTo: z.number().int().nullable(),
  effectiveFrom: z.number().int().nullable(),
  effectiveTo: z.number().int().nullable(),
  returnedBars: z.number().int().nonnegative(),
  complete: z.boolean(),
  sourceTimestamp: z.number().int().nullable(),
  fetchedAt: z.number().int().positive(),
});
const StrategyCompileInput = z.object({
  source: z.string().max(16_000),
});

const SaveResearchDraftInput = z.object({
  id: z.string().uuid().optional(),
  workspaceName: z.string().trim().max(160).optional(),
  title: z.string().trim().max(180).optional(),
  hypothesis: z.string().trim().min(1).max(2_000),
  condition: z.string().trim().min(1).max(2_000),
  dataset: ResearchDatasetInput,
});

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
  strategy: router({
    compile: rateLimitedPublicProcedure.input(StrategyCompileInput).mutation(({ input }) => compileZS(input.source)),
  }),
  research: router({
    listDrafts: protectedProcedure.query(async ({ ctx }) => {
      const drafts = await listResearchDrafts(ctx.user.id);
      if (!drafts) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Durable workspace storage is not configured for this environment." });
      return drafts;
    }),
    saveDraft: protectedProcedure.input(SaveResearchDraftInput).mutation(async ({ ctx, input }) => {
      const draft = await saveResearchDraft(ctx.user.id, input);
      if (!draft) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Durable workspace storage is not configured for this environment." });
      return draft;
    }),
  }),

  market: router({
    capabilities: rateLimitedPublicProcedure.query(() => ({
      provider: "gateio" as const,
      environment: "public-read-only" as const,
      state: "CONNECTED" as const,
      instruments: { search: "provider-verified-on-request", aliases: true },
      history: { ranges: true, maximumBarsPerRequest: MAX_CANDLE_LIMIT, intervals: MARKET_INTERVALS },
      orderFlow: { state: "PARTIAL" as const, reason: "Gate.io DOM uses a reconciled public depth snapshot plus sequenced deltas. Gate.io, Binance USDⓈ-M, Bybit linear, and Coinbase Exchange USD spot expose separately labelled bounded public trade tapes with explicit live/stale/degraded states; cross-venue depth and historical tick replay are unavailable." },
      gex: { state: "UNAVAILABLE" as const, reason: "Options-feed required (Deribit/CME/OPRA); Gate.io perpetual data does not provide options-chain or Greek inputs." },
      providerCatalog: PROVIDER_CATALOG,
    })),
    providers: rateLimitedPublicProcedure.query(() => ({
      at: Date.now(),
      activeProvider: "gateio" as const,
      providers: PROVIDER_CATALOG,
    })),
    contracts: rateLimitedPublicProcedure.input(ContractListInput).query(async ({ input }) => {
      const fetchedAt = Date.now();
      const requestedSymbol = input?.symbol ? resolveSymbol(input.symbol) : null;
      if (input?.symbol && !requestedSymbol) {
        return {
          provider: "gateio" as const,
          state: "UNAVAILABLE" as const,
          fetchedAt,
          contracts: [],
          reasonCode: "UNSUPPORTED_INSTRUMENT" as const,
          reason: "The requested instrument is not a Gate.io USDT perpetual symbol.",
          retryable: false,
        };
      }
      try {
        const response = await axios.get<unknown>(GATE_CONTRACTS_URL, {
          headers: { Accept: "application/json" },
          timeout: 12_000,
          responseType: "json",
        });
        if (!Array.isArray(response.data)) throw new Error("Gate.io returned an invalid futures-contract payload");
        const contracts = response.data
          .map(contract => gateContractToMarketMetadata(contract, fetchedAt))
          .filter((contract): contract is NonNullable<typeof contract> => contract !== null)
          .filter(contract => requestedSymbol === null || contract.nativeSymbol === requestedSymbol)
          .slice(0, input?.limit ?? 100);
        if (requestedSymbol && contracts.length === 0) {
          return {
            provider: "gateio" as const,
            state: "UNAVAILABLE" as const,
            fetchedAt,
            contracts: [],
            reasonCode: "UNSUPPORTED_INSTRUMENT" as const,
            reason: "Gate.io did not return metadata for the requested USDT perpetual symbol.",
            retryable: false,
          };
        }
        return {
          provider: "gateio" as const,
          state: contracts.length ? "CONNECTED" as const : "EMPTY" as const,
          fetchedAt,
          contracts,
          reasonCode: null,
          reason: null,
          retryable: false,
        };
      } catch (error) {
        const failure = classifyProviderFailure(error);
        return {
          provider: "gateio" as const,
          state: "UNAVAILABLE" as const,
          fetchedAt,
          contracts: [],
          reasonCode: failure.reasonCode,
          reason: failure.message,
          retryable: failure.retryable,
        };
      }
    }),
    tradeTape: rateLimitedPublicProcedure.input(TradeTapeInput).query(({ input }) => {
      const symbol = input?.symbol ? resolveSymbol(input.symbol) : DEFAULT_SYMBOL;
      if (!symbol) return gateioTradeStream.getSnapshot(input?.symbol ?? "");
      const snapshot = gateioTradeStream.getSnapshot(symbol);
      return {
        ...snapshot,
        trades: snapshot.trades.slice(-(input?.limit ?? 250)),
      };
    }),
    depth: rateLimitedPublicProcedure.input(DepthInput).query(({ input }) => {
      const symbol = input?.symbol ? resolveSymbol(input.symbol) : DEFAULT_SYMBOL;
      if (!symbol) return gateioDepthStream.getSnapshot(input?.symbol ?? "");
      const snapshot = gateioDepthStream.getSnapshot(symbol);
      return {
        ...snapshot,
        bids: snapshot.bids.slice(0, input?.limit ?? 20),
        asks: snapshot.asks.slice(0, input?.limit ?? 20),
      };
    }),
    multiTradeTape: rateLimitedPublicProcedure.input(MultiExchangeTradeTapeInput).query(({ input }) => {
      const requestedSymbol = input.provider === "coinbase_exchange" ? toCoinbaseUsdSpotSymbol(input.symbol) : input.symbol ?? "BTC_USDT";
      const snapshot = multiExchangeTradeStream.getSnapshot(input.provider, requestedSymbol);
      return { ...snapshot, trades: snapshot.trades.slice(-(input.limit ?? 250)) };
    }),
    feedHealth: rateLimitedPublicProcedure.input(FeedHealthInput).query(({ input }) => {
      const requested = input?.symbol ?? "BTC_USDT";
      const gateSymbol = resolveSymbol(requested);
      const gate = gateSymbol ? gateioTradeStream.getSnapshot(gateSymbol) : gateioTradeStream.getSnapshot(requested);
      const binance = multiExchangeTradeStream.getSnapshot("binance_usdm", requested);
      const bybit = multiExchangeTradeStream.getSnapshot("bybit_linear", requested);
      const coinbase = multiExchangeTradeStream.getSnapshot("coinbase_exchange", toCoinbaseUsdSpotSymbol(requested));
      return { symbol: requested, checkedAt: Date.now(), feeds: [gate, binance, bybit, coinbase] };
    }),
    snapshot: rateLimitedPublicProcedure.input(SnapshotInput).query(async ({ input }) => {
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
    bars: rateLimitedPublicProcedure.input(CandleInput).query(async ({ input }) => {
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
        // Gate.io rejects requests that combine `limit` with both range bounds.
        // A bounded request therefore uses only `from` and `to`; a latest-window
        // request retains the bounded `limit` fallback for backwards compatibility.
        const params = requested.from === null
          ? { contract: symbol, interval: input.interval, limit: input.limit ?? 120 }
          : { contract: symbol, interval: input.interval, from: Math.floor(requested.from / 1_000), to: Math.floor(requested.to / 1_000) };
        const response = await axios.get<unknown>(GATE_CANDLES_URL, {
          params,
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
