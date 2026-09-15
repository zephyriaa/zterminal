"use client";

import React, { useState, useEffect, useRef } from "react";
import { MaskedHeading, FadeInView, ScaleReveal } from "./motion-primitives";
import { Zap, Play, Activity } from "lucide-react";
import styles from "./order-flow-engine.module.css";

interface DomLevel {
  price: number;
  size: number;
  total: number;
  depthPct: number;
}

interface TapePrint {
  id: string;
  time: string;
  price: number;
  size: number;
  side: "BUY" | "SELL";
}

const INITIAL_ASKS: DomLevel[] = [
  { price: 79432.5, size: 8.42, total: 38.12, depthPct: 78 },
  { price: 79430.0, size: 5.18, total: 29.70, depthPct: 61 },
  { price: 79427.5, size: 12.35, total: 24.52, depthPct: 92 },
  { price: 79425.0, size: 4.80, total: 12.17, depthPct: 45 },
  { price: 79422.5, size: 7.37, total: 7.37, depthPct: 56 },
];

const INITIAL_BIDS: DomLevel[] = [
  { price: 79420.0, size: 9.15, total: 9.15, depthPct: 68 },
  { price: 79417.5, size: 14.80, total: 23.95, depthPct: 95 },
  { price: 79415.0, size: 6.22, total: 30.17, depthPct: 52 },
  { price: 79412.5, size: 11.45, total: 41.62, depthPct: 86 },
  { price: 79410.0, size: 18.90, total: 60.52, depthPct: 100 },
];

const INITIAL_TAPE: TapePrint[] = [
  { id: "1", time: "18:24:02.842", price: 79421.5, size: 1.45, side: "BUY" },
  { id: "2", time: "18:24:02.610", price: 79421.0, size: 0.82, side: "BUY" },
  { id: "3", time: "18:24:02.195", price: 79420.5, size: 2.10, side: "SELL" },
  { id: "4", time: "18:24:01.884", price: 79421.0, size: 0.45, side: "BUY" },
  { id: "5", time: "18:24:01.420", price: 79420.5, size: 3.85, side: "SELL" },
  { id: "6", time: "18:24:00.915", price: 79420.5, size: 1.20, side: "BUY" },
];

export function OrderFlowEngine() {
  const [mode, setMode] = useState<"dom" | "tape" | "cvd">("dom");
  const [asks, setAsks] = useState<DomLevel[]>(INITIAL_ASKS);
  const [bids, setBids] = useState<DomLevel[]>(INITIAL_BIDS);
  const [tape, setTape] = useState<TapePrint[]>(INITIAL_TAPE);
  const [currentPrice, setCurrentPrice] = useState(79421.5);
  const [isSweeping, setIsSweeping] = useState(false);
  const [sweepAlert, setSweepAlert] = useState<string | null>(null);
  const [cvdScore, setCvdScore] = useState("+2.4σ (ABSORPTION)");

  // Live micro-tick generator simulating real-time order book flux
  useEffect(() => {
    const interval = setInterval(() => {
      // Subtle organic volume adjustments
      setAsks((prev) =>
        prev.map((ask) => {
          const delta = (Math.random() - 0.48) * 0.4;
          const nextSize = Math.max(1.2, Number((ask.size + delta).toFixed(2)));
          return { ...ask, size: nextSize, depthPct: Math.min(100, Math.round((nextSize / 15) * 100)) };
        })
      );

      setBids((prev) =>
        prev.map((bid) => {
          const delta = (Math.random() - 0.48) * 0.4;
          const nextSize = Math.max(1.5, Number((bid.size + delta).toFixed(2)));
          return { ...bid, size: nextSize, depthPct: Math.min(100, Math.round((nextSize / 18) * 100)) };
        })
      );

      // Random trade print additions
      if (Math.random() > 0.4) {
        const side: "BUY" | "SELL" = Math.random() > 0.42 ? "BUY" : "SELL";
        const tradePrice = side === "BUY" ? 79422.5 : 79420.0;
        const tradeSize = Number((0.2 + Math.random() * 2.8).toFixed(2));
        const now = new Date();
        const timeStr = `${now.toTimeString().split(" ")[0]}.${Math.floor(Math.random() * 900 + 100)}`;

        setTape((prev) => [
          {
            id: Math.random().toString(36).slice(2, 8),
            time: timeStr,
            price: tradePrice,
            size: tradeSize,
            side,
          },
          ...prev.slice(0, 7),
        ]);

        setCurrentPrice(tradePrice);
      }
    }, 750);

    return () => clearInterval(interval);
  }, []);

  // Trigger high-impact simulated institutional liquidity sweep
  const handleTriggerSweep = () => {
    setIsSweeping(true);
    setSweepAlert("INSTITUTIONAL SWEEP DETECTED · 48.6 BTC MARKET BUY SWEPT 3 RESTING ASK LEVELS");
    setCvdScore("+3.8σ (AGGRESSIVE ABSORPTION)");

    // Simulate aggressive fill
    setCurrentPrice(79430.0);
    const now = new Date();
    const timeStr = `${now.toTimeString().split(" ")[0]}.${Math.floor(Math.random() * 900 + 100)}`;

    setTape((prev) => [
      { id: "sweep-1", time: timeStr, price: 79430.0, size: 24.8, side: "BUY" },
      { id: "sweep-2", time: timeStr, price: 79427.5, size: 14.5, side: "BUY" },
      { id: "sweep-3", time: timeStr, price: 79425.0, size: 9.3, side: "BUY" },
      ...prev.slice(0, 5),
    ]);

    // Restore steady-state after 3.2s
    setTimeout(() => {
      setIsSweeping(false);
      setSweepAlert(null);
      setCvdScore("+2.4σ (ABSORPTION)");
    }, 3200);
  };

  return (
    <section className={styles.section} id="microstructure" aria-labelledby="microstructure-title">
      <div className={styles.sectionHeaderCentered}>
        <p className={styles.eyebrow}>04 / REAL-TIME MICROSTRUCTURE ENGINE</p>
        <MaskedHeading
          as="h2"
          id="microstructure-title"
          className={styles.sectionHeading}
          lines={[
            { text: "Live Level-2 Order Flow." },
            { text: "Zero Cloud Telemetry.", italic: true },
          ]}
        />
        <FadeInView delay={0.04} yOffset={12}>
          <p className={styles.sectionLead}>
            Retail charts guess what happened in the past. ZTerminal streams raw limit order book depth, aggressive market delta, and resting absorption walls at 60 FPS straight from exchange matching engines.
          </p>
        </FadeInView>
      </div>

      {/* Prominent Foreground Live Workstation Engine */}
      <div className={styles.stageWrapper}>
        <ScaleReveal className={styles.engineFrame} delay={0.06}>
          {/* Top Window Chrome */}
          <div className={styles.chromeBar}>
            <div className={styles.chromeLeft}>
              <div className={styles.dots} aria-hidden="true">
                <span className={`${styles.dot} ${styles.dotRed}`} />
                <span className={`${styles.dot} ${styles.dotYellow}`} />
                <span className={`${styles.dot} ${styles.dotGreen}`} />
              </div>
              <span className={styles.tabLabel}>BTC/USDT PERPETUAL · LEVEL-2 ORDER BOOK DOM · 60 FPS WEBGL</span>
            </div>

            <div className={styles.chromeRight}>
              <div className={styles.modeSwitch}>
                <button
                  type="button"
                  onClick={() => setMode("dom")}
                  className={`${styles.modeButton} ${mode === "dom" ? styles.modeButtonActive : ""}`}
                >
                  DEPTH LADDER
                </button>
                <button
                  type="button"
                  onClick={() => setMode("tape")}
                  className={`${styles.modeButton} ${mode === "tape" ? styles.modeButtonActive : ""}`}
                >
                  LIVE TAPE
                </button>
                <button
                  type="button"
                  onClick={() => setMode("cvd")}
                  className={`${styles.modeButton} ${mode === "cvd" ? styles.modeButtonActive : ""}`}
                >
                  CVD METRICS
                </button>
              </div>

              <div className={styles.liveChip}>
                <span className={styles.pulseDot} aria-hidden="true" />
                <span className={styles.liveBadge}>LIVE L2 STREAM</span>
              </div>
            </div>
          </div>

          {/* Interactive Microstructure Grid */}
          <div className={styles.workspaceGrid}>
            {/* Left Column: DOM Depth Ladder */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>ORDER BOOK DEPTH (RESTING LIMIT LIQUIDITY)</span>
                <button
                  type="button"
                  onClick={handleTriggerSweep}
                  disabled={isSweeping}
                  className={styles.panelAction}
                >
                  <Zap className="w-3 h-3 text-accent" />
                  {isSweeping ? "SWEEPING..." : "SIMULATE SWEEP"}
                </button>
              </div>

              <div className={styles.domTable} role="table" aria-label="Level 2 DOM ladder">
                {/* Asks (Sells) */}
                {asks.map((ask) => (
                  <div key={ask.price} className={`${styles.domRow} ${styles.askRow}`}>
                    <div className={styles.depthFillAsk} style={{ width: `${ask.depthPct}%` }} />
                    <span className={styles.priceAsk}>{ask.price.toFixed(1)}</span>
                    <span className={styles.volumeBarCell}>{ask.size.toFixed(2)} BTC</span>
                    <span className={styles.totalCell}>{ask.total.toFixed(1)}</span>
                  </div>
                ))}

                {/* Mid-Market Price Indicator */}
                <div className={styles.midMarketBar}>
                  <div className={styles.currentPrice}>
                    <span>${currentPrice.toFixed(1)}</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  </div>
                  <span className={styles.spreadTag}>SPREAD: 2.50 USDT (0.003%)</span>
                </div>

                {/* Bids (Buys) */}
                {bids.map((bid) => (
                  <div key={bid.price} className={`${styles.domRow} ${styles.bidRow}`}>
                    <div className={styles.depthFillBid} style={{ width: `${bid.depthPct}%` }} />
                    <span className={styles.priceBid}>{bid.price.toFixed(1)}</span>
                    <span className={styles.volumeBarCell}>{bid.size.toFixed(2)} BTC</span>
                    <span className={styles.totalCell}>{bid.total.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Real-Time Tape & CVD Microstructure */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>AGGRESSIVE TIME &amp; SALES TAPE (CVD: {cvdScore})</span>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <Play className="w-2.5 h-2.5 fill-current" />
                  FLOW ACTIVE
                </span>
              </div>

              <div className={styles.tapeStream}>
                <div className="grid grid-cols-4 text-[9px] font-mono text-muted-foreground pb-1 border-b border-border/40 uppercase">
                  <span>Timestamp</span>
                  <span>Price</span>
                  <span>Size (BTC)</span>
                  <span className="text-right">Side</span>
                </div>
                {tape.map((t) => (
                  <div key={t.id} className={styles.tapeRow}>
                    <span className={styles.tapeTime}>{t.time}</span>
                    <span className={`${styles.tapePrice} ${t.side === "BUY" ? "text-emerald-400" : "text-rose-400"}`}>
                      {t.price.toFixed(1)}
                    </span>
                    <span className={styles.tapeSize}>{t.size.toFixed(2)}</span>
                    <span className={t.side === "BUY" ? styles.tapeSideBuy : styles.tapeSideSell}>
                      {t.side}
                    </span>
                  </div>
                ))}
              </div>

              {/* Dynamic Sweep Notification Badge */}
              {sweepAlert && (
                <div className={styles.sweepAlert}>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{sweepAlert}</span>
                  </div>
                  <span className="text-[9px] bg-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                    DETECTED
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Telemetry Status Bar */}
          <div className={styles.statusBar}>
            <span>ENGINE LATENCY: <span className={styles.statusTag}>0.38MS</span></span>
            <span>THROUGHPUT: <span className={styles.statusTag}>42,800 TICKS/SEC</span></span>
            <span>CUSTODY: <span className={styles.statusTag}>100% LOCAL WORKSTATION</span></span>
            <span>FEED STATUS: <span className={styles.statusTag}>DIRECT L2 WEBSOCKET</span></span>
          </div>
        </ScaleReveal>
      </div>
    </section>
  );
}
