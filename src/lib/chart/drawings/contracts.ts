import type { DrawingObject, DrawingType } from "../contracts";

export type DrawingTool = "cursor" | "crosshair" | "eraser" | DrawingType;
export type MagnetMode = "off" | "weak" | "strong";
export type ScreenPoint = { x: number; y: number };
export type ProjectedDrawing = { drawing: DrawingObject; points: ScreenPoint[] };

export const ONE_POINT_DRAWINGS: readonly DrawingType[] = ["horizontal-line", "vertical-line", "text", "price-label"];
export const DRAWING_LABELS: Record<DrawingType, string> = {
  "trend-line": "Trend line", ray: "Ray", "extended-line": "Extended line",
  "horizontal-line": "Horizontal line", "horizontal-ray": "Horizontal ray", "vertical-line": "Vertical line",
  rectangle: "Rectangle", arrow: "Arrow", text: "Text", "price-label": "Price label",
  ruler: "Ruler", "price-range": "Price range", "date-range": "Date range",
  "long-position": "Long position", "short-position": "Short position", "fibonacci-retracement": "Fibonacci retracement",
};
