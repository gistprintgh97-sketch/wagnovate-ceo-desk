"use client";
import { useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { presetRange, iso, today, type Preset } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Button, ConfirmDialog, Tabs } from "./ui";
import { useToast } from "./toast";

/** Tabs whose selection lives in the URL (?tab=...), so links from alerts and the dashboard land on the right tab. */
export function useTabState<T extends string>(ids: readonly T[], fallback: T): [T, (t: T) => void] {
  const sp = useSearchParams(); const router = useRouter(); const path = usePathname();
  const raw = sp.get("tab") as T | null;
  const value = raw && ids.includes(raw) ? raw : fallback;
  const set = (t: T) => { const n = new URLSearchParams(sp.toString()); n.set("tab", t); router.replace(`${path}?${n.toString()}`, { scroll: false }); };
  return [value, set];
}
export function ModuleTabs<T extends string>({ tabs, fallback, children }: { tabs: { id: T; label: string; count?: number }[]; fallback: T; children: (tab: T) => ReactNode }) {
  const [tab, setTab] = useTabState(tabs.map((t) => t.id), fallback);
  return <><Tabs tabs={tabs} value={tab} onChange={setTab} />{children(tab)}</>;
}

export type Period = { preset: Preset; from: string; to: string };
const PRESETS: { id: Preset; label: string }[] = [{ id: "today", label: "Today" }, { id: "week", label: "This week" }, { id: "month", label: "This month" }, { id: "quarter", label: "This quarter" }, { id: "year", label: "This year" }, { id: "custom", label: "Custom" }];
export function periodOf(preset: Preset, custom?: { from: string; to: string }): Period {
  if (preset === "custom" && custom) return { preset, ...custom };
  const r = presetRange(preset, today());
  return { preset, from: iso(r.from), to: iso(r.to) };
}
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <button key={p.id} aria-pressed={value.preset === p.id} onClick={() => onChange(p.id === "custom" ? { ...value, preset: "custom" } : periodOf(p.id))}
          className={cn("rounded-lg border px-2.5 py-1.5 text-xs font-medium transition", value.preset === p.id ? "border-accent bg-accent/15" : "border-line text-muted hover:text-fg")}>{p.label}</button>
      ))}
      {value.preset === "custom" && (
        <span className="flex items-center gap-1.5 text-xs">
          <input aria-label="From date" type="date" className="field w-auto py-1" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-muted">to</span>
          <input aria-label="To date" type="date" className="field w-auto py-1" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </span>
      )}
    </div>
  );
}

type Doc = { id: string; originalName: string; mime: string; size: number; purpose: string; createdAt: string };
/** Upload and list documents attached to one record (customer, contract, project or transaction). */
export function DocumentList({ link, purpose = "DOCUMENT", compact }: { link: { customerId?: string; contractId?: string; projectId?: string; transactionId?: string }; purpose?: string; compact?: boolean }) {
  const qc = useQueryClient(); const toast = useToast(); const input = useRef<HTMLInputElement>(null);
  const [del, setDel] = useState<Doc | null>(null);
  const key = ["documents", link];
  const q = useQuery({ queryKey: key, queryFn: () => api<{ items: Doc[] }>(`/api/documents?${new URLSearchParams(link as Record<string, string>)}`) });
  const up = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData(); fd.append("file", file); fd.append("purpose", purpose);
      for (const [k, v] of Object.entries(link)) if (v) fd.append(k, v);
      const res = await fetch("/api/documents", { method: "POST", body: fd, credentials: "same-origin" });
      const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error ?? "Upload failed.");
      return j;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.ok("File uploaded."); if (input.current) input.current.value = ""; },
    onError: (e: Error) => toast.err(e.message),
  });
  const rm = useMutation({ mutationFn: (id: string) => api(`/api/documents/${id}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setDel(null); toast.ok("File removed."); }, onError: (e: Error) => toast.err(e.message) });
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        {!compact && <p className="text-xs text-muted">PNG, JPG, WEBP, PDF, DOCX, XLSX, TXT or CSV · up to 10 MB</p>}
        <input ref={input} type="file" className="hidden" aria-label="Choose a file to upload" onChange={(e) => e.target.files?.[0] && up.mutate(e.target.files[0])} />
        <Button onClick={() => input.current?.click()} loading={up.isPending}><Upload className="h-4 w-4" />Upload file</Button>
      </div>
      {q.isLoading ? <p className="text-xs text-muted">Loading…</p> : !q.data?.items.length ? <p className="py-3 text-center text-xs text-muted">No documents uploaded yet.</p> : (
        <ul className="space-y-1">
          {q.data.items.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg bg-panel2/60 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <a href={`/api/files/${d.id}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:text-accent">{d.originalName}</a>
              <span className="num text-[11px] text-muted">{d.size > 1048576 ? `${(d.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(d.size / 1024))} KB`}</span>
              <button aria-label={`Remove ${d.originalName}`} className="rounded-md p-1 text-muted hover:text-bad" onClick={() => setDel(d)}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={!!del} title="Remove this file?" message={`“${del?.originalName}” will be removed from this record. A copy is kept in storage history.`} confirmLabel="Remove" loading={rm.isPending} onClose={() => setDel(null)} onConfirm={() => del && rm.mutate(del.id)} />
    </div>
  );
}
