"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  UserRound,
  LogOut,
  Terminal,
  Settings2,
  Cloud,
  Loader2,
  Edit2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import styles from "./public-shared.module.css";

interface PublicHeaderAccountProps {
  onNavigate?: () => void;
}

export function PublicHeaderAccount({ onNavigate }: PublicHeaderAccountProps) {
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleSignInAvailable, setGoogleSignInAvailable] = useState<boolean | null>(null);

  // Check auth runtime availability matching AccountPanel
  useEffect(() => {
    let active = true;
    void fetch("/api/auth/config", { cache: "no-store" })
      .then(async (response) => ({
        response,
        body: await response.json().catch(() => null),
      }))
      .then(({ response, body }) => {
        if (active) setGoogleSignInAvailable(Boolean(response.ok && body?.enabled));
      })
      .catch(() => {
        if (active) setGoogleSignInAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (googleSignInAvailable === false) {
      setAuthError("Cloud identity is not configured for this deployment.");
      return;
    }
    setSigningIn(true);
    setAuthError(null);
    try {
      const result = await signIn("google", {
        callbackUrl: window.location.pathname || "/terminal",
      });
      if (result?.error) throw new Error(result.error);
    } catch {
      setSigningIn(false);
      setAuthError("Could not start Google sign-in. Please try again.");
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setAuthError(null);
    try {
      await signOut({ redirect: false });
      setDropdownOpen(false);
      onNavigate?.();
    } catch {
      // Fallback redirect if client sign-out fails
      await signOut({ callbackUrl: window.location.pathname });
    } finally {
      setSigningOut(false);
    }
  };

  const authenticated = status === "authenticated" && Boolean(session?.user);
  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email || "Account";
  const subtitle = user?.name
    ? (user.email || "Manage account")
    : "Manage account";
  const userImage = user?.image;
  const initial = displayName[0]?.toUpperCase() || "U";

  // Reserved loading state: neutral, stable dimensions, zero layout shift
  if (status === "loading") {
    return (
      <div
        className={`${styles.accountCapsule} ${styles.accountCapsuleLoading}`}
        aria-busy="true"
        aria-label="Resolving account session"
      >
        <div className={styles.accountAvatar}>
          <UserRound className="w-3.5 h-3.5 opacity-60" aria-hidden="true" />
          <span className={styles.syncDot} style={{ opacity: 0.3 }} aria-hidden="true" />
        </div>
        <div className={styles.accountMeta}>
          <span className={styles.accountName}>Account</span>
          <span className={styles.accountStatus}>Connecting...</span>
        </div>
        <svg
          className={styles.accountChevron}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    );
  }

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${styles.accountCapsule} ${styles.accountCapsuleBtn}`}
          title={authenticated ? `${displayName} (${user?.email || ""})` : "Account: Sign in or manage profile"}
          aria-label={authenticated ? `Account menu for ${displayName}` : "Account and sign-in menu"}
          aria-expanded={dropdownOpen}
        >
          <div className={styles.accountAvatar}>
            {authenticated && userImage ? (
              <img
                src={userImage}
                alt=""
                referrerPolicy="no-referrer"
                className={styles.accountAvatarImg}
              />
            ) : authenticated ? (
              <span className={styles.accountAvatarInitial}>{initial}</span>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
            <span
              className={authenticated ? styles.syncDot : styles.syncDotOff}
              aria-hidden="true"
            />
          </div>
          <div className={styles.accountMeta}>
            <span className={styles.accountName}>
              {authenticated ? displayName : "Account"}
            </span>
            <span className={styles.accountStatus}>
              {authenticated ? subtitle : "Sign in or manage profile"}
            </span>
          </div>
          <svg
            className={`${styles.accountChevron} ${dropdownOpen ? styles.accountChevronOpen : ""}`}
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={styles.accountDropdown}
      >
        {authError && (
          <div className="m-1.5 p-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10.5px] leading-relaxed flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {authenticated ? (
          /* ================= SIGNED-IN MENU ================= */
          <>
            <div className={styles.accountDropdownHeader}>
              <div className="relative shrink-0">
                {userImage ? (
                  <img
                    src={userImage}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full object-cover border border-cyan-500/50 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-cyan-950 border border-cyan-500/40 grid place-items-center text-cyan-400 font-bold text-xs">
                    {initial}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-slate-100 tracking-tight">
                    {displayName}
                  </span>
                  <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                    Verified
                  </span>
                </div>
                <p className="truncate text-[10px] text-slate-400 font-mono mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="px-3 py-1.5 flex items-center gap-1.5 text-[10px] text-slate-400 border-b border-white/[0.06]">
              <Cloud className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="truncate">Cloud Workspaces Sync Active</span>
            </div>

            <div className="py-1">
              <DropdownMenuItem asChild>
                <Link
                  href="/terminal"
                  className={styles.accountDropdownItem}
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigate?.();
                  }}
                >
                  <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Launch Research Terminal</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  href="/terminal?account=profile"
                  className={styles.accountDropdownItem}
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigate?.();
                  }}
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Manage Profile & Avatar</span>
                </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
                <Link
                  href="/terminal?panel=settings"
                  className={styles.accountDropdownItem}
                  onClick={() => {
                    setDropdownOpen(false);
                    onNavigate?.();
                  }}
                >
                  <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Terminal Preferences</span>
                </Link>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className={styles.accountDropdownSeparator} />

            <div className="py-1">
              <DropdownMenuItem
                className={`${styles.accountDropdownItem} ${styles.accountDropdownItemDanger}`}
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                {signingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Sign out</span>
                  </>
                )}
              </DropdownMenuItem>
            </div>
          </>
        ) : (
          /* ================= SIGNED-OUT MENU ================= */
          <div className="p-3 space-y-3">
            <div>
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                ZT Research Identity
              </span>
              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                Connect your verified Google account to sync named workspaces across devices.
              </p>
            </div>

            {googleSignInAvailable === false ? (
              <div className="rounded border border-white/10 bg-white/[0.03] p-2.5 text-[10px] leading-relaxed text-slate-400">
                Cloud identity and workspace sync are unavailable until Google OAuth, a session secret, and PostgreSQL are configured. Local research remains on this device.
              </div>
            ) : (
              <button
                type="button"
                className="w-full py-2 px-3 rounded bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-medium text-xs shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                disabled={signingIn || googleSignInAvailable === null}
                onClick={() => void handleGoogleSignIn()}
              >
                {signingIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-700" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 shrink-0">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            )}

            <div className="pt-1 border-t border-white/[0.08] flex items-center justify-between text-[10px]">
              <Link
                href="/terminal?account=signin"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
                onClick={() => {
                  setDropdownOpen(false);
                  onNavigate?.();
                }}
              >
                <Terminal className="w-3 h-3" />
                <span>Open in Terminal</span>
              </Link>
              <span className="text-slate-500 font-mono text-[9px]">Google OAuth only</span>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
