import type { Bar } from "./types";

function isRenderableBar(value: unknown): value is Bar {
  if (!value || typeof value !== "object") return false;
  const bar = value as Partial<Bar>;
  return [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every((field) => typeof field === "number" && Number.isFinite(field));
}

/** Validate and canonicalize provider bars before passing them to Lightweight Charts. */
export function normalizeChartBars(value: unknown): Bar[] {
  if (!Array.isArray(value)) throw new Error("invalid historical data");
  const byTime = new Map<number, Bar>();
  for (const candidate of value) {
    if (isRenderableBar(candidate)) byTime.set(candidate.t, candidate);
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}
