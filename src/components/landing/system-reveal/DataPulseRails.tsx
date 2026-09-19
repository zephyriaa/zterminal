"use client";

import React from "react";
import styles from "./system-reveal.module.css";

interface DataPulseRailsProps {
  progress: number;
  isStatic?: boolean;
}

export function DataPulseRails({ progress, isStatic = false }: DataPulseRailsProps) {
  if (isStatic) return null;

  // Pulse activates around beat 3 (0.45 to 0.72)
  const isPulsing = progress >= 0.42 && progress <= 0.75;
  const pulsePhase = Math.max(0, Math.min(1, (progress - 0.42) / 0.33));

  // The rail opacity scales in with decomposition (starts around 0.25)
  const railOpacity = Math.max(0, Math.min(0.65, (progress - 0.2) * 1.5));

  return (
    <svg
      className={styles.pulseConduits}
      viewBox="0 0 1440 820"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* Subtle engineering line glow */}
        <filter id="railGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#6527e4" floodOpacity="0.4" />
        </filter>

        {/* Pulse gradient traveling along path */}
        <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
          <stop offset={`${Math.max(0, pulsePhase * 100 - 15)}%`} stopColor="#06b6d4" stopOpacity="0" />
          <stop offset={`${pulsePhase * 100}%`} stopColor="#c084fc" stopOpacity="1" />
          <stop offset={`${Math.min(100, pulsePhase * 100 + 15)}%`} stopColor="#6527e4" stopOpacity="0" />
          <stop offset="100%" stopColor="#6527e4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Structural Central Axis Rail */}
      <line
        x1="720"
        y1="40"
        x2="720"
        y2="780"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth="1"
        strokeDasharray="4 6"
        opacity={railOpacity}
      />

      {/* Cross-Alignment Horizontal Axis */}
      <line
        x1="120"
        y1="410"
        x2="1320"
        y2="410"
        stroke="rgba(255, 255, 255, 0.06)"
        strokeWidth="1"
        strokeDasharray="4 6"
        opacity={railOpacity}
      />

      {/* Conduit 1: Market Data (left) -> Central Chart */}
      <path
        d="M 350 410 L 460 410"
        stroke="rgba(6, 182, 212, 0.3)"
        strokeWidth="1.5"
        opacity={railOpacity}
      />

      {/* Conduit 2: Central Chart -> Strategy Code (top-left) */}
      <path
        d="M 520 280 L 420 200"
        stroke="rgba(192, 132, 252, 0.3)"
        strokeWidth="1.5"
        opacity={railOpacity}
      />

      {/* Conduit 3: Strategy Code -> Dataset Manifest (top-center) */}
      <path
        d="M 460 120 L 520 120"
        stroke="rgba(16, 185, 129, 0.3)"
        strokeWidth="1.5"
        opacity={railOpacity}
      />

      {/* Conduit 4: Strategy Code -> Backtest Engine (top-right) */}
      <path
        d="M 920 280 L 1020 200"
        stroke="rgba(192, 132, 252, 0.3)"
        strokeWidth="1.5"
        opacity={railOpacity}
      />

      {/* Conduit 5: Backtest Engine -> Monte Carlo Robustness (bottom-right) */}
      <path
        d="M 1200 330 L 1200 480"
        stroke="rgba(56, 189, 248, 0.3)"
        strokeWidth="1.5"
        opacity={railOpacity}
      />

      {/* Conduit 6: Local Execution Boundary (bottom-center) */}
      <path
        d="M 720 620 L 720 690"
        stroke="rgba(16, 185, 129, 0.3)"
        strokeWidth="1.5"
        opacity={railOpacity}
      />

      {/* The Market Data Pulse (Sequential Circuit Animation) */}
      {isPulsing && (
        <g filter="url(#railGlow)">
          {/* Main Bus Path: Feed -> Chart -> Strategy -> Backtest -> Monte Carlo */}
          <path
            d="M 280 410 L 520 410 L 460 160 L 720 120 L 1050 160 L 1180 520"
            fill="none"
            stroke="url(#pulseGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Pulse Node Spark */}
          <circle
            cx={280 + pulsePhase * 900}
            cy={410 - Math.sin(pulsePhase * Math.PI) * 200}
            r="3"
            fill="#c084fc"
            box-shadow="0 0 10px #c084fc"
          />
        </g>
      )}
    </svg>
  );
}
