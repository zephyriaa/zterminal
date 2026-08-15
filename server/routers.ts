import { COOKIE_NAME } from "@shared/const";
import axios from "axios";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { finiteNumber, normalizePublicBars } from "./marketData";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const GATE_TICKER_URL = "https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=QQQX_USDT";
const GATE_CANDLES_URL = "https://api.gateio.ws/api/v4/futures/usdt/candlesticks";
const CandleInput = z.object({ interval: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]) });

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  market: router({
    snapshot: publicProcedure.query(async () => {
      const at = Date.now();
      try {
        const response = await axios.get<unknown>(GATE_TICKER_URL, {
          headers: { Accept: "application/json" },
          timeout: 12_000,
          responseType: "json",
        });
        const payload: unknown = response.data;
        const ticker = Array.isArray(payload) ? payload[0] : payload;
        if (!ticker || typeof ticker !== "object") throw new Error("Gate.io returned an invalid ticker payload");
        const data = ticker as Record<string, unknown>;
        const price = finiteNumber(data.last);
        if (price === null) throw new Error("Gate.io ticker did not include a finite last price");

        return {
          provider: "gateio" as const,
          environment: "public-read-only" as const,
          dataStatus: "LIVE" as const,
          symbol: "QQQX_USDT",
          price,
          changePercent: finiteNumber(data.change_percentage),
          dayHigh: finiteNumber(data.high_24h),
          dayLow: finiteNumber(data.low_24h),
          quoteVolume: finiteNumber(data.volume_24h_quote ?? data.volume_24h),
          bid: finiteNumber(data.highest_bid),
          ask: finiteNumber(data.lowest_ask),
          at,
        };
      } catch (error) {
        return {
          provider: "gateio" as const,
          environment: "public-read-only" as const,
          dataStatus: "UNAVAILABLE" as const,
          symbol: "QQQX_USDT",
          price: null,
          changePercent: null,
          dayHigh: null,
          dayLow: null,
          quoteVolume: null,
          bid: null,
          ask: null,
          at,
          reason: error instanceof Error ? error.message : "Public market snapshot unavailable",
        };
      }
    }),
    bars: publicProcedure.input(CandleInput).query(async ({ input }) => {
      const fetchedAt = Date.now();
      try {
        const response = await axios.get<unknown>(GATE_CANDLES_URL, {
          params: { contract: "QQQX_USDT", interval: input.interval, limit: 120 },
          headers: { Accept: "application/json" },
          timeout: 12_000,
          responseType: "json",
        });
        if (!Array.isArray(response.data)) throw new Error("Gate.io returned an invalid historical-candle payload");
        const bars = normalizePublicBars(response.data);
        if (bars.length < 2) throw new Error("Gate.io returned insufficient verified historical bars");

        return {
          provider: "gateio" as const,
          dataStatus: "HISTORICAL" as const,
          symbol: "QQQX_USDT",
          interval: input.interval,
          sourceTimestamp: bars.at(-1)?.t ?? null,
          fetchedAt,
          bars,
        };
      } catch (error) {
        return {
          provider: "gateio" as const,
          dataStatus: "UNAVAILABLE" as const,
          symbol: "QQQX_USDT",
          interval: input.interval,
          sourceTimestamp: null,
          fetchedAt,
          bars: [],
          reason: error instanceof Error ? error.message : "Public historical bars unavailable",
        };
      }
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
