import React, { useEffect, useState, useMemo } from "react";
import { DockviewReact, DockviewReadyEvent, IDockviewPanelProps } from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import { ReferenceChartWorkspace } from "../reference-chart-workspace";

// Import existing chart wrapper
import { TerminalChart } from "../terminal-chart";
import { useWorkspace } from "@/stores/workspace";
import { useMarketStream } from "@/hooks/use-market-stream";
import { ResearchReport } from "../research-report";

function TerminalChartPanel(props: IDockviewPanelProps<{}>) {
  const { symbol, timeframe } = useWorkspace();
  const { provider } = useMarketStream(symbol, { trades: 1, depth: false });

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <TerminalChart 
        symbol={symbol}
        timeframe={timeframe as any}
        chartType="candles"
        indicators={{ vwap: false, ema20: false, ema50: false, volume: true }}
      />
    </div>
  );
}

function OrderbookPanel(props: IDockviewPanelProps<{}>) {
  const { symbol } = useWorkspace();
  const { provider } = useMarketStream(symbol, { trades: 1, depth: true });
  return (
    <div className="flex flex-col h-full bg-panel text-foreground p-4">
      <h3 className="font-bold mb-2">Orderbook - {symbol}</h3>
      <div className="text-sm opacity-50 flex-1 flex items-center justify-center border border-dashed border-border/20 rounded">
        Level 2 Depth Feed Pending...
      </div>
    </div>
  );
}

function StrategyPanel(props: IDockviewPanelProps<{}>) {
  return (
    <div className="flex flex-col h-full bg-panel text-foreground p-4">
      <h3 className="font-bold mb-2">Strategy Editor</h3>
      <div className="text-sm opacity-50 flex-1 flex items-center justify-center border border-dashed border-border/20 rounded">
        Monaco Editor Pending...
      </div>
    </div>
  );
}

function AnalyticsPanel(props: IDockviewPanelProps<{}>) {
  return (
    <div className="h-full w-full overflow-y-auto">
      <ResearchReport />
    </div>
  );
}

const components = {
  chart: TerminalChartPanel,
  orderbook: OrderbookPanel,
  strategy: StrategyPanel,
  analytics: AnalyticsPanel,
};

const DEFAULT_LAYOUT = {
  activeGroup: "group_left",
  grid: {
    root: {
      type: "splitview",
      orientation: "horizontal",
      views: [
        {
          type: "group",
          id: "group_left",
          size: 70,
          views: [{ id: "chart_1", component: "chart", title: "Primary Chart" }]
        },
        {
          type: "splitview",
          orientation: "vertical",
          size: 30,
          views: [
            {
              type: "group",
              id: "group_top_right",
              size: 50,
              views: [{ id: "orderbook_1", component: "orderbook", title: "Orderbook" }]
            },
            {
              type: "group",
              id: "group_bottom_right",
              size: 50,
              views: [
                { id: "analytics_1", component: "analytics", title: "Analytics" },
                { id: "strategy_1", component: "strategy", title: "Strategy" }
              ]
            }
          ]
        }
      ]
    }
  }
};

const STORAGE_KEY = "zt_workspace_layout_v1";

export function WorkspaceDock() {
  const [api, setApi] = useState<DockviewReadyEvent | null>(null);

  const onReady = (event: DockviewReadyEvent) => {
    setApi(event);
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        event.api.fromJSON(JSON.parse(stored));
      } else {
        event.api.fromJSON(DEFAULT_LAYOUT as any);
      }
    } catch (e) {
      console.error("Failed to load layout:", e);
      event.api.fromJSON(DEFAULT_LAYOUT as any);
    }

    event.api.onDidLayoutChange(() => {
      const layout = event.api.toJSON();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    });
  };

  return (
    <div className="h-full w-full bg-background relative" style={{ '--dv-background': 'var(--panel)', '--dv-pane-divider': 'var(--border)' } as React.CSSProperties}>
      <DockviewReact
        components={components}
        onReady={onReady}
        className="dockview-theme-dark"
      />
    </div>
  );
}

export default WorkspaceDock;
