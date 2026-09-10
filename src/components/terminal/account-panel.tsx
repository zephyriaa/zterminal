"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  Camera,
  Check,
  Cloud,
  CloudOff,
  Database,
  Edit2,
  Image as ImageIcon,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Curated institutional quantitative avatar presets (encoded SVG data URIs)
export const INSTITUTIONAL_AVATAR_PRESETS = [
  {
    id: "quant-teal",
    label: "Quant",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2306b6d4'/%3E%3Cstop offset='100%25' stop-color='%233b82f6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='50' fill='%230b1329'/%3E%3Ccircle cx='50' cy='50' r='40' fill='none' stroke='url(%23g1)' stroke-width='4' stroke-dasharray='6 3'/%3E%3Ccircle cx='50' cy='50' r='24' fill='url(%23g1)' opacity='0.85'/%3E%3Ctext x='50' y='57' font-family='monospace' font-size='20' font-weight='bold' fill='%23ffffff' text-anchor='middle'%3EQT%3C/text%3E%3C/svg%3E",
  },
  {
    id: "alpha-gold",
    label: "Alpha",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g2' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23f59e0b'/%3E%3Cstop offset='100%25' stop-color='%23ef4444'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='50' fill='%231c150c'/%3E%3Cpolygon points='50,18 78,74 22,74' fill='none' stroke='url(%23g2)' stroke-width='4'/%3E%3Ccircle cx='50' cy='52' r='12' fill='url(%23g2)'/%3E%3Ctext x='50' y='56' font-family='sans-serif' font-size='14' font-weight='bold' fill='%23000' text-anchor='middle'%3E%CE%B1%3C/text%3E%3C/svg%3E",
  },
  {
    id: "cyber-matrix",
    label: "Matrix",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g3' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2310b981'/%3E%3Cstop offset='100%25' stop-color='%23059669'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='50' fill='%23051a14'/%3E%3Crect x='28' y='28' width='44' height='44' rx='8' fill='none' stroke='url(%23g3)' stroke-width='4'/%3E%3Cpath d='M38 50 L46 58 L62 42' fill='none' stroke='%2334d399' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
  },
  {
    id: "deep-neural",
    label: "Neural",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cdefs%3E%3ClinearGradient id='g4' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%238b5cf6'/%3E%3Cstop offset='100%25' stop-color='%23ec4899'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='100' rx='50' fill='%231a0b2e'/%3E%3Ccircle cx='35' cy='35' r='10' fill='url(%23g4)'/%3E%3Ccircle cx='65' cy='35' r='10' fill='url(%23g4)'/%3E%3Ccircle cx='50' cy='68' r='12' fill='url(%23g4)'/%3E%3Cline x1='35' y1='35' x2='50' y2='68' stroke='%23a78bfa' stroke-width='3'/%3E%3Cline x1='65' y1='35' x2='50' y2='68' stroke='%23a78bfa' stroke-width='3'/%3E%3Cline x1='35' y1='35' x2='65' y2='35' stroke='%23a78bfa' stroke-width='3'/%3E%3C/svg%3E",
  },
];

export function AccountPanel({
  symbol,
  provider,
  dataStatus,
  onClose,
}: {
  symbol: string;
  provider?: string;
  dataStatus: string;
  onClose: () => void;
}) {
  const { data: session, status, update: updateSession } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const urlParams = new URLSearchParams(window.location.search);
    const err = urlParams.get("error");
    if (!err) return null;
    if (err === "OAuthCallback" || err === "OAuthSignin") {
      return "Google OAuth configuration or redirect mismatch. Ensure authorized callback URL is registered in Google Cloud Console.";
    }
    if (err === "AccessDenied") {
      return "Sign-in cancelled or Google account permission was denied.";
    }
    return `Authentication error: ${err}`;
  });

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<"preset" | "upload" | "url">("preset");

  const panelRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartEditing = () => {
    setNameInput(session?.user?.name || "");
    setImageInput(session?.user?.image || "");
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
    setIsEditing(true);
  };

  // Handle closing on escape / outside click
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".zt-research-account")) return;
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signIn("google", { callbackUrl: "/terminal" });
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Failed to initiate Google sign-in.");
      setSigningIn(false);
    }
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      setProfileErrorMsg("Image size exceeds 500KB limit. Please choose a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageInput(reader.result);
        setProfileErrorMsg(null);
      }
    };
    reader.onerror = () => {
      setProfileErrorMsg("Failed to read selected image file.");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);

    try {
      const trimmedName = nameInput.trim();
      const trimmedImage = imageInput.trim();

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName || undefined,
          image: trimmedImage || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.errors?.[0]?.message || "Failed to update profile");
      }

      // Update NextAuth client-side session immediately
      await updateSession({
        name: trimmedName,
        image: trimmedImage,
      });

      setProfileSuccessMsg("Profile updated successfully");
      setTimeout(() => {
        setProfileSuccessMsg(null);
        setIsEditing(false);
      }, 1400);
    } catch (err) {
      setProfileErrorMsg(err instanceof Error ? err.message : "Error saving profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleResetToGoogleImage = () => {
    setImageInput("https://lh3.googleusercontent.com/a/default-user=s96-c");
  };

  const authenticated = status === "authenticated" && Boolean(session?.user?.email);
  const displayName = session?.user?.name || session?.user?.email || "Research workspace";
  const userImage = session?.user?.image;

  return (
    <section
      ref={panelRef}
      className="zt-account-panel zt-account-panel-auth max-h-[85vh] overflow-y-auto"
      aria-label="Research account and cloud workspace"
    >
      <header className="sticky top-0 z-10 bg-panel/95 backdrop-blur-sm border-b border-border/60">
        <div>
          <span>ZT RESEARCH IDENTITY</span>
          <h2>{authenticated ? "Quantitative Profile" : "Save Your Research"}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close account information">
          <X />
        </button>
      </header>

      {authError && (
        <div className="m-3 p-2.5 rounded border border-warn/40 bg-warn/10 text-warn text-[10.5px] leading-relaxed flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <b className="block font-semibold">Google Sign-In Alert</b>
            <span>{authError}</span>
          </div>
        </div>
      )}

      {authenticated ? (
        <div className="p-3 border-b border-border/70 bg-gradient-to-r from-accent/10 via-surface/40 to-transparent">
          {!isEditing ? (
            <div>
              <div className="flex items-center gap-3">
                <div className="relative group shrink-0">
                  {userImage ? (
                    <img
                      src={userImage}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full border-2 border-accent/60 object-cover shadow-sm bg-surface"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full border-2 border-accent/60 bg-surface grid place-items-center text-accent font-bold text-sm">
                      {displayName[0]?.toUpperCase() || <UserRound className="w-5 h-5" />}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleStartEditing}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground grid place-items-center shadow hover:scale-110 transition-transform"
                    title="Change profile picture"
                  >
                    <Camera className="w-2.5 h-2.5" />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <b className="truncate text-xs font-semibold text-foreground tracking-tight">{displayName}</b>
                    <span className="inline-flex items-center px-1.5 py-0.2 text-[9px] rounded-full bg-pos/15 text-pos border border-pos/30 font-mono">
                      Verified
                    </span>
                  </div>
                  <p className="truncate text-[10.5px] text-muted-foreground font-mono mt-0.5">{session?.user?.email}</p>
                </div>

                <button
                  type="button"
                  className="zt-account-signout"
                  onClick={() => void signOut({ callbackUrl: "/terminal" })}
                  title="Sign out of Google"
                >
                  <LogOut />
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium rounded border border-border hover:border-accent/60 hover:text-accent transition-colors text-muted-foreground bg-surface/60"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit Profile & Avatar
                </button>
                <span className="text-[9.5px] font-mono text-muted-foreground/80">Google Auth active</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-border/50">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5 text-accent" />
                  Update Profile Details
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setProfileErrorMsg(null);
                    setProfileSuccessMsg(null);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>

              {profileErrorMsg && (
                <div className="p-2 text-[10px] rounded bg-neg/10 border border-neg/30 text-neg">
                  {profileErrorMsg}
                </div>
              )}
              {profileSuccessMsg && (
                <div className="p-2 text-[10px] rounded bg-pos/10 border border-pos/30 text-pos flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {profileSuccessMsg}
                </div>
              )}

              {/* Display Name Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Display Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your Name / Quantitative Analyst"
                  maxLength={80}
                  className="w-full px-2.5 py-1.5 text-xs font-medium rounded bg-surface border border-border text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Avatar Selector Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Profile Picture / Avatar
                  </label>
                  <div className="flex items-center gap-1 text-[9px]">
                    <button
                      type="button"
                      onClick={() => setUploadMode("preset")}
                      className={cn(
                        "px-1.5 py-0.5 rounded transition-colors",
                        uploadMode === "preset" ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Presets
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("upload")}
                      className={cn(
                        "px-1.5 py-0.5 rounded transition-colors",
                        uploadMode === "upload" ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode("url")}
                      className={cn(
                        "px-1.5 py-0.5 rounded transition-colors",
                        uploadMode === "url" ? "bg-accent text-accent-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      URL
                    </button>
                  </div>
                </div>

                {/* Avatar Preview */}
                <div className="flex items-center gap-3 p-2 rounded bg-surface/80 border border-border/60">
                  <div className="relative shrink-0">
                    {imageInput ? (
                      <img
                        src={imageInput}
                        alt="Preview"
                        className="w-12 h-12 rounded-full border border-accent/70 object-cover shadow bg-background"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-border bg-background grid place-items-center text-muted-foreground">
                        <UserRound className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-[10px] text-muted-foreground">
                    <p className="font-semibold text-foreground">Avatar Live Preview</p>
                    <p className="truncate mt-0.5">Select a preset badge, upload a custom picture, or link an image.</p>
                  </div>
                </div>

                {/* Mode 1: Presets */}
                {uploadMode === "preset" && (
                  <div className="space-y-1.5">
                    <span className="text-[9.5px] text-muted-foreground block">Institutional Quant Presets:</span>
                    <div className="grid grid-cols-4 gap-2">
                      {INSTITUTIONAL_AVATAR_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setImageInput(preset.url)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-1.5 rounded border transition-all hover:border-accent/80 hover:bg-accent/5",
                            imageInput === preset.url ? "border-accent bg-accent/15 ring-1 ring-accent" : "border-border/60 bg-surface/50"
                          )}
                        >
                          <img src={preset.url} alt={preset.label} className="w-7 h-7 rounded-full" />
                          <span className="text-[9px] font-mono text-muted-foreground">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode 2: File Upload */}
                {uploadMode === "upload" && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageFileUpload}
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2.5 px-3 rounded border border-dashed border-border/80 hover:border-accent/80 hover:bg-accent/5 transition-all text-[11px] font-medium flex items-center justify-center gap-2 text-foreground"
                    >
                      <Upload className="w-3.5 h-3.5 text-accent" />
                      Choose Image File (max 500KB)
                    </button>
                  </div>
                )}

                {/* Mode 3: Image URL */}
                {uploadMode === "url" && (
                  <div className="space-y-1">
                    <input
                      type="url"
                      value={imageInput}
                      onChange={(e) => setImageInput(e.target.value)}
                      placeholder="https://example.com/avatar.jpg"
                      className="w-full px-2.5 py-1.5 text-[11px] font-mono rounded bg-surface border border-border text-foreground focus:outline-none focus:border-accent"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleResetToGoogleImage}
                    className="text-[9.5px] text-muted-foreground hover:text-accent flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Reset to Google Photo
                  </button>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 py-1.5 px-3 rounded bg-accent text-accent-foreground text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      Save Profile
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSavingProfile}
                  className="py-1.5 px-3 rounded border border-border text-muted-foreground text-[11px] hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Unauthenticated: Clean, Single Google Login */
        <div className="zt-account-signin-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-surface border border-border/80 grid place-items-center shadow-sm shrink-0">
              {/* Authentic Google G Icon */}
              <svg viewBox="0 0 24 24" className="w-4 h-4">
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
            </div>
            <div>
              <b className="text-xs font-semibold text-foreground">Sign in with Google</b>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                Connect your verified Google account to persist named workspaces, custom indicators, and quantitative profiles securely across devices.
              </p>
            </div>
          </div>

          <div className="w-full pt-1">
            <button
              type="button"
              className="w-full py-2.5 px-4 rounded bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-medium text-xs shadow-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed hover:shadow"
              disabled={status === "loading" || signingIn}
              onClick={() => void handleGoogleSignIn()}
            >
              {signingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-700" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
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
                  <span className="tracking-tight">Continue with Google</span>
                </>
              )}
            </button>
            <p className="text-[9.5px] text-center text-muted-foreground mt-2">
              Google is the exclusive authentication provider for ZTerminal.
            </p>
          </div>
        </div>
      )}

      {/* Account Facts */}
      <div className="zt-account-facts">
        <div>
          <span>Permission scope</span>
          <b>
            <ShieldCheck />
            Research only
          </b>
        </div>
        <div>
          <span>Active provider</span>
          <b>
            <Database />
            {provider?.toUpperCase() ?? "Awaiting provider"}
          </b>
        </div>
        <div>
          <span>Selected market</span>
          <b>{symbol}</b>
        </div>
        <div>
          <span>Feed state</span>
          <b className={cn(dataStatus === "LIVE" && "is-live")}>{dataStatus}</b>
        </div>
        <div>
          <span>Cloud workspace</span>
          <b className={authenticated ? "text-pos font-semibold" : ""}>
            {authenticated ? <Cloud className="text-pos" /> : <CloudOff />}
            {authenticated ? "Synchronized & Active" : "Local until sign-in"}
          </b>
        </div>
      </div>

      <div className="zt-account-not-connected">
        <b>{authenticated ? "Google Account Verified" : "No trading account connected"}</b>
        <p>
          {authenticated
            ? "Your identity is authenticated via Google. Named workspaces, custom indicators, and profiles synchronize safely across devices; no broker, order, or execution authority is attached."
            : "Google sign-in is used only for workspace identity and synchronization. It never grants brokerage, balance, position, or order permissions."}
        </p>
      </div>
    </section>
  );
}
