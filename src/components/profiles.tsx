"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- profile payloads are rendered generically */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { label } from "@/config/enums";
import { Badge, EmptyState, Modal, Progress, Skeleton, Tabs, statusTone } from "./ui";
import { DocumentList } from "./module";
import { ResourceManager } from "./resource-manager";

const Tot = ({ l, v, tone }: { l: string; v: string; tone?: string }) => <div className="rounded-xl border border-line bg-panel2/60 px-3 py-2"><p className="eyebrow">{l}</p><p className={`num mt-0.5 text-base font-semibold ${tone ?? ""}`}>{v}</p></div>;
const Rows = ({ rows, empty }: { rows: React.ReactNode[][]; empty: string }) => !rows.length ? <p className="py-4 text-center text-sm text-muted">{empty}</p> : (
  <ul className="divide-y divide-line/60">{rows.map((r, i) => <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">{r.map((c, j) => <span key={j} className={j === 0 ? "min-w-0 flex-1 font-medium" : ""}>{c}</span>)}</li>)}</ul>
);

type CTab = "contracts" | "invoices" | "payments" | "projects" | "feedback" | "support" | "documents";
export function CustomerProfile({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<CTab>("contracts");
  const q = useQuery({ queryKey: ["customer-profile", id], queryFn: () => api<any>(`/api/customers/${id}/profile`), enabled: !!id });
  const d = q.data;
  return (
    <Modal open={!!id} onClose={onClose} title={d?.customer.name ?? "Customer profile"} wide>
      {q.isLoading ? <Skeleton className="h-64" /> : q.isError || !d ? <EmptyState title="Could not load this customer" hint={(q.error as Error)?.message} /> : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <Badge tone={statusTone(d.customer.status)}>{label(d.customer.status)}</Badge>
            {d.customer.contactPerson && <span>{d.customer.contactPerson}</span>}
            {d.customer.phone && <span className="inline-flex items-center gap-1 text-muted"><Phone className="h-3.5 w-3.5" />{d.customer.phone}</span>}
            {d.customer.email && <span className="inline-flex items-center gap-1 text-muted"><Mail className="h-3.5 w-3.5" />{d.customer.email}</span>}
            {d.customer.location && <span className="inline-flex items-center gap-1 text-muted"><MapPin className="h-3.5 w-3.5" />{d.customer.location}</span>}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tot l="Paid to date" v={ghs(d.totals.paid)} tone="text-good" /><Tot l="Outstanding" v={ghs(d.totals.outstanding)} tone={d.totals.outstanding > 0 ? "text-warn" : ""} />
            <Tot l="Active contract value" v={ghs(d.totals.contractValue)} /><Tot l="Satisfaction" v={(() => { const r = d.feedback.filter((f: any) => f.rating); return r.length ? `${(r.reduce((s: number, f: any) => s + f.rating, 0) / r.length).toFixed(1)}/5` : "No ratings"; })()} />
          </div>
          {d.customer.notes && <p className="mb-3 rounded-lg bg-panel2/60 p-2.5 text-sm text-muted">{d.customer.notes}</p>}
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "contracts", label: "Contracts", count: d.contracts.length }, { id: "invoices", label: "Invoices", count: d.invoices.length }, { id: "payments", label: "Payments", count: d.payments.length }, { id: "projects", label: "Projects", count: d.projects.length }, { id: "feedback", label: "Feedback", count: d.feedback.length }, { id: "support", label: "Support issues", count: d.support.length }, { id: "documents", label: "Documents", count: d.documents.length }]} />
          {tab === "contracts" && <Rows empty="No contracts yet." rows={d.contracts.map((c: any) => [c.title, <Badge key="s" tone={statusTone(c.status)}>{label(c.status)}</Badge>, <span key="v" className="num">{ghs(Number(c.value))}</span>, <span key="p" className="num text-muted">paid {ghs(c.paid)}</span>, <span key="e" className="num text-muted">ends {fmtDate(c.endDate)}</span>])} />}
          {tab === "invoices" && <Rows empty="No invoices yet." rows={d.invoices.map((i: any) => [i.number, <span key="a" className="num">{ghs(i.amount)}</span>, <span key="o" className={`num ${i.outstanding > 0 ? "text-warn" : "text-good"}`}>{i.outstanding > 0 ? `owes ${ghs(i.outstanding)}` : i.status === "SENT" ? "paid" : label(i.status)}</span>, <span key="d" className="num text-muted">due {fmtDate(i.dueDate)}{i.overdueDays ? ` · ${i.overdueDays} d late` : ""}</span>])} />}
          {tab === "payments" && <Rows empty="No payments recorded." rows={d.payments.map((p: any) => [p.title, <span key="a" className="num text-good">{ghs(Number(p.amount))}</span>, <span key="m" className="text-muted">{label(p.paymentMethod)}</span>, <span key="d" className="num text-muted">{fmtDate(p.date)}</span>])} />}
          {tab === "projects" && <Rows empty="No projects yet." rows={d.projects.map((p: any) => [p.name, <Badge key="s" tone={statusTone(p.status)}>{label(p.status)}</Badge>, <span key="t" className="num text-muted">target {fmtDate(p.targetDate)}</span>])} />}
          {tab === "feedback" && <Rows empty="No feedback recorded." rows={d.feedback.map((f: any) => [f.comments.slice(0, 120), <Badge key="c" tone={statusTone(f.category)}>{label(f.category)}</Badge>, <span key="r" className="num">{f.rating ? `${f.rating}/5` : "—"}</span>, <span key="d" className="num text-muted">{fmtDate(f.date)}</span>])} />}
          {tab === "support" && <Rows empty="No support issues." rows={d.support.map((f: any) => [f.comments.slice(0, 120), <Badge key="c" tone={statusTone(f.category)}>{label(f.category)}</Badge>, <Badge key="s" tone={statusTone(f.resolution)}>{label(f.resolution)}</Badge>, <span key="d" className="num text-muted">{fmtDate(f.date)}</span>])} />}
          {tab === "documents" && <DocumentList link={{ customerId: d.customer.id }} purpose="CONTRACT" />}
        </div>
      )}
    </Modal>
  );
}

type PTab = "overview" | "milestones" | "tasks" | "money" | "documents";
export function ProjectProfile({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [tab, setTab] = useState<PTab>("overview");
  const q = useQuery({ queryKey: ["project-profile", id], queryFn: () => api<any>(`/api/projects/${id}/profile`), enabled: !!id });
  const d = q.data;
  return (
    <Modal open={!!id} onClose={onClose} title={d?.project.name ?? "Project"} wide>
      {q.isLoading ? <Skeleton className="h-64" /> : q.isError || !d ? <EmptyState title="Could not load this project" hint={(q.error as Error)?.message} /> : (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><Badge tone={statusTone(d.project.status)}>{label(d.project.status)}</Badge><Badge tone="violet">{label(d.project.category)}</Badge>{d.project.customer && <span className="text-muted">for {d.project.customer.name}</span>}</div>
          <div className="mb-3"><div className="mb-1 flex justify-between text-xs"><span className="text-muted">Progress</span><span className="num">{d.progress}%</span></div><Progress value={d.progress} tone={d.progress === 100 ? "good" : "accent"} /></div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><Tot l="Budget" v={ghs(d.finance.budget)} /><Tot l="Received" v={ghs(d.finance.received)} tone="text-good" /><Tot l="Balance outstanding" v={ghs(d.finance.outstanding)} tone={d.finance.outstanding > 0 ? "text-warn" : ""} /><Tot l="Expenses" v={ghs(d.finance.expenses)} /></div>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "milestones", label: "Milestones", count: d.milestones.length }, { id: "tasks", label: "Tasks", count: d.tasks.length }, { id: "money", label: "Income & expenses", count: d.transactions.length }, { id: "documents", label: "Documents" }]} />
          {tab === "overview" && (
            <div className="space-y-3 text-sm">
              {d.project.description && <p>{d.project.description}</p>}
              <p className="text-muted">Start {fmtDate(d.project.startDate)} · Target {fmtDate(d.project.targetDate)} · {d.project.completedAt ? `Completed ${fmtDate(d.project.completedAt)}` : "Not completed"}</p>
              {d.project.notes && <p className="rounded-lg bg-panel2/60 p-2.5">{d.project.notes}</p>}
              <div><p className="eyebrow mb-1">Linked problems</p><Rows empty="No linked problems." rows={d.problems.map((p: any) => [p.title, <Badge key="s" tone={statusTone(p.severity)}>{label(p.severity)}</Badge>, <span key="t" className="text-muted">{label(p.status)}</span>])} /></div>
              <div><p className="eyebrow mb-1">Linked engineering achievements</p><Rows empty="None linked. Link achievements to this project when you record them." rows={d.achievements.map((a: any) => [a.title, <span key="d" className="num text-muted">{fmtDate(a.completedAt)}</span>])} /></div>
            </div>
          )}
          {tab === "milestones" && <ResourceManager resource="milestones" query={{ f_projectId: id }} defaults={{ projectId: id }} compact addLabel="Add milestone" />}
          {tab === "tasks" && <ResourceManager resource="tasks" query={{ f_projectId: id }} defaults={{ projectId: id }} compact addLabel="Add task" />}
          {tab === "money" && <Rows empty="No income or expenses linked to this project." rows={d.transactions.map((t: any) => [t.title, <Badge key="t" tone={t.type === "INCOME" ? "green" : "orange"}>{label(t.type)}</Badge>, <span key="a" className="num">{ghs(Number(t.amount))}</span>, <span key="d" className="num text-muted">{fmtDate(t.date)}</span>])} />}
          {tab === "documents" && <DocumentList link={{ projectId: d.project.id }} />}
        </div>
      )}
    </Modal>
  );
}
