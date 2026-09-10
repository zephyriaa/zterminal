"use client";

import { Check, Globe } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace, type ChartTimezone } from "@/stores/workspace";
import { formatTimezonePill, resolveEffectiveTimezone } from "@/lib/market/market-sessions";
import { cn } from "@/lib/utils";

const TIMEZONE_LIST: { id: ChartTimezone; label: string; city: string; iana: string }[] = [
  { id: "local", label: "Local system time", city: "Local", iana: "Auto-detect" },
  { id: "UTC", label: "Coordinated Universal Time", city: "UTC", iana: "UTC" },
  { id: "America/New_York", label: "New York (ET)", city: "New York", iana: "America/New_York" },
  { id: "Europe/London", label: "London (GMT/BST)", city: "London", iana: "Europe/London" },
  { id: "Asia/Tokyo", label: "Tokyo (JST)", city: "Tokyo", iana: "Asia/Tokyo" },
  { id: "Asia/Dubai", label: "Dubai (GST)", city: "Dubai", iana: "Asia/Dubai" },
];

export function TimezonePopover() {
  const { timezone, setTimezone } = useWorkspace();
  const pillLabel = formatTimezonePill(timezone);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="zt-status-bar-item hover:bg-hover hover:text-foreground text-muted-foreground transition-colors flex items-center gap-1.5 px-2 py-0.5"
          aria-label={`Timezone: ${pillLabel}. Click to change.`}
          title="Change display timezone"
        >
          <span className="font-mono-num text-[10.5px] font-medium">{pillLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={6}
        className="w-[260px] p-2 zt-popover-terminal border border-border/80 bg-panel text-foreground shadow-2xl rounded-[6px]"
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/60 mb-1">
          <Globe className="h-3.5 w-3.5 text-mdata" />
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            WORKSTATION TIMEZONE
          </span>
        </div>
        <div className="space-y-0.5">
          {TIMEZONE_LIST.map((item) => {
            const isSelected = timezone === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTimezone(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-2 py-1.5 text-left rounded-[4px] text-[11px] transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground/80 hover:bg-hover hover:text-foreground"
                )}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-[11px]">{item.city}</span>
                  <span className="text-[9px] text-muted-foreground">{item.label}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-border/60 px-2 py-1 text-[9px] text-muted-foreground/75">
          Active: <code className="font-mono-num text-foreground/90">{resolveEffectiveTimezone(timezone)}</code>
        </div>
      </PopoverContent>
    </Popover>
  );
}
