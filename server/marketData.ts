export type PublicBar = { t: number; o: number; h: number; l: number; c: number; v: number };

export function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePublicBars(payload: unknown): PublicBar[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const t = finiteNumber(row.t);
    const o = finiteNumber(row.o);
    const h = finiteNumber(row.h);
    const l = finiteNumber(row.l);
    const c = finiteNumber(row.c);
    const v = finiteNumber(row.v);
    if ([t, o, h, l, c, v].some((value) => value === null)) return [];
    if (h! < Math.max(o!, c!) || l! > Math.min(o!, c!) || v! < 0) return [];
    return [{ t: t! * 1_000, o: o!, h: h!, l: l!, c: c!, v: Math.abs(v!) }];
  }).sort((a, b) => a.t - b.t);
}
