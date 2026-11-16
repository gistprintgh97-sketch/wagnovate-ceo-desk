"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { ScopedContracts, ScopedInvoices, ScopedList, ScopedPayments, OpenProfileLink, scopedKpis } from "./scoped";
import { api } from "@/lib/api";
import { isoWeekKey, today } from "@/lib/dates";
import { label } from "@/config/enums";
import { ghs } from "@/lib/money";
import { Button, EmptyState, Panel, Progress, Skeleton } from "@/components/ui";
import type { Dashboard } from "@/server/metrics";
import type { Alert, getActionCentre } from "@/server/insights";
import { Globe } from "./globe";
import { AchievementPanel, AlertsPanel, DeliveryPanel, DonutPanel, KpiCard, TopCustomers, moneyParts } from "./kpi-panels";
import { CollectionsChart, ProductivityChart, TrendChart, WeeklyRevExp } from "./charts";
import { ActionCentre, PriorityAndReview } from "./action-centre";

type Resp = { dashboard: Dashboard; alerts: Alert[]; action: Awaited<ReturnType<typeof getActionCentre>>; user: { name: string }; company: { name: string } };

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", weekday: "long", day: "numeric", month: "long", year: "numeric" });
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Accra", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)_330px]" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-52 rounded-panel" />)}</div>
      <div className="space-y-3"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-panel" />)}</div><Skeleton className="h-[420px] rounded-panel" /><Skeleton className="h-52 rounded-panel" /></div>
      <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-panel" />)}</div>
    </div>
  );
}

export function Overview() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Resp>("/api/dashboard"), refetchInterval: 60_000 });
  const [hello, setHello] = useState("Hello");
  const [dateText, setDateText] = useState("");
  useEffect(() => { setHello(greeting()); setDateText(dateFmt.format(new Date())); }, []);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const scopeQ = useQuery({ queryKey: ["customer-profile", scopeId], queryFn: () => api<any>(`/api/customers/${scopeId}/profile`), enabled: !!scopeId });
  const sp = scopeQ.data;

  if (q.isLoading) return <LoadingState />;
  if (q.isError || !q.data) return <EmptyState title="The dashboard could not load" hint={(q.error as Error)?.message} action={<Button onClick={() => q.refetch()}><RefreshCw className="h-4 w-4" />Try again</Button>} />;
  const { dashboard: d, alerts, action, user } = q.data;
  const k = d.kpis;
  const scope = scopeId ? d.globe.customers.find((c) => c.id === scopeId) ?? null : null;
  const swap = { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { type: "spring" as const, stiffness: 340, damping: 32 } };
  // In drill-down, show only the alerts that concern the selected customer.
  const shownAlerts = scope ? alerts.filter((a) => a.link.includes(scope.id) || a.title.includes(scope.name) || a.explanation.includes(scope.name)) : alerts;
  const high = shownAlerts.filter((a) => a.level === "HIGH").length, med = shownAlerts.filter((a) => a.level === "MEDIUM").length;
  const week = isoWeekKey(today()).split("-W")[1];
  const noData = d.counts.transactions === 0 && d.counts.customers === 0 && d.counts.leads === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{hello}, CEO.</h1>
          <p className="text-sm text-muted">WAGNOVATE Technologies — Executive Overview</p>
        </div>
        <p className="num text-xs text-muted">{dateText} · Week {Number(week)} · {d.ytdLabel}</p>
      </div>

      {noData && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-accent/40 p-4">
          <p className="text-sm">Welcome, {user.name.split(" ")[0]}. Your records are empty, so every panel below shows an empty state instead of made-up numbers. Start by recording income, adding customers or opening your first weekly review.</p>
          <div className="flex gap-2"><Link className="btn btn-primary" href="/finance?tab=transactions">Record income</Link><Link className="btn" href="/review">Start review</Link></div>
        </div>
      )}

      <PriorityAndReview a={action} />

      <AnimatePresence>
        {scope && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <nav aria-label="Drill-down" className="flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-sm">
              <button className="btn min-h-[32px] px-2.5 py-1 text-xs" onClick={() => setScopeId(null)}><ArrowLeft className="h-3.5 w-3.5" />Back</button>
              <span className="text-muted">Overview</span><span className="text-muted">/</span><span className="font-semibold text-cyan">{scope.name}</span>
              <span className="ml-auto text-xs">{sp ? <OpenProfileLink id={scope.id} /> : null}</span>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[300px_minmax(0,1fr)_330px]">
        {/* LEFT */}
        <AnimatePresence mode="wait" initial={false}>
        {scope && sp ? (
        <motion.div key={`l-${scope.id}`} {...swap} className="flex flex-col gap-3 xl:order-1">
          <Panel title={`Contract Progress · ${scope.name}`}><ScopedContracts p={sp} /></Panel>
          <Panel title="Projects"><ScopedList empty="No projects for this customer." rows={sp.projects.map((x: any) => ({ id: x.id, a: x.name, b: x.status }))} /></Panel>
          <Panel title="Feedback"><ScopedList empty="No feedback recorded." rows={sp.feedback.slice(0, 6).map((x: any) => ({ id: x.id, a: x.comments, b: x.category }))} /></Panel>
        </motion.div>
        ) : (
        <motion.div key="l-all" {...swap} className="flex flex-col gap-3 xl:order-1">
          <Panel title="Achievement vs Target" right={<>Red line 90%</>}><AchievementPanel d={d} /></Panel>
          <Panel title="Revenue by Product"><DonutPanel d={d} /></Panel>
          <Panel title="Project Delivery Days" right={<span className="text-bad">┆ target</span>}><DeliveryPanel d={d} /></Panel>
        </motion.div>
        )}
        </AnimatePresence>

        {/* CENTER */}
        <div className="flex min-w-0 flex-col gap-3 md:order-first md:col-span-2 xl:order-2 xl:col-span-1">
          <AnimatePresence mode="wait" initial={false}>
          {scope && sp ? (
            <motion.div key={`k-${scope.id}`} {...swap} className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3">{scopedKpis(sp)}</motion.div>
          ) : (
          <motion.div key="k-all" {...swap} className="flex flex-col gap-3">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3">
            <KpiCard label="Total Revenue" value={moneyParts(k.revenue.value).text} unit={moneyParts(k.revenue.value).unit} delta={k.revenue} href="/finance?tab=transactions" />
            <KpiCard label="Total Expenses" value={moneyParts(k.expenses.value).text} unit={moneyParts(k.expenses.value).unit} delta={k.expenses} goodWhen="down" href="/finance?tab=transactions" />
            <KpiCard label="Net Operating Cash Flow" value={moneyParts(k.netCashFlow.value).text} unit={moneyParts(k.netCashFlow.value).unit} delta={k.netCashFlow} href="/finance" />
            <KpiCard label="Collection Rate" value={k.collectionRate.value === null ? "—" : k.collectionRate.value.toFixed(1)} unit={k.collectionRate.value === null ? "" : "%"} delta={k.collectionRate} sub="No invoices issued" href="/finance?tab=invoices" />
            <KpiCard label="Active Customers" value={String(k.activeCustomers.value ?? 0)} delta={k.activeCustomers} href="/customers" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard small label="New Contracts" value={String(k.newContracts.value ?? 0)} delta={k.newContracts} href="/sales?tab=contracts" />
            <KpiCard small label="Outstanding Invoices" value={moneyParts(k.outstandingInvoices.value).text} unit={moneyParts(k.outstandingInvoices.value).unit} sub={`${k.outstandingInvoices.count} unpaid${k.outstandingInvoices.overdueCount ? ` · ${k.outstandingInvoices.overdueCount} overdue` : ""}`} href="/finance?tab=invoices&state=outstanding" />
            <KpiCard small label="Active Projects" value={String(k.activeProjects.value ?? 0)} sub="Currently in progress" href="/engineering?tab=projects" />
            <KpiCard small label="Completed Projects" value={String(k.completedProjects.value ?? 0)} delta={k.completedProjects} href="/engineering?tab=projects" />
          </div>
          </motion.div>
          )}
          </AnimatePresence>

          <Panel title={scope ? `Customer Network · ${scope.name}` : "Customer Network"} right={<span className="eyebrow">{scope ? "drill-down" : "Accra hub · live"}</span>}><Globe hub={d.globe.hub} customers={d.globe.customers} unplotted={d.globe.unplotted} selectedId={scopeId} onSelect={(c) => setScopeId(c?.id ?? null)} /></Panel>
          <AnimatePresence mode="wait" initial={false}>
          {scope && sp ? (
            <motion.div key={`t-${scope.id}`} {...swap}><Panel title={`Payments Received · ${scope.name}`}><ScopedPayments p={sp} /></Panel></motion.div>
          ) : (
            <motion.div key="t-all" {...swap}><Panel title="Revenue Trend & Target" right={<span className="num">GHS · {d.year}</span>}><TrendChart d={d} /></Panel></motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-3 xl:order-3">
          <AnimatePresence mode="wait" initial={false}>
          {scope && sp ? (
            <motion.div key={`r-${scope.id}`} {...swap}><Panel title={`Invoices · ${scope.name}`}><ScopedInvoices p={sp} /></Panel></motion.div>
          ) : (
            <motion.div key="r-all" {...swap}><Panel title="Top Customers & Outstanding" right={<Link href="/finance?tab=invoices" className="text-accent hover:underline">Invoices</Link>}><TopCustomers d={d} /></Panel></motion.div>
          )}
          </AnimatePresence>
          <Panel title={scope ? `Live Alerts · ${scope.name}` : "Live Alerts"} right={<span><span className="text-bad">High {high}</span> · <span className="text-warn">Medium {med}</span></span>}><AlertsPanel key={scope?.id ?? "all"} alerts={shownAlerts} /></Panel>
          {!scope && <Panel title="Collections & Cash Flow"><CollectionsChart d={d} /></Panel>}
        </div>
      </div>

      <section aria-label="Business performance" className="space-y-3">
        <h2 className="text-sm font-semibold">Business performance</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Panel title="Sales Pipeline" right={<>{ghs(d.performance.pipeline.pipelineValue)}</>}>
            {d.counts.leads === 0 ? <EmptyState title="No sales opportunities yet" action={<Link href="/sales" className="text-xs text-accent hover:underline">Add a prospect</Link>} /> : (
              <ul className="space-y-2 text-xs">
                {d.performance.pipeline.stages.map((s) => (
                  <li key={s.stage}><div className="mb-0.5 flex justify-between"><span>{label(s.stage)}</span><span className="num text-muted">{s.count} · {ghs(s.value)}</span></div><Progress value={(s.count / Math.max(1, ...d.performance.pipeline.stages.map((x) => x.count))) * 100} tone={s.stage === "WON" ? "good" : s.stage === "LOST" ? "bad" : "accent"} /></li>
                ))}
                <li className="num border-t border-line pt-2 text-muted">Win rate: {d.performance.pipeline.conversion === null ? "no closed deals yet" : `${d.performance.pipeline.conversion}% (${d.performance.pipeline.wonCount} won, ${d.performance.pipeline.lostCount} lost)`}</li>
              </ul>
            )}
          </Panel>
          <Panel title="Weekly Revenue vs Expenses"><WeeklyRevExp d={d} /></Panel>
          <Panel title="Weekly Productivity"><ProductivityChart d={d} /></Panel>
          <Panel title="Growth & Execution">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div><dt className="eyebrow">Customer retention</dt><dd className="num mt-0.5 text-lg font-semibold">{d.performance.retention === null ? "—" : `${d.performance.retention}%`}</dd></div>
              <div><dt className="eyebrow">Priority completion</dt><dd className="num mt-0.5 text-lg font-semibold">{d.performance.priorityRate === null ? "—" : `${d.performance.priorityRate}%`}</dd><dd className="text-[10px] text-muted">{d.performance.prioritiesDone} of {d.performance.prioritiesTotal} weeks</dd></div>
              <div><dt className="eyebrow">New customers {d.year}</dt><dd className="num mt-0.5 text-lg font-semibold">{d.performance.newCustPerMonth.reduce((s, v) => s + v, 0)}</dd></div>
              <div><dt className="eyebrow">Projects completed {d.year}</dt><dd className="num mt-0.5 text-lg font-semibold">{d.performance.projDonePerMonth.reduce((s, v) => s + v, 0)}</dd></div>
            </dl>
            <p className="mt-3 text-[11px] text-muted">Retention = customers not marked Churned. Figures come only from records you entered.</p>
          </Panel>
        </div>
      </section>

      <ActionCentre a={action} />
    </div>
  );
}
