"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- list items are rendered generically */
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { api, qs } from "@/lib/api";
import { label } from "@/config/enums";
import { Button, EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui";
import { ModuleTabs, PeriodPicker, periodOf, type Period } from "@/components/module";
import { ResourceManager } from "@/components/resource-manager";
import { CustomerProfile } from "@/components/profiles";
import { ReportView } from "@/components/report-view";
import type { Report } from "@/server/reports";

function Satisfaction() {
  const [period, setPeriod] = useState<Period>(periodOf("year"));
  const q = useQuery({ queryKey: ["report", "satisfaction", period], queryFn: () => api<Report>(`/api/reports/satisfaction${qs({ from: period.from, to: period.to })}`), placeholderData: (p) => p });
  const risk = useQuery({ queryKey: ["r", "customers", "risk"], queryFn: () => api<{ items: any[] }>("/api/r/customers?f_status=AT_RISK&pageSize=20") });
  return (
    <div className="space-y-4">
      <PeriodPicker value={period} onChange={setPeriod} />
      {risk.data?.items.length ? <Panel title="Customers at risk of leaving"><ul className="flex flex-wrap gap-2">{risk.data.items.map((c) => <li key={c.id} className="rounded-lg border border-warn/40 bg-warn/10 px-2.5 py-1 text-sm">{c.name} <span className="text-xs text-muted">{label(c.status)}</span></li>)}</ul></Panel> : null}
      {q.data ? <ReportView report={q.data} /> : <Skeleton className="h-64 rounded-panel" />}
    </div>
  );
}

export function CustomersPage() {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const [open, setOpen] = useState<string | null>(sp.get("customer"));
  useEffect(() => { setOpen(sp.get("customer")); }, [sp]);
  const close = () => { setOpen(null); const n = new URLSearchParams(sp.toString()); n.delete("customer"); router.replace(`${path}${n.toString() ? `?${n}` : ""}`, { scroll: false }); };
  return (
    <>
      <PageHeader title="Customers & Feedback" subtitle="Who you serve, what they say, and who needs attention." />
      <ModuleTabs fallback="customers" tabs={[{ id: "customers", label: "Customers" }, { id: "feedback", label: "Feedback" }, { id: "satisfaction", label: "Satisfaction analytics" }]}>
        {(tab) => tab === "customers"
          ? <ResourceManager resource="customers" rowActions={(c) => <Button className="min-h-[32px] px-2 py-1 text-xs" onClick={() => setOpen(c.id)}><UserRound className="h-3.5 w-3.5" />Profile</Button>} />
          : tab === "feedback" ? <ResourceManager resource="feedback" query={{ open: sp.get("open") ? 1 : undefined }} /> : <Satisfaction />}
      </ModuleTabs>
      <CustomerProfile id={open} onClose={close} />
      <span className="hidden">{EmptyState.name}</span>
    </>
  );
}
