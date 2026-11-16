"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- comparison rows are rendered generically */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, Printer } from "lucide-react";
import { api, qs } from "@/lib/api";
import { fmtDate, iso, parseDate, today } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PageHeader, Panel, Skeleton } from "@/components/ui";
import { ModuleTabs, PeriodPicker, periodOf, type Period } from "@/components/module";
import { ReportView } from "@/components/report-view";
import type { Report } from "@/server/reports";

const TYPES = [
  { id: "weekly", label: "Weekly CEO performance", period: "week" }, { id: "monthly", label: "Monthly business performance", period: "month" }, { id: "quarterly", label: "Quarterly business performance", period: "quarter" }, { id: "annual", label: "Annual business performance", period: "year" },
  { id: "revenue-expense", label: "Revenue and expense analysis" }, { id: "pipeline", label: "Sales pipeline analysis" }, { id: "satisfaction", label: "Customer satisfaction" },
  { id: "project-delivery", label: "Project delivery" }, { id: "priority-completion", label: "Priority completion" }, { id: "outstanding-invoices", label: "Outstanding invoices" },
];
const NEEDS_RANGE = new Set(["revenue-expense", "satisfaction", "priority-completion"]);

function Reports() {
  const [type, setType] = useState("monthly");
  const [period, setPeriod] = useState<Period>(periodOf("year"));
  const [anchor, setAnchor] = useState(iso(today()));
  const t = TYPES.find((x) => x.id === type)!;
  const params = t.period ? { preset: t.period, anchor } : NEEDS_RANGE.has(type) ? { from: period.from, to: period.to } : {};
  const q = useQuery({ queryKey: ["report", type, params], queryFn: () => api<Report>(`/api/reports/${type}${qs(params)}`), placeholderData: (p) => p });
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-3">
        <div><label htmlFor="rtype" className="mb-1 block text-xs text-muted">Report</label><select id="rtype" className="field min-w-[250px]" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>
        {t.period && <div><label htmlFor="ranchor" className="mb-1 block text-xs text-muted">Period containing</label><input id="ranchor" type="date" className="field" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} /></div>}
        {NEEDS_RANGE.has(type) && <PeriodPicker value={period} onChange={setPeriod} />}
        <div className="ml-auto flex gap-2">
          <button className="btn" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>
          <a className="btn" href={`/api/reports/${type}${qs({ ...params, format: "csv" })}`}><Download className="h-4 w-4" />CSV</a>
          <a className="btn btn-primary" href={`/api/reports/${type}${qs({ ...params, format: "pdf" })}`}><Download className="h-4 w-4" />PDF</a>
        </div>
      </div>
      {q.data ? (
        <>
          <div className="panel p-4"><p className="eyebrow">WAGNOVATE Technologies</p><h2 className="text-xl font-semibold">{q.data.title}</h2><p className="text-sm text-muted">{q.data.subtitle}</p></div>
          <ReportView report={q.data} />
        </>
      ) : <Skeleton className="h-64 rounded-panel" />}
    </div>
  );
}

function Compare() {
  const [mode, setMode] = useState<"week" | "month" | "quarter" | "year">("month");
  const q = useQuery({ queryKey: ["compare", mode], queryFn: () => api<any>(`/api/compare?mode=${mode}`) });
  const d = q.data;
  const fmt = (r: any, v: number | null) => (v === null ? "—" : r.money ? ghs(v) : String(v));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">{(["week", "month", "quarter", "year"] as const).map((m) => <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-lg border px-3 py-1.5 text-sm", mode === m ? "border-accent bg-accent/15" : "border-line text-muted hover:text-fg")}>This {m} vs last {m}</button>)}</div>
      {!d ? <Skeleton className="h-64 rounded-panel" /> : (
        <Panel title="Performance comparison" right={`${fmtDate(parseDate(d.current.from))} – ${fmtDate(parseDate(d.current.to))} vs ${fmtDate(parseDate(d.previous.from))} – ${fmtDate(parseDate(d.previous.to))}`}>
          <ul className="divide-y divide-line/60">
            {d.rows.map((r: any) => (
              <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <span className="text-sm font-medium">{r.label}</span>
                <span className="num text-sm sm:text-right"><span className="text-[10px] uppercase text-muted sm:hidden">This </span>{fmt(r, r.current)}</span>
                <span className="num text-sm text-muted sm:text-right"><span className="text-[10px] uppercase sm:hidden">Prev </span>{fmt(r, r.previous)}</span>
                <span className="col-span-2 text-xs sm:col-span-1 sm:text-right">
                  {r.pct !== null ? <span className={cn("num inline-flex items-center gap-0.5 font-medium", r.pct >= 0 ? "text-good" : "text-bad")}>{r.pct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{Math.abs(r.pct)}%</span> : <span className="text-muted">{r.note ?? "n/a"}</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Percentages are shown only when the previous period had a non-zero value. Otherwise the reason is shown instead of a misleading figure.</p>
        </Panel>
      )}
    </div>
  );
}

export function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports & Analytics" subtitle="Business reports from your records, with PDF and CSV export." />
      <ModuleTabs fallback="reports" tabs={[{ id: "reports", label: "Reports" }, { id: "compare", label: "Compare periods" }]}>
        {(tab) => tab === "reports" ? <Reports /> : <Compare />}
      </ModuleTabs>
    </>
  );
}
