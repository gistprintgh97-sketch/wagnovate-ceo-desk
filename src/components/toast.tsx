"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, X } from "lucide-react";

type T = { id: number; kind: "ok" | "err"; text: string };
const Ctx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: T["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), kind === "err" ? 7000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={{ ok: (t) => push("ok", t), err: (t) => push("err", t) }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6">
        <AnimatePresence>
          {items.map((i) => (
            <motion.div key={i.id} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: "spring", stiffness: 420, damping: 32 }}
              role={i.kind === "err" ? "alert" : "status"}
              className="pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm shadow-soft">
              {i.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
              <span className="flex-1">{i.text}</span>
              <button aria-label="Dismiss" onClick={() => setItems((x) => x.filter((y) => y.id !== i.id))}><X className="h-4 w-4 text-muted" /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
