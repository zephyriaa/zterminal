export type TerminalAppearance = {
  preset: string;
  material: "violet" | "blue";
  appBackground: string;
  panelBackground: string;
  chartBackground: string;
  accent: string;
  upColor: string;
  downColor: string;
  gridOpacity: number;
  density: "compact" | "comfortable";
};

export const APPEARANCE_PRESETS: Record<string, Omit<TerminalAppearance, "preset">> = {
  Violet: { material: "violet", appBackground: "#090a10", panelBackground: "#14111d", chartBackground: "#0b0a10", accent: "#b5a2e8", upColor: "#34d399", downColor: "#fb7185", gridOpacity: 7, density: "compact" },
  // Keep the original key and exact colors so existing saved choices stay intact.
  Graphite: { material: "blue", appBackground: "#07090d", panelBackground: "#10141b", chartBackground: "#080b10", accent: "#7dd3fc", upColor: "#34d399", downColor: "#fb7185", gridOpacity: 7, density: "compact" },
  Midnight: { material: "blue", appBackground: "#050816", panelBackground: "#0b1224", chartBackground: "#060a18", accent: "#a78bfa", upColor: "#4ade80", downColor: "#f87171", gridOpacity: 6, density: "compact" },
  Sandstone: { material: "blue", appBackground: "#171512", panelBackground: "#24201a", chartBackground: "#15130f", accent: "#f0b35b", upColor: "#70d6a3", downColor: "#ee8f83", gridOpacity: 8, density: "comfortable" },
};

export const DEFAULT_APPEARANCE: TerminalAppearance = { preset: "Violet", ...APPEARANCE_PRESETS.Violet };

export function normalizeTerminalAppearance(value: unknown): TerminalAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_APPEARANCE };
  const input = value as Record<string, unknown>;
  const preset = typeof input.preset === "string" ? input.preset : "Custom";
  const result: TerminalAppearance = { ...DEFAULT_APPEARANCE, ...(APPEARANCE_PRESETS[preset] ?? {}), preset };
  for (const key of ["appBackground", "panelBackground", "chartBackground", "accent", "upColor", "downColor"] as const) {
    if (typeof input[key] === "string" && /^#[0-9a-f]{6}$/i.test(input[key])) result[key] = input[key];
  }
  if (input.material === "violet" || input.material === "blue") result.material = input.material;
  else if (preset !== "Violet") result.material = "blue"; // Pre-theme custom preferences.
  if (typeof input.gridOpacity === "number" && Number.isFinite(input.gridOpacity)) result.gridOpacity = Math.max(0, Math.min(18, input.gridOpacity));
  if (input.density === "comfortable" || input.density === "compact") result.density = input.density;
  return result;
}
