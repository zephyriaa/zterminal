import type { Bar } from "@/lib/market/types";
import type { ChartTimezone } from "@/stores/workspace";
import type { IndicatorInstance } from "@/lib/indicator-library";

export type IndicatorEvaluationOutput = { id: string; values: (number | null)[] };
function ema(values: number[], period: number) { const out: (number | null)[] = new Array(values.length).fill(null); if (!values.length) return out; const k = 2 / (period + 1); let previous = values[0]; out[0] = previous; for (let i = 1; i < values.length; i++) { previous = values[i] * k + previous * (1 - k); out[i] = previous; } return out; }
function sma(values: number[], period: number) { const out: (number | null)[] = new Array(values.length).fill(null); let sum = 0; for (let i = 0; i < values.length; i++) { sum += values[i]; if (i >= period) sum -= values[i - period]; if (i >= period - 1) out[i] = sum / period; } return out; }
function wma(values: number[], period: number) { const out: (number | null)[] = new Array(values.length).fill(null), denominator = period * (period + 1) / 2; for (let i = period - 1; i < values.length; i++) { let sum = 0; for (let offset = 0; offset < period; offset++) sum += values[i - period + 1 + offset] * (offset + 1); out[i] = sum / denominator; } return out; }
function vwma(bars: Bar[], period: number) { const out: (number | null)[] = new Array(bars.length).fill(null); let pv = 0, volume = 0; for (let i = 0; i < bars.length; i++) { pv += bars[i].c * bars[i].v; volume += bars[i].v; if (i >= period) { pv -= bars[i - period].c * bars[i - period].v; volume -= bars[i - period].v; } if (i >= period - 1) out[i] = volume > 0 ? pv / volume : null; } return out; }
function extrema(values: number[], period: number, mode: "max" | "min") { const out: (number | null)[] = new Array(values.length).fill(null); for (let i = period - 1; i < values.length; i++) { let value = values[i - period + 1]; for (let offset = 1; offset < period; offset++) value = mode === "max" ? Math.max(value, values[i - period + 1 + offset]) : Math.min(value, values[i - period + 1 + offset]); out[i] = value; } return out; }
function vwap(bars: Bar[], timezone: ChartTimezone) { const out: (number | null)[] = new Array(bars.length).fill(null); let pv = 0, volume = 0, day = ""; const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }); for (let i = 0; i < bars.length; i++) { const key = formatter.format(new Date(bars[i].t)); if (key !== day) { day = key; pv = 0; volume = 0; } pv += ((bars[i].h + bars[i].l + bars[i].c) / 3) * bars[i].v; volume += bars[i].v; out[i] = volume > 0 ? pv / volume : bars[i].c; } return out; }

export function evaluateIndicator(instance: IndicatorInstance, bars: Bar[], timezone: ChartTimezone): IndicatorEvaluationOutput[] {
  const closes = bars.map(bar => bar.c), period = Math.max(1, Number(instance.inputs.length ?? 20));
  if (instance.kind === "ema") return [{ id: "value", values: ema(closes, period) }];
  if (instance.kind === "sma") return [{ id: "value", values: sma(closes, period) }];
  if (instance.kind === "wma") return [{ id: "value", values: wma(closes, period) }];
  if (instance.kind === "vwma") return [{ id: "value", values: vwma(bars, period) }];
  if (instance.kind === "vwap") return [{ id: "value", values: vwap(bars, timezone) }];
  if (instance.kind === "donchian") return [{ id: "upper", values: extrema(bars.map(bar => bar.h), period, "max") }, { id: "lower", values: extrema(bars.map(bar => bar.l), period, "min") }];
  if (instance.kind === "bollinger") { const middle = sma(closes, period), deviation = middle.map((mean, index) => { if (mean == null) return null; let squared = 0; for (let offset = 0; offset < period; offset++) squared += (closes[index - offset] - mean) ** 2; return Math.sqrt(squared / period); }), multiplier = Number(instance.inputs.multiplier ?? 2); return [{ id: "middle", values: middle }, { id: "upper", values: middle.map((value, index) => value == null || deviation[index] == null ? null : value + deviation[index]! * multiplier) }, { id: "lower", values: middle.map((value, index) => value == null || deviation[index] == null ? null : value - deviation[index]! * multiplier) }]; }
  return [];
}
