"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ghs, ghsCompact } from "@/lib/money";
import { useReducedMotion, useThemeColors } from "@/lib/use-theme-colors";
import { Badge, EmptyState, Progress } from "@/components/ui";
import type { Dashboard } from "@/server/metrics";
import type { Alert } from "@/server/insights";

type Delta = { pct?: number | null; deltaPts?: number | null };

export function moneyParts(v: number | null): { text: string; unit: string } {
  if (v === null) return { text: "—", unit: "" };
  const a = Math.abs(v);
  if (a >= 1e6) return { text: (v / 1e6).toFixed(2), unit: "M GHS" };
  if (a >= 1e4) return { text: (v / 1e3).toFixed(1), unit: "K GHS" };
  return { text: v.toLocaleString("en-GH", { maximumFractionDigits: 2, minimumFractionDigits: a % 1 ? 2 : 0 }), unit: "GHS" };
}

export function DeltaBadge({ d, goodWhen = "up", suffix = "YoY" }: { d: Delta; goodWhen?: "up" | "down"; suffix?: string }) {
  const v = d.deltaPts ?? d.pct ?? null;
  if (v === null || v === undefined) return <span className="num text-[11px] text-muted" title="There is no data for the same period last year, so no honest comparison can be made.">{suffix} n/a</span>;
  const up = v > 0, flat = v === 0;
  const good = flat ? null : up === (goodWhen === "up");
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span className={cn("num inline-flex items-center gap-0.5 text-[11px] font-medium", good === null ? "text-muted" : good ? "text-good" : "text-bad")}>
      <Icon className="h-3 w-3" />{suffix} {Math.abs(v).toFixed(1)}{d.deltaPts !== undefined && d.deltaPts !== null ? "pt" : "%"}
    </span>
  );
}

export function KpiCard({ label, value, unit, delta, goodWhen, href, sub, small }: { label: string; value: string; unit?: string; delta?: Delta; goodWhen?: "up" | "down"; href?: string; sub?: string; small?: boolean }) {
  const body = (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={cn("panel flex h-full min-h-[92px] flex-col justify-between p-3 transition-shadow hover:border-accent/50", small && "min-h-[80px]")}>
      <p className="eyebrow text-[10px] leading-tight">{label}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1"><span className="num text-[22px] font-semibold leading-none">{value}</span>{unit && <span className="num text-[10px] text-muted">{unit}</span>}</p>
      <div className="mt-1 min-h-[14px] text-[11px] leading-tight">{delta ? <DeltaBadge d={delta} goodWhen={goodWhen} /> : sub ? <span className="text-muted">{sub}</span> : null}</div>
    </motion.div>
  );
  return href ? <Link href={href} className="block rounded-panel">{body}</Link> : body;
}

export function AchievementPanel({ d }: { d: Dashboard }) {
  const rows = d.achievement.slice(0, 5);
  if (!rows.length) return <EmptyState title="No revenue targets set" hint="Set an annual target for each product or service to see achievement here." action={<Link href="/settings?tab=targets" className="text-xs text-accent hover:underline">Set targets in Settings</Link>} />;
  return (
    <ol className="space-y-3">
      {rows.map((r, i) => {
        const pct = r.pct ?? 0;
        const tone = pct >= 100 ? "good" : pct >= 90 ? "accent" : "warn";
        return (
          <li key={r.key} className="grid grid-cols-[28px_1fr_auto] items-center gap-x-2 gap-y-1">
            <span className="num flex h-6 w-6 items-center justify-center rounded border border-line text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
            <div className="min-w-0"><p className="truncate text-[13px] font-medium">{r.label}</p><p className="num text-[10px] text-muted">{ghsCompact(r.actual)} of {ghsCompact(r.expected)} due to date</p></div>
            <span className={cn("num text-sm font-semibold", pct >= 100 ? "text-good" : pct < 90 ? "text-warn" : "")}>{r.pct === null ? "—" : `${pct.toFixed(1)}%`}</span>
            <span />
            <div className="relative col-span-2"><Progress value={Math.min(100, pct)} tone={tone} /><span className="absolute -top-0.5 h-2.5 w-px bg-bad" style={{ left: "90%" }} aria-hidden /></div>
          </li>
        );
      })}
    </ol>
  );
}

const DONUT = ["accent", "cyan", "good", "warn", "violet"] as const;
export function DonutPanel({ d }: { d: Dashboard }) {
  const c = useThemeColors(); const reduced = useReducedMotion();
  const rows = d.revenueByCategory;
  if (!rows.length) return <EmptyState title="No revenue recorded yet" hint="Income you record in Finance appears here, split by product or service." action={<Link href="/finance?tab=transactions" className="text-xs text-accent hover:underline">Record income</Link>} />;
  const top = rows.slice(0, 4); const other = rows.slice(4).reduce((s, r) => s + r.amount, 0);
  const data = other > 0 ? [...top, { key: "OTHER", label: "Other", amount: other }] : top;
  const total = d.revenueTotal || 1; const p = moneyParts(d.revenueTotal);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-[130px] w-[130px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="label" innerRadius={42} outerRadius={60} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={!reduced} animationDuration={900}>
              {data.map((_, i) => <Cell key={i} fill={c[DONUT[i % DONUT.length]]} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded-lg border border-line bg-panel px-2 py-1 text-xs shadow-soft">{payload[0].name}: <b className="num">{ghs(payload[0].value as number)}</b></div> : null} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="num text-base font-semibold">{p.text}</span><span className="num text-[9px] text-muted">{p.unit}</span></div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {data.map((r, i) => (
          <li key={r.key} className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: c[DONUT[i % DONUT.length]] }} /><span className="min-w-0 flex-1 truncate">{r.label}</span><span className="num font-medium">{((r.amount / total) * 100).toFixed(1)}%</span></li>
        ))}
      </ul>
    </div>
  );
}

export function DeliveryPanel({ d }: { d: Dashboard }) {
  const rows = d.delivery;
  if (!rows.length) return <EmptyState title="No dated projects yet" hint="Give projects a start and target date to track delivery days." action={<Link href="/engineering?tab=projects" className="text-xs text-accent hover:underline">Open projects</Link>} />;
  const max = Math.max(...rows.map((r) => Math.max(r.days, r.target ?? 0)), 1);
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const over = r.target !== null && r.days > r.target;
        return (
          <li key={r.id} className="grid grid-cols-[84px_1fr_auto] items-center gap-2 text-xs">
            <span className="truncate" title={r.name}>{r.name}</span>
            <div className="relative h-2 rounded-full bg-line/50">
              <motion.div className={cn("h-full rounded-full", over ? "bg-warn" : r.status === "COMPLETED" ? "bg-good" : "bg-accent")} initial={{ width: 0 }} animate={{ width: `${(r.days / max) * 100}%` }} transition={{ type: "spring", stiffness: 110, damping: 22 }} />
              {r.target !== null && <span className="absolute -top-1 h-4 w-px border-l border-dashed border-bad" style={{ left: `${(r.target / max) * 100}%` }} title={`Target ${r.target} days`} />}
            </div>
            <span className="num w-[58px] text-right">{r.days} d</span>
          </li>
        );
      })}
    </ul>
  );
}

export function TopCustomers({ d }: { d: Dashboard }) {
  const rows = d.topCustomers;
  if (!rows.length) return <EmptyState title="No customer billing yet" hint="Customers with invoices or payments appear here." action={<Link href="/finance?tab=invoices" className="text-xs text-accent hover:underline">Create an invoice</Link>} />;
  return (
    <table className="w-full text-xs">
      <thead><tr className="eyebrow text-left"><th className="pb-1.5 font-medium">Customer</th><th className="pb-1.5 text-right font-medium">Paid YTD</th><th className="pb-1.5 text-right font-medium">Owes</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-line/60">
            <td className="max-w-[120px] py-1.5"><Link href={`/customers?customer=${r.id}`} className="block truncate hover:text-accent">{r.name}</Link>{r.overdueDays > 0 && <span className="text-[10px] text-bad">{r.overdueDays} d overdue</span>}</td>
            <td className="num py-1.5 text-right">{ghsCompact(r.received)}</td>
            <td className={cn("num py-1.5 text-right font-medium", r.outstanding > 0 ? "text-warn" : "text-muted")}>{r.outstanding > 0 ? ghsCompact(r.outstanding) : "0"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const accra = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const accraDay = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", day: "numeric", month: "short" });
function alertTime(iso: string) { const d = new Date(iso); const today = accraDay.format(new Date()) === accraDay.format(d); return today ? accra.format(d) : accraDay.format(d); }

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const box = useRef<HTMLUListElement>(null);
  // Live ticker: the list drifts upward like a feed, pauses on hover/focus/expanded item, then loops back to the top.
  useEffect(() => {
    const el = box.current;
    if (!el || reduced || paused || open) return;
    let raf = 0, wait = 0, last = performance.now();
    const tick = (now: number) => {
      const dt = now - last; last = now;
      if (el.scrollHeight > el.clientHeight + 4) {
        if (wait > 0) wait -= dt;
        else if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) { wait = 1800; el.scrollTo({ top: 0, behavior: "smooth" }); }
        else el.scrollTop += dt * 0.018;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, paused, open, alerts.length]);
  if (!alerts.length) return <EmptyState title="No warnings right now" hint="Warnings appear here when your recorded data shows a risk, such as overdue invoices or unresolved critical problems." />;
  return (
    <ul ref={box} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} className="max-h-[300px] space-y-0.5 overflow-y-auto pr-1">
      {alerts.map((a, idx) => {
        const on = open === a.id;
        return (
          <motion.li key={a.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 28, delay: Math.min(idx, 8) * 0.06 }} className="border-b border-line/50 last:border-0">
            <button className="flex w-full items-start gap-2 py-2 text-left" aria-expanded={on} onClick={() => setOpen(on ? null : a.id)}>
              <Badge tone={a.level === "HIGH" ? "red" : a.level === "MEDIUM" ? "orange" : "green"} className="mt-0.5 w-[54px] justify-center">{a.level === "HIGH" ? "High" : a.level === "MEDIUM" ? "Medium" : a.missing ? "Missing" : "Info"}</Badge>
              <span className="min-w-0 flex-1 text-xs leading-snug"><span className={on ? "" : "line-clamp-2"}>{a.title}</span></span>
              <span className="num shrink-0 text-[10px] text-muted">{alertTime(a.at)}</span>
              <ChevronDown className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-muted transition", on && "rotate-180")} />
            </button>
            {on && (
              <div className="mb-2 ml-[62px] space-y-1 rounded-lg bg-panel2 p-2.5 text-xs">
                <p className="text-muted">{a.explanation}</p>
                <p><b>Next step:</b> {a.action}</p>
                <Link href={a.link} className="inline-flex items-center gap-1 text-accent hover:underline">Open <ArrowUpRight className="h-3 w-3" /></Link>
              </div>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}
