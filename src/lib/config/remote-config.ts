/**
 * Remote Configuration Service
 * Provides dynamic runtime feature flags, risk parameter overrides,
 * endpoint routing, and offline-first cache fallback for ZTerminal.
 */

export interface RemoteConfigSchema {
  version: string;
  updatedAt: number;
  features: {
    enableOrderFlow: boolean;
    enableSubBarMagnifier: boolean;
    enableNativeWebSockets: boolean;
    enableAiAssistant: boolean;
    maxConcurrentCharts: number;
  };
  riskDefaults: {
    maxDailyLossUsd: number;
    maxGrossExposureUsd: number;
    emergencyHaltAll: boolean;
  };
  endpoints: {
    marketDataGateway?: string;
    historicalBarsUrl?: string;
  };
}

export const DEFAULT_CONFIG: RemoteConfigSchema = {
  version: "1.0.0",
  updatedAt: 0,
  features: {
    enableOrderFlow: true,
    enableSubBarMagnifier: true,
    enableNativeWebSockets: true,
    enableAiAssistant: true,
    maxConcurrentCharts: 8,
  },
  riskDefaults: {
    maxDailyLossUsd: 10_000,
    maxGrossExposureUsd: 250_000,
    emergencyHaltAll: false,
  },
  endpoints: {},
};

export interface RemoteConfigFetcher {
  fetchConfig(): Promise<Partial<RemoteConfigSchema>>;
}

export class RemoteConfigService {
  private currentConfig: RemoteConfigSchema;
  private cacheTtlMs: number;
  private lastFetchedAt = 0;
  private listeners = new Set<(config: RemoteConfigSchema) => void>();

  constructor(
    private fetcher?: RemoteConfigFetcher,
    initialConfig: RemoteConfigSchema = DEFAULT_CONFIG,
    cacheTtlMs = 5 * 60 * 1000, // 5 min default TTL
  ) {
    this.currentConfig = { ...initialConfig };
    this.cacheTtlMs = cacheTtlMs;
  }

  public getConfig(): RemoteConfigSchema {
    return { ...this.currentConfig };
  }

  public getFeature<K extends keyof RemoteConfigSchema["features"]>(
    key: K,
  ): RemoteConfigSchema["features"][K] {
    return this.currentConfig.features[key];
  }

  public isEmergencyHaltActive(): boolean {
    return this.currentConfig.riskDefaults.emergencyHaltAll;
  }

  public async refresh(force = false): Promise<RemoteConfigSchema> {
    const now = Date.now();
    if (!force && now - this.lastFetchedAt < this.cacheTtlMs) {
      return this.currentConfig;
    }

    if (!this.fetcher) {
      return this.currentConfig;
    }

    try {
      const remote = await this.fetcher.fetchConfig();
      this.currentConfig = {
        ...this.currentConfig,
        ...remote,
        features: {
          ...this.currentConfig.features,
          ...(remote.features ?? {}),
        },
        riskDefaults: {
          ...this.currentConfig.riskDefaults,
          ...(remote.riskDefaults ?? {}),
        },
        endpoints: {
          ...this.currentConfig.endpoints,
          ...(remote.endpoints ?? {}),
        },
        updatedAt: now,
      };
      this.lastFetchedAt = now;
      this.notifyListeners();
    } catch (err) {
      // In offline mode or fetch error, fail-safe to cached configuration
      console.warn("Failed to fetch remote config; preserving current cached config:", err);
    }

    return this.currentConfig;
  }

  public overrideLocalConfig(partial: Partial<RemoteConfigSchema>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...partial,
      features: {
        ...this.currentConfig.features,
        ...(partial.features ?? {}),
      },
      riskDefaults: {
        ...this.currentConfig.riskDefaults,
        ...(partial.riskDefaults ?? {}),
      },
    };
    this.notifyListeners();
  }

  public subscribe(listener: (config: RemoteConfigSchema) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentConfig);
    }
  }
}
