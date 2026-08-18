import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { FixedWindowRateLimiter, publicRequestIdentity } from "./rateLimit";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  // Error messages may be user-facing; server stack traces and local paths never are.
  errorFormatter({ shape }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        stack: undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const publicApiLimiter = new FixedWindowRateLimiter(120, 60_000);
const limitPublicApi = t.middleware(async ({ ctx, next }) => {
  const decision = publicApiLimiter.consume(publicRequestIdentity(ctx.req));
  if (!decision.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Public research request limit reached. Retry in ${decision.retryAfterSeconds} seconds.` });
  }
  ctx.res.setHeader?.("RateLimit-Remaining", String(decision.remaining));
  return next();
});

/** Bounded public reads and diagnostics only; authenticated mutations use protectedProcedure. */
export const rateLimitedPublicProcedure = t.procedure.use(limitPublicApi);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
