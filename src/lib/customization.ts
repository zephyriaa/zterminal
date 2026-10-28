import { z } from "zod";
import { normalizeTerminalAppearance, type TerminalAppearance } from "./terminal-appearance";
import { sanitizeChartSettings, type ChartSettingsV2 } from "./chart/contracts";
import { migrateStudy, validateStudy, type IndicatorInstance } from "./indicator-library";
import { validateSavedLayout } from "./workspace-dock-layout";

export const COMMANDS = {
  commands: { label: "Open command palette", binding: "Mod+K" },
  sidebar: { label: "Toggle sidebar", binding: "Mod+B" },
  preferences: { label: "Open preferences", binding: "Mod+Shift+," },
  chartSettings: { label: "Open chart settings", binding: "Mod+Shift+." },
  chart: { label: "Focus chart", binding: "Alt+1" },
  strategy: { label: "Open Python editor", binding: "Alt+2" },
  research: { label: "Open research report", binding: "Alt+3" },
} as const;
export type CommandId = keyof typeof COMMANDS;
const binding = z.string().max(60).refine(value => value === "" || /^(?:(?:Mod|Alt|Shift)\+){1,3}[a-z0-9,.]$/i.test(value), "Use Mod, Alt or Shift and one letter, digit, comma or period.");
export const defaultBindings = Object.fromEntries(Object.entries(COMMANDS).map(([id, command]) => [id, command.binding])) as Record<CommandId, string>;
export function shortcutFromEvent(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">) {
  if (["Control", "Meta", "Alt", "Shift"].includes(event.key)) return null;
  return `${event.ctrlKey || event.metaKey ? "Mod+" : ""}${event.altKey ? "Alt+" : ""}${event.shiftKey ? "Shift+" : ""}${event.key.toUpperCase()}`;
}
export function validateBindings(values: Record<string, string>) {
  const result = { ...defaultBindings, ...values };
  const used = new Set<string>();
  for (const [id, value] of Object.entries(result)) {
    if (!Object.hasOwn(COMMANDS, id)) throw new Error("Unknown shortcut action.");
    binding.parse(value);
    if (value && !/^(?:Mod\+)?(?:Alt\+)?(?:Shift\+)?[a-z0-9,.]$/i.test(value)) throw new Error("Use each modifier once, in Mod, Alt, Shift order.");
    const normalized = value.toUpperCase();
    if (value && used.has(normalized)) throw new Error(`Shortcut ${value} is already assigned.`);
    if (/^(MOD\+(?:[ACDVXYZSFRLNTWP]|SHIFT\+[ZNPTR]))$/.test(normalized) || !/^(MOD\+|ALT\+|$)/.test(normalized)) throw new Error("This shortcut is reserved for the editor or browser.");
    used.add(normalized);
  }
  return result;
}

export const STYLE_KEYS = ["backgroundColor", "candleUpColor", "candleDownColor", "candleBorderUpColor", "candleBorderDownColor", "candleWickUpColor", "candleWickDownColor", "gridOpacity", "showGrid", "showCandleBorders", "showCandleWicks", "showCrosshair", "showPriceLine", "showMarkPrice"] as const;
export function chartStyle(settings: ChartSettingsV2): Partial<ChartSettingsV2> {
  return Object.fromEntries(STYLE_KEYS.map(key => [key, settings[key]]));
}
export function appearanceChartStyle(appearance: TerminalAppearance): Partial<ChartSettingsV2> {
  return { backgroundColor: appearance.chartBackground, candleUpColor: appearance.upColor, candleDownColor: appearance.downColor, candleBorderUpColor: appearance.upColor, candleBorderDownColor: appearance.downColor, candleWickUpColor: appearance.upColor, candleWickDownColor: appearance.downColor, gridOpacity: appearance.gridOpacity / 100 };
}
const name = z.string().trim().min(1).max(60);
const layoutTemplate = z.object({ name, layout: z.record(z.string(), z.unknown()), multiLayout: z.enum(["1", "2h", "2v", "3", "4"]) });
export const customizationSchema = z.object({
  fontSize: z.number().int().min(11).max(18).default(12),
  reduceMotion: z.boolean().default(false),
  bindings: z.record(z.string(), binding).default(defaultBindings),
  appearancePresets: z.array(z.object({ name, appearance: z.record(z.string(), z.unknown()) })).max(30).default([]),
  chartStyles: z.array(z.object({ name, settings: z.record(z.string(), z.unknown()) })).max(30).default([]),
  chartDefaults: z.record(z.string(), z.unknown()).nullable().default(null),
  indicatorTemplates: z.array(z.object({ name, indicators: z.array(z.unknown()).max(50) })).max(30).default([]),
  layoutTemplates: z.array(layoutTemplate).max(30).default([]),
});
export type Customization = Omit<z.infer<typeof customizationSchema>, "appearancePresets" | "chartStyles" | "chartDefaults" | "indicatorTemplates"> & {
  appearancePresets: { name: string; appearance: TerminalAppearance }[];
  chartStyles: { name: string; settings: Partial<ChartSettingsV2> }[];
  chartDefaults: Partial<ChartSettingsV2> | null;
  indicatorTemplates: { name: string; indicators: IndicatorInstance[] }[];
};
export function parseCustomization(input: unknown): Customization {
  const parsed = customizationSchema.parse(input);
  const style = (value: Record<string, unknown>) => {
    const valid = sanitizeChartSettings(value);
    for (const key of Object.keys(value)) {
      if (!STYLE_KEYS.includes(key as typeof STYLE_KEYS[number]) || value[key] !== valid[key as keyof ChartSettingsV2]) throw new Error(`Invalid chart style: ${key}.`);
    }
    return value as Partial<ChartSettingsV2>;
  };
  for (const collection of [parsed.appearancePresets, parsed.chartStyles, parsed.indicatorTemplates, parsed.layoutTemplates]) if (new Set(collection.map(item => item.name)).size !== collection.length) throw new Error("Saved preset names must be unique within each collection.");
  for (const template of parsed.layoutTemplates) validateSavedLayout(template.layout);
  return { ...parsed, bindings: validateBindings(parsed.bindings),
    appearancePresets: parsed.appearancePresets.map(preset => { const appearance = normalizeTerminalAppearance(preset.appearance); for (const [key, value] of Object.entries(preset.appearance)) if (appearance[key as keyof TerminalAppearance] !== value) throw new Error(`Invalid appearance preset: ${key}.`); return { ...preset, appearance }; }),
    chartStyles: parsed.chartStyles.map(preset => ({ ...preset, settings: style(preset.settings) })),
    chartDefaults: parsed.chartDefaults === null ? null : style(parsed.chartDefaults),
    indicatorTemplates: parsed.indicatorTemplates.map(template => ({ ...template, indicators: template.indicators.map(input => { const study = migrateStudy(input); if (!study) throw new Error("Incompatible indicator template."); validateStudy(study); return study; }) })),
  };
}
export const DEFAULT_CUSTOMIZATION = parseCustomization({});
export function parsePreferenceFile(text: string) {
  if (text.length > 2_000_000) throw new Error("Preference files must be smaller than 2 MB.");
  const input = z.object({ version: z.literal(1), appearance: z.record(z.string(), z.unknown()), customization: customizationSchema }).strict().parse(JSON.parse(text));
  const appearance = normalizeTerminalAppearance(input.appearance);
  for (const [key, value] of Object.entries(input.appearance)) if (appearance[key as keyof TerminalAppearance] !== value) throw new Error(`Invalid appearance setting: ${key}.`);
  return { appearance, customization: parseCustomization(input.customization) };
}
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
