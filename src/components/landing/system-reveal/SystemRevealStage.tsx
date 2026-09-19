"use client";

import React from "react";
import styles from "./system-reveal.module.css";
import {
  CentralWorkstation,
  MicrostructureLayer,
  StrategyCodeLayer,
  DatasetManifestLayer,
  BacktestEngineLayer,
  MonteCarloLayer,
  LocalExecutionLayer,
} from "./SystemRevealLayers";
import { DataPulseRails } from "./DataPulseRails";

interface SystemRevealStageProps {
  progress: number;
  isStatic?: boolean;
}

/** Helper easing function for smooth spatial transitions */
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

export function SystemRevealStage({
  progress,
  isStatic = false,
}: SystemRevealStageProps) {
  if (isStatic) {
    return (
      <div className={styles.scene3D} data-testid="system-reveal-stage-static">
        <CentralWorkstation isStatic />
        <MicrostructureLayer />
        <StrategyCodeLayer />
        <DatasetManifestLayer />
        <BacktestEngineLayer />
        <MonteCarloLayer />
        <LocalExecutionLayer />
      </div>
    );
  }

  // Phase transitions:
  // Phase 1 (0.00 - 0.20): Complete Workstation
  // Phase 2 (0.20 - 0.45): Microstructure separates
  // Phase 3 (0.45 - 0.72): Code, Dataset, Backtest separate (Midpoint data pulse)
  // Phase 4 (0.72 - 1.00): Monte Carlo & Local Engine separate (Full exploded diagram at rest)

  const pMicro = smoothstep(0.18, 0.38, progress);
  const pCode = smoothstep(0.40, 0.58, progress);
  const pDataset = smoothstep(0.44, 0.62, progress);
  const pBacktest = smoothstep(0.48, 0.66, progress);
  const pMonteCarlo = smoothstep(0.68, 0.86, progress);
  const pLocalEngine = smoothstep(0.72, 0.90, progress);

  // Central workstation subtle responsive offset to balance the composition as panels open
  const workstationX = progress > 0.2 ? Math.min(60, (progress - 0.2) * 120) : 0;
  const workstationScale = 1 - progress * 0.04;

  const centralStyle: React.CSSProperties = {
    transform: `translate3d(${workstationX}px, 0px, 0px) scale3d(${workstationScale}, ${workstationScale}, 1)`,
    transition: "transform 0.1s linear",
  };

  // Microstructure (left plane)
  const microX = -440 * pMicro;
  const microY = 20 * pMicro;
  const microZ = 60 * pMicro;
  const microRotY = 12 * pMicro;
  const microStyle: React.CSSProperties = {
    opacity: pMicro,
    transform: `translate3d(${microX}px, ${microY}px, ${microZ}px) rotateY(${microRotY}deg) scale3d(${0.85 + pMicro * 0.15}, ${0.85 + pMicro * 0.15}, 1)`,
    pointerEvents: pMicro > 0.6 ? "auto" : "none",
  };

  // Strategy Code (top-left plane)
  const codeX = -420 * pCode;
  const codeY = -230 * pCode;
  const codeZ = 75 * pCode;
  const codeRotX = 8 * pCode;
  const codeRotY = 10 * pCode;
  const codeStyle: React.CSSProperties = {
    opacity: pCode,
    transform: `translate3d(${codeX}px, ${codeY}px, ${codeZ}px) rotateX(${codeRotX}deg) rotateY(${codeRotY}deg) scale3d(${0.85 + pCode * 0.15}, ${0.85 + pCode * 0.15}, 1)`,
    pointerEvents: pCode > 0.6 ? "auto" : "none",
  };

  // Dataset Manifest (top-center plane)
  const dataX = 0;
  const dataY = -270 * pDataset;
  const dataZ = 40 * pDataset;
  const dataRotX = 12 * pDataset;
  const datasetStyle: React.CSSProperties = {
    opacity: pDataset,
    transform: `translate3d(${dataX}px, ${dataY}px, ${dataZ}px) rotateX(${dataRotX}deg) scale3d(${0.88 + pDataset * 0.12}, ${0.88 + pDataset * 0.12}, 1)`,
    pointerEvents: pDataset > 0.6 ? "auto" : "none",
  };

  // Backtest Engine (top-right plane)
  const backtestX = 430 * pBacktest;
  const backtestY = -210 * pBacktest;
  const backtestZ = 70 * pBacktest;
  const backtestRotX = 6 * pBacktest;
  const backtestRotY = -10 * pBacktest;
  const backtestStyle: React.CSSProperties = {
    opacity: pBacktest,
    transform: `translate3d(${backtestX}px, ${backtestY}px, ${backtestZ}px) rotateX(${backtestRotX}deg) rotateY(${backtestRotY}deg) scale3d(${0.85 + pBacktest * 0.15}, ${0.85 + pBacktest * 0.15}, 1)`,
    pointerEvents: pBacktest > 0.6 ? "auto" : "none",
  };

  // Monte Carlo Robustness (bottom-right plane)
  const mcX = 430 * pMonteCarlo;
  const mcY = 170 * pMonteCarlo;
  const mcZ = 60 * pMonteCarlo;
  const mcRotX = -8 * pMonteCarlo;
  const mcRotY = -12 * pMonteCarlo;
  const monteCarloStyle: React.CSSProperties = {
    opacity: pMonteCarlo,
    transform: `translate3d(${mcX}px, ${mcY}px, ${mcZ}px) rotateX(${mcRotX}deg) rotateY(${mcRotY}deg) scale3d(${0.85 + pMonteCarlo * 0.15}, ${0.85 + pMonteCarlo * 0.15}, 1)`,
    pointerEvents: pMonteCarlo > 0.6 ? "auto" : "none",
  };

  // Local Execution Boundary (bottom-center plane)
  const localX = 0;
  const localY = 280 * pLocalEngine;
  const localZ = 45 * pLocalEngine;
  const localRotX = -10 * pLocalEngine;
  const localEngineStyle: React.CSSProperties = {
    opacity: pLocalEngine,
    transform: `translate3d(${localX}px, ${localY}px, ${localZ}px) rotateX(${localRotX}deg) scale3d(${0.88 + pLocalEngine * 0.12}, ${0.88 + pLocalEngine * 0.12}, 1)`,
    pointerEvents: pLocalEngine > 0.6 ? "auto" : "none",
  };

  return (
    <div className={styles.scene3D} data-testid="system-reveal-stage">
      {/* Structural Laser Conduits & Midpoint Data Pulse */}
      <DataPulseRails progress={progress} isStatic={isStatic} />

      {/* Central Workstation (Gravitational Center) */}
      <CentralWorkstation style={centralStyle} />

      {/* Deconstructed Analytical Layers */}
      <MicrostructureLayer style={microStyle} />
      <StrategyCodeLayer style={codeStyle} />
      <DatasetManifestLayer style={datasetStyle} />
      <BacktestEngineLayer style={backtestStyle} />
      <MonteCarloLayer style={monteCarloStyle} />
      <LocalExecutionLayer style={localEngineStyle} />
    </div>
  );
}
