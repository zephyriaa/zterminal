# Native Chart Vertical Slice — Fixture Evidence

**Status:** Implemented as a Windows-only Direct3D fixture renderer. It is a measured engineering slice, not an installable terminal or a source of market data.

## Delivered behaviour

The native Win32 host now creates a Direct3D 11 chart surface that renders bounded visible candles from a deterministic **fixture-only** series. The process neither embeds a WebView nor contacts Render, a market-data gateway, or an external provider.

| Capability | Current behaviour |
|---|---|
| Candle data | Deterministic fixture input only, visibly labelled in the window title and diagnostics. It must not be interpreted as market data. |
| Visible draw budget | Renders at most 2,000 visible candles, even when the loaded fixture contains 10k or 100k records. |
| Pan and zoom | Mouse-wheel changes visible candle count; left-drag changes the visible range. |
| Crosshair | Mouse movement renders a local Direct3D crosshair; no service request occurs. |
| Provenance | Diagnostics record `fixture_only: true`, hardware/WARP mode, adapter, feature level, launch time, frame timing, and process memory. |
| Data integrity | The future integration point is the Rust `SegmentStore` and `LocalAvailability` contract; missing, stale, gapped, unavailable, or corrupt ranges must not be drawn as continuous candles. |

## First measured chart evidence

The connected Windows 10 reference device used hardware Direct3D 11.0 on an NVIDIA GeForce 710M. Each smoke run used a five-second auto-close interval, which is sufficient only to detect basic render-loop regressions. The raw results are retained beside this record.

| Fixture records loaded | Visible candle cap | Frame average | Frame p95 | Launch to visible | Working set | Result |
|---:|---:|---:|---:|---:|---:|---|
| 10,000 | 2,000 | 46.300 ms | 46.999 ms | 385.560 ms | 29,077,504 bytes | Functional but misses the 60 FPS interaction target on this reference hardware. |
| 100,000 | 2,000 | 46.846 ms | 48.109 ms | 135.706 ms | 30,244,864 bytes | Functional and bounded, but also misses the 60 FPS interaction target. |

> The chart renderer is **not accepted as performance-ready**. Approximately 47–48 ms p95 frame time is below the required 60 FPS budget of 16.67 ms. The implementation provides a truthful baseline from which to optimize; it does not claim TradingView-class performance yet.

## Why the result is still useful

The evidence proves that a local native renderer can load a 100k-record fixture collection without moving the dataset, rendering, or chart interaction to Render. Memory growth from the 10k to 100k fixture run remained small because the draw path is capped by visible candles. The frame result shows that the next work must optimize CPU-side vertex generation and old-GPU presentation behaviour before feature expansion.

## Next renderer requirements

1. Separate retained local candle data from the per-frame visible scene so no full fixture/vector walk occurs in the interactive hot path.
2. Use a persistent GPU vertex buffer and update only changed ranges, rather than remapping the full visible scene every present.
3. Add a frame cap/dirty-render policy so an unchanged view does not rebuild/present at an unconstrained rate.
4. Feed only verified `SegmentStore` bytes through a typed Rust scene contract; reject `Gap`, `Unavailable`, and `Corrupt` data before scene generation.
5. Add deterministic 10k/100k pan, zoom, resize, and device-reset tests; record CPU, GPU where available, input-to-present, and frame histograms on the three required reference tiers.

The raw machine-specific reports are `docs/windows/benchmarks/windows-fixture-candles-10000.json` and `docs/windows/benchmarks/windows-fixture-candles-100000.json`. The repeatable runner is `apps/windows-host/scripts/run-fixture-candle-benchmark.ps1`.
