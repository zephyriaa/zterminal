import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function PwaControls() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showAppleHelp, setShowAppleHelp] = useState(false);
  useEffect(() => {
    setInstalled(isStandalone());
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowAppleHelp(false);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) return null;

  const requestInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return <>
    {deferredPrompt && <button className="pwa-install-trigger" onClick={() => void requestInstall()} aria-label="Install ZTerminal as an app"><Download size={14} /><span>Install app</span></button>}
    {!deferredPrompt && isAppleMobile() && <button className="pwa-install-trigger apple" onClick={() => setShowAppleHelp(true)} aria-label="Show iPhone or iPad home screen instructions"><Smartphone size={14} /><span>Add to Home Screen</span></button>}
    {showAppleHelp && <section className="pwa-install-help" role="dialog" aria-modal="true" aria-label="Add ZTerminal to the home screen"><div><button className="pwa-install-close" onClick={() => setShowAppleHelp(false)} aria-label="Close installation instructions"><X size={15} /></button><span className="drawer-kicker">iPhone and iPad</span><h2>Add ZTerminal to your Home Screen</h2><p>In Safari, use the Share button, choose <b>Add to Home Screen</b>, then confirm <b>Add</b>. The installed app opens in its own window; live market data still needs a network connection.</p></div></section>}
  </>;
}
