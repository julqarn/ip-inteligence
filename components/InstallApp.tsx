"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  const install = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    } else {
      setShowIosHelp((value) => !value);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {showIosHelp && (
        <div className="max-w-xs rounded-xl border border-cyan-400/30 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-xl">
          On iPhone or iPad, tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.
        </div>
      )}
      <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 p-1 shadow-lg shadow-cyan-500/25">
        <button
          onClick={install}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-slate-950"
          aria-label="Install IP Intelligence app"
        >
          <Download className="h-4 w-4" />
          Install app
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-full p-1.5 text-slate-950/70 hover:text-slate-950"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
