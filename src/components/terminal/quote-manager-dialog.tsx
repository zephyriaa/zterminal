"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  listCachedDatasets,
  purgeDataset,
  type DatasetMetadata,
} from "@/lib/market/bar-cache";
import { importCustomDataset, type ParsedDatasetResult } from "@/lib/market/dataset-importer";
import { getOrFetchHistoricalBars } from "@/lib/market/cached-bars-provider";
import { useWorkspace } from "@/stores/workspace";
import { useLayout } from "@/stores/layout";
import type { Timeframe } from "@/lib/market/types";
import { cn } from "@/lib/utils";

interface QuoteManagerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function QuoteManagerDialog({ open, onClose }: QuoteManagerDialogProps) {
  const { setSymbol, setTimeframe } = useWorkspace();
  const { addLog } = useLayout();
  const [datasets, setDatasets] = useState<DatasetMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Import form state
  const [customSymbol, setCustomSymbol] = useState("CUSTOM_BTC");
  const [forcedTf, setForcedTf] = useState<Timeframe>("5m");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCachedDatasets();
      setDatasets(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (open) {
      listCachedDatasets()
        .then((list) => {
          if (active) {
            setDatasets(list);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  const handleFileUpload = async (file: File) => {
    setImporting(true);
    setStatusMsg(`Reading ${file.name}...`);
    try {
      const text = await file.text();
      const result = await importCustomDataset(text, customSymbol, forcedTf);
      setStatusMsg(
        `Successfully imported ${result.totalBars.toLocaleString()} bars for ${result.symbol} (${result.timeframe}).`
      );
      addLog(
        "success",
        `QuoteManager: Imported ${result.totalBars} bars (${result.symbol} · ${result.timeframe})`
      );
      await reloadDatasets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      setStatusMsg(`Error: ${message}`);
      addLog("error", `QuoteManager import failed: ${message}`);
    } finally {
      setImporting(false);
    }
  };

  const handlePrefetch = async (days: number) => {
    setPrefetching(true);
    setStatusMsg(`Prefetching ${days} days of BTCUSDT 5m data...`);
    try {
      const toMs = Date.now();
      const fromMs = toMs - days * 86_400_000;
      await getOrFetchHistoricalBars("BTCUSDT", "5m", fromMs, toMs, (msg) => setStatusMsg(msg));
      setStatusMsg(`Prefetched ${days} days into local cache.`);
      addLog("success", `QuoteManager: Prefetched ${days}d of BTCUSDT into local storage.`);
      await reloadDatasets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Prefetch failed";
      setStatusMsg(`Prefetch failed: ${message}`);
    } finally {
      setPrefetching(false);
    }
  };

  const handleDelete = async (datasetId: string) => {
    if (confirm(`Delete cached dataset ${datasetId}?`)) {
      await purgeDataset(datasetId);
      addLog("info", `QuoteManager: Deleted dataset ${datasetId}`);
      await reloadDatasets();
    }
  };

  const handleClearAll = async () => {
    if (confirm("Purge ALL locally cached market datasets?")) {
      await purgeDataset();
      addLog("warn", "QuoteManager: Purged all locally cached datasets.");
      await reloadDatasets();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-lg border hairline bg-panel shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b hairline px-4 bg-surface/40">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Web QuoteManager
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-surface border hairline text-muted-foreground font-mono">
              IndexedDB Storage
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 scroll-thin">
          {/* Status Message */}
          {statusMsg && (
            <div className="flex items-center gap-2 rounded border hairline bg-surface/50 p-2.5 text-xs text-foreground font-mono">
              {(importing || prefetching) ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-pos" />
              )}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Quick Actions Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Prefetch Card */}
            <div className="rounded border hairline bg-surface/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Prefetch Binance Data
                </span>
                <Download className="h-3.5 w-3.5 text-accent" />
              </div>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                Cache continuous historical candles locally for offline, sub-millisecond backtesting without network calls.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={prefetching}
                  onClick={() => handlePrefetch(30)}
                  className="px-2.5 py-1 rounded bg-surface hover:bg-surface/80 border hairline text-[11px] font-medium transition-colors"
                >
                  30 Days (5m)
                </button>
                <button
                  type="button"
                  disabled={prefetching}
                  onClick={() => handlePrefetch(90)}
                  className="px-2.5 py-1 rounded bg-surface hover:bg-surface/80 border hairline text-[11px] font-medium transition-colors"
                >
                  90 Days (5m)
                </button>
                <button
                  type="button"
                  disabled={prefetching}
                  onClick={() => handlePrefetch(365)}
                  className="px-2.5 py-1 rounded bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30 text-[11px] font-medium transition-colors"
                >
                  1 Year (5m)
                </button>
              </div>
            </div>

            {/* Custom CSV Importer Card */}
            <div className="rounded border hairline bg-surface/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Import Custom CSV / Parquet
                </span>
                <Upload className="h-3.5 w-3.5 text-accent" />
              </div>
              <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                Upload historical OHLCV data from TradingView, MT5, or proprietary archives to test private datasets.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  placeholder="Symbol (e.g. BTC_CUSTOM)"
                  className="w-32 rounded bg-surface border hairline px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <select
                  value={forcedTf}
                  onChange={(e) => setForcedTf(e.target.value as Timeframe)}
                  className="rounded bg-surface border hairline px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="1m">1m</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="1d">1d</option>
                </select>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleFileUpload(file);
                  }}
                />
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded bg-accent text-accent-foreground text-[11px] font-medium hover:bg-accent/90 transition-colors"
                >
                  {importing ? "Importing..." : "Choose File"}
                </button>
              </div>
            </div>
          </div>

          {/* Cached Datasets Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Cached Local Datasets ({datasets.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={reloadDatasets}
                  className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-surface"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Refresh</span>
                </button>
                {datasets.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex items-center gap-1 text-[10.5px] text-neg hover:text-neg/80 px-2 py-1 rounded hover:bg-neg/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            </div>

            <div className="rounded border hairline bg-surface/20 overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b hairline bg-surface/40 text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">TF</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Total Bars</th>
                    <th className="px-3 py-2">Date Range</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y hairline divide-border/30 font-mono">
                  {datasets.map((d) => (
                    <tr key={d.id} className="hover:bg-surface/40 transition-colors">
                      <td className="px-3 py-2 font-bold text-foreground">{d.symbol}</td>
                      <td className="px-3 py-2">{d.timeframe}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-surface text-muted-foreground border hairline">
                          {d.source}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-foreground font-semibold">
                        {d.count.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-[10px]">
                        {new Date(d.earliestMs).toLocaleDateString()} &rarr;{" "}
                        {new Date(d.latestMs).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right space-x-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSymbol(d.symbol);
                            setTimeframe(d.timeframe);
                            onClose();
                          }}
                          className="px-2 py-0.5 rounded bg-accent/15 text-accent hover:bg-accent hover:text-accent-foreground text-[10px] font-medium transition-colors"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-neg hover:bg-neg/10 text-[10px] transition-colors"
                        >
                          <Trash2 className="h-3 w-3 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {datasets.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs text-muted-foreground font-sans">
                        No datasets cached locally yet. Use &ldquo;Prefetch Binance Data&rdquo; or &ldquo;Import Custom CSV&rdquo; above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
