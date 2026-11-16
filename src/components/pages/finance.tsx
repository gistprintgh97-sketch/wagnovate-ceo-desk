"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- list items are rendered generically */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Banknote, Download, Paperclip } from "lucide-react";
import { api, qs } from "@/lib/api";
import { fmtDate } from "@/lib/dates";
import { ghs, ghsCompact } from "@/lib/money";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, Skeleton } from "@/components/ui";
import { DocumentList, ModuleTabs, PeriodPicker, periodOf, type Period } from "@/components/module";
import { RecordForm, ResourceManager } from "@/components/resource-manager";
import { RESOURCES } from "@/config/resources";
import { DeltaBadge } from "@/components/dashboard/kpi-panels";
import { ChartTip, useChartStyle } from "@/components/dashboard/charts";

const PAL = ["accent", "cyan", "good", "warn", "violet", "bad"] as const;
const exportUrl = (fmt: "csv" | "pdf", p: Period) => `/api/reports/revenue-expense${qs({ from: p.from, to: p.to, format: fmt })}`;

function Overview() {
  const [period, setPeriod] = useState<Period>(periodOf("month"));
  const { c, anim, tick, grid } = useChartStyle();
  const q = useQuery({ queryKey: ["finance-overview", period], queryFn: () => api<any>(`/api/finance/overview${qs({ preset: period.preset === "custom" ? "" : period.preset, from: period.preset === "custom" ? period.from : "", to: period.preset === "custom" ? period.to : "" })}`), placeholderData: (p) => p });
  const d = q.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="flex gap-2"><a className="btn" href={exportUrl("csv", period)}><Download className="h-4 w-4" />CSV</a><a className="btn" href={exportUrl("pdf", period)}><Download className="h-4 w-4" />PDF</a></div>
      </div>
      {!d ? <Skeleton className="h-64 rounded-panel" /> : (
        <>
          <p className="text-xs text-muted">{fmtDate(d.range.from)} – {fmtDate(d.range.to)} · compared with {fmtDate(d.prevRange.from)} – {fmtDate(d.prevRange.to)}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[["Income received", d.totals.income, { pct: d.totals.incomeChange }, "up"], ["Expenses paid", d.totals.expense, { pct: d.totals.expenseChange }, "down"], ["Net cash flow", d.totals.net, {}, "up"]].map(([l, v, delta, good]: any) => (
              <div key={l} className="panel p-3"><p className="eyebrow">{l}</p><p className={`num mt-1 text-xl font-semibold ${l === "Net cash flow" ? (v < 0 ? "text-bad" : v > 0 ? "text-good" : "") : ""}`}>{ghs(v)}</p>{l === "Net cash flow" ? <p className="text-[11px] text-muted">Cash in minus cash out. Not profit.</p> : <DeltaBadge d={delta} goodWhen={good} suffix="vs prev." />}</div>
            ))}
            <div className="panel p-3"><p className="eyebrow">Transactions</p><p className="num mt-1 text-xl font-semibold">{d.totals.count}</p><p className="text-[11px] text-muted">recorded in this period</p></div>
          </div>
          {d.totals.count === 0 ? <Panel><EmptyState title="No financial transactions recorded for this period." hint="Try a wider period, or record income and expenses." /></Panel> : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Panel title="Income versus expenses"><div className="h-[240px]"><ResponsiveContainer><BarChart data={d.series} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}><CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" /><YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => ghsCompact(v)} width={48} /><Tooltip content={<ChartTip />} /><Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} /><Bar name="Income" dataKey="income" fill={c.accent} radius={[3, 3, 0, 0]} {...anim} /><Bar name="Expenses" dataKey="expense" fill={c.warn} radius={[3, 3, 0, 0]} {...anim} /></BarChart></ResponsiveContainer></div></Panel>
              <Panel title="Revenue trend and net cash flow"><div className="h-[240px]"><ResponsiveContainer><LineChart data={d.series} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}><CartesianGrid stroke={grid} vertical={false} /><XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" /><YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => ghsCompact(v)} width={48} /><Tooltip content={<ChartTip />} /><Legend iconType="plainline" wrapperStyle={{ fontSize: 11 }} /><Line name="Income" dataKey="income" stroke={c.accent} strokeWidth={2.5} dot={false} {...anim} /><Line name="Net cash flow" dataKey="net" stroke={c.good} strokeWidth={2} dot={false} {...anim} /></LineChart></ResponsiveContainer></div></Panel>
              <Panel title="Expense distribution">
                {!d.expenseByCategory.length ? <EmptyState title="No expenses recorded." /> : <div className="flex flex-wrap items-center gap-4"><div className="h-[190px] w-[190px] shrink-0"><ResponsiveContainer><PieChart><Pie data={d.expenseByCategory} dataKey="amount" nameKey="label" innerRadius={48} outerRadius={82} paddingAngle={2} stroke="none" {...anim}>{d.expenseByCategory.map((_: any, i: number) => <Cell key={i} fill={c[PAL[i % PAL.length]]} />)}</Pie><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded-lg border border-line bg-panel px-2 py-1 text-xs">{payload[0].name}: <b className="num">{ghs(payload[0].value as number)}</b></div> : null} /></PieChart></ResponsiveContainer></div><ul className="min-w-[160px] flex-1 space-y-1 text-xs">{d.expenseByCategory.map((e: any, i: number) => <li key={e.key} className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: c[PAL[i % PAL.length]] }} /><span className="flex-1 truncate">{e.label}</span><span className="num">{ghs(e.amount)}</span></li>)}</ul></div>}
              </Panel>
              <Panel title="Revenue by product or service">
                {!d.revenueByCategory.length ? <EmptyState title="No income recorded." /> : <ul className="space-y-2 text-sm">{d.revenueByCategory.map((r: any) => <li key={r.key} className="flex items-center justify-between rounded-lg bg-panel2/60 px-3 py-2"><span>{r.label}</span><span className="num font-medium">{ghs(r.amount)}</span></li>)}</ul>}
              </Panel>
            </div>
          )}
          {d.monthly.length > 0 && (
            <Panel title="Monthly financial summary">
              <ul className="divide-y divide-line/60 text-sm">
                {d.monthly.map((m: any) => <li key={m.month} className="grid grid-cols-[70px_1fr_1fr_1fr] items-center gap-2 py-2 sm:grid-cols-[90px_1fr_1fr_1fr_90px]"><span className="font-medium">{m.month}</span><span className="num">{ghsCompact(m.income)}<span className="block text-[10px] text-muted">income</span></span><span className="num">{ghsCompact(m.expense)}<span className="block text-[10px] text-muted">expenses</span></span><span className={`num ${m.net < 0 ? "text-bad" : "text-good"}`}>{ghsCompact(m.net)}<span className="block text-[10px] text-muted">net</span></span><span className="num hidden text-xs sm:block">{m.growth === null ? <span className="text-muted" title="No income in the previous month, so no honest percentage">n/a</span> : `${m.growth > 0 ? "+" : ""}${m.growth}%`}<span className="block text-[10px] text-muted">vs prev. month</span></span></li>)}
              </ul>
            </Panel>
          )}
          <Panel title="Outstanding payment tracker" right={<a href="/finance?tab=invoices&state=outstanding" className="text-accent hover:underline">All invoices</a>}>
            {!d.outstanding.length ? <EmptyState title="No unpaid invoices." hint="Everything invoiced has been paid." /> : (
              <ul className="divide-y divide-line/60 text-sm">{d.outstanding.map((o: any) => <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-2"><span className="min-w-0 flex-1"><b>{o.customer}</b> <span className="text-muted">· {o.number}</span></span><span className="num text-warn">{ghs(o.outstanding)}</span><span className="num text-xs text-muted">due {fmtDate(o.dueDate)}</span>{o.overdueDays > 0 ? <Badge tone="red">{o.overdueDays} d overdue</Badge> : <Badge tone="blue">Not yet due</Badge>}</li>)}</ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function Transactions() {
  const [period, setPeriod] = useState<Period>(periodOf("year"));
  const [receipt, setReceipt] = useState<any | null>(null);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><PeriodPicker value={period} onChange={setPeriod} /><div className="flex gap-2"><a className="btn" href={exportUrl("csv", period)}><Download className="h-4 w-4" />CSV</a><a className="btn" href={exportUrl("pdf", period)}><Download className="h-4 w-4" />PDF</a></div></div>
      <ResourceManager resource="transactions" query={{ from: period.from, to: period.to }} rowActions={(t) => <button aria-label="Receipts and documents" className="rounded-md p-1.5 text-muted hover:bg-panel2 hover:text-fg" onClick={() => setReceipt(t)}><Paperclip className="h-4 w-4" /></button>} />
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={`Receipt · ${receipt?.title ?? ""}`}>{receipt && <DocumentList link={{ transactionId: receipt.id }} purpose="RECEIPT" />}</Modal>
    </>
  );
}

function Invoices() {
  const sp = useSearchParams();
  const [state, setState] = useState(sp.get("state") ?? "");
  const [pay, setPay] = useState<any | null>(null);
  return (
    <>
      <ResourceManager resource="invoices" query={{ state }} extraFilters={
        <select aria-label="Filter by payment state" className="field w-auto max-w-[180px]" value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">State: all</option><option value="outstanding">Unpaid</option><option value="overdue">Overdue</option><option value="paid">Paid</option>
        </select>}
        rowActions={(i) => i._outstanding > 0 ? <Button className="min-h-[32px] px-2 py-1 text-xs" onClick={() => setPay(i)}><Banknote className="h-3.5 w-3.5" />Record payment</Button> : null} />
      <Modal open={!!pay} onClose={() => setPay(null)} title={`Record payment · ${pay?.number ?? ""}`} wide>
        {pay && <RecordForm def={RESOURCES.transactions} defaults={{ type: "INCOME", title: `Payment for ${pay.number}`, amount: pay._outstanding, category: pay.category, customerId: pay.customerId, invoiceId: pay.id, contractId: pay.contractId, projectId: pay.projectId, date: new Date().toISOString().slice(0, 10) }} onDone={() => setPay(null)} onCancel={() => setPay(null)} />}
      </Modal>
    </>
  );
}

export function FinancePage() {
  return (
    <>
      <PageHeader title="Finance" subtitle="Cash received, cash paid out, and what customers still owe. All amounts in GHS." />
      <ModuleTabs fallback="overview" tabs={[{ id: "overview", label: "Overview" }, { id: "transactions", label: "Transactions" }, { id: "invoices", label: "Invoices" }]}>
        {(tab) => tab === "overview" ? <Overview /> : tab === "transactions" ? <Transactions /> : <Invoices />}
      </ModuleTabs>
    </>
  );
}
