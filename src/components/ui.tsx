"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({ title, right, children, className, bodyClass }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("panel p-4", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="panel-title">{title}</h2>}
          {right && <div className="text-xs text-muted">{right}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Button({ variant = "default", loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost"; loading?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || loading} className={cn("btn", variant === "primary" && "btn-primary", variant === "danger" && "btn-danger", variant === "ghost" && "btn-ghost", className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

const TONES: Record<string, string> = {
  neutral: "border-line text-muted", blue: "border-accent/40 bg-accent/10 text-accent", green: "border-good/40 bg-good/10 text-good",
  orange: "border-warn/40 bg-warn/10 text-warn", red: "border-bad/40 bg-bad/10 text-bad", violet: "border-violet/40 bg-violet/10 text-violet", cyan: "border-cyan/40 bg-cyan/10 text-cyan",
};
export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium", TONES[tone], className)}>{children}</span>;
}
/** Picks a badge colour for common status words. */
export function statusTone(v: string | null | undefined): keyof typeof TONES {
  const s = (v ?? "").toUpperCase();
  if (["COMPLETED", "DONE", "WON", "RESOLVED", "CLOSED", "ACTIVE", "POSITIVE", "INCOME", "PAID", "SENT"].includes(s)) return "green";
  if (["CRITICAL", "LOST", "BLOCKED", "CHURNED", "TERMINATED", "EXPIRED", "COMPLAINT", "URGENT", "NOT_COMPLETED", "CANCELLED"].includes(s)) return "red";
  if (["HIGH", "DELAYED", "AT_RISK", "BILLING_ISSUE", "TECHNICAL_ISSUE", "EXPENSE", "PARTIAL"].includes(s)) return "orange";
  if (["IN_PROGRESS", "INVESTIGATING", "NEGOTIATION", "PROPOSAL_SENT", "INTERESTED", "DEMO_SCHEDULED", "MEDIUM"].includes(s)) return "blue";
  return "neutral";
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("relative overflow-hidden rounded-md bg-panel2", className)}><div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-fg/10 to-transparent" /></div>;
}

export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <div className="text-muted">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: 40, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className={cn("panel flex max-h-[92dvh] w-full flex-col rounded-b-none sm:rounded-b-panel", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-base font-semibold">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="rounded-md p-1.5 hover:bg-panel2"><X className="h-4 w-4" /></button>
            </header>
            <div className="overflow-y-auto px-4 py-4">{children}</div>
            {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Delete", onConfirm, onClose, loading }: { open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={<><Button onClick={onClose}>Cancel</Button><Button variant="danger" loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-muted">{message}</p>
    </Modal>
  );
}

export function Progress({ value, tone = "accent", className }: { value: number; tone?: "accent" | "good" | "warn" | "bad" | "cyan"; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line/60", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn("h-full rounded-full", { accent: "bg-accent", good: "bg-good", warn: "bg-warn", bad: "bg-bad", cyan: "bg-cyan" }[tone])} initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="no-print mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition", value === t.id ? "text-fg" : "text-muted hover:text-fg")}>
          {value === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-lg bg-accent/15 ring-1 ring-accent/40" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
          <span className="relative">{t.label}{t.count !== undefined ? <span className="ml-1.5 text-xs text-muted">{t.count}</span> : null}</span>
        </button>
      ))}
    </div>
  );
}

export function Label({ children, htmlFor, required }: { children: ReactNode; htmlFor?: string; required?: boolean }) {
  return <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted">{children}{required && <span className="text-bad"> *</span>}</label>;
}
