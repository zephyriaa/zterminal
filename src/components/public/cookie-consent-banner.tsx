"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Settings, Check, X } from "lucide-react";

const CONSENT_STORAGE_KEY = "zt_cookie_consent_v1";
const CONSENT_MAX_AGE_DAYS = 180; // CNIL recommendation: 6 months

export interface CookieConsentPreferences {
  strictlyNecessary: boolean;
  analytics: boolean;
  timestamp: string;
  version: number;
}

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CookieConsentPreferences;
        const storedDate = new Date(parsed.timestamp).getTime();
        const now = Date.now();
        const ageInDays = (now - storedDate) / (1000 * 60 * 60 * 24);

        if (ageInDays < CONSENT_MAX_AGE_DAYS && parsed.version === 1) {
          setAnalyticsConsent(parsed.analytics);
          return;
        }
      }
      // If no stored consent or expired, display banner
      setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  }, []);

  // Listen for programmatic open requests (e.g. from footer "Cookie Settings" link)
  useEffect(() => {
    const handleOpen = () => {
      setIsCustomizing(true);
      setIsOpen(true);
    };
    window.addEventListener("zt:open-cookie-settings", handleOpen);
    return () => window.removeEventListener("zt:open-cookie-settings", handleOpen);
  }, []);

  const saveConsent = (analytics: boolean) => {
    const consent: CookieConsentPreferences = {
      strictlyNecessary: true,
      analytics,
      timestamp: new Date().toISOString(),
      version: 1,
    };
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
      // storage disabled
    }
    setAnalyticsConsent(analytics);
    setIsOpen(false);
    setIsCustomizing(false);
  };

  if (!mounted || !isOpen) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      role="dialog"
      aria-modal="false"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-xl border border-[rgba(197,161,230,0.24)] bg-[rgba(13,14,26,0.95)] p-5 text-slate-200 shadow-2xl backdrop-blur-xl sm:bottom-6"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(197,161,230,0.3)] bg-[rgba(101,39,228,0.18)] text-[var(--public-lilac)]">
              <Shield className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-white sm:text-base">
              Privacy &amp; Cookie Choices
            </h2>
          </div>
          {isCustomizing && (
            <button
              type="button"
              onClick={() => setIsCustomizing(false)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
              aria-label="Close customization"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
          ZTerminal uses strictly necessary cookies to authenticate sessions and protect against CSRF attacks. In accordance with EU ePrivacy and CNIL standards, non-essential cookies are disabled by default and access to the terminal is never conditioned on accepting optional tracking.
        </p>

        {isCustomizing && (
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/40 p-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <div>
                <p className="font-medium text-white">Strictly Necessary Cookies</p>
                <p className="text-[11px] text-slate-400">
                  Required for authentication, CSRF validation, and UI theme preservation (ePrivacy Art. 5(3) exempt).
                </p>
              </div>
              <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <Check className="h-3.5 w-3.5" /> Always Active
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="font-medium text-white">Optional Analytics &amp; Performance</p>
                <p className="text-[11px] text-slate-400">
                  Anonymous aggregate telemetry to evaluate terminal load and data feed latency.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={analyticsConsent}
                  onChange={(e) => setAnalyticsConsent(e.target.checked)}
                />
                <div className="h-5 w-9 rounded-full bg-slate-700 peer-checked:bg-[var(--public-lilac)] peer-focus:outline-none transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <Link href="/privacy" className="hover:text-white underline underline-offset-2">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/cookies" className="hover:text-white underline underline-offset-2">
              Cookie Policy
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isCustomizing ? (
              <>
                <button
                  type="button"
                  onClick={() => setIsCustomizing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white transition-all"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Customize
                </button>
                <button
                  type="button"
                  onClick={() => saveConsent(false)}
                  className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-all"
                >
                  Reject Non-Essential
                </button>
                <button
                  type="button"
                  onClick={() => saveConsent(true)}
                  className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/15 transition-all"
                >
                  Accept All
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => saveConsent(analyticsConsent)}
                className="rounded-lg border border-purple-500/40 bg-purple-600/30 px-4 py-1.5 text-xs font-medium text-white hover:bg-purple-600/40 transition-all"
              >
                Save Preferences
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
