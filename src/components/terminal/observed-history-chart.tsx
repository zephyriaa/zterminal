"use client";
import { useEffect, useRef } from "react";
import { CandlestickSeries, ColorType, createChart, type Time, type UTCTimestamp } from "lightweight-charts";
import type { Bar } from "@/lib/market/types";

/** Shared chart surface; callers supply observed history through their platform adapter. */
export function LocalHistoryChart({ bars, from, to, onRange }: {
  bars: Bar[]; from: number | null; to: number | null;
  onRange: (from: number, to: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const interacting = useRef(false);
  const callback = useRef(onRange);
  useEffect(() => { callback.current = onRange; }, [onRange]);
  useEffect(() => {
    if (!container.current || !bars.length) return;
    interacting.current = false;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#10151e" }, textColor: "#aeb9cb", attributionLogo: true },
      grid: { vertLines: { color: "#1b2533" }, horzLines: { color: "#1b2533" } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chart.addSeries(CandlestickSeries, { upColor: "#51c4a8", downColor: "#ef7c86", borderVisible: false, wickUpColor: "#51c4a8", wickDownColor: "#ef7c86" })
      .setData(bars.map(b => ({ time: b.t / 1000 as UTCTimestamp, open: b.o, high: b.h, low: b.l, close: b.c })));
    if (from != null && to != null) chart.timeScale().setVisibleRange({ from: from / 1000 as Time, to: to / 1000 as Time });
    else chart.timeScale().fitContent();
    chart.timeScale().subscribeVisibleTimeRangeChange(range => {
      if (interacting.current && range && typeof range.from === "number" && typeof range.to === "number" && range.from < range.to) callback.current(range.from * 1000, range.to * 1000);
    });
    return () => chart.remove();
  }, [bars, from, to]);
  return <div ref={container} className="local-chart" role="img" aria-label="Imported historical candlestick chart. Drag to pan; mouse wheel to zoom." onPointerDownCapture={() => { interacting.current = true; }} onWheelCapture={() => { interacting.current = true; }} />;
}
