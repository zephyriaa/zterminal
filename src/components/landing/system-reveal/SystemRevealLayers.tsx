"use client";

import React from "react";
import Image from "next/image";
import {
  Braces,
  Database,
  Layers,
  Activity,
  ShieldCheck,
  TrendingUp,
  Cpu,
  Check,
} from "lucide-react";
import styles from "./system-reveal.module.css";

/* -------------------------------------------------------------------------- */
/* 01. Central Workstation Anchor                                             */
/* -------------------------------------------------------------------------- */
export function CentralWorkstation({
  style,
  isStatic = false,
}: {
  style?: React.CSSProperties;
  isStatic?: boolean;
}) {
  return (
    <div
      className={styles.centralWorkstation}
      style={style}
      data-testid="central-workstation"
    >
      <div className={styles.chassisFrame}>
        <div className={styles.screenGlassSheen} aria-hidden="true" />
        <div className={styles.telemetryChrome}>
          <div className={styles.trafficLights}>
            <i />
            <i />
            <i />
          </div>
          <div>
            <span style={{ color: "#ffffff", fontWeight: 600 }}>ZT / BTC·USDT</span>
            <span style={{ color: "rgba(255,255,255,0.35)", margin: "0 6px" }}>·</span>
            <span>5M WORKSPACE</span>
          </div>
          <div className={styles.statusPill}>
            <i /> LIVE CONTEXT
          </div>
        </div>

        <div className={styles.screenBody}>
          <Image
            src="/landing/terminal-screenshot.webp"
            alt="ZTerminal institutional quantitative research chart showing candlestick price action, order flow, and volume profile"
            width={1600}
            height={900}
            priority
            sizes="(max-width: 900px) 95vw, 65vw"
            className={styles.screenImage}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 02. Microstructure & Order Flow Layer                                      */
/* -------------------------------------------------------------------------- */
export function MicrostructureLayer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  const bids = [
    { price: "64,280", size: "48.2", width: 88 },
    { price: "64,270", size: "36.5", width: 66 },
    { price: "64,260", size: "29.1", width: 52 },
    { price: "64,250", size: "54.8", width: 94 },
  ];
  const asks = [
    { price: "64,290", size: "32.4", width: 58 },
    { price: "64,300", size: "41.0", width: 74 },
    { price: "64,310", size: "62.3", width: 98 },
    { price: "64,320", size: "18.7", width: 34 },
  ];

  return (
    <div
      className={`${styles.explodedLayer} ${styles.microstructureLayer}`}
      style={style}
      data-testid="layer-microstructure"
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerHeaderTag}>
          <Layers size={12} />
          <span>ORDER FLOW / DEPTH</span>
        </div>
        <span style={{ color: "#34d399", fontSize: 9 }}>L2 DELTAS</span>
      </div>

      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Big Trades Callout */}
        <div
          style={{
            padding: "6px 10px",
            borderRadius: "6px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: 11,
          }}
        >
          <span style={{ color: "#a7f3d0" }}>BIG TRADES</span>
          <b style={{ color: "#34d399" }}>+84.2 BTC @ 64,280</b>
        </div>

        {/* Order Book Depth Bars */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10 }}>
          {asks.slice().reverse().map((ask) => (
            <div key={ask.price} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", height: "16px" }}>
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${ask.width}%`,
                  background: "rgba(244, 63, 94, 0.14)",
                  borderRadius: "2px",
                }}
              />
              <span style={{ color: "#fda4af", zIndex: 1, paddingLeft: 4 }}>{ask.price}</span>
              <span style={{ color: "#8b9bb4", zIndex: 1, paddingRight: 4 }}>{ask.size}</span>
            </div>
          ))}
          <div style={{ height: "1px", background: "rgba(255,255,255,0.12)", margin: "2px 0" }} />
          {bids.map((bid) => (
            <div key={bid.price} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", height: "16px" }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${bid.width}%`,
                  background: "rgba(16, 185, 129, 0.16)",
                  borderRadius: "2px",
                }}
              />
              <span style={{ color: "#6ee7b7", zIndex: 1, paddingLeft: 4 }}>{bid.price}</span>
              <span style={{ color: "#8b9bb4", zIndex: 1, paddingRight: 4 }}>{bid.size}</span>
            </div>
          ))}
        </div>

        {/* CVD Mini Trace */}
        <div style={{ paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)", color: "#8b9bb4", marginBottom: 4 }}>
            <span>CUMULATIVE DELTA</span>
            <span style={{ color: "#38bdf8" }}>+248.5 Δ</span>
          </div>
          <svg viewBox="0 0 280 40" preserveAspectRatio="none" style={{ width: "100%", height: 36 }} aria-hidden="true">
            <path
              d="M0 32 Q 40 28, 70 34 T 140 18 T 210 22 T 280 8"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 03. Python Strategy Code Editor Layer                                      */
/* -------------------------------------------------------------------------- */
export function StrategyCodeLayer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${styles.explodedLayer} ${styles.codeLayer}`}
      style={style}
      data-testid="layer-strategy-code"
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerHeaderTag}>
          <Braces size={12} />
          <span>PYTHON STRATEGY / RUNTIME</span>
        </div>
        <span style={{ color: "#a78bfa", fontSize: 9 }}>momentum_retest.py</span>
      </div>

      <div
        style={{
          padding: "12px 14px",
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 11,
          lineHeight: 1.65,
          color: "#e2e8f0",
        }}
      >
        <div style={{ color: "#64748b" }}># Canonical ZTerminal Quant Runtime</div>
        <div>
          <span style={{ color: "#c084fc" }}>import</span>{" "}
          <span style={{ color: "#93c5fd" }}>zt.market</span>{" "}
          <span style={{ color: "#c084fc" }}>as</span>{" "}
          <span style={{ color: "#f1f5f9" }}>market</span>
        </div>
        <div>
          <span style={{ color: "#c084fc" }}>import</span>{" "}
          <span style={{ color: "#93c5fd" }}>zt.orderflow</span>{" "}
          <span style={{ color: "#c084fc" }}>as</span>{" "}
          <span style={{ color: "#f1f5f9" }}>of</span>
        </div>
        <br />
        <div>
          <span style={{ color: "#38bdf8" }}>@strategy</span>
          <span style={{ color: "#94a3b8" }}>.register(</span>
          <span style={{ color: "#34d399" }}>&quot;vpoc_reclaim_v2&quot;</span>
          <span style={{ color: "#94a3b8" }}>)</span>
        </div>
        <div>
          <span style={{ color: "#c084fc" }}>def</span>{" "}
          <span style={{ color: "#fcd34d" }}>evaluate</span>
          <span style={{ color: "#94a3b8" }}>(bar, depth):</span>
        </div>
        <div style={{ paddingLeft: "16px" }}>
          <span style={{ color: "#c084fc" }}>if</span>{" "}
          <span style={{ color: "#f1f5f9" }}>of.absorbed(depth.bid)</span>{" "}
          <span style={{ color: "#c084fc" }}>and</span>{" "}
          <span style={{ color: "#f1f5f9" }}>bar.close &gt; of.vpoc:</span>
        </div>
        <div style={{ paddingLeft: "32px" }}>
          <span style={{ color: "#c084fc" }}>return</span>{" "}
          <span style={{ color: "#f1f5f9" }}>market.order(</span>
          <span style={{ color: "#34d399" }}>&quot;BUY&quot;</span>
          <span style={{ color: "#94a3b8" }}>, size=1.0)</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 04. Dataset Manifest & Lineage Layer                                       */
/* -------------------------------------------------------------------------- */
export function DatasetManifestLayer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${styles.explodedLayer} ${styles.datasetLayer}`}
      style={style}
      data-testid="layer-dataset-manifest"
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerHeaderTag}>
          <Database size={12} />
          <span>DATASET MANIFEST V3</span>
        </div>
        <span style={{ color: "#10b981", fontSize: 9 }}>IMMUTABLE PARQUET</span>
      </div>

      <div
        style={{
          padding: "10px 14px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "8px",
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 10,
        }}
      >
        <div>
          <div style={{ color: "#8b9bb4" }}>SOURCE HASH</div>
          <div style={{ color: "#f1f5f9", fontWeight: 600 }}>sha256:8f4e2b</div>
        </div>
        <div>
          <div style={{ color: "#8b9bb4" }}>EXCHANGES</div>
          <div style={{ color: "#f1f5f9", fontWeight: 600 }}>Gate.io · Binance</div>
        </div>
        <div>
          <div style={{ color: "#8b9bb4" }}>QUALITY</div>
          <div style={{ color: "#34d399", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}>
            <Check size={11} /> 0 Gaps Verified
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 05. Backtest Engine & Performance Layer                                    */
/* -------------------------------------------------------------------------- */
export function BacktestEngineLayer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${styles.explodedLayer} ${styles.backtestLayer}`}
      style={style}
      data-testid="layer-backtest-engine"
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerHeaderTag}>
          <TrendingUp size={12} />
          <span>BACKTEST EXECUTION ENGINE</span>
        </div>
        <span style={{ color: "#a855f7", fontSize: 9 }}>EXPERIMENT #042</span>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px",
            marginBottom: "12px",
            fontFamily: "var(--font-geist-mono, monospace)",
          }}
        >
          <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
            <div style={{ color: "#8b9bb4", fontSize: 9 }}>SHARPE</div>
            <b style={{ color: "#34d399", fontSize: 13 }}>2.14</b>
          </div>
          <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
            <div style={{ color: "#8b9bb4", fontSize: 9 }}>MAX DRAWDOWN</div>
            <b style={{ color: "#fda4af", fontSize: 13 }}>−6.8%</b>
          </div>
          <div style={{ padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "6px" }}>
            <div style={{ color: "#8b9bb4", fontSize: 9 }}>TRADES</div>
            <b style={{ color: "#e2e8f0", fontSize: 13 }}>1,842</b>
          </div>
        </div>

        {/* Equity Curve */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--font-geist-mono, monospace)", color: "#8b9bb4", marginBottom: 4 }}>
            <span>EQUITY PROGRESSION</span>
            <span style={{ color: "#a855f7" }}>+38.4% NET</span>
          </div>
          <svg viewBox="0 0 350 90" preserveAspectRatio="none" style={{ width: "100%", height: 80 }} aria-hidden="true">
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M0 80 Q 50 75, 90 62 T 180 50 T 260 28 T 350 12 L 350 90 L 0 90 Z"
              fill="url(#equityGradient)"
            />
            <path
              d="M0 80 Q 50 75, 90 62 T 180 50 T 260 28 T 350 12"
              fill="none"
              stroke="#c084fc"
              strokeWidth="2"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 06. Monte Carlo & Robustness Layer                                         */
/* -------------------------------------------------------------------------- */
export function MonteCarloLayer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${styles.explodedLayer} ${styles.monteCarloLayer}`}
      style={style}
      data-testid="layer-monte-carlo"
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerHeaderTag}>
          <Activity size={12} />
          <span>MONTE CARLO ROBUSTNESS</span>
        </div>
        <span style={{ color: "#38bdf8", fontSize: 9 }}>18 BOOTSTRAP PATHS</span>
      </div>

      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, color: "#8b9bb4" }}>
            CONFIDENCE CONE (5% - 95%)
          </span>
          <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontSize: 10, color: "#34d399" }}>
            FRAGILITY: LOW (0.12)
          </span>
        </div>

        {/* Stochastic Paths Fan */}
        <svg viewBox="0 0 380 130" preserveAspectRatio="none" style={{ width: "100%", height: 110 }} aria-hidden="true">
          <defs>
            <linearGradient id="coneGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.15)" />
              <stop offset="100%" stopColor="rgba(192, 132, 252, 0.2)" />
            </linearGradient>
          </defs>
          {/* Shaded Dispersion Cone */}
          <polygon
            points="0,65 380,15 380,115"
            fill="url(#coneGradient)"
          />
          {/* Individual Paths */}
          <path d="M0 65 Q 120 60, 240 45 T 380 25" fill="none" stroke="rgba(56, 189, 248, 0.5)" strokeWidth="1" />
          <path d="M0 65 Q 100 55, 220 35 T 380 18" fill="none" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1.2" />
          <path d="M0 65 Q 140 70, 260 55 T 380 40" fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
          <path d="M0 65 Q 130 65, 250 65 T 380 62" fill="none" stroke="#38bdf8" strokeWidth="1.8" />
          <path d="M0 65 Q 120 75, 230 80 T 380 85" fill="none" stroke="rgba(192, 132, 252, 0.4)" strokeWidth="1" />
          <path d="M0 65 Q 110 80, 240 95 T 380 105" fill="none" stroke="rgba(192, 132, 252, 0.6)" strokeWidth="1" />
        </svg>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "var(--font-geist-mono, monospace)", color: "#8b9bb4", marginTop: 4 }}>
          <span>BOOTSTRAP RE-SAMPLE</span>
          <span>STATIONARITY CHECKED</span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 07. Local Execution Engine Boundary Layer                                  */
/* -------------------------------------------------------------------------- */
export function LocalExecutionLayer({
  style,
}: {
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${styles.explodedLayer} ${styles.localEngineLayer}`}
      style={style}
      data-testid="layer-local-engine"
    >
      <div className={styles.layerHeader}>
        <div className={styles.layerHeaderTag}>
          <Cpu size={12} />
          <span>LOCAL EXECUTION BOUNDARY</span>
        </div>
        <span style={{ color: "#34d399", fontSize: 9 }}>ZERO EGRESS</span>
      </div>

      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-geist-mono, monospace)",
          fontSize: 11,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34d399",
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 600 }}>WINDOWS HELPER LOOPBACK</div>
            <div style={{ color: "#8b9bb4", fontSize: 10 }}>127.0.0.1:48201 · OS Vault Encrypted</div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#34d399", fontWeight: 600 }}>ISOLATED</div>
          <div style={{ color: "#8b9bb4", fontSize: 9 }}>IPC LATENCY &lt; 0.4ms</div>
        </div>
      </div>
    </div>
  );
}
