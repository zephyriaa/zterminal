import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type GoogleCredentialResponse = { credential?: string };

type GoogleAccounts = {
  id: {
    initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean }): void;
    renderButton(element: HTMLElement, options: { theme: "filled_black"; size: "large"; shape: "rectangular"; text: "continue_with"; width?: number }): void;
  };
};

function googleAccounts(): GoogleAccounts["id"] | undefined {
  const googleIdentity = Reflect.get(window, "google") as { accounts?: GoogleAccounts } | undefined;
  return googleIdentity?.accounts?.id;
}

type GoogleSignInButtonProps = {
  className?: string;
  redirectTo?: string;
  unavailableLabel?: string;
};

const GOOGLE_SCRIPT_ID = "zterminal-google-identity-services";

function loadGoogleIdentityScript(): Promise<void> {
  if (googleAccounts()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Identity Services could not load.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services could not load."));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton({
  className = "google-sign-in",
  redirectTo = "/terminal",
  unavailableLabel = "Google sign-in unavailable",
}: GoogleSignInButtonProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const configQuery = trpc.auth.googleConfig.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const signInMutation = trpc.auth.googleSignIn.useMutation({
    onSuccess: async (user) => {
      utils.auth.me.setData(undefined, user);
      await utils.auth.me.invalidate();
      window.location.assign(redirectTo);
    },
    onError: (error) => {
      setUiError(error.message || "Google sign-in could not be completed.");
    },
  });

  useEffect(() => {
    const config = configQuery.data;
    const target = targetRef.current;
    if (!config?.enabled || !config.clientId || !config.csrfToken || !target) return;

    let cancelled = false;
    setUiError(null);
    target.replaceChildren();

    void loadGoogleIdentityScript()
      .then(() => {
        const identityApi = googleAccounts();
        if (cancelled || !identityApi) return;
        identityApi.initialize({
          client_id: config.clientId,
          auto_select: false,
          callback: (response) => {
            if (!response.credential) {
              setUiError("Google did not return a credential.");
              return;
            }
            signInMutation.mutate({ credential: response.credential, csrfToken: config.csrfToken });
          },
        });
        identityApi.renderButton(target, {
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: Math.max(220, Math.floor(target.clientWidth || 260)),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) setUiError(error instanceof Error ? error.message : "Google Identity Services could not load.");
      });

    return () => {
      cancelled = true;
      target.replaceChildren();
    };
  }, [configQuery.data?.enabled, configQuery.data?.clientId, configQuery.data?.csrfToken]);

  if (configQuery.isLoading) {
    return <div className={`${className} google-sign-in-pending`} aria-live="polite">Checking account access…</div>;
  }

  if (!configQuery.data?.enabled) {
    return <div className={`${className} google-sign-in-unavailable`} role="status">{unavailableLabel}</div>;
  }

  return (
    <div className={className}>
      <div ref={targetRef} className="google-sign-in-target" />
      {signInMutation.isPending ? <small aria-live="polite">Verifying Google identity…</small> : null}
      {uiError ? <small className="google-sign-in-error" role="alert">{uiError}</small> : null}
    </div>
  );
}
