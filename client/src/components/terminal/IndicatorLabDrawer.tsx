import { useMemo, useState } from "react";
import { CheckCircle2, Code2, Plus, Trash2, X } from "lucide-react";
import { compileIndicator, evaluateIndicator, type CompiledIndicator, type IndicatorDraft, type IndicatorInput } from "@shared/indicators/indicatorRuntime";
import type { TerminalBar } from "@/lib/terminalWorkspace";

const initialInputs: IndicatorInput[] = [
  { id: "fast", label: "Fast length", defaultValue: 12, min: 1, max: 250, step: 1 },
  { id: "slow", label: "Slow length", defaultValue: 26, min: 1, max: 250, step: 1 },
];

const defaultDraft: IndicatorDraft = {
  name: "EMA spread",
  expression: "ema(close, fast) - ema(close, slow)",
  inputs: initialInputs,
  output: { pane: "pane", color: "#9f75fa", lineWidth: 2 },
};

function nextInputId(inputs: IndicatorInput[]) {
  let index = inputs.length + 1;
  while (inputs.some(input => input.id === `input${index}`)) index += 1;
  return `input${index}`;
}

function numeric(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

type IndicatorLabDrawerProps = {
  bars: TerminalBar[];
  onAdd: (indicator: CompiledIndicator) => void;
  onClose: () => void;
};

export function IndicatorLabDrawer({ bars, onAdd, onClose }: IndicatorLabDrawerProps) {
  const [draft, setDraft] = useState<IndicatorDraft>(defaultDraft);
  const compiled = useMemo(() => compileIndicator(draft), [draft]);
  const preview = useMemo(() => compiled.status === "VALID" ? evaluateIndicator(compiled, bars) : null, [bars, compiled]);
  const valid = compiled.status === "VALID" && preview?.status === "COMPLETED";

  const updateInput = (index: number, patch: Partial<IndicatorInput>) => setDraft(current => ({ ...current, inputs: current.inputs.map((input, cursor) => cursor === index ? { ...input, ...patch } : input) }));
  const addInput = () => setDraft(current => ({ ...current, inputs: [...current.inputs, { id: nextInputId(current.inputs), label: "New input", defaultValue: 14, min: 1, max: 250, step: 1 }] }));
  const removeInput = (index: number) => setDraft(current => ({ ...current, inputs: current.inputs.filter((_, cursor) => cursor !== index) }));

  return <aside className="studies-drawer indicator-lab-drawer" aria-label="Indicator Lab">
    <div className="drawer-heading"><div><span className="drawer-kicker">Local custom study</span><h2>Indicator Lab</h2></div><button onClick={onClose} aria-label="Close Indicator Lab"><X size={16} /></button></div>
    <div className="indicator-lab-status"><Code2 size={14} /><span>Closed candle runtime</span><b>LOCAL</b></div>
    <p className="indicator-lab-intro">Define one formula from the loaded verified OHLCV window. ZTerminal parses it into a closed expression tree; it never runs JavaScript, Pine Script, external requests, alerts, strategies, or orders.</p>
    <div className="indicator-lab-form">
      <label>Indicator name<input value={draft.name} maxLength={64} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
      <label>Formula<textarea value={draft.expression} maxLength={1200} spellCheck="false" onChange={event => setDraft(current => ({ ...current, expression: event.target.value }))} /></label>
      <small className="indicator-lab-hint">Sources: open, high, low, close, volume, hl2, hlc3, ohlc4. Functions: sma(series, period), ema(series, period), rsi(series, period), abs, min, max.</small>
      <div className="indicator-output-grid"><label>Pane<select value={draft.output.pane} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, pane: event.target.value as "overlay" | "pane" } }))}><option value="overlay">Price overlay</option><option value="pane">Separate pane</option></select></label><label>Color<input type="color" value={draft.output.color} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, color: event.target.value } }))} /></label><label>Width<select value={draft.output.lineWidth} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, lineWidth: Number(event.target.value) } }))}>{[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}px</option>)}</select></label></div>
      <section className="indicator-inputs"><div><span>Bounded numeric inputs</span><button onClick={addInput} type="button"><Plus size={13} /> Add input</button></div>{draft.inputs.map((input, index) => <div className="indicator-input-row" key={`${input.id}-${index}`}><input aria-label={`Input ${index + 1} id`} value={input.id} onChange={event => updateInput(index, { id: event.target.value })} /><input aria-label={`Input ${index + 1} label`} value={input.label} onChange={event => updateInput(index, { label: event.target.value })} /><input aria-label={`Input ${index + 1} default`} type="number" value={input.defaultValue} onChange={event => updateInput(index, { defaultValue: numeric(event.target.value, input.defaultValue) })} /><input aria-label={`Input ${index + 1} minimum`} type="number" value={input.min} onChange={event => updateInput(index, { min: numeric(event.target.value, input.min) })} /><input aria-label={`Input ${index + 1} maximum`} type="number" value={input.max} onChange={event => updateInput(index, { max: numeric(event.target.value, input.max) })} /><button type="button" onClick={() => removeInput(index)} aria-label={`Remove ${input.label}`}><Trash2 size={13} /></button></div>)}</section>
    </div>
    <section className={`indicator-preview ${valid ? "valid" : "invalid"}`}><div>{valid ? <CheckCircle2 size={17} /> : <X size={17} />}<div><b>{valid ? "Formula validated" : "Formula withheld"}</b><p>{compiled.status === "INVALID" ? compiled.diagnostic : preview?.status === "UNAVAILABLE" ? preview.reason : `${preview?.points.length ?? 0} loaded verified bars · ${draft.output.pane === "overlay" ? "price overlay" : "separate pane"}`}</p></div></div>{valid && <button className="terminal-primary-button" onClick={() => { if (compiled.status === "VALID") onAdd(compiled); }}>Add to chart</button>}</section>
    <footer className="indicator-lab-footer"><span>Current loaded candles only</span><span>No look-ahead · no execution</span></footer>
  </aside>;
}
