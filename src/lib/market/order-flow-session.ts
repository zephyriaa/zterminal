import { appendObservedDepth, buildOrderFlowContext, sanitizeOrderFlowSettings, type OrderFlowContextSettings } from "./order-flow-context";
import { validateObservedTrades } from "./order-flow";
import { aggregateBigTrades, type BigTradesSnapshot } from "../chart/overlays/big-trades";
import type { BigTradesOverlaySettings } from "../chart/overlays/contracts";
import type { DepthEvent, Environment, FeedHealth, ProviderId, TradeEvent } from "./types";

function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}

/** One bounded observation owner per active source; presentation never owns its history. */
export class OrderFlowSession {
  private ring: TradeEvent[] = [];
  private bySequence = new Map<number, TradeEvent>();
  private head = 0;
  private count = 0;
  private revision = 0;
  private tradesDirty = false;
  get trades() { return this.getSnapshot().trades; }
  frames: readonly DepthEvent[] = Object.freeze([]);
  depth: DepthEvent | null = null;
  now = 0;
  health: FeedHealth | null = null;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private snapshot = Object.freeze({ revision: 0 as number, trades: Object.freeze([]) as readonly TradeEvent[], depth: this.depth, frames: this.frames, health: this.health, now: this.now });
  private lastSequence = -1;
  private contextCache = new Map<string, ReturnType<typeof buildOrderFlowContext>>();
  private bigTradesCache = new Map<string, BigTradesSnapshot>();

  constructor(readonly provider: ProviderId, readonly symbol: string, readonly environment: Environment) {}

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => {
    if (this.snapshot.revision !== this.revision) {
      const trades = this.tradesDirty ? Object.freeze(Array.from({ length: this.count }, (_, index) => this.ring[(this.head - this.count + index + 2000) % 2000])) : this.snapshot.trades;
      this.snapshot = Object.freeze({ revision: this.revision, trades, depth: this.depth, frames: this.frames, health: this.health, now: this.now });
      this.tradesDirty = false;
    }
    return this.snapshot;
  };

  updateHealth(health: FeedHealth) {
    if (health.provider !== this.provider || health.symbol !== this.symbol || this.health && health.updatedAt < this.health.updatedAt) return;
    this.health = freezeSnapshot(health); this.now = Date.now();
    if ((health.streams?.trades.state ?? health.state) !== "LIVE") this.clearTrades();
    if ((health.streams?.depth.state ?? health.state) !== "LIVE") this.clearDepth();
    this.invalidate();
  }

  private assertIdentity(event: TradeEvent | DepthEvent) {
    if (event.provider !== this.provider || event.symbol !== this.symbol || event.environment !== this.environment) throw new Error("Order-flow session identity mismatch");
  }

  pushTrade(trade: TradeEvent) {
    this.assertIdentity(trade); validateObservedTrades([trade]);
    if (!Number.isSafeInteger(trade.sequence) || trade.sequence < 0) throw new Error("Invalid trade sequence");
    if (trade.sequence <= this.lastSequence) {
      const previous = this.bySequence.get(trade.sequence);
      if (previous && (previous.timestamp !== trade.timestamp || previous.price !== trade.price || previous.quantity !== trade.quantity || previous.side !== trade.side || previous.quantityUnit !== trade.quantityUnit || previous.contractMultiplier !== trade.contractMultiplier)) throw new Error("Conflicting trade identity");
      return;
    }
    this.lastSequence = trade.sequence;
    const observed = { ...trade, conditions: trade.conditions ? [...trade.conditions] : undefined };
    if (observed.conditions) Object.freeze(observed.conditions);
    Object.freeze(observed);
    if (this.count === 2000) this.bySequence.delete(this.ring[this.head].sequence);
    else this.count++;
    this.ring[this.head] = observed; this.bySequence.set(observed.sequence, observed);
    this.head = (this.head + 1) % 2000; this.tradesDirty = true;
    this.now = Date.now();
    this.invalidate();
  }

  pushDepth(event: DepthEvent) {
    this.assertIdentity(event);
    const frames = appendObservedDepth(this.frames, event);
    if (frames === this.frames) return;
    this.frames = Object.freeze(frames.map(frame => Object.isFrozen(frame) ? frame : Object.freeze({ ...frame, levels: Object.freeze(frame.levels.map(level => Object.freeze(level))) as unknown as DepthEvent["levels"] })));
    this.depth = freezeSnapshot({ ...event, levels: event.levels.map(level => ({ ...level })) });
    this.now = Date.now();
    this.invalidate();
  }

  clearTrades() {
    if (!this.count) return;
    this.ring = []; this.bySequence.clear(); this.head = 0; this.count = 0; this.tradesDirty = true; this.invalidate();
  }

  clearDepth() {
    if (!this.depth && !this.frames.length) return;
    this.depth = null; this.frames = Object.freeze([]); this.invalidate();
  }

  reset() { this.clearTrades(); this.clearDepth(); this.lastSequence = -1; this.health = null; this.invalidate(); }

  dispose() { this.reset(); if (this.timer) clearTimeout(this.timer); this.timer = null; this.listeners.clear(); }

  private invalidate() {
    this.contextCache.clear(); this.bigTradesCache.clear();
    this.revision++;
    if (!this.timer && this.listeners.size) this.timer = setTimeout(() => { this.timer = null; for (const listener of this.listeners) listener(); }, 50);
  }

  context(settings: OrderFlowContextSettings, tickSize: number, tradesReady: boolean, depthReady: boolean, now: number, observation = this.getSnapshot()) {
    const clean = sanitizeOrderFlowSettings(settings);
    const key = JSON.stringify([observation.revision, clean, tickSize, tradesReady, depthReady, now]);
    let snapshot = this.contextCache.get(key);
    if (!snapshot) {
      snapshot = freezeSnapshot(buildOrderFlowContext({ provider: this.provider, symbol: this.symbol, available: tradesReady, depthAvailable: depthReady, trades: observation.trades, depth: observation.depth, tickSize, now, settings: clean }));
      if (this.contextCache.size >= 32) this.contextCache.clear();
      this.contextCache.set(key, snapshot);
    }
    return snapshot;
  }

  bigTrades(tickSize: number, settings: BigTradesOverlaySettings, observation = this.getSnapshot()) {
    const key = JSON.stringify([observation.revision, tickSize, settings]);
    let snapshot = this.bigTradesCache.get(key);
    if (!snapshot) {
      snapshot = freezeSnapshot(aggregateBigTrades(observation.trades, tickSize, settings));
      if (this.bigTradesCache.size >= 32) this.bigTradesCache.clear();
      this.bigTradesCache.set(key, snapshot);
    }
    return snapshot;
  }
}

const sessions = new Map<string, { session: OrderFlowSession; references: number }>();

export function acquireOrderFlowSession(provider: ProviderId, symbol: string, environment: Environment, workspaceId = "") {
  const key = JSON.stringify([provider, environment, symbol, workspaceId]);
  const owner = sessions.get(key) ?? { session: new OrderFlowSession(provider, symbol, environment), references: 0 };
  sessions.set(key, owner); owner.references++;
  let released = false;
  return { session: owner.session, release() {
    if (released) return;
    released = true;
    if (--owner.references === 0) { owner.session.dispose(); sessions.delete(key); }
  } };
}
