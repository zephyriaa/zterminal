"use client";

import { useState } from "react";
import { useResearch } from "@/stores/research";
import { intervalMs } from "@/lib/local-research/dataset";
import { BarChart2, Calendar, CheckCircle2, ChevronRight, Clock, DollarSign, Layers, Shield, Sliders, TrendingUp } from "lucide-react";

export function ResearchInspector({
  paramsText,
  setParamsText,
  paramsError,
  setParamsError,
}: {
  paramsText: string;
  setParamsText: (value: string) => void;
  paramsError: string;
  setParamsError: (value: string) => void;
}) {
  const state = useResearch();
  const script = state.drafts[state.activeId];
  const [activeTab, setActiveTab] = useState<"market" | "sizing" | "friction" | "params">("market");

  const period = (days: number) => {
    const interval = intervalMs(state.config.timeframe);
    const to = Math.floor(Date.now() / interval) * interval;
    state.configure({ from: to - days * 86400000, to });
  };

  const timeframes = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];

  return (
    <aside className="zt-studio-inspector" aria-label="Strategy Inspector & Parameters">
      {/* Inspector Tab Bar */}
      <nav className="zt-inspector-tabs" aria-label="Configuration categories">
        <button
          type="button"
          onClick={() => setActiveTab("market")}
          className={activeTab === "market" ? "is-active" : ""}
        >
          <BarChart2 size={12} /> Market
        </button>
        {script?.kind !== "indicator" && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("sizing")}
              className={activeTab === "sizing" ? "is-active" : ""}
            >
              <TrendingUp size={12} /> Sizing & Exit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("friction")}
              className={activeTab === "friction" ? "is-active" : ""}
            >
              <Shield size={12} /> Execution
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setActiveTab("params")}
          className={activeTab === "params" ? "is-active" : ""}
        >
          <Sliders size={12} /> Params
        </button>
      </nav>

      {/* Tab 1: Market & Dataset */}
      {activeTab === "market" && (
        <div className="zt-inspector-content space-y-4">
          <div className="zt-inspector-section">
            <span className="zt-section-label">Dataset & Venue</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="zt-field">
                <span>Provider</span>
                <select
                  value={state.config.provider}
                  onChange={e =>
                    state.configure({
                      provider: e.target.value as "gateio" | "binance",
                      symbol: e.target.value === "gateio" ? "BTC_USDT" : "BTCUSDT",
                    })
                  }
                >
                  <option value="gateio">Gate.io</option>
                  <option value="binance">Binance USDⓈ-M</option>
                </select>
              </label>

              <label className="zt-field">
                <span>Native Symbol</span>
                <input
                  value={state.config.symbol}
                  onChange={e => state.configure({ symbol: e.target.value.toUpperCase() })}
                  className="font-mono"
                  placeholder="BTCUSDT"
                />
              </label>
            </div>
          </div>

          <div className="zt-inspector-section">
            <span className="zt-section-label">Timeframe</span>
            <div className="zt-pill-group mt-2">
              {timeframes.map(tf => (
                <button
                  type="button"
                  key={tf}
                  className={`zt-pill-item ${state.config.timeframe === tf ? "is-active" : ""}`}
                  onClick={() => {
                    const interval = intervalMs(tf);
                    state.configure({
                      timeframe: tf,
                      from: Math.floor(state.config.from / interval) * interval,
                      to: Math.floor(state.config.to / interval) * interval,
                    });
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="zt-inspector-section">
            <div className="flex items-center justify-between">
              <span className="zt-section-label">Historical Window (UTC)</span>
              <span className="text-[10px] font-mono text-[#9ca3af]">
                {Math.round((state.config.to - state.config.from) / 86400000)} days
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="zt-field">
                <span>Start</span>
                <input
                  type="datetime-local"
                  value={new Date(state.config.from).toISOString().slice(0, 16)}
                  onChange={e => {
                    const from = Date.parse(`${e.target.value}Z`);
                    if (Number.isFinite(from)) state.configure({ from });
                  }}
                />
              </label>
              <label className="zt-field">
                <span>End (Exclusive)</span>
                <input
                  type="datetime-local"
                  value={new Date(state.config.to).toISOString().slice(0, 16)}
                  onChange={e => {
                    const to = Date.parse(`${e.target.value}Z`);
                    if (Number.isFinite(to)) state.configure({ to });
                  }}
                />
              </label>
            </div>

            <div className="flex gap-1.5 mt-2">
              <button type="button" className="zt-quick-btn" onClick={() => period(30)}>30d</button>
              <button type="button" className="zt-quick-btn" onClick={() => period(90)}>90d</button>
              <button type="button" className="zt-quick-btn" onClick={() => period(180)}>180d</button>
              <button type="button" className="zt-quick-btn" onClick={() => period(365)}>1 Year</button>
              <button type="button" className="zt-quick-btn" onClick={() => period(730)}>2 Years</button>
            </div>
          </div>

          <div className="zt-inspector-section">
            <span className="zt-section-label">Starting Capital</span>
            <div className="mt-2">
              <label className="zt-field">
                <span>Quote Currency Balance</span>
                <input
                  type="number"
                  min={1}
                  value={state.config.initialCapital}
                  onChange={e => state.configure({ initialCapital: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
            </div>
          </div>

          {/* Instrument units verification */}
          <div className="zt-instrument-card">
            <div className="flex items-center justify-between text-xs font-medium text-white mb-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={12} className={state.instrument ? "text-[#34d399]" : "text-[#9ca3af]"} />
                Instrument Contract
              </span>
              <button
                type="button"
                onClick={() => state.verifyInstrument()}
                className="text-[10px] text-[#a78bfa] hover:text-[#c4b5fd] hover:underline"
              >
                Re-verify
              </button>
            </div>
            {state.instrument ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-[#9ca3af] mt-2 pt-2 border-t border-[#232738]">
                <div>Tick: <span className="text-white">{state.instrument.tickSize}</span></div>
                <div>Step: <span className="text-white">{state.instrument.quantityStep}</span></div>
                <div>Min Qty: <span className="text-white">{state.instrument.minimumQuantity}</span></div>
                <div>Min Notional: <span className="text-white">{state.instrument.minimumNotional}</span></div>
              </div>
            ) : (
              <p className="text-[10px] text-[#9ca3af] mt-1">Unverified units. Click re-verify to fetch exchange metadata.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Sizing & Brackets */}
      {activeTab === "sizing" && (
        <div className="zt-inspector-content space-y-4">
          <div className="zt-inspector-section">
            <span className="zt-section-label">Position Sizing & Direction</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="zt-field">
                <span>Direction</span>
                <select
                  value={state.config.direction}
                  onChange={e => state.configure({ direction: e.target.value as "long" | "both" })}
                >
                  <option value="long">Long Only</option>
                  <option value="both">Long & Short</option>
                </select>
              </label>

              <label className="zt-field">
                <span>Allocation</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.01"
                  max="1.0"
                  value={state.config.allocation}
                  onChange={e => state.configure({ allocation: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
            </div>
          </div>

          <div className="zt-inspector-section">
            <span className="zt-section-label">Intrabar Brackets & Limits</span>
            <p className="text-[11px] text-[#9ca3af] mt-1 mb-2 leading-relaxed">
              When <code>strategy.stop_loss</code> or <code>take_profit</code> are returned by the strategy, intrabar high/low are evaluated with pessimistic tie-breaking.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="zt-field">
                <span>Warm-up Bars</span>
                <input
                  type="number"
                  value={state.config.warmupBars}
                  onChange={e => state.configure({ warmupBars: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
              <label className="zt-field">
                <span>Execution Delay</span>
                <input
                  type="number"
                  value={state.config.executionDelayBars}
                  onChange={e => state.configure({ executionDelayBars: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
            </div>
          </div>

          <div className="zt-inspector-section">
            <span className="zt-section-label">Institutional Helpers</span>
            <div className="p-3 bg-[#131622] rounded border border-[#232738] text-[11px] text-[#9ca3af] space-y-2 mt-2">
              <div className="font-mono text-white text-[10px]">zt.atr_volatility_size(data, stop_loss_pts, risk_dollar)</div>
              <p>Computes risk-budgeted contract lots using ATR volatility target.</p>
              <div className="font-mono text-white text-[10px] pt-1">zt.Strategy(..., max_hold_bars=15, cooldown_bars=30)</div>
              <p>Enforces maximum bar holding time and post-exit cooldown lockout.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Execution & Friction */}
      {activeTab === "friction" && (
        <div className="zt-inspector-content space-y-4">
          <div className="zt-inspector-section">
            <span className="zt-section-label">Fee & Slippage Drag</span>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <label className="zt-field">
                <span>Fee (bps)</span>
                <input
                  type="number"
                  step="any"
                  value={state.config.feeBps}
                  onChange={e => state.configure({ feeBps: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
              <label className="zt-field">
                <span>Slippage (bps)</span>
                <input
                  type="number"
                  step="any"
                  value={state.config.slippageBps}
                  onChange={e => state.configure({ slippageBps: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
              <label className="zt-field">
                <span>Spread (bps)</span>
                <input
                  type="number"
                  step="any"
                  value={state.config.spreadBps}
                  onChange={e => state.configure({ spreadBps: Number(e.target.value) })}
                  className="font-mono"
                />
              </label>
            </div>
          </div>

          <div className="zt-inspector-section">
            <span className="zt-section-label">Validation & Out-of-Sample Holdout</span>
            <div className="space-y-2 mt-2">
              <label className="flex items-center gap-2 text-xs text-[#e5e7eb] cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.config.reserveHoldout ?? false}
                  onChange={e =>
                    state.configure({
                      reserveHoldout: e.target.checked,
                      executionModel: "synthetic_next_open_v2",
                    })
                  }
                  className="rounded border-[#374151] bg-[#161a26]"
                />
                Reserve Out-of-Sample Holdout
              </label>

              <label className="zt-field">
                <span>Holdout Split Ratio</span>
                <select
                  value={state.config.holdoutSplitRatio ?? 0.20}
                  onChange={e =>
                    state.configure({
                      holdoutSplitRatio: Number(e.target.value),
                      reserveHoldout: true,
                      executionModel: "synthetic_next_open_v2",
                    })
                  }
                >
                  <option value={0.10}>90% In-Sample / 10% Holdout</option>
                  <option value={0.20}>80% In-Sample / 20% Holdout</option>
                  <option value={0.25}>75% In-Sample / 25% Holdout</option>
                  <option value={0.30}>70% In-Sample / 30% Holdout</option>
                </select>
              </label>
            </div>
          </div>

          <div className="zt-inspector-section">
            <span className="zt-section-label">Trading Session Regime</span>
            <div className="mt-2">
              <label className="zt-field">
                <span>Session Filter</span>
                <select
                  value={state.config.sessionPreset ?? "24/7"}
                  onChange={e => state.configure({ sessionPreset: e.target.value as any })}
                >
                  <option value="24/7">24/7 Crypto Continuous</option>
                  <option value="us_equities_rth">US Equities RTH (09:30–16:00 ET)</option>
                  <option value="cme_globex">CME Globex (18:00–17:00 CT)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="zt-inspector-section">
            <label className="zt-field">
              <span>Strategy Seed</span>
              <input
                type="number"
                value={state.config.strategySeed}
                onChange={e => state.configure({ strategySeed: Number(e.target.value) })}
                className="font-mono"
              />
            </label>
          </div>
        </div>
      )}

      {/* Tab 4: Parameters JSON */}
      {activeTab === "params" && (
        <div className="zt-inspector-content space-y-4">
          <div className="zt-inspector-section">
            <div className="flex items-center justify-between mb-1">
              <span className="zt-section-label">Strategy Parameters (JSON)</span>
              <button
                type="button"
                onClick={() => {
                  setParamsText(JSON.stringify(state.params, null, 2));
                  setParamsError("");
                }}
                className="text-[10px] text-[#a78bfa] hover:underline"
              >
                Format
              </button>
            </div>
            <textarea
              value={paramsText}
              spellCheck={false}
              rows={8}
              onChange={e => setParamsText(e.target.value)}
              onBlur={() => {
                try {
                  const parsed = JSON.parse(paramsText);
                  if (
                    !parsed ||
                    Array.isArray(parsed) ||
                    typeof parsed !== "object" ||
                    Object.entries(parsed).some(
                      ([key, value]) =>
                        key.length > 80 ||
                        !["string", "number", "boolean"].includes(typeof value) ||
                        (typeof value === "number" && !Number.isFinite(value))
                    )
                  ) {
                    throw new Error("Use a JSON object with finite number, string, or boolean values.");
                  }
                  useResearch.setState({ params: parsed });
                  setParamsError("");
                } catch (error) {
                  setParamsError((error as Error).message);
                }
              }}
              className="zt-params-textarea w-full bg-[#11141f] border border-[#2b3147] rounded p-2.5 font-mono text-xs text-[#e2e8f0] focus:outline-none focus:border-[#8b5cf6]"
            />
            {paramsError && (
              <p role="alert" className="text-xs text-red-400 mt-1 leading-relaxed">
                {paramsError} The last valid parameters remain active.
              </p>
            )}
          </div>

          <div className="p-3 bg-[#131622] rounded border border-[#232738] text-[11px] text-[#9ca3af] leading-relaxed">
            {script?.kind === "indicator"
              ? "Calculations retain source, parameter, dataset, input, result, helper, and engine hashes."
              : "Next-open vectorized execution. Signals at candle close fill at the next eligible open with configured fee and slippage friction."}
          </div>
        </div>
      )}
    </aside>
  );
}
