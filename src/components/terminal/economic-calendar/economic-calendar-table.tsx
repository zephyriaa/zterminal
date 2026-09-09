"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { Pill } from "@/components/terminal/primitives";
import { cn } from "@/lib/utils";
import type {
  EconomicCalendarEvent,
  EconomicCalendarResponse,
  EconomicEventImpact,
  ProviderMetadata,
} from "@/lib/economic-calendar/types";
import {
  formatEventTime,
  getNextUpcomingEvent,
  getPresetDateRange,
  groupEventsByLocalDate,
  type DateFilterPreset,
} from "@/lib/economic-calendar/date-utils";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"] as const;

export function EconomicCalendarTable() {
  const { timezone, setTimezone } = useWorkspace();

  const [datePreset, setDatePreset] = useState<DateFilterPreset>("this-week");
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>([]);
  const [selectedImpacts, setSelectedImpacts] = useState<EconomicEventImpact[]>(["high", "medium", "low", "unknown"]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EconomicCalendarEvent[]>([]);
  const [providers, setProviders] = useState<ProviderMetadata[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  // Clock tick for next-event countdown and local date matching
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchCalendar() {
      try {
        const range = getPresetDateRange(datePreset, timezone, new Date());
        const params = new URLSearchParams({
          from: range.from,
          to: range.to,
        });

        const res = await fetch(`/api/economic-calendar?${params.toString()}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Server returned status ${res.status}`);
        }

        const data = (await res.json()) as EconomicCalendarResponse;
        if (active) {
          setEvents(data.events ?? []);
          setProviders(data.providers ?? []);
          setIsStale(Boolean(data.isStale));
          setLastUpdated(data.cachedAt ? new Date(data.cachedAt).toLocaleTimeString() : new Date().toLocaleTimeString());
          setLoading(false);
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : "Failed to load economic events";
          setError(msg);
          setLoading(false);
        }
      }
    }

    fetchCalendar();
    return () => {
      active = false;
    };
  }, [datePreset, timezone]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const range = getPresetDateRange(datePreset, timezone, new Date());
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        refresh: "true",
      });

      const res = await fetch(`/api/economic-calendar?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned status ${res.status}`);
      }

      const data = (await res.json()) as EconomicCalendarResponse;
      setEvents(data.events ?? []);
      setProviders(data.providers ?? []);
      setIsStale(Boolean(data.isStale));
      setLastUpdated(data.cachedAt ? new Date(data.cachedAt).toLocaleTimeString() : new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to refresh economic events";
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  }, [datePreset, timezone]);

  // Currency toggle helper
  const toggleCurrency = (ccy: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(ccy) ? prev.filter((c) => c !== ccy) : [...prev, ccy]
    );
  };

  // Impact toggle helper
  const toggleImpact = (impact: EconomicEventImpact) => {
    setSelectedImpacts((prev) =>
      prev.includes(impact) ? prev.filter((i) => i !== impact) : [...prev, impact]
    );
  };

  // Filter events client-side for immediate responsive interaction
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedCurrencies.length > 0 && !selectedCurrencies.includes(e.currency)) return false;
      if (selectedImpacts.length > 0 && !selectedImpacts.includes(e.impact)) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = e.title.toLowerCase().includes(q);
        const matchesSource = e.source.toLowerCase().includes(q);
        const matchesCcy = e.currency.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSource && !matchesCcy) return false;
      }
      return true;
    });
  }, [events, selectedCurrencies, selectedImpacts, searchQuery]);

  // Group events by local date in selected timezone
  const dateGroups = useMemo(() => {
    return groupEventsByLocalDate(filteredEvents, timezone, nowMs);
  }, [filteredEvents, timezone, nowMs]);

  // Next high-impact countdown
  const nextEvent = useMemo(() => {
    return getNextUpcomingEvent(events, nowMs);
  }, [events, nowMs]);

  return (
    <div className="flex h-full flex-col bg-background text-foreground font-sans select-none overflow-hidden">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b hairline bg-panel px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-mdata" />
          <span className="font-semibold uppercase tracking-wider text-foreground">Economic Calendar</span>
          {nextEvent && (
            <div className="hidden md:flex items-center gap-1.5 rounded-[4px] border hairline bg-surface px-2 py-0.5 text-[10px]">
              <span className="text-muted-foreground uppercase tracking-widest text-[9px]">Next:</span>
              <span className="font-mono-num font-semibold text-foreground">{nextEvent.event.currency} {nextEvent.event.title.slice(0, 24)}</span>
              <span className="font-mono-num text-mdata font-medium">in {nextEvent.countdownText}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Timezone Switcher */}
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className="text-muted-foreground hidden sm:inline">Timezone:</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value as ChartTimezone)}
              className="h-6 rounded border hairline bg-surface px-2 text-[10.5px] text-foreground outline-none focus:border-mdata"
            >
              <option value="America/New_York">New York (ET)</option>
              <option value="UTC">UTC</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Asia/Dubai">Dubai (GST)</option>
            </select>
          </div>

          {/* Refresh & Cache Status */}
          <div className="flex items-center gap-1.5">
            {isStale ? (
              <Pill tone="warn">STALE CACHE</Pill>
            ) : lastUpdated ? (
              <span className="hidden sm:inline text-[9.5px] text-muted-foreground">
                Updated {lastUpdated}
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              title="Refresh economic calendar"
              className="grid h-6 w-6 place-items-center rounded border hairline bg-surface text-muted-foreground hover:text-foreground hover:bg-hover transition-colors"
            >
              <RefreshCw className={cn("h-3 w-3", (refreshing || loading) && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b hairline bg-panel/60 px-3 py-1.5 text-[10.5px]">
        {/* Date presets */}
        <div className="flex items-center gap-1">
          {(["today", "tomorrow", "this-week", "next-week", "all"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDatePreset(preset)}
              className={cn(
                "rounded px-2 py-0.5 capitalize transition-colors",
                datePreset === preset
                  ? "bg-mdata/20 text-mdata font-semibold border border-mdata/40"
                  : "bg-surface text-muted-foreground hover:text-foreground border hairline"
              )}
            >
              {preset.replace("-", " ")}
            </button>
          ))}
        </div>

        <span className="h-3 w-px bg-border/40 hidden sm:block" />

        {/* Currency multi-filters */}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setSelectedCurrencies([])}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] uppercase transition-colors",
              selectedCurrencies.length === 0
                ? "bg-foreground/15 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All CCY
          </button>
          {CURRENCIES.map((ccy) => {
            const isSelected = selectedCurrencies.includes(ccy);
            return (
              <button
                key={ccy}
                type="button"
                onClick={() => toggleCurrency(ccy)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-mono-num transition-colors",
                  isSelected
                    ? "bg-mdata text-mdata-foreground font-bold"
                    : "bg-surface text-muted-foreground hover:text-foreground border hairline"
                )}
              >
                {ccy}
              </button>
            );
          })}
        </div>

        <span className="h-3 w-px bg-border/40 hidden md:block" />

        {/* Impact filters */}
        <div className="flex items-center gap-1">
          <ImpactButton
            impact="high"
            label="High"
            active={selectedImpacts.includes("high")}
            onClick={() => toggleImpact("high")}
          />
          <ImpactButton
            impact="medium"
            label="Med"
            active={selectedImpacts.includes("medium")}
            onClick={() => toggleImpact("medium")}
          />
          <ImpactButton
            impact="low"
            label="Low"
            active={selectedImpacts.includes("low")}
            onClick={() => toggleImpact("low")}
          />
          <ImpactButton
            impact="unknown"
            label="Other"
            active={selectedImpacts.includes("unknown")}
            onClick={() => toggleImpact("unknown")}
          />
        </div>

        {/* Search Box */}
        <div className="ml-auto flex items-center gap-1">
          <div className="relative">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search release…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-6 w-32 md:w-44 rounded border hairline bg-surface pl-6 pr-2 text-[10.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-mdata"
            />
          </div>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin">
        {loading && events.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[11px] flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-mdata" />
            <span>Loading verified economic calendar data…</span>
          </div>
        ) : error && events.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[11px]">
            <p className="text-warn font-semibold">Calendar feed unavailable</p>
            <p className="mt-1 text-[10px]">{error}</p>
            <button
              type="button"
              onClick={handleManualRefresh}
              className="mt-3 rounded border hairline bg-surface px-3 py-1 text-[10.5px] hover:bg-hover"
            >
              Retry
            </button>
          </div>
        ) : dateGroups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-[11px]">
            <p className="font-medium text-foreground/80">No economic events match these filters.</p>
            <p className="mt-1 text-[10px]">Try clearing active currency or impact filters.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 border-b hairline bg-panel text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-16 px-2 py-1.5 text-left font-medium">Time</th>
                <th className="w-12 px-2 py-1.5 text-center font-medium">CCY</th>
                <th className="w-12 px-2 py-1.5 text-center font-medium">Imp</th>
                <th className="px-3 py-1.5 text-left font-medium">Event</th>
                <th className="w-20 px-2 py-1.5 text-right font-medium">Actual</th>
                <th className="w-20 px-2 py-1.5 text-right font-medium">Forecast</th>
                <th className="w-20 px-2 py-1.5 text-right font-medium">Previous</th>
                <th className="w-24 px-2 py-1.5 text-left font-medium hidden md:table-cell">Source</th>
              </tr>
            </thead>
            <tbody>
              {dateGroups.map((group) => (
                <DateGroupBlock
                  key={group.dateKey}
                  group={group}
                  timezone={timezone}
                  expandedId={expandedEventId}
                  onToggleExpand={(id) => setExpandedEventId((prev) => (prev === id ? null : id))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Provider Status Footer */}
      <div className="border-t hairline bg-panel px-3 py-1 text-[9.5px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold uppercase tracking-wider text-[9px] text-muted-foreground/80">Sources:</span>
          {providers.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  p.status === "healthy"
                    ? "bg-pos"
                    : p.status === "unconfigured"
                    ? "bg-muted-foreground/50"
                    : "bg-warn"
                )}
              />
              <span className={p.status === "healthy" ? "text-foreground/90" : "text-muted-foreground"}>
                {p.label.split("(")[0].trim()} ({p.status})
              </span>
            </span>
          ))}
        </div>
        <div className="text-[9px] text-muted-foreground/70">
          Canonical time UTC · Display in {timezone}
        </div>
      </div>
    </div>
  );
}

function DateGroupBlock({
  group,
  timezone,
  expandedId,
  onToggleExpand,
}: {
  group: { dateKey: string; header: string; events: EconomicCalendarEvent[] };
  timezone: ChartTimezone;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}) {
  return (
    <>
      <tr className="sticky top-[27px] z-10 bg-surface/90 backdrop-blur-sm border-y hairline">
        <td colSpan={8} className="px-3 py-1 text-[9.5px] font-bold uppercase tracking-wider text-mdata">
          {group.header}
        </td>
      </tr>
      {group.events.map((event) => {
        const isExpanded = expandedId === event.id;
        const timeStr = formatEventTime(event.scheduledAt, timezone);

        return (
          <EventRow
            key={event.id}
            event={event}
            timeStr={timeStr}
            isExpanded={isExpanded}
            onToggle={() => onToggleExpand(event.id)}
          />
        );
      })}
    </>
  );
}

function EventRow({
  event,
  timeStr,
  isExpanded,
  onToggle,
}: {
  event: EconomicCalendarEvent;
  timeStr: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "border-b hairline cursor-pointer transition-colors text-[11px]",
          isExpanded ? "bg-mdata/10" : "hover:bg-hover/50"
        )}
      >
        {/* Time */}
        <td className="px-2 py-1.5 font-mono-num text-[10.5px] text-muted-foreground whitespace-nowrap">
          {timeStr}
        </td>

        {/* Currency */}
        <td className="px-2 py-1.5 text-center font-mono-num font-semibold text-[10px] whitespace-nowrap">
          <span className="rounded bg-surface px-1.5 py-0.5 border hairline text-foreground/90">
            {event.currency}
          </span>
        </td>

        {/* Impact Pips */}
        <td className="px-2 py-1.5 text-center">
          <ImpactPips impact={event.impact} />
        </td>

        {/* Title */}
        <td className="px-3 py-1.5 text-foreground font-medium flex items-center gap-1.5 truncate">
          <span className="truncate">{event.title}</span>
          {event.unit && <span className="text-[9px] text-muted-foreground font-normal">({event.unit})</span>}
        </td>

        {/* Actual */}
        <td className="px-2 py-1.5 text-right font-mono-num text-[11px] font-semibold whitespace-nowrap">
          {event.actual !== null && event.actual !== undefined ? (
            <span className="text-foreground">{event.actual}</span>
          ) : (
            <span className="text-muted-foreground/40">—</span>
          )}
        </td>

        {/* Forecast */}
        <td className="px-2 py-1.5 text-right font-mono-num text-[10.5px] text-muted-foreground whitespace-nowrap">
          {event.forecast ?? "—"}
        </td>

        {/* Previous */}
        <td className="px-2 py-1.5 text-right font-mono-num text-[10.5px] text-muted-foreground whitespace-nowrap">
          {event.previous ?? "—"}
        </td>

        {/* Source */}
        <td className="px-2 py-1.5 text-[9.5px] text-muted-foreground truncate hidden md:table-cell">
          {event.source}
        </td>
      </tr>

      {/* Expanded Detail Panel */}
      {isExpanded && (
        <tr className="bg-panel/40 border-b hairline">
          <td colSpan={8} className="p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded border hairline bg-surface p-3 text-[11px]">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Release Metadata</div>
                <div className="mt-1 font-semibold text-foreground">{event.title}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Scheduled UTC: <span className="font-mono-num text-foreground">{event.scheduledAt}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  Status: <span className="capitalize text-foreground">{event.status}</span>
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Figures</div>
                <div className="mt-1 grid grid-cols-3 gap-2 font-mono-num text-[11px]">
                  <div>
                    <span className="block text-[9px] text-muted-foreground">Actual</span>
                    <span className="font-semibold text-foreground">{event.actual ?? "Unreleased"}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-muted-foreground">Forecast</span>
                    <span className="text-muted-foreground">{event.forecast ?? "None"}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] text-muted-foreground">Previous</span>
                    <span className="text-muted-foreground">{event.previous ?? "None"}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Source Provenance</div>
                <div className="mt-1 text-[10.5px] text-foreground">{event.source}</div>
                {event.sourceUrl && (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-mdata hover:underline"
                  >
                    View official publication <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {event.providerEventId && (
                  <div className="mt-1 text-[9px] text-muted-foreground font-mono-num">
                    ID: {event.providerEventId}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ImpactPips({ impact }: { impact: EconomicEventImpact }) {
  switch (impact) {
    case "high":
      return (
        <span className="inline-flex gap-0.5 text-[8px] text-rose-500 font-bold" title="High Impact">
          ●●●
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex gap-0.5 text-[8px] text-amber-500 font-bold" title="Medium Impact">
          ●●<span className="text-muted-foreground/30">○</span>
        </span>
      );
    case "low":
      return (
        <span className="inline-flex gap-0.5 text-[8px] text-emerald-400 font-bold" title="Low Impact">
          ●<span className="text-muted-foreground/30">○○</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex gap-0.5 text-[8px] text-muted-foreground/40 font-bold" title="Impact Unknown">
          ○○○
        </span>
      );
  }
}

function ImpactButton({
  impact,
  label,
  active,
  onClick,
}: {
  impact: EconomicEventImpact;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] transition-colors inline-flex items-center gap-1",
        active
          ? "bg-surface text-foreground border hairline font-medium"
          : "text-muted-foreground/50 hover:text-muted-foreground"
      )}
    >
      <ImpactPips impact={impact} />
      <span>{label}</span>
    </button>
  );
}
