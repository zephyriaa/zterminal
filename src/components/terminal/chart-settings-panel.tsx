"use client";

import { useState } from "react";
import type { ChartSettingsV2 } from "@/lib/chart/contracts";
import { cn } from "@/lib/utils";

type Category = "Symbol" | "Appearance" | "Scales" | "Research" | "Events";
const CATEGORIES: Category[] = ["Symbol", "Appearance", "Scales", "Research", "Events"];

export function ChartSettingsPanel({ settings, instrument, provider, volumeVisible, volumeHeight, onChange, onVolume, onReset }: {
  settings: ChartSettingsV2;
  instrument: string;
  provider: string;
  volumeVisible: boolean;
  volumeHeight: number;
  onChange: (patch: Partial<ChartSettingsV2>) => void;
  onVolume: (patch: { visible?: boolean; height?: number }) => void;
  onReset: () => void;
}) {
  const [category, setCategory] = useState<Category>("Appearance");
  return <div className="zt-chart-settings-panel">
    <div className="zt-chart-settings-tabs" role="tablist" aria-label="Chart setting categories">{CATEGORIES.map(item => <button key={item} role="tab" aria-selected={category === item} className={cn(category === item && "is-active")} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="zt-chart-settings-content">
      {category === "Symbol" && <section><SettingsHeading title="Market context" detail="Instrument and source are selected outside appearance settings." /><ReadOnlyRow label="Instrument" value={instrument} /><ReadOnlyRow label="Provider" value={provider} /><p className="zt-settings-note">Provider identity and instrument identity remain separate so drawings and chart state cannot leak across venues.</p></section>}
      {category === "Appearance" && <section><SettingsHeading title="Chart appearance" detail="Colors update without rebuilding the chart." /><ColorRow label="Background" value={settings.backgroundColor} onChange={backgroundColor => onChange({ backgroundColor })} /><ColorRow label="Up candles" value={settings.candleUpColor} onChange={candleUpColor => onChange({ candleUpColor, candleBorderUpColor: candleUpColor, candleWickUpColor: candleUpColor })} /><ColorRow label="Down candles" value={settings.candleDownColor} onChange={candleDownColor => onChange({ candleDownColor, candleBorderDownColor: candleDownColor, candleWickDownColor: candleDownColor })} /><Toggle label="Grid lines" checked={settings.showGrid} onChange={showGrid => onChange({ showGrid })} /><Toggle label="Candle borders" checked={settings.showCandleBorders} onChange={showCandleBorders => onChange({ showCandleBorders })} /><Toggle label="Candle wicks" checked={settings.showCandleWicks} onChange={showCandleWicks => onChange({ showCandleWicks })} /><Range label="Grid intensity" value={Math.round(settings.gridOpacity * 100)} min={0} max={30} suffix="%" onChange={value => onChange({ gridOpacity: value / 100 })} /></section>}
      {category === "Scales" && <section><SettingsHeading title="Price and time scales" detail="Scale changes are applied to the existing chart instance." /><label className="zt-settings-select"><span>Price scale</span><select value={settings.scaleMode} onChange={event => onChange({ scaleMode: event.target.value as ChartSettingsV2["scaleMode"] })}><option value="normal">Normal</option><option value="logarithmic">Logarithmic</option><option value="percentage">Percentage</option></select></label><Toggle label="Invert price scale" checked={settings.invertScale} onChange={invertScale => onChange({ invertScale })} /><Range label="Top margin" value={Math.round(settings.scaleMarginTop * 100)} min={0} max={40} suffix="%" onChange={value => onChange({ scaleMarginTop: value / 100 })} /><Range label="Bottom margin" value={Math.round(settings.scaleMarginBottom * 100)} min={0} max={40} suffix="%" onChange={value => onChange({ scaleMarginBottom: value / 100 })} /><Range label="Future space" value={settings.futureBars} min={0} max={80} suffix=" bars" onChange={futureBars => onChange({ futureBars })} /></section>}
      {category === "Research" && <section><SettingsHeading title="Research layers" detail="Volume is managed as a dedicated pane." /><Toggle label="Volume pane" checked={volumeVisible} onChange={visible => onVolume({ visible })} /><Range label="Volume pane height" value={Math.round(volumeHeight * 100)} min={12} max={45} suffix="%" onChange={value => onVolume({ height: value / 100 })} /><Toggle label="Crosshair" checked={settings.showCrosshair} onChange={showCrosshair => onChange({ showCrosshair })} /><Toggle label="Last price line" checked={settings.showPriceLine} onChange={showPriceLine => onChange({ showPriceLine })} /><Toggle label="Mark price" checked={settings.showMarkPrice} onChange={showMarkPrice => onChange({ showMarkPrice })} /></section>}
      {category === "Events" && <section><SettingsHeading title="Chart events" detail="Only verified and available events are shown." /><Toggle label="Strategy trades" checked={settings.showStrategyTrades} onChange={showStrategyTrades => onChange({ showStrategyTrades })} /><DisabledRow label="Economic events" reason="No verified provider" /><DisabledRow label="Liquidations" reason="Historical coverage unavailable" /></section>}
    </div>
    <footer><button type="button" onClick={onReset}>Reset chart settings</button><span>Saved per market</span></footer>
  </div>;
}

function SettingsHeading({ title, detail }: { title: string; detail: string }) { return <div className="zt-settings-heading"><b>{title}</b><p>{detail}</p></div>; }
function ReadOnlyRow({ label, value }: { label: string; value: string }) { return <div className="zt-settings-readonly"><span>{label}</span><b>{value}</b></div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="zt-settings-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /></label>; }
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="zt-settings-color"><span>{label}</span><input type="color" value={value} onChange={event => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></label>; }
function Range({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) { return <label className="zt-settings-range"><span><span>{label}</span><b>{value}{suffix}</b></span><input type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /></label>; }
function DisabledRow({ label, reason }: { label: string; reason: string }) { return <div className="zt-settings-disabled"><span>{label}</span><b>{reason}</b></div>; }
