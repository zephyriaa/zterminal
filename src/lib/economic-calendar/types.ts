/**
 * ZTerminal — Normalized Economic Calendar Domain Model.
 *
 * Analytics and UI components must never depend on provider-specific
 * payloads or conventions. Provider adapters normalize external data
 * into these authoritative contracts.
 *
 * All timestamps are canonically ISO-8601 UTC strings.
 */

export type EconomicEventImpact = "low" | "medium" | "high" | "unknown";
export type EconomicEventStatus = "scheduled" | "released" | "revised";

export interface EconomicCalendarEvent {
  /** Deterministic stable ID: e.g. `${source}:${currency}:${slug}:${scheduledAt}` */
  id: string;

  /** Event headline / indicator title (e.g. "FOMC Interest Rate Decision", "Consumer Price Index m/m") */
  title: string;

  /** Country code (ISO 3166-1 alpha-2, e.g. "US", "EU", "GB", "JP") */
  country?: string;

  /** Currency code (ISO 4217, e.g. "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF") */
  currency: string;

  /** Canonical scheduled release time in ISO-8601 UTC (e.g. "2026-09-17T18:00:00.000Z") */
  scheduledAt: string;

  /** Observed actual value upon release, or null if not yet released */
  actual?: string | null;

  /** Verified consensus forecast, or null if unprovided or not applicable */
  forecast?: string | null;

  /** Prior period figure, or null if unprovided */
  previous?: string | null;

  /** Prior figure revised value, if reported */
  revised?: string | null;

  /** Market impact level according to authoritative or normalized criteria */
  impact: EconomicEventImpact;

  /** Release state */
  status: EconomicEventStatus;

  /** Primary authoritative or reporting source (e.g. "Federal Reserve", "Bureau of Labor Statistics", "ECB") */
  source: string;

  /** Direct link to authoritative release or announcement page, if available */
  sourceUrl?: string;

  /** Upstream provider's native event ID for auditability and deduplication */
  providerEventId?: string;

  /** Optional explanatory context or indicator unit (e.g. "m/m", "y/y", "%", "K") */
  unit?: string;
  period?: string;
}

export type ProviderHealthStatus = "healthy" | "unconfigured" | "degraded" | "failed";

export interface ProviderMetadata {
  id: string;
  label: string;
  status: ProviderHealthStatus;
  message?: string;
  lastUpdated?: string;
}

export interface EconomicCalendarResponse {
  events: EconomicCalendarEvent[];
  providers: ProviderMetadata[];
  from: string;
  to: string;
  cachedAt: string;
  isStale: boolean;
}

export interface CalendarRequest {
  from: Date;
  to: Date;
  currencies?: string[];
  impacts?: EconomicEventImpact[];
}

export interface EconomicCalendarProviderResult {
  providerId: string;
  status: ProviderHealthStatus;
  events: EconomicCalendarEvent[];
  message?: string;
  error?: string;
}

export interface EconomicCalendarProvider {
  readonly id: string;
  readonly label: string;
  isConfigured(): boolean;
  fetchEvents(request: CalendarRequest): Promise<EconomicCalendarProviderResult>;
}
