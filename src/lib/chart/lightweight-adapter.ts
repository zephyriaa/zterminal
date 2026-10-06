import {
  ColorType,
  CrosshairMode,
  PriceScaleMode,
  type ChartOptions,
  type DeepPartial,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type Logical,
  type SeriesType,
} from "lightweight-charts";
import type { ChartSettingsV2 } from "./contracts";
import type { DrawingAnchor } from "./contracts";
import { logicalToTime, timeToLogical, type DrawingCoordinates } from "./drawings/coordinates";

function scaleMode(settings: ChartSettingsV2) {
  if (settings.scaleMode === "logarithmic") return PriceScaleMode.Logarithmic;
  if (settings.scaleMode === "percentage") return PriceScaleMode.Percentage;
  return PriceScaleMode.Normal;
}

/**
 * Translates persisted chart-domain settings into the third-party renderer API.
 * Keeping this boundary pure makes settings migrations independent of chart mounts.
 */
export function lightweightChartOptions(
  settings: ChartSettingsV2,
  axisText = "#8b98a5",
): DeepPartial<ChartOptions> {
  const gridColor = `rgba(255,255,255,${settings.showGrid ? settings.gridOpacity : 0})`;
  return {
    layout: {
      background: { type: ColorType.Solid, color: settings.backgroundColor },
      textColor: axisText,
    },
    grid: {
      vertLines: { color: gridColor },
      horzLines: { color: gridColor },
    },
    crosshair: {
      mode: settings.showCrosshair ? CrosshairMode.Normal : CrosshairMode.Hidden,
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      rightOffset: settings.futureBars,
    },
    rightPriceScale: {
      mode: scaleMode(settings),
      invertScale: settings.invertScale,
      scaleMargins: {
        top: settings.scaleMarginTop,
        bottom: settings.scaleMarginBottom,
      },
    },
  };
}

/** Applies the persisted pane ratio without leaking pane mutation into React. */
export function applyVolumePaneLayout(chart: IChartApi, volumeHeight: number) {
  const panes = chart.panes();
  if (panes.length < 2) return;
  const boundedHeight = Math.min(0.5, Math.max(0.12, volumeHeight));
  panes[0].setStretchFactor(Math.max(0.5, 1 - boundedHeight));
  panes[1].setStretchFactor(boundedHeight);
}

export function coordinateToDrawingAnchor(chart: IChartApi, series: ISeriesApi<any>, point: { x: number; y: number }): DrawingAnchor | null {
  const time = chart.timeScale().coordinateToTime(point.x) as Time | null;
  const price = series.coordinateToPrice(point.y);
  if (typeof time !== "number" || price == null || !Number.isFinite(price)) return null;
  return { time: time * 1000, price };
}

export function drawingAnchorToCoordinate(chart: IChartApi, series: ISeriesApi<any>, anchor: DrawingAnchor) {
  const x = chart.timeScale().timeToCoordinate((anchor.time / 1000) as Time);
  const y = series.priceToCoordinate(anchor.price);
  return x == null || y == null ? null : { x, y };
}

export function createDrawingCoordinates(chart: IChartApi, series: ISeriesApi<SeriesType>, times: readonly number[], interval: number): DrawingCoordinates {
  const scale = chart.timeScale();
  return {
    project(anchor) {
      const logical = timeToLogical(times, anchor.time, interval);
      const x = logical == null ? null : scale.logicalToCoordinate(logical as Logical), y = series.priceToCoordinate(anchor.price);
      return x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y) ? null : { x, y };
    },
    unproject(point) {
      const logical = scale.coordinateToLogical(point.x), price = series.coordinateToPrice(point.y);
      const time = logical == null ? null : logicalToTime(times, logical, interval);
      return time == null || time < 0 || price == null || !Number.isFinite(price) ? null : { time, price };
    },
  };
}
