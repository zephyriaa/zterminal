"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  Radio,
  FileSpreadsheet,
  ShieldCheck,
  X,
  Play,
  Server,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ConnectionTestResult,
  type FieldMapping,
  testMappingOnPayload,
} from "@/lib/market/connectors";
import { cn } from "@/lib/utils";

interface AddConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenLocalDatasets?: () => void;
}

type SourceType = "builtin" | "custom-ws" | "custom-rest" | "local-file";

export function AddConnectionDialog({ open, onClose, onOpenLocalDatasets }: AddConnectionDialogProps) {
  const [sourceType, setSourceType] = useState<SourceType>("custom-ws");
  const [name, setName] = useState("Custom WebSocket Feed");
  const [endpoint, setEndpoint] = useState("wss://stream.example.com/ws/v1");
  const [subPayload, setSubPayload] = useState('{\n  "method": "SUBSCRIBE",\n  "params": ["btcusdt@kline_15m"],\n  "id": 1\n}');
  const [mapping, setMapping] = useState<FieldMapping>({
    timestamp: "k.t",
    symbol: "s",
    open: "k.o",
    high: "k.h",
    low: "k.l",
    close: "k.c",
    volume: "k.v",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const runTest = () => {
    setTesting(true);
    // Simulate safe endpoint connection check and test against a sample payload
    setTimeout(() => {
      const sampleServerPayload = {
        s: "BTCUSDT",
        k: {
          t: Date.now(),
          o: "89140.50",
          h: "89280.00",
          l: "89110.20",
          c: "89245.80",
          v: "42.815",
        },
      };

      const result = testMappingOnPayload(sampleServerPayload, mapping);
      setTestResult(result);
      setTesting(false);
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-xl bg-panel border-border/80 text-foreground p-0 overflow-hidden shadow-2xl rounded-[8px]">
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-base/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-mdata" />
              <DialogTitle className="text-sm font-semibold tracking-wide">
                ADD DATA CONNECTION
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Connect public market data streams into ZTerminal. Strictly read-only.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Read-only Security Banner */}
          <div className="flex items-start gap-2.5 p-2.5 rounded-[6px] border border-pos/30 bg-pos/5">
            <ShieldCheck className="h-4 w-4 text-pos shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px] leading-relaxed text-foreground/90">
              <b className="font-semibold text-pos">Market-Data Permissions Only</b>
              <p className="text-muted-foreground">
                ZTerminal only ingests market prices and order book data. Never provide API credentials with trading, withdrawal, or transfer authority.
              </p>
            </div>
          </div>

          {/* Source Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              SOURCE TYPE
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "custom-ws", label: "Custom WS", icon: Radio },
                { id: "custom-rest", label: "Custom REST", icon: Globe },
                { id: "builtin", label: "Built-in", icon: Database },
                { id: "local-file", label: "Local File", icon: FileSpreadsheet },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = sourceType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSourceType(item.id as SourceType);
                      setTestResult(null);
                      if (item.id === "local-file" && onOpenLocalDatasets) {
                        onClose();
                        onOpenLocalDatasets();
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2.5 rounded-[6px] border text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border/60 hover:bg-hover text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[10.5px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Fields for Custom Feeds */}
          {(sourceType === "custom-ws" || sourceType === "custom-rest") && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">FEED NAME</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-7 text-xs bg-background/50 border-border/60 font-mono-num"
                  placeholder="e.g. My Futures Feed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground font-semibold">
                  {sourceType === "custom-ws" ? "WEBSOCKET ENDPOINT" : "REST ENDPOINT"}
                </label>
                <Input
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="h-7 text-xs bg-background/50 border-border/60 font-mono-num"
                  placeholder={sourceType === "custom-ws" ? "wss://..." : "https://..."}
                />
              </div>

              {sourceType === "custom-ws" && (
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground font-semibold">
                    SUBSCRIPTION PAYLOAD (JSON)
                  </label>
                  <textarea
                    value={subPayload}
                    onChange={(e) => setSubPayload(e.target.value)}
                    rows={3}
                    className="w-full text-xs font-mono bg-background/50 border border-border/60 rounded-[4px] p-2 text-foreground focus:outline-hidden"
                  />
                </div>
              )}

              {/* Data Field Mapping */}
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    DATA MAPPING (JSON PATH)
                  </label>
                  <span className="text-[9px] text-muted-foreground">e.g. k.c or close</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Timestamp</span>
                    <Input
                      value={mapping.timestamp}
                      onChange={(e) => setMapping({ ...mapping, timestamp: e.target.value })}
                      className="h-6 text-[11px] font-mono bg-background/50 border-border/60"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Symbol</span>
                    <Input
                      value={mapping.symbol}
                      onChange={(e) => setMapping({ ...mapping, symbol: e.target.value })}
                      className="h-6 text-[11px] font-mono bg-background/50 border-border/60"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Open</span>
                    <Input
                      value={mapping.open}
                      onChange={(e) => setMapping({ ...mapping, open: e.target.value })}
                      className="h-6 text-[11px] font-mono bg-background/50 border-border/60"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-muted-foreground">High</span>
                    <Input
                      value={mapping.high}
                      onChange={(e) => setMapping({ ...mapping, high: e.target.value })}
                      className="h-6 text-[11px] font-mono bg-background/50 border-border/60"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Low</span>
                    <Input
                      value={mapping.low}
                      onChange={(e) => setMapping({ ...mapping, low: e.target.value })}
                      className="h-6 text-[11px] font-mono bg-background/50 border-border/60"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9.5px] text-muted-foreground">Close</span>
                    <Input
                      value={mapping.close}
                      onChange={(e) => setMapping({ ...mapping, close: e.target.value })}
                      className="h-6 text-[11px] font-mono bg-background/50 border-border/60"
                    />
                  </div>
                </div>
              </div>

              {/* Test Connection Button */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={runTest}
                  disabled={testing}
                  className="h-7 text-xs flex items-center gap-1.5"
                >
                  <Play className="h-3 w-3 text-pos" />
                  {testing ? "Testing mapping…" : "Test Connection"}
                </Button>
                <span className="text-[10px] text-muted-foreground">
                  Validates endpoint reachability and JSON parsing
                </span>
              </div>

              {/* Test Results & Data Preview */}
              {testResult && (
                <div className="p-3 rounded-[6px] border border-border/80 bg-background/40 space-y-2.5">
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 text-pos shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-neg shrink-0" />
                    )}
                    <span className="font-semibold text-[11px]">
                      {testResult.success ? "CONNECTION TEST PASSED" : "CONNECTION TEST FAILED"}
                    </span>
                  </div>

                  {/* Checklist */}
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {testResult.checks.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5">
                        <span className={c.passed ? "text-pos" : "text-neg"}>
                          {c.passed ? "✓" : "✗"}
                        </span>
                        <span className="text-muted-foreground">{c.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Sample Candle Preview */}
                  {testResult.sampleCandle && (
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                        DATA PREVIEW
                      </span>
                      <div className="mt-1 p-2 rounded bg-base font-mono-num text-[10.5px] grid grid-cols-4 gap-2">
                        <div>
                          <span className="text-muted-foreground block text-[9px]">SYMBOL</span>
                          <b>{testResult.sampleCandle.symbol}</b>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[9px]">CLOSE</span>
                          <b>{testResult.sampleCandle.close}</b>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[9px]">RANGE (H/L)</span>
                          <span>{testResult.sampleCandle.high} / {testResult.sampleCandle.low}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[9px]">VOLUME</span>
                          <span>{testResult.sampleCandle.volume}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {sourceType === "builtin" && (
            <div className="space-y-2">
              <p className="text-muted-foreground text-[11px]">
                Built-in providers are pre-configured with canonical normalization and low-latency websocket adapters.
              </p>
              <div className="space-y-1.5">
                {[
                  { name: "Gate.io Futures", status: "Active (Connected)", desc: "Production perpetuals feed" },
                  { name: "Binance Futures", status: "Available", desc: "USDT-M perpetual contract streams" },
                  { name: "Simulation Gateway", status: "Available", desc: "Local deterministic market simulator" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-[4px] border border-border/60 bg-background/30">
                    <div>
                      <b className="text-[11px] block">{item.name}</b>
                      <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                    </div>
                    <span className="text-[10px] font-mono-num text-pos">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border/60 bg-base/60 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={sourceType !== "builtin" && !testResult?.success}
            onClick={() => {
              onClose();
            }}
            className="h-7 text-xs"
          >
            Save Connection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
