"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Briefcase,
  Calendar as CalendarIcon,
  FlaskConical,
  Plug,
  Plus,
  Radio,
  Settings as SettingsIcon,
  ShieldAlert,
  NotebookPen,
  Trash2,
} from "lucide-react";
import { Panel, PanelHeader, Pill, SimulatedTag, StatRow } from "../terminal/primitives";
import { useWorkspace } from "@/stores/workspace";
import { listContracts, getContract } from "@/lib/market/contracts";
import { PROVIDER_CATALOG, type ProviderCatalogEntry } from "@/lib/market/capabilities";
import { calculateFixedRiskSizing } from "@/domain/risk/sizing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ----------------------------- Calendar ----------------------------- */

const ECON_EVENTS = [
  { time: "08:30 ET", date: "Today", title: "CPI m/m", impact: "high", actual: "0.2%", forecast: "0.3%", prev: "0.3%" },
  { time: "10:00 ET", date: "Today", title: "Crude Oil Inventories", impact: "med", actual: null, forecast: "1.2M", prev: "-0.4M" },
  { time: "14:00 ET", date: "Today", title: "FOMC Rate Decision", impact: "high", actual: null, forecast: "5.50%", prev: "5.50%" },
  { time: "08:30 ET", date: "Tomorrow", title: "Initial Jobless Claims", impact: "med", actual: null, forecast: "220K", prev: "218K" },
  { time: "08:30 ET", date: "Fri", title: "Nonfarm Payrolls", impact: "high", actual: null, forecast: "180K", prev: "175K" },
];

export function CalendarView() {
  return (
    <ViewShell title="Economic Calendar" icon={CalendarIcon} right={<Pill tone="warn">Sample events</Pill>}>
      <div className="px-3 py-2 border-b hairline text-[10.5px] text-muted-foreground">Illustrative event rows only. A provider-backed calendar has not been connected yet.</div>
      <div className="overflow-y-auto scroll-thin">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-panel border-b hairline">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Date</th>
              <th className="text-left font-medium px-2 py-2">Time</th>
              <th className="text-left font-medium px-2 py-2">Event</th>
              <th className="text-center font-medium px-2 py-2">Impact</th>
              <th className="text-right font-medium px-2 py-2 tnum">Actual</th>
              <th className="text-right font-medium px-2 py-2 tnum">Forecast</th>
              <th className="text-right font-medium px-3 py-2 tnum">Previous</th>
            </tr>
          </thead>
          <tbody>
            {ECON_EVENTS.map((e, i) => (
              <tr key={i} className="border-b hairline hover:bg-hover/40">
                <td className="px-3 py-2 text-muted-foreground">{e.date}</td>
                <td className="px-2 py-2 tnum text-muted-foreground">{e.time}</td>
                <td className="px-2 py-2">{e.title}</td>
                <td className="px-2 py-2 text-center">
                  <Pill tone={e.impact === "high" ? "neg" : e.impact === "med" ? "warn" : "default"}>
                    {e.impact === "high" ? "High" : e.impact === "med" ? "Med" : "Low"}
                  </Pill>
                </td>
                <td className={cn("px-2 py-2 text-right tnum", e.actual ? "text-pos" : "text-muted-foreground")}>{e.actual ?? "—"}</td>
                <td className="px-2 py-2 text-right tnum text-muted-foreground">{e.forecast}</td>
                <td className="px-3 py-2 text-right tnum text-muted-foreground">{e.prev}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Alerts ----------------------------- */

interface Alert {
  id: string;
  symbol: string;
  cond: "above" | "below";
  price: number;
  active: boolean;
}

export function AlertsView() {
  const { setSymbol, setView, symbol, connection } = useWorkspace();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [sym, setSym] = useState(symbol);
  const [cond, setCond] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const liveContracts = useMemo(() => {
    if (connection.provider !== "gateio" || connection.dataStatus !== "LIVE") return [];
    return listContracts().filter((contract) => contract.symbol === "QQQX_USDT");
  }, [connection.dataStatus, connection.provider]);

  const add = () => {
    const p = Number(price);
    if (!Number.isFinite(p) || p <= 0) {
      setError("Enter a positive numeric trigger price.");
      return;
    }
    const alertSymbol = liveContracts.some((contract) => contract.symbol === sym) ? sym : liveContracts[0]?.symbol;
    if (!alertSymbol) {
      setError("Choose a symbol with an active live market-data subscription before creating an alert.");
      return;
    }
    setAlerts((current) => [...current, { id: crypto.randomUUID(), symbol: alertSymbol, cond, price: p, active: true }]);
    setError(null);
    setPrice("");
  };

  return (
    <ViewShell title="Alerts" icon={Bell} right={<Pill tone="warn">Session only</Pill>}>
      <div className="p-3 border-b hairline flex flex-wrap items-end gap-2">
        <Field label="Symbol">
          <Select value={sym} onValueChange={setSym} disabled={!liveContracts.length}>
            <SelectTrigger className="h-7 w-28 text-[12px] bg-surface"><SelectValue placeholder="No live symbols" /></SelectTrigger>
            <SelectContent>{liveContracts.map((contract) => <SelectItem key={contract.symbol} value={contract.symbol}>{contract.symbol}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Condition">
          <Select value={cond} onValueChange={(v) => setCond(v as "above" | "below")}>
            <SelectTrigger className="h-7 w-28 text-[12px] bg-surface"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="above">crosses above</SelectItem><SelectItem value="below">crosses below</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="Price">
          <Input value={price} onChange={(e) => { setPrice(e.target.value); setError(null); }} type="number" min="0" step="any" aria-invalid={Boolean(error)} className="h-7 w-28 text-[12px] tnum bg-surface" />
        </Field>
        <Button size="sm" onClick={add} disabled={!liveContracts.length} className="h-7 text-[12px]"><Plus className="w-3.5 h-3.5 mr-1" />Add</Button>
      </div>
      <div className="px-3 py-2 border-b hairline text-[10.5px] text-muted-foreground">
        {liveContracts.length ? `Provider: ${connection.provider.toUpperCase()} · alerts are kept only in this browser session until the durable alert service is released.` : "No active live provider is available. Reconnect public market data before adding an alert."}
        {error && <span className="block mt-1 text-neg" role="alert">{error}</span>}
      </div>
      <div className="overflow-y-auto scroll-thin flex-1">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-panel border-b hairline">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Symbol</th>
              <th className="text-left font-medium px-2 py-2">Condition</th>
              <th className="text-right font-medium px-2 py-2 tnum">Price</th>
              <th className="text-center font-medium px-2 py-2">Active</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-b hairline hover:bg-hover/40">
                <td className="px-3 py-2">
                  <button className="font-mono-num font-semibold hover:text-mdata" onClick={() => { setSymbol(a.symbol); setView("chart"); }}>{a.symbol}</button>
                </td>
                <td className="px-2 py-2 text-muted-foreground">crosses {a.cond}</td>
                <td className="px-2 py-2 text-right tnum">{a.price.toLocaleString()}</td>
                <td className="px-2 py-2 text-center">
                  <Switch checked={a.active} onCheckedChange={(v) => setAlerts((s) => s.map((x) => x.id === a.id ? { ...x, active: v } : x))} className="h-4 w-7" />
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setAlerts((s) => s.filter((x) => x.id !== a.id))} className="text-muted-foreground hover:text-neg"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
            {!alerts.length && <tr><td className="px-3 py-6 text-muted-foreground text-[11px]">No alerts configured.</td></tr>}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Research Lab ----------------------------- */

const HYPOTHESES = [
  {
    id: "h1",
    title: "NQ ORB breakouts above VWAP have positive expectancy",
    status: "potential-edge" as const,
    symbol: "NQ",
    sample: 240,
    edge: 0.18,
  },
  {
    id: "h2",
    title: "ES mean-reversion at overnight high, RTH open",
    status: "insufficient" as const,
    symbol: "ES",
    sample: 38,
    edge: 0.04,
  },
];

const HYP_TONE: Record<string, { tone: "warn" | "mdata" | "pos" | "research" | "default"; label: string }> = {
  "potential-edge": { tone: "research", label: "Potential Edge" },
  insufficient: { tone: "warn", label: "Insufficient Data" },
  "regime-dependent": { tone: "mdata", label: "Regime Dependent" },
  robust: { tone: "pos", label: "Robust" },
  overfit: { tone: "default", label: "Potentially Overfit" },
};

export function ResearchView() {
  return (
    <ViewShell title="Research Lab" icon={FlaskConical} right={<SimulatedTag />}>
      <div className="p-3 border-b hairline text-[11.5px] text-muted-foreground leading-relaxed">
        Trading is a hypothesis-testing problem. Define a hypothesis, select a dataset, run the test,
        and classify the result by evidence — never by raw profitability. The cards below are illustrative only; no historical dataset or validation artifact is attached yet.
      </div>
      <div className="overflow-y-auto scroll-thin p-3 space-y-2">
        {HYPOTHESES.map((h) => {
          const m = HYP_TONE[h.status];
          return (
            <Panel key={h.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-[12px] font-semibold">{h.symbol}</span>
                    <Pill tone={m.tone}>{m.label}</Pill>
                  </div>
                  <div className="text-[12.5px] mt-1">{h.title}</div>
                  <div className="text-[10.5px] text-muted-foreground mt-1">Sample n={h.sample} · estimated expectancy {h.edge >= 0 ? "+" : ""}{(h.edge * 100).toFixed(1)}R</div>
                </div>
                <Button size="sm" variant="outline" disabled title="Research detail requires a historical dataset and persisted validation run" className="h-7 text-[11px]">Not linked</Button>
              </div>
            </Panel>
          );
        })}
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Portfolio ----------------------------- */

const POSITIONS = [
  { symbol: "NQ", net: 2, avg: 21420, last: 21455, pnl: 1400 },
  { symbol: "ES", net: -1, avg: 6045, last: 6040, pnl: 250 },
];

export function PortfolioView() {
  const total = POSITIONS.reduce((s, p) => s + p.pnl, 0);
  return (
    <ViewShell title="Portfolio" icon={Briefcase} right={<><SimulatedTag /><Pill tone={total >= 0 ? "pos" : "neg"}>{total >= 0 ? "+" : ""}${total.toLocaleString()}</Pill></>}>
      <div className="px-3 py-2 border-b hairline text-[10.5px] text-muted-foreground">Illustrative simulation only. No broker or account position feed is connected.</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 border-b hairline">
        <Panel className="p-3"><StatRow label="Equity" value="$102,350" tone="default" /><StatRow label="Realized P&L" value="+$1,240" tone="pos" /><StatRow label="Unrealized P&L" value={`+${total.toLocaleString()}`} tone="pos" /></Panel>
        <Panel className="p-3"><StatRow label="Margin used" value="$8,400" /><StatRow label="Margin avail" value="$93,950" /><StatRow label="Exposure" value="8.2%" /></Panel>
        <Panel className="p-3"><StatRow label="Open positions" value={String(POSITIONS.length)} /><StatRow label="Strategies" value="2" /><StatRow label="Day trades" value="3" /></Panel>
      </div>
      <div className="overflow-y-auto scroll-thin flex-1">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-panel border-b hairline">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-medium px-3 py-2">Symbol</th>
              <th className="text-right font-medium px-2 py-2 tnum">Net</th>
              <th className="text-right font-medium px-2 py-2 tnum">Avg</th>
              <th className="text-right font-medium px-2 py-2 tnum">Last</th>
              <th className="text-right font-medium px-3 py-2 tnum">P&L</th>
            </tr>
          </thead>
          <tbody>
            {POSITIONS.map((p) => (
              <tr key={p.symbol} className="border-b hairline hover:bg-hover/40">
                <td className="px-3 py-2 font-mono-num font-semibold">{p.symbol}</td>
                <td className={cn("px-2 py-2 text-right tnum", p.net >= 0 ? "text-pos" : "text-neg")}>{p.net >= 0 ? "+" : ""}{p.net}</td>
                <td className="px-2 py-2 text-right tnum text-muted-foreground">{p.avg.toLocaleString()}</td>
                <td className="px-2 py-2 text-right tnum">{p.last.toLocaleString()}</td>
                <td className={cn("px-3 py-2 text-right tnum font-medium", p.pnl >= 0 ? "text-pos" : "text-neg")}>{p.pnl >= 0 ? "+" : ""}${p.pnl.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Risk ----------------------------- */

function formatQuoteAmount(value: number, currency: string) {
  const fractionDigits = Math.abs(value) < 0.01 ? 4 : 2;
  return `${currency === "USD" ? "$" : ""}${value.toLocaleString(undefined, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}${currency === "USDT" ? " USDT" : ""}`;
}

export function RiskView() {
  const { symbol } = useWorkspace();
  const c = getContract(symbol);
  const [acct, setAcct] = useState("100000");
  const [risk, setRisk] = useState("1");
  const [stop, setStop] = useState<{ symbol: string; value: string } | null>(null);
  const stopValue = stop?.symbol === symbol ? stop.value : String(c.tickSize * 8);

  const acctN = Math.max(0, Number(acct) || 0);
  const riskN = Math.max(0, Number(risk) || 0);
  const stopN = Math.max(0, Number(stopValue) || 0);
  const sizing = calculateFixedRiskSizing({
    accountEquity: acctN,
    riskPercent: riskN,
    stopDistance: stopN,
    tickSize: c.tickSize,
    multiplier: c.multiplier,
  });
  const { riskAmount, stopTicks, perUnitRisk: perContractRisk, maxQuantity: size } = sizing;
  const nativeContract = c.exchange === "GATEIO";

  return (
    <ViewShell title="Risk" icon={ShieldAlert} right={<Pill tone="warn">ILLUSTRATIVE</Pill>}>
      <div className="p-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel className="p-3">
          <PanelHeader title="Position Sizing" className="-mx-3 -mt-3 mb-2" />
          <div className="space-y-2">
            <Field label="Instrument"><div className="font-mono-num text-[12px] font-semibold">{symbol}</div></Field>
            <Field label={`Account equity (${c.currency})`}><Input value={acct} onChange={(e) => setAcct(e.target.value)} type="number" min="0" className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label="Risk per trade (%)"><Input value={risk} onChange={(e) => setRisk(e.target.value)} type="number" min="0" className="h-7 text-[12px] tnum bg-surface" /></Field>
            <Field label={`Stop distance (${c.currency} price)`}><Input value={stopValue} onChange={(e) => setStop({ symbol, value: e.target.value })} type="number" min="0" step={c.tickSize} className="h-7 text-[12px] tnum bg-surface" /></Field>
          </div>
        </Panel>
        <Panel className="p-3">
          <PanelHeader title="Calculation" className="-mx-3 -mt-3 mb-2" />
          <StatRow label={`Risk amount (${c.currency})`} value={formatQuoteAmount(riskAmount, c.currency)} tone="neg" />
          <StatRow label="Stop distance" value={`${stopTicks.toFixed(2)} ticks`} />
          <StatRow label="Per-native-contract risk" value={formatQuoteAmount(perContractRisk, c.currency)} />
          <StatRow label="Tick value" value={formatQuoteAmount(c.tickValue, c.currency)} />
          <StatRow label="Quantity multiplier" value={`${c.multiplier} ${c.currency}/price point`} />
          <div className="mt-2 pt-2 border-t hairline">
            <StatRow label="Maximum native quantity" value={`${size.toLocaleString()} contract${size === 1 ? "" : "s"}`} tone="pos" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
            {nativeContract ? "QQQX uses Gate.io native-contract terms (0.01 quantity multiplier); verify current venue specifications, fees, leverage, liquidation rules, and account currency before any order." : "Illustrative calculation based on static contract metadata only. Verify current venue specifications, fees, leverage, liquidation rules, and account currency before any order."} This is not personalized financial advice.
          </p>
        </Panel>
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Journal ----------------------------- */

interface Entry {
  id: string;
  date: string;
  symbol: string;
  side: "long" | "short";
  setup: string;
  result: number;
  note: string;
}

const SEED_ENTRIES: Entry[] = [];

export function JournalView() {
  const { symbol } = useWorkspace();
  const [entries, setEntries] = useState<Entry[]>(SEED_ENTRIES);
  const [note, setNote] = useState("");
  const add = () => {
    const trimmedNote = note.trim();
    if (!trimmedNote) return;
    setEntries((entries) => [{ id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), symbol, side: "long", setup: "Manual", result: 0, note: trimmedNote }, ...entries]);
    setNote("");
  };
  return (
    <ViewShell title="Journal" icon={NotebookPen}>
      <div className="p-3 border-b hairline flex items-center gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log an observation, setup, or mistake…" className="h-7 text-[12px] bg-surface" />
        <Button size="sm" onClick={add} className="h-7 text-[12px]"><Plus className="w-3.5 h-3.5 mr-1" />Entry</Button>
      </div>
      <div className="overflow-y-auto scroll-thin p-3 space-y-2">
        {!entries.length && <Panel className="p-4 text-[11px] text-muted-foreground">No journal entries are stored yet. Entries created here remain in this browser session until the durable journal service is released.</Panel>}
        {entries.map((e) => (
          <Panel key={e.id} className="p-3">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="tnum text-muted-foreground">{e.date}</span>
              <span className="font-mono-num font-semibold">{e.symbol}</span>
              <Pill tone={e.side === "long" ? "pos" : "neg"}>{e.side}</Pill>
              <span className="text-muted-foreground">{e.setup}</span>
              <span className={cn("ml-auto tnum font-medium", e.result >= 0 ? "text-pos" : "text-neg")}>{e.result >= 0 ? "+" : ""}${e.result}</span>
            </div>
            <p className="text-[12px] mt-1.5 text-foreground/85">{e.note}</p>
          </Panel>
        ))}
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Connections ----------------------------- */

export function ConnectionsView() {
  const { connection, setConnection } = useWorkspace();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [system, setSystem] = useState<"Rithmic Paper Trading" | "Rithmic Test">("Rithmic Paper Trading");
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function connectRithmic() {
    setConnecting(true);
    setResult(null);
    try {
      const response = await fetch("/api/connectors/rithmic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, password, system }),
      });
      const body = await response.json();
      setResult(body.message ?? body.error ?? "Rithmic connector is unavailable.");
      setConnection({ provider: "rithmic-test", environment: "paper", state: "unavailable", dataStatus: "UNAVAILABLE" });
    } catch {
      setResult("The connector request could not reach the server. No credentials were stored.");
    } finally {
      // Credentials must never survive a runtime request in the client UI.
      setPassword("");
      setConnecting(false);
    }
  }

  return (
    <ViewShell title="Connections" icon={Plug}>
      <div className="p-3 space-y-3 max-w-3xl">
        <Panel className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-surface border hairline grid place-items-center"><Radio className="w-4 h-4 text-mdata" /></div>
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="text-[13px] font-semibold">Gate.io — Public USDT Perpetual Data</span><Pill tone={connection.provider === "gateio" && connection.dataStatus === "LIVE" ? "pos" : "warn"}>{connection.dataStatus}</Pill></div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Read-only public market data · QQQX_USDT · no API key or account permission required</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="Market Data" value={connection.provider === "gateio" ? connection.dataStatus : "UNAVAILABLE"} tone={connection.dataStatus === "LIVE" ? "pos" : "warn"} />
            <Stat label="Execution" value="DISABLED" tone="muted" />
            <Stat label="Environment" value="live / read-only" />
            <Stat label="Credentials" value="Not required" tone="muted" />
          </div>
          <div className="mt-3 text-[10.5px] text-muted-foreground">This deployment is configured for live, read-only Gate.io data. Simulation mode is a server deployment setting and cannot be toggled from this client, preventing a misleading one-way state change.</div>
        </Panel>

        <Panel className="p-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[6px] bg-surface border hairline grid place-items-center"><Plug className="w-4 h-4 text-muted-foreground" /></div>
            <div className="flex-1"><div className="flex items-center gap-2"><span className="text-[13px] font-semibold">Rithmic — Runtime Connector</span><Pill tone="warn">Approval-gated</Pill></div><div className="text-[11px] text-muted-foreground mt-0.5">R | Protocol API · credentials are submitted for this request only and are never stored in the browser, database, logs, or repository.</div></div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_1fr_190px] gap-2">
            <Input value={userId} onChange={(event) => setUserId(event.target.value)} type="email" autoComplete="username" placeholder="Rithmic user ID / email" className="h-8 text-[12px] bg-surface" />
            <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Rithmic password" className="h-8 text-[12px] bg-surface" />
            <Select value={system} onValueChange={(value) => setSystem(value as typeof system)}><SelectTrigger className="h-8 text-[12px] bg-surface"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Rithmic Paper Trading">Rithmic Paper Trading</SelectItem><SelectItem value="Rithmic Test">Rithmic Test</SelectItem></SelectContent></Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button size="sm" onClick={connectRithmic} disabled={connecting || !userId || !password} className="h-7 text-[12px]">{connecting ? "Checking connector…" : "Connect Rithmic"}</Button><span className="text-[10px] text-muted-foreground">Password is cleared immediately after each request.</span></div>
          {result && <p className="mt-2 text-[11px] text-warn leading-relaxed">{result}</p>}
        </Panel>
        <div className="flex items-start gap-2 p-3 border border-warn/30 bg-warn/5 rounded-[6px]"><AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" /><p className="text-[11.5px] text-foreground/85 leading-relaxed">The secure connector form is ready, but this deployment will refuse a live Rithmic login until the official R | Protocol development kit, Rithmic Test integration, and conformance approval are installed. ZTerminal will never falsely label this connection as live. See <span className="font-mono-num text-[11px]">RITHMIC_INTEGRATION.md</span>.</p></div>
      </div>
    </ViewShell>
  );
}

/* ----------------------------- Settings ----------------------------- */

export function SettingsView() {
  const { sidebarCollapsed, setSidebar, connection } = useWorkspace();
  const [tabular, setTabular] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [confirmOrders, setConfirmOrders] = useState(true);
  const [preferredProvider, setPreferredProvider] = useState<ProviderCatalogEntry["id"]>(() => {
    if (typeof window === "undefined") return "gateio";
    const saved = window.localStorage.getItem("zterminal.preferred-provider");
    return PROVIDER_CATALOG.some((provider) => provider.id === saved) ? saved as ProviderCatalogEntry["id"] : "gateio";
  });
  const [aggregatedView, setAggregatedView] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("zterminal.preferred-provider", preferredProvider);
  }, [preferredProvider]);

  return (
    <ViewShell title="Settings" icon={SettingsIcon}>
      <div className="p-3 space-y-3 max-w-3xl overflow-y-auto scroll-thin">
        <Panel className="p-3">
          <PanelHeader title="Interface" className="-mx-3 -mt-3 mb-2" />
          <Toggle label="Collapse sidebar by default" on={sidebarCollapsed} set={(v) => setSidebar(v)} />
          <Toggle label="Tabular numerals" hint="Align financial numbers" on={tabular} set={setTabular} />
          <Toggle label="Reduce motion" on={reduceMotion} set={setReduceMotion} />
        </Panel>
        <Panel className="p-3">
          <PanelHeader title="Execution" className="-mx-3 -mt-3 mb-2" />
          <Toggle label="Confirm orders before submission" hint="Order routing is not implemented; this preference is retained for the future manual-execution workflow." on={confirmOrders} set={setConfirmOrders} />
        </Panel>
        <Panel className="p-3">
          <PanelHeader title="Market data" className="-mx-3 -mt-3 mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Preferred public-data venue">
              <Select value={preferredProvider} onValueChange={(value) => setPreferredProvider(value as ProviderCatalogEntry["id"])}>
                <SelectTrigger className="h-8 text-[12px] bg-surface"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDER_CATALOG.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.label} · {provider.streamIntegration === "active" ? "stream active" : "catalogued"}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="rounded-[5px] border hairline bg-surface px-2.5 py-2">
              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Active gateway</div>
              <div className={cn("mt-0.5 text-[12px] font-medium", connection.dataStatus === "LIVE" ? "text-pos" : "text-warn")}>{connection.provider.toUpperCase()} · {connection.dataStatus}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">The preferred venue does not replace a live stream until its adapter passes validation.</div>
            </div>
          </div>
          <div className="mt-3 border-t hairline pt-2">
            <Toggle label="Aggregated market view" hint="Disabled until equivalent instrument mappings, freshness checks, and contributor disclosure pass validation. Venue-specific depth, funding, OI, and liquidations will not be averaged." on={aggregatedView} set={setAggregatedView} disabled />
          </div>
          <div className="mt-3 space-y-2">
            {PROVIDER_CATALOG.map((provider) => <ProviderCapabilityCard key={provider.id} provider={provider} active={connection.provider === provider.id} preferred={preferredProvider === provider.id} />)}
          </div>
          <div className="mt-3 pt-2 border-t hairline text-[10.5px] text-muted-foreground">All timestamps are normalized to UTC internally. Session display is currently America/New_York. Public data access requests no account, trading, or withdrawal credentials.</div>
        </Panel>
      </div>
    </ViewShell>
  );
}

/* ----------------------------- shared shell ----------------------------- */

function ProviderCapabilityCard({ provider, active, preferred }: { provider: ProviderCatalogEntry; active: boolean; preferred: boolean }) {
  return (
    <div className={cn("rounded-[5px] border hairline bg-surface p-2.5", preferred && "border-mdata/50")}>
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold">{provider.label}</span>
        {active && <Pill tone="pos">ACTIVE</Pill>}
        {preferred && <Pill tone="mdata">PREFERRED</Pill>}
        <Pill tone={provider.streamIntegration === "active" ? "pos" : "warn"} className="ml-auto">{provider.streamIntegration === "active" ? "stream active" : "catalogued"}</Pill>
      </div>
      <div className="mt-1 text-[10.5px] text-muted-foreground leading-relaxed">{provider.notice}</div>
      <div className="mt-2 flex flex-wrap gap-1">{provider.capabilities.map((capability) => <span key={capability} className="rounded border hairline px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{capability.replaceAll("_", " ")}</span>)}</div>
      <div className="mt-2 text-[9.5px] text-muted-foreground">Example mapping: {provider.canonicalExample} → {provider.nativeExample} · aggregation: {provider.aggregation.replaceAll("-", " ")}</div>
    </div>
  );
}

function ViewShell({ title, icon: Icon, right, children }: { title: string; icon: React.ComponentType<{ className?: string }>; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="h-10 border-b hairline bg-panel flex items-center gap-2 px-3">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</span>
        {right && <div className="ml-auto flex items-center gap-1.5">{right}</div>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, hint, on, set, disabled = false }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1.5", disabled && "opacity-70")}>
      <div>
        <div className="text-[12.5px]">{label}</div>
        {hint && <div className="text-[10.5px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={on} onCheckedChange={set} disabled={disabled} className="h-4 w-7" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "muted" | "pos" }) {
  const cls = tone === "warn" ? "text-warn" : tone === "muted" ? "text-muted-foreground" : tone === "pos" ? "text-pos" : "text-foreground";
  return (
    <div className="border hairline rounded-[5px] p-2 bg-surface">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-[12px] tnum font-medium mt-0.5", cls)}>{value}</div>
    </div>
  );
}
