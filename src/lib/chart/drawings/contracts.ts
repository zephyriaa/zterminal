import type { DrawingObject, DrawingType } from "../contracts";

export type DrawingTool = "cursor" | "crosshair" | "eraser" | DrawingType;
export type MagnetMode = "off" | "weak" | "strong";
export type ScreenPoint = { x: number; y: number };
export type ProjectedDrawing = { drawing: DrawingObject; points: ScreenPoint[]; viewport?: { width: number; height: number }; levels?: { value: number; y: number }[] };

export const ONE_POINT_DRAWINGS: readonly DrawingType[] = ["horizontal-line", "vertical-line", "cross-line", "text", "price-label", "callout"];
export const DRAWING_LABELS: Record<DrawingType, string> = {
  "trend-line": "Trend line", ray: "Ray", "extended-line": "Extended line",
  "horizontal-line": "Horizontal line", "horizontal-ray": "Horizontal ray", "vertical-line": "Vertical line",
  rectangle: "Rectangle", arrow: "Arrow", text: "Text", "price-label": "Price label",
  ruler: "Ruler", "price-range": "Price range", "date-range": "Date range",
  "long-position": "Long position", "short-position": "Short position", "fibonacci-retracement": "Fibonacci retracement",
  "cross-line": "Cross line", "parallel-channel": "Parallel channel", "fibonacci-extension": "Fibonacci extension",
  ellipse: "Ellipse", polyline: "Path / Polyline", callout: "Callout / Note",
};
