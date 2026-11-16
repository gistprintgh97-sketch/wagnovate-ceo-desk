"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- list items are rendered generically */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { LEAD_STAGE, label } from "@/config/enums";
import { diffDays, fmtDate, today } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, Skeleton } from "@/components/ui";
import { DocumentList, ModuleTabs } from "@/components/module";
import { AddRecordButton, ResourceManager } from "@/components/resource-manager";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

function Board() {
  const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ["r", "leads", "board"], queryFn: () => api<{ items: any[] }>("/api/r/leads?pageSize=200&sort=value&dir=desc") });
  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => api(`/api/r/leads/${id}`, { method: "PATCH", body: { stage } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["r"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: Error) => toast.err(e.message),
  });
  const convert = useMutation({
    mutationFn: (id: string) => api(`/api/leads/${id}/convert`, { method: "POST", body: {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["r"] }); toast.ok("Customer created. Open Customers to see it."); },
    onError: (e: Error) => toast.err(e.message),
  });
  if (q.isLoading) return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-panel" />)}</div>;
  const items = q.data?.items ?? [];
  if (!items.length) return <EmptyState title="No sales opportunities yet" hint="Add a prospect to start your pipeline." />;
  const t = today();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {LEAD_STAGE.map((s) => {
        const col = items.filter((x) => x.stage === s.value);
        const total = col.reduce((sum, x) => sum + Number(x.value), 0);
        return (
          <section key={s.value} aria-label={s.label} className="panel flex min-h-[120px] flex-col p-3">
            <header className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-semibold">{s.label}</h3><span className="num text-xs text-muted">{col.length} · {ghs(total)}</span></header>
            <ul className="space-y-2">
              {col.map((x) => {
                const due = x.nextFollowUp && diffDays(new Date(x.nextFollowUp), t) <= 0 && !["WON", "LOST"].includes(x.stage);
                return (
                  <li key={x.id} className="rounded-xl border border-line bg-panel2/60 p-2.5">
                    <p className="text-sm font-medium">{x.businessName}</p>
                    <p className="num text-xs text-muted">{ghs(Number(x.value))}{x.product ? ` · ${x.product}` : ""}</p>
                    {x.nextFollowUp && <p className={cn("text-[11px]", due ? "text-bad" : "text-muted")}>{due ? "Follow-up due " : "Follow up "}{fmtDate(x.nextFollowUp)}</p>}
                    <div className="mt-2 flex items-center gap-1.5">
                      <select aria-label={`Move ${x.businessName} to another stage`} className="field min-h-[32px] flex-1 py-1 text-xs" value={x.stage} onChange={(e) => move.mutate({ id: x.id, stage: e.target.value })}>
                        {LEAD_STAGE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {x.stage === "WON" && !x.customerId && <Button className="min-h-[32px] px-2 py-1 text-xs" loading={convert.isPending} onClick={() => convert.mutate(x.id)}><UserPlus className="h-3.5 w-3.5" />Customer</Button>}
                    </div>
                  </li>
                );
              })}
              {!col.length && <li className="py-3 text-center text-xs text-muted">Empty</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ContractRow({ c, onDocs }: { c: any; onDocs: () => void }) {
  const days = c.endDate && c.status === "ACTIVE" ? diffDays(new Date(c.endDate), today()) : null;
  return (
    <>
      {days !== null && days <= 60 && <Badge tone={days < 0 ? "red" : days <= 30 ? "orange" : "blue"}>{days < 0 ? `Expired ${-days} d ago` : `Expires in ${days} d`}</Badge>}
      <button aria-label="Documents" className="rounded-md p-1.5 text-muted hover:bg-panel2 hover:text-fg" onClick={onDocs}><Paperclip className="h-4 w-4" /></button>
    </>
  );
}

export function SalesPage() {
  const sp = useSearchParams();
  const [docs, setDocs] = useState<any | null>(null);
  const followUpDue = sp.get("followUpDue") ? 1 : undefined;
  return (
    <>
      <PageHeader title="Sales & Contracts" subtitle="Pipeline, opportunities and the contract register." />
      <ModuleTabs fallback={followUpDue ? "opportunities" : "pipeline"} tabs={[{ id: "pipeline", label: "Pipeline" }, { id: "opportunities", label: "All opportunities" }, { id: "contracts", label: "Contract register" }]}>
        {(tab) => tab === "pipeline" ? (
          <><div className="mb-3 flex justify-end"><AddRecordButton resource="leads">Add prospect</AddRecordButton></div><Board /></>
        ) : tab === "opportunities" ? <ResourceManager resource="leads" query={{ followUpDue }} /> : (
          <Panel><ResourceManager resource="contracts" rowActions={(c) => <ContractRow c={c} onDocs={() => setDocs(c)} />} /></Panel>
        )}
      </ModuleTabs>
      <Modal open={!!docs} onClose={() => setDocs(null)} title={`Documents · ${docs?.title ?? ""}`}>{docs && <DocumentList link={{ contractId: docs.id }} purpose="CONTRACT" />}</Modal>
      <span className="hidden">{label("WON")}</span>
    </>
  );
}
