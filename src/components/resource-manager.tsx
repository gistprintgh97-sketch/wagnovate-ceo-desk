"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- forms are generated from the field config, so values are dynamic */
import { useMemo, useState, type ReactNode } from "react";
import { useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { RESOURCES, buildSchema, type Field, type ResourceDef } from "@/config/resources";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, label } from "@/config/enums";
import { api, qs } from "@/lib/api";
import { fmtDate } from "@/lib/dates";
import { ghs } from "@/lib/money";
import { Badge, Button, ConfirmDialog, EmptyState, Label, Modal, Progress, Skeleton, statusTone } from "./ui";
import { useToast } from "./toast";

type ListResp = { items: any[]; total: number; page: number; pageSize: number };

export function useOptions(relation: string) {
  return useQuery({ queryKey: ["r", relation, "options"], queryFn: () => api<{ options: { id: string; label: string }[] }>(`/api/r/${relation}?options=1`), staleTime: 30_000 });
}

function FieldInput({ f, form, def }: { f: Field; form: any; def: ResourceDef }) {
  const opts = f.type === "relation" ? useOptions(f.relation!).data?.options : undefined; // eslint-disable-line react-hooks/rules-of-hooks -- stable per field
  const err = form.formState.errors[f.key]?.message as string | undefined;
  const id = `f-${def.key}-${f.key}`;
  let options = f.options;
  if (def.key === "transactions" && f.key === "category") options = form.watch("type") === "EXPENSE" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const reg = form.register(f.key);
  return (
    <div className={f.wide || f.type === "textarea" ? "sm:col-span-2" : ""}>
      <Label htmlFor={id} required={f.required}>{f.label}</Label>
      {f.type === "textarea" ? <textarea id={id} rows={3} className="field" {...reg} />
        : f.type === "select" ? (
          <select id={id} className="field" {...reg}>
            {!f.required || f.type === "select" ? <option value="">{f.required ? "Choose…" : "— None —"}</option> : null}
            {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : f.type === "relation" ? (
          <select id={id} className="field" {...reg}>
            <option value="">{f.required ? "Choose…" : "— None —"}</option>
            {opts?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        ) : <input id={id} className="field" type={f.type === "date" ? "date" : f.type === "number" || f.type === "money" || f.type === "int" ? "number" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
          step={f.type === "money" ? "0.01" : f.type === "number" ? "0.1" : f.type === "int" ? "1" : undefined} min={f.min} max={f.max} inputMode={f.type === "money" || f.type === "number" ? "decimal" : undefined} {...reg} />}
      {f.hint && !err && <p className="mt-1 text-[11px] text-muted">{f.hint}</p>}
      {err && <p role="alert" className="mt-1 text-xs text-bad">{err}</p>}
    </div>
  );
}

export function RecordForm({ def, item, defaults, onDone, onCancel }: { def: ResourceDef; item?: any; defaults?: Record<string, any>; onDone: (saved: any) => void; onCancel: () => void }) {
  const qc = useQueryClient(); const toast = useToast();
  const schema = useMemo(() => buildSchema(def), [def]);
  const initial = useMemo(() => {
    const v: Record<string, any> = {};
    for (const f of def.fields) {
      const raw = item ? item[f.key] : defaults?.[f.key] ?? f.default;
      v[f.key] = raw === null || raw === undefined ? "" : f.type === "date" ? String(raw).slice(0, 10) : raw;
    }
    return v;
  }, [def, item, defaults]);
  const form = useForm<FieldValues>({ resolver: zodResolver(schema) as any, defaultValues: initial });
  const [serverErr, setServerErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (values: any) => item ? api(`/api/r/${def.key}/${item.id}`, { method: "PATCH", body: values }) : api(`/api/r/${def.key}`, { method: "POST", body: values }),
    onSuccess: (saved) => { qc.invalidateQueries({ queryKey: ["r"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); qc.invalidateQueries({ queryKey: ["review"] }); toast.ok(`${def.label} saved.`); onDone(saved); },
    onError: (e: Error) => { setServerErr(e.message); toast.err(e.message); },
  });
  return (
    <form onSubmit={form.handleSubmit((v) => { setServerErr(null); save.mutate(v); })} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">{def.fields.filter((f) => !f.hidden).map((f) => <FieldInput key={f.key} f={f} form={form} def={def} />)}</div>
      {serverErr && <p role="alert" className="mt-3 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{serverErr}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" loading={save.isPending}>{item ? "Save changes" : `Add ${def.label.toLowerCase()}`}</Button>
      </div>
    </form>
  );
}

export function Cell({ f, item }: { f: Field | { key: string; type: string }; item: any }) {
  const v = item[f.key];
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  switch (f.type) {
    case "select": return <Badge tone={statusTone(v)}>{label(v)}</Badge>;
    case "money": return <span className="num">{ghs(v)}</span>;
    case "date": return <span className="num">{fmtDate(String(v))}</span>;
    case "relation": return <span>{item._labels?.[f.key] ?? "—"}</span>;
    case "int": return <span className="num">{v}{f.key === "rating" ? "/5" : ""}</span>;
    case "number": return <span className="num">{v}</span>;
    case "percent": return <div className="flex min-w-[80px] items-center gap-2"><Progress value={v} className="w-16" /><span className="num text-xs">{v}%</span></div>;
    default: return <span className="line-clamp-2">{String(v)}</span>;
  }
}

export function ResourceManager({ resource, title, defaults, query, rowActions, hideAdd, compact, addLabel, pageSize = 15, onChanged, extraFilters }: {
  resource: string; title?: string; defaults?: Record<string, any>; query?: Record<string, any>; rowActions?: (item: any) => ReactNode;
  hideAdd?: boolean; compact?: boolean; addLabel?: string; pageSize?: number; onChanged?: () => void; extraFilters?: ReactNode;
}) {
  const def = RESOURCES[resource];
  const qc = useQueryClient(); const toast = useToast();
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [editing, setEditing] = useState<any | null | "new">(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const params = { q, page, pageSize, sort: sort?.key, dir: sort?.dir, ...Object.fromEntries(Object.entries(filters).map(([k, v]) => [`f_${k}`, v])), ...query };
  const list = useQuery({ queryKey: ["r", resource, params], queryFn: () => api<ListResp>(`/api/r/${resource}${qs(params)}`), placeholderData: (p) => p });
  const del = useMutation({
    mutationFn: (id: string) => api(`/api/r/${resource}/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["r"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.ok(`${def.label} deleted. It is kept in history, not shown in lists.`); setDeleting(null); onChanged?.(); },
    onError: (e: Error) => { toast.err(e.message); setDeleting(null); },
  });

  const cols = def.fields.filter((f) => f.table);
  const filterFields = def.fields.filter((f) => f.filter && f.type === "select");
  const items = list.data?.items ?? []; const total = list.data?.total ?? 0; const pages = Math.max(1, Math.ceil(total / pageSize));
  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {title && <h2 className="mr-auto text-sm font-semibold">{title}</h2>}
        {!compact && (
          <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label={`Search ${def.plural}`} placeholder="Search…" className="field pl-8" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
        )}
        {!compact && filterFields.slice(0, 3).map((f) => (
          <select key={f.key} aria-label={`Filter by ${f.label}`} className="field w-auto max-w-[170px]" value={filters[f.key] ?? ""} onChange={(e) => { setFilters((x) => ({ ...x, [f.key]: e.target.value })); setPage(1); }}>
            <option value="">{f.label}: all</option>
            {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
        {extraFilters}
        {!hideAdd && <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{addLabel ?? `Add ${def.label.toLowerCase()}`}</Button>}
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : list.isError ? (
        <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{(list.error as Error).message}</p>
      ) : !items.length ? (
        <EmptyState title={q || Object.values(filters).some(Boolean) ? "Nothing matches your search." : def.emptyText} action={!hideAdd && !q ? <Button variant="primary" onClick={() => setEditing("new")}><Plus className="h-4 w-4" />{addLabel ?? `Add ${def.label.toLowerCase()}`}</Button> : undefined} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <table className="w-full text-sm">
              <thead className="bg-panel2 text-left">
                <tr>
                  {cols.map((f) => (
                    <th key={f.key} className="eyebrow cursor-pointer select-none whitespace-nowrap px-3 py-2 font-medium" onClick={() => toggleSort(f.key)} aria-sort={sort?.key === f.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <span className="inline-flex items-center gap-1">{f.label.replace(/ \(.*\)/, "")}{sort?.key === f.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
                    </th>
                  ))}
                  {def.computed?.map((c) => <th key={c.key} className="eyebrow whitespace-nowrap px-3 py-2 font-medium">{c.label}</th>)}
                  <th className="w-px px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-line/70 hover:bg-accent/5">
                    {cols.map((f) => <td key={f.key} className="max-w-[260px] px-3 py-2 align-middle"><Cell f={f} item={it} /></td>)}
                    {def.computed?.map((c) => <td key={c.key} className="px-3 py-2"><Cell f={{ key: c.key, type: c.type === "text" ? "text" : c.type }} item={it} /></td>)}
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {rowActions?.(it)}
                        <button aria-label={`Edit ${def.label}`} className="rounded-md p-1.5 text-muted hover:bg-panel2 hover:text-fg" onClick={() => setEditing(it)}><Pencil className="h-4 w-4" /></button>
                        <button aria-label={`Delete ${def.label}`} className="rounded-md p-1.5 text-muted hover:bg-bad/10 hover:text-bad" onClick={() => setDeleting(it)}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {items.map((it) => (
              <li key={it.id} className="rounded-xl border border-line bg-panel2/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium">{String(it[def.titleField] ?? "").slice(0, 90)}</p>
                  <div className="flex shrink-0 gap-1">
                    <button aria-label={`Edit ${def.label}`} className="rounded-md p-1.5 text-muted" onClick={() => setEditing(it)}><Pencil className="h-4 w-4" /></button>
                    <button aria-label={`Delete ${def.label}`} className="rounded-md p-1.5 text-muted" onClick={() => setDeleting(it)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  {cols.filter((f) => f.key !== def.titleField).map((f) => (<div key={f.key} className="min-w-0"><dt className="eyebrow">{f.label.replace(/ \(.*\)/, "")}</dt><dd className="break-words"><Cell f={f} item={it} /></dd></div>))}
                  {def.computed?.map((c) => (<div key={c.key}><dt className="eyebrow">{c.label}</dt><dd><Cell f={{ key: c.key, type: c.type }} item={it} /></dd></div>))}
                </dl>
                {rowActions && <div className="mt-2 flex gap-2">{rowActions(it)}</div>}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>{total} {total === 1 ? "record" : "records"}</span>
            {pages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="num">{page} / {pages}</span>
                <Button variant="ghost" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? `Add ${def.label.toLowerCase()}` : `Edit ${def.label.toLowerCase()}`} wide>
        {editing !== null && <RecordForm def={def} item={editing === "new" ? undefined : editing} defaults={defaults} onDone={() => { setEditing(null); onChanged?.(); }} onCancel={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog open={!!deleting} title={`Delete this ${def.label.toLowerCase()}?`} message={<>“{String(deleting?.[def.titleField] ?? "").slice(0, 80)}” will be removed from your lists and totals. A copy is kept in the database history. This cannot be undone from the app.</>} loading={del.isPending} onClose={() => setDeleting(null)} onConfirm={() => del.mutate(deleting.id)} />
    </div>
  );
}
