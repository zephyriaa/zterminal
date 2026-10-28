"use client";
import { useEffect, useState } from "react";
export function PreferenceColor({ label, value, onChange, onReset }: { label: string; value: string; onChange: (value: string) => void; onReset?: () => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = /^#[0-9a-f]{6}$/i.test(draft);
  return <div className="zt-preference-color"><label><span>{label}</span><input aria-label={`${label} picker`} type="color" value={value} onChange={event => onChange(event.target.value)} /><input aria-label={`${label} hex`} value={draft} maxLength={7} aria-invalid={!valid} onChange={event => { const next = event.target.value; setDraft(next); if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next); }} onBlur={() => { if (!valid) setDraft(value); }} /></label>{onReset && <button onClick={onReset} aria-label={`Reset ${label}`}>Reset</button>}</div>;
}
