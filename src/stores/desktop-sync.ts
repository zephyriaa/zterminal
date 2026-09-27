import { create } from 'zustand';
import { defaultExecutionProvider } from '@/lib/research/execution-provider';

export type SyncStatus = 'Local' | 'Cloud' | 'Synced';

export interface WorkspaceEntity {
  id: string;
  name: string;
  syncStatus: SyncStatus;
  updatedAt: string;
  category: string;
  isStarred?: boolean;
  view?: string;
}

export interface StudyEntity {
  id: string;
  name: string;
  description: string;
  kind: 'Indicator' | 'Strategy';
  syncStatus: SyncStatus;
  updatedAt: string;
  chartType: 'volatility' | 'orderflow' | 'gex' | 'reversion' | 'custom';
  source?: string;
  parameters?: Record<string, number | string | boolean>;
}

export interface DesktopTab {
  id: string;
  title: string;
  type: 'home' | 'chart' | 'studio' | 'workspace';
  icon: 'home' | 'chart' | 'code' | 'grid' | 'file';
  closable: boolean;
  symbol?: string;
  timeframe?: string;
  studyId?: string;
  workspaceId?: string;
}

export interface BacktestMetrics {
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
}

export interface BacktestResult {
  studyId: string;
  studyName: string;
  symbol: string;
  timeframe: string;
  metrics: BacktestMetrics;
  equityCurve: { date: string; value: number }[];
  trades: { id: string; time: string; side: 'BUY' | 'SELL'; price: number; pnl: number }[];
  sourceHash: string;
  datasetHash: string;
  determinismHash: string;
  executedAt: string;
}

export interface DashboardData {
  workspaces: WorkspaceEntity[];
  studies: StudyEntity[];
}

const DEFAULT_STUDIES: StudyEntity[] = [
  {
    id: '1',
    name: 'Volatility Regime Detector',
    description: 'Indicator',
    kind: 'Indicator',
    syncStatus: 'Synced',
    updatedAt: 'Edited 2d ago',
    chartType: 'volatility',
    parameters: { lookback: 20, threshold: 1.85, smoothing: 3 },
    source: `# Volatility Regime Detector - Institutional GARCH / Range Dispersion
import zterminal as zt
import numpy as np

def calculate_regime(data, params):
    lookback = int(params.get("lookback", 20))
    threshold = float(params.get("threshold", 1.85))
    
    # Compute true range & Parkinson volatility estimator
    hl_ratio = np.log(data.high / data.low) ** 2
    parkinson = np.sqrt(hl_ratio.rolling(lookback).mean() / (4 * np.log(2)))
    
    regime = np.where(parkinson > threshold, 1.0, 0.0)
    return zt.StudyOutput(
        plots={"Volatility": parkinson, "Regime High": regime},
        alerts={"High Volatility Detected": parkinson > threshold}
    )`
  },
  {
    id: '2',
    name: 'Orderflow Imbalance',
    description: 'Indicator',
    kind: 'Indicator',
    syncStatus: 'Local',
    updatedAt: 'Edited 5d ago',
    chartType: 'orderflow',
    parameters: { imbalanceRatio: 3.0, minVolume: 50, stackLevels: 3 },
    source: `# Orderflow Imbalance (Delta & Diagonal Aggregation)
import zterminal as zt

def detect_imbalance(orderbook_events, params):
    ratio = float(params.get("imbalanceRatio", 3.0))
    min_vol = float(params.get("minVolume", 50))
    
    # Analyze diagonal bid/ask absorption
    bid_vol = orderbook_events.bid_volume
    ask_vol = orderbook_events.ask_volume
    
    buy_imbalance = (ask_vol / (bid_vol + 1e-6)) > ratio
    sell_imbalance = (bid_vol / (ask_vol + 1e-6)) > ratio
    
    return zt.StudyOutput(
        plots={"Buy Imbalance": buy_imbalance, "Sell Imbalance": sell_imbalance}
    )`
  },
  {
    id: '3',
    name: 'GEX Levels',
    description: 'Indicator',
    kind: 'Indicator',
    syncStatus: 'Synced',
    updatedAt: 'Edited 1w ago',
    chartType: 'gex',
    parameters: { expiryHorizon: 'near', strikeStep: 500, decayGamma: true },
    source: `# Gamma Exposure (GEX) Stripped Curve & Dealer Positioning
import zterminal as zt

def calculate_gex(derivatives_surface, params):
    # Dealer gamma positioning across strike distribution
    strikes = derivatives_surface.strikes
    open_interest = derivatives_surface.open_interest
    gamma = derivatives_surface.gamma
    
    call_gex = gamma.calls * open_interest.calls * derivatives_surface.spot_price
    put_gex = gamma.puts * open_interest.puts * derivatives_surface.spot_price * -1
    net_gex = call_gex + put_gex
    
    return zt.StudyOutput(
        plots={"Net GEX": net_gex, "Zero Gamma Pivot": zt.find_zero_cross(net_gex)}
    )`
  },
  {
    id: '4',
    name: 'Mean Reversion',
    description: 'Strategy',
    kind: 'Strategy',
    syncStatus: 'Cloud',
    updatedAt: 'Edited 2w ago',
    chartType: 'reversion',
    parameters: { period: 20, stdDev: 2.2, stopLossBps: 45 },
    source: `# Statistical Mean Reversion with Dynamic Volatility Bands
import zterminal as zt

def strategy(data, params):
    period = int(params.get("period", 20))
    stdev_mult = float(params.get("stdDev", 2.2))
    
    mean = data.close.rolling(period).mean()
    stdev = data.close.rolling(period).std()
    
    upper = mean + (stdev * stdev_mult)
    lower = mean - (stdev * stdev_mult)
    
    entries = zt.crossunder(data.close, lower)  # Oversold bounce
    exits = zt.crossover(data.close, mean)       # Mean reversion target
    
    return zt.Strategy(
        entries=entries,
        exits=exits,
        plots={"Mean": mean, "Upper Band": upper, "Lower Band": lower}
    )`
  }
];

const DEFAULT_WORKSPACES: WorkspaceEntity[] = [
  { id: '1', name: 'Execution Lab', syncStatus: 'Synced', updatedAt: 'Modified 1d ago', category: 'starred', isStarred: true, view: 'execution' },
  { id: '2', name: 'Macro Dashboard', syncStatus: 'Local', updatedAt: 'Modified 3d ago', category: 'macro', view: 'macro' },
  { id: '3', name: 'Crypto Orderflow', syncStatus: 'Local', updatedAt: 'Modified 5d ago', category: 'orderflow', view: 'orderflow' },
  { id: '4', name: 'Options Vol Surface', syncStatus: 'Synced', updatedAt: 'Modified 1w ago', category: 'volatility', view: 'volatility' },
  { id: '5', name: 'Strategy Studio', syncStatus: 'Local', updatedAt: 'Modified 1w ago', category: 'strategy', view: 'studio' },
  { id: '6', name: 'Market Context', syncStatus: 'Synced', updatedAt: 'Modified 2w ago', category: 'context', view: 'context' },
  { id: '7', name: 'News Flow', syncStatus: 'Synced', updatedAt: 'Modified 2w ago', category: 'news', view: 'news' },
  { id: '8', name: 'Community Indicators', syncStatus: 'Synced', updatedAt: 'Modified 3w ago', category: 'community', view: 'community' }
];

const DEFAULT_TABS: DesktopTab[] = [
  { id: 'home', title: 'Home', type: 'home', icon: 'home', closable: false },
  { id: 'chart-btc', title: 'BTCUSDT - 5m', type: 'chart', icon: 'chart', closable: true, symbol: 'BTCUSDT', timeframe: '5m' },
  { id: 'strategy-studio', title: 'Strategy Studio', type: 'studio', icon: 'code', closable: true, studyId: '1' },
  { id: 'macro-workspace', title: 'Macro Workspace', type: 'workspace', icon: 'grid', closable: true, workspaceId: '2' },
];

interface DesktopSyncState {
  workspaces: WorkspaceEntity[];
  studies: StudyEntity[];
  tabs: DesktopTab[];
  activeTabId: string;
  searchQuery: string;
  filterType: 'all' | 'local' | 'cloud' | 'indicator' | 'strategy';
  selectedStudyForStudio: StudyEntity | null;
  activeWorkspaceId: string | null;
  isNewStudyModalOpen: boolean;
  isWorkspacesModalOpen: boolean;
  isStudiesModalOpen: boolean;
  backtestResult: BacktestResult | null;
  isBacktestRunning: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDashboardData: () => Promise<void>;
  triggerSync: (id: string) => Promise<void>;
  setActiveTab: (id: string) => void;
  openTab: (tab: DesktopTab) => void;
  closeTab: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (filter: 'all' | 'local' | 'cloud' | 'indicator' | 'strategy') => void;
  openStudyInStudio: (study: StudyEntity) => void;
  openWorkspaceInTab: (workspace: WorkspaceEntity) => void;
  setNewStudyModalOpen: (open: boolean) => void;
  setWorkspacesModalOpen: (open: boolean) => void;
  setStudiesModalOpen: (open: boolean) => void;
  createStudy: (study: Omit<StudyEntity, 'id' | 'updatedAt'>) => void;
  updateStudy: (id: string, updates: Partial<StudyEntity>) => void;
  deleteStudy: (id: string) => void;
  duplicateStudy: (id: string) => void;
  runLocalBacktest: (studyId: string, customParams?: Record<string, any>) => Promise<BacktestResult>;
  clearBacktestResult: () => void;
}

export const useDesktopSyncStore = create<DesktopSyncState>((set, get) => ({
  workspaces: DEFAULT_WORKSPACES,
  studies: DEFAULT_STUDIES,
  tabs: DEFAULT_TABS,
  activeTabId: 'home',
  searchQuery: '',
  filterType: 'all',
  selectedStudyForStudio: DEFAULT_STUDIES[0],
  activeWorkspaceId: null,
  isNewStudyModalOpen: false,
  isWorkspacesModalOpen: false,
  isStudiesModalOpen: false,
  backtestResult: null,
  isBacktestRunning: false,
  isLoading: false,
  error: null,

  fetchDashboardData: async () => {
    set({ isLoading: true, error: null });
    try {
      // Attempt Tauri IPC
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        const data: DashboardData = await invoke('fetch_dashboard_data');
        if (data && data.workspaces && data.workspaces.length > 0) {
          // Merge with detailed local attributes
          const mergedWorkspaces = DEFAULT_WORKSPACES.map(dw => {
            const match = data.workspaces.find(w => w.id === dw.id);
            return match ? { ...dw, ...match } : dw;
          });
          const mergedStudies = DEFAULT_STUDIES.map(ds => {
            const match = data.studies.find(s => s.id === ds.id);
            return match ? { ...ds, ...match } : ds;
          });
          set({ workspaces: mergedWorkspaces, studies: mergedStudies, isLoading: false });
          return;
        }
      }
      
      // Fallback: localStorage persistence
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('zt_desktop_data_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          set({
            workspaces: parsed.workspaces || DEFAULT_WORKSPACES,
            studies: parsed.studies || DEFAULT_STUDIES,
            isLoading: false
          });
          return;
        }
      }

      set({ workspaces: DEFAULT_WORKSPACES, studies: DEFAULT_STUDIES, isLoading: false });
    } catch (err) {
      console.warn('Dashboard IPC fallback active:', err);
      set({ workspaces: DEFAULT_WORKSPACES, studies: DEFAULT_STUDIES, isLoading: false });
    }
  },

  triggerSync: async (id: string) => {
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('trigger_sync', { id });
      }
      
      set(state => {
        const nextWorkspaces = state.workspaces.map(w => w.id === id ? { ...w, syncStatus: 'Synced' as SyncStatus } : w);
        const nextStudies = state.studies.map(s => s.id === id ? { ...s, syncStatus: 'Synced' as SyncStatus } : s);
        if (typeof window !== 'undefined') {
          localStorage.setItem('zt_desktop_data_v2', JSON.stringify({ workspaces: nextWorkspaces, studies: nextStudies }));
        }
        return { workspaces: nextWorkspaces, studies: nextStudies };
      });
    } catch (err) {
      console.error('Sync failed:', err);
    }
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id });
  },

  openTab: (tab: DesktopTab) => {
    set(state => {
      const exists = state.tabs.some(t => t.id === tab.id);
      const nextTabs = exists ? state.tabs : [...state.tabs, tab];
      return { tabs: nextTabs, activeTabId: tab.id };
    });
  },

  closeTab: (id: string) => {
    set(state => {
      if (id === 'home') return state; // Home tab is permanent
      const nextTabs = state.tabs.filter(t => t.id !== id);
      const nextActive = state.activeTabId === id
        ? (nextTabs[nextTabs.length - 1]?.id || 'home')
        : state.activeTabId;
      return { tabs: nextTabs, activeTabId: nextActive };
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setFilterType: (filter) => {
    set({ filterType: filter });
  },

  openStudyInStudio: (study: StudyEntity) => {
    set(state => {
      const studioTabId = 'strategy-studio';
      const studioTabExists = state.tabs.some(t => t.id === studioTabId);
      const updatedTabs = studioTabExists
        ? state.tabs.map(t => t.id === studioTabId ? { ...t, title: `Studio: ${study.name}`, studyId: study.id } : t)
        : [...state.tabs, { id: studioTabId, title: `Studio: ${study.name}`, type: 'studio' as const, icon: 'code' as const, closable: true, studyId: study.id }];

      return {
        tabs: updatedTabs,
        activeTabId: studioTabId,
        selectedStudyForStudio: study
      };
    });
  },

  openWorkspaceInTab: (workspace: WorkspaceEntity) => {
    set(state => {
      const tabId = `ws-${workspace.id}`;
      const exists = state.tabs.some(t => t.id === tabId);
      const nextTabs = exists
        ? state.tabs
        : [...state.tabs, { id: tabId, title: workspace.name, type: 'workspace' as const, icon: 'grid' as const, closable: true, workspaceId: workspace.id }];

      return {
        tabs: nextTabs,
        activeTabId: tabId,
        activeWorkspaceId: workspace.id
      };
    });
  },

  setNewStudyModalOpen: (open: boolean) => set({ isNewStudyModalOpen: open }),
  setWorkspacesModalOpen: (open: boolean) => set({ isWorkspacesModalOpen: open }),
  setStudiesModalOpen: (open: boolean) => set({ isStudiesModalOpen: open }),

  createStudy: (studyData) => {
    const id = Date.now().toString();
    const newStudy: StudyEntity = {
      ...studyData,
      id,
      updatedAt: 'Edited just now'
    };

    set(state => {
      const nextStudies = [newStudy, ...state.studies];
      if (typeof window !== 'undefined') {
        localStorage.setItem('zt_desktop_data_v2', JSON.stringify({ workspaces: state.workspaces, studies: nextStudies }));
      }
      return {
        studies: nextStudies,
        isNewStudyModalOpen: false,
        selectedStudyForStudio: newStudy,
        activeTabId: 'strategy-studio',
        tabs: state.tabs.some(t => t.id === 'strategy-studio')
          ? state.tabs.map(t => t.id === 'strategy-studio' ? { ...t, title: `Studio: ${newStudy.name}`, studyId: newStudy.id } : t)
          : [...state.tabs, { id: 'strategy-studio', title: `Studio: ${newStudy.name}`, type: 'studio' as const, icon: 'code' as const, closable: true, studyId: newStudy.id }]
      };
    });
  },

  updateStudy: (id: string, updates: Partial<StudyEntity>) => {
    set(state => {
      const nextStudies = state.studies.map(s => s.id === id ? { ...s, ...updates, updatedAt: 'Edited just now' } : s);
      if (typeof window !== 'undefined') {
        localStorage.setItem('zt_desktop_data_v2', JSON.stringify({ workspaces: state.workspaces, studies: nextStudies }));
      }
      return {
        studies: nextStudies,
        selectedStudyForStudio: state.selectedStudyForStudio?.id === id
          ? { ...state.selectedStudyForStudio, ...updates }
          : state.selectedStudyForStudio
      };
    });
  },

  deleteStudy: (id: string) => {
    set(state => {
      const nextStudies = state.studies.filter(s => s.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('zt_desktop_data_v2', JSON.stringify({ workspaces: state.workspaces, studies: nextStudies }));
      }
      return { studies: nextStudies };
    });
  },

  duplicateStudy: (id: string) => {
    const original = get().studies.find(s => s.id === id);
    if (!original) return;
    const duplicated: StudyEntity = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      updatedAt: 'Edited just now',
      syncStatus: 'Local'
    };
    set(state => {
      const nextStudies = [duplicated, ...state.studies];
      if (typeof window !== 'undefined') {
        localStorage.setItem('zt_desktop_data_v2', JSON.stringify({ workspaces: state.workspaces, studies: nextStudies }));
      }
      return { studies: nextStudies };
    });
  },

  runLocalBacktest: async (studyId: string, customParams?: Record<string, any>) => {
    const study = get().studies.find(s => s.id === studyId) || get().selectedStudyForStudio;
    set({ isBacktestRunning: true });

    try {
      const caps = await defaultExecutionProvider.capabilities();
      if (!caps.available) {
        throw new Error("Python runtime unavailable — connect ZTerminal Local Helper to execute this strategy.");
      }

      const symbol = "BTCUSDT";
      const timeframe = "1h";
      const to = Math.floor(Date.now() / 3600000) * 3600000;
      const from = to - 30 * 86400000;

      const query = new URLSearchParams({ provider: "binance", symbol, timeframe, from: String(from), to: String(to) });
      const resp = await fetch(`/api/research-data?${query}`, { cache: "no-store" });
      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(payload.error ?? "Failed to load historical data for backtest.");
      }
      const dataset = await resp.json();

      const result = await defaultExecutionProvider.execute({
        runId: `run-${Date.now().toString(36)}`,
        name: study?.name ?? "Local Strategy",
        strategy: {
          language: "python",
          source: study?.source ?? "",
          sourceHash: dataset.hash,
          kind: study?.kind === "Indicator" ? "indicator" : "strategy",
        },
        dataset,
        parameters: customParams ?? (study?.parameters as Record<string, number | string | boolean>) ?? {},
        execution: {
          initialCapital: 100000,
          feeBps: 5,
          slippageBps: 5,
          allocation: 1,
          direction: "long",
          multiplier: 1,
          quantityStep: 0.001,
        },
      });

      const metrics: BacktestMetrics = {
        totalReturn: (result.metrics.totalReturn?.value ?? 0) * 100,
        sharpeRatio: result.metrics.sharpe?.value ?? 0,
        sortinoRatio: result.metrics.sortino?.value ?? 0,
        maxDrawdown: (result.metrics.maxDrawdown?.value ?? 0) * -100,
        winRate: (result.metrics.winRate?.value ?? 0) * 100,
        profitFactor: result.metrics.profitFactor?.value ?? 0,
        totalTrades: result.metrics.totalTrades?.value ?? 0,
        winningTrades: result.trades.filter(t => t.pnl > 0).length,
        losingTrades: result.trades.filter(t => t.pnl < 0).length,
      };

      const equityCurve = result.equity.map(p => ({
        date: new Date(p.time).toISOString().split("T")[0],
        value: p.equity,
      }));

      const trades = result.trades.map((t, idx) => ({
        id: t.id || `t${idx}`,
        time: new Date(t.entryTime).toISOString().slice(0, 16).replace("T", " "),
        side: (t.side.toUpperCase() === "SHORT" ? "SELL" : "BUY") as "BUY" | "SELL",
        price: t.entryPrice,
        pnl: t.pnl,
      }));

      const backtestResult: BacktestResult = {
        studyId: study?.id || "unknown",
        studyName: study?.name || "Local Strategy",
        symbol,
        timeframe,
        metrics,
        equityCurve,
        trades,
        sourceHash: result.sourceHash,
        datasetHash: result.dataset.hash,
        determinismHash: result.resultHash,
        executedAt: new Date(result.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };

      set({ backtestResult, isBacktestRunning: false });
      return backtestResult;
    } catch (error) {
      set({ isBacktestRunning: false });
      throw error;
    }
  },

  clearBacktestResult: () => set({ backtestResult: null })
}));
