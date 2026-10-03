import type { IChartApi, ISeriesApi, Logical, Time } from "lightweight-charts";
import type { DrawingAnchor } from "./contracts";

// LWC data() materializes every row. Invalidate only when series data changes,
// so pointer events and primitive repaints don't repeatedly copy the history.
const seriesData = new WeakMap<ISeriesApi<any>, { rows: ReturnType<ISeriesApi<any>["data"]> | null }>();
function drawingData(series: ISeriesApi<any>) {
  let cached = seriesData.get(series);
  if (!cached) {
    cached = { rows: null };
    seriesData.set(series, cached);
    const entry = cached;
    series.subscribeDataChanged(() => { entry.rows = null; });
  }
  return cached.rows ??= series.data();
}

/** Drawing time is continuous, including empty future space; candles stay unchanged. */
export function drawingTimeProjection(chart: IChartApi, series: ISeriesApi<any>, intervalSeconds: number) {
  const scale = chart.timeScale();
  const data = drawingData(series);
  const first = data[0]?.time;
  const last = data.at(-1)?.time;
  if (typeof first !== "number" || typeof last !== "number" || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) return null;
  const firstIndex = scale.timeToIndex(first as Time);
  const lastIndex = scale.timeToIndex(last as Time);
  if (firstIndex == null || lastIndex == null) return null;
  const timeAt = (index: number) => {
    const x = scale.logicalToCoordinate(index as Logical);
    return x == null ? null : scale.coordinateToTime(x);
  };
  return {
    timeAtLogical(logical: number): number | null {
      if (!Number.isFinite(logical)) return null;
      if (logical <= firstIndex) return first + (logical - firstIndex) * intervalSeconds;
      if (logical >= lastIndex) return last + (logical - lastIndex) * intervalSeconds;
      const lower = Math.floor(logical), upper = Math.ceil(logical);
      const from = timeAt(lower), to = timeAt(upper);
      return typeof from === "number" && typeof to === "number" ? from + (to - from) * (logical - lower) : null;
    },
    logicalAtTime(time: number): number | null {
      if (!Number.isFinite(time)) return null;
      if (time <= first) return firstIndex + (time - first) / intervalSeconds;
      if (time >= last) return lastIndex + (time - last) / intervalSeconds;
      const upper = scale.timeToIndex(time as Time, true);
      if (upper == null) return null;
      const to = timeAt(upper);
      if (to === time) return upper;
      const from = timeAt(upper - 1);
      return typeof from === "number" && typeof to === "number" && to > from ? upper - 1 + (time - from) / (to - from) : null;
    },
  };
}

export function coordinateToDrawingAnchor(chart: IChartApi, series: ISeriesApi<any>, point: { x: number; y: number }, intervalSeconds: number): DrawingAnchor | null {
  const logical = chart.timeScale().coordinateToLogical(point.x);
  const time = logical == null ? null : drawingTimeProjection(chart, series, intervalSeconds)?.timeAtLogical(logical);
  const price = series.coordinateToPrice(point.y);
  if (typeof time !== "number" || price == null || !Number.isFinite(price)) return null;
  return { time: time * 1000, price };
}

export function drawingAnchorToCoordinate(chart: IChartApi, series: ISeriesApi<any>, anchor: DrawingAnchor, intervalSeconds: number, projection = drawingTimeProjection(chart, series, intervalSeconds)) {
  const logical = projection?.logicalAtTime(anchor.time / 1000);
  const x = logical == null ? null : chart.timeScale().logicalToCoordinate(logical as Logical);
  const y = series.priceToCoordinate(anchor.price);
  return x == null || y == null ? null : { x, y };
}
