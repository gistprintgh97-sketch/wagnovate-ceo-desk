"use client";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui";

type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker and offers the PWA install prompt where the browser supports it. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP); try { setHidden(localStorage.getItem("ceo-install-dismissed") === "1"); } catch { setHidden(false); } };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt || hidden) return null;
  return (
    <div className="no-print fixed inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-xl border border-accent/40 bg-panel p-3 shadow-soft sm:left-auto sm:right-6 sm:max-w-sm lg:bottom-6">
      <Download className="h-5 w-5 shrink-0 text-accent" />
      <p className="flex-1 text-xs">Install CEO Desk on this device for faster access and reminders.</p>
      <Button variant="primary" className="min-h-[36px] px-3 py-1 text-xs" onClick={async () => { await evt.prompt(); setEvt(null); }}>Install</Button>
      <button aria-label="Not now" onClick={() => { setHidden(true); try { localStorage.setItem("ceo-install-dismissed", "1"); } catch { /* ignore */ } }}><X className="h-4 w-4 text-muted" /></button>
    </div>
  );
}
