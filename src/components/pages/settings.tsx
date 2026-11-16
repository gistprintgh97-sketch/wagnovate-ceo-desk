"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- settings payload is rendered generically */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Download, ImageUp, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { INCOME_CATEGORIES } from "@/config/enums";
import { Badge, Button, Label, PageHeader, Panel, Skeleton } from "@/components/ui";
import { ModuleTabs } from "@/components/module";
import { useToast } from "@/components/toast";
import { applyTheme, type Theme } from "@/components/theme-toggle";

type S = any;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function useSettings() {
  const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api<S>("/api/settings") });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<S>("/api/settings", { method: "PATCH", body }),
    onSuccess: (d) => { qc.setQueryData(["settings"], d); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.ok("Settings saved."); },
    onError: (e: Error) => toast.err(e.message),
  });
  return { q, save };
}
const Field = ({ id, l, children, hint }: { id: string; l: string; children: ReactNode; hint?: string }) => <div><Label htmlFor={id}>{l}</Label>{children}{hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}</div>;
function Toggle({ id, l, v, on }: { id: string; l: string; v: boolean; on: (b: boolean) => void }) {
  return <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-panel2/50 px-3 text-sm"><span>{l}</span><input id={id} type="checkbox" className="h-5 w-5 accent-[rgb(var(--accent))]" checked={v} onChange={(e) => on(e.target.checked)} /></label>;
}

function Upload({ kind, current, onDone }: { kind: "logo" | "avatar"; current: boolean; onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null); const toast = useToast(); const [busy, setBusy] = useState(false);
  async function go(f: File) {
    setBusy(true);
    try { const fd = new FormData(); fd.append("file", f); fd.append("kind", kind); const r = await fetch("/api/settings/upload", { method: "POST", body: fd }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error ?? "Upload failed."); toast.ok(kind === "logo" ? "Logo updated." : "Picture updated."); onDone(); }
    catch (e) { toast.err((e as Error).message); } finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }
  return (
    <div className="flex items-center gap-3">
      {current && /* eslint-disable-next-line @next/next/no-img-element */ <img src={kind === "logo" ? `/api/branding/logo?t=${Date.now()}` : undefined} alt="" className={kind === "logo" ? "h-14 max-w-[160px] rounded-lg border border-line object-contain p-1" : "hidden"} />}
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-label={`Upload ${kind}`} onChange={(e) => e.target.files?.[0] && go(e.target.files[0])} />
      <Button onClick={() => ref.current?.click()} loading={busy}><ImageUp className="h-4 w-4" />{current ? "Replace" : "Upload"} {kind === "logo" ? "company logo" : "picture"}</Button>
      <span className="text-[11px] text-muted">PNG, JPG or WEBP · 2 MB max</span>
    </div>
  );
}

function Company({ s, save, refresh }: { s: S; save: (b: any) => void; refresh: () => void }) {
  const [f, setF] = useState({ name: s.company.name, slogan: s.company.slogan, website: s.company.website, email: s.company.email ?? "", phone: s.company.phone ?? "", address: s.company.address });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Panel title="Company">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="c-name" l="Company name"><input id="c-name" className="field" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field id="c-slogan" l="Slogan"><input id="c-slogan" className="field" value={f.slogan} onChange={(e) => set("slogan", e.target.value)} /></Field>
        <Field id="c-web" l="Website"><input id="c-web" className="field" value={f.website} onChange={(e) => set("website", e.target.value)} /></Field>
        <Field id="c-email" l="Contact email"><input id="c-email" type="email" className="field" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field id="c-phone" l="Contact phone"><input id="c-phone" className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field id="c-addr" l="Address"><input id="c-addr" className="field" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field id="c-cur" l="Currency" hint="GHS (Ghana Cedis). Fixed for now."><input id="c-cur" className="field" value="GHS — Ghana Cedis" disabled /></Field>
        <Field id="c-tz" l="Timezone" hint="All dates, reminders and the clock use this zone."><input id="c-tz" className="field" value="Africa/Accra" disabled /></Field>
      </div>
      <div className="mt-4"><Upload kind="logo" current={!!s.company.logoDocId} onDone={refresh} /></div>
      <p className="mt-2 text-[11px] text-muted">Your logo appears on the login page, the sidebar and printed reports. No logo is invented for you: until you upload one, only the WAGNOVATE name is shown.</p>
      <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => save({ section: "company", ...f, email: f.email || null, phone: f.phone || null })}>Save company</Button></div>
    </Panel>
  );
}

function Profile({ s, save, refresh }: { s: S; save: (b: any) => void; refresh: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: s.user.name, email: s.user.email });
  const [pw, setPw] = useState({ current: "", next: "" });
  const change = useMutation({ mutationFn: () => api("/api/auth/change-password", { body: pw }), onSuccess: () => { toast.ok("Password changed."); setPw({ current: "", next: "" }); }, onError: (e: Error) => toast.err(e.message) });
  return (
    <div className="space-y-4">
      <Panel title="CEO profile">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="p-name" l="Name"><input id="p-name" className="field" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field id="p-email" l="Email (used to sign in)"><input id="p-email" type="email" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <div className="mt-4"><Upload kind="avatar" current={false} onDone={refresh} /></div>
        <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => save({ section: "profile", ...f })}>Save profile</Button></div>
      </Panel>
      <Panel title="Change password">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="pw-cur" l="Current password"><input id="pw-cur" type="password" autoComplete="current-password" className="field" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field id="pw-new" l="New password" hint="At least 10 characters with upper-case, lower-case and a number."><input id="pw-new" type="password" autoComplete="new-password" className="field" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="primary" loading={change.isPending} disabled={!pw.current || !pw.next} onClick={() => change.mutate()}><ShieldCheck className="h-4 w-4" />Change password</Button></div>
      </Panel>
    </div>
  );
}

function Appearance({ s, save }: { s: S; save: (b: any) => void }) {
  const [t, setT] = useState<Theme>(s.settings.theme);
  return (
    <Panel title="Appearance">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
        {([["dark", "Dark", "Command-center look (default)"], ["light", "Light", "Clean white look"], ["system", "System", "Follows your device"]] as [Theme, string, string][]).map(([v, l, d]) => (
          <button key={v} role="radio" aria-checked={t === v} onClick={() => { setT(v); applyTheme(v); save({ section: "appearance", theme: v }); }} className={`rounded-xl border p-3 text-left transition ${t === v ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}><p className="text-sm font-semibold">{l}</p><p className="text-xs text-muted">{d}</p></button>
        ))}
      </div>
    </Panel>
  );
}

function Notifications({ s, save }: { s: S; save: (b: any) => void }) {
  const toast = useToast(); const qc = useQueryClient();
  const [f, setF] = useState({ reviewDay: s.settings.reviewDay, reviewTime: s.settings.reviewTime, reviewEveryWeeks: s.settings.reviewEveryWeeks, notifyReview: s.settings.notifyReview, notifyTasks: s.settings.notifyTasks, notifyFollowUps: s.settings.notifyFollowUps, notifyInvoices: s.settings.notifyInvoices, notifyProblems: s.settings.notifyProblems, notifyPriority: s.settings.notifyPriority, notifyContracts: s.settings.notifyContracts, lowConversionPct: s.settings.lowConversionPct });
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission); }, []);
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  async function enable() {
    if (typeof Notification === "undefined") { toast.err("This browser does not support notifications."); return; }
    const p = await Notification.requestPermission(); setPerm(p);
    if (p !== "granted") { toast.err("Notifications are blocked. You still get reminders inside the app. To allow them, change the site permission in your browser settings."); return; }
    try {
      if (s.push.configured && s.push.publicKey && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const key = Uint8Array.from(atob(s.push.publicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await api("/api/push", { body: sub.toJSON() }); qc.invalidateQueries({ queryKey: ["settings"] });
        toast.ok("Notifications enabled, including when the app is closed.");
      } else toast.ok("Notifications enabled while the app is open. Background push needs VAPID keys on the server (see README).");
    } catch (e) { toast.err(`Permission granted, but background push could not start: ${(e as Error).message}`); }
  }
  const test = useMutation({ mutationFn: () => api("/api/notifications/test", { method: "POST", body: {} }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["notifications"] }); toast.ok("Test sent. Look at the bell."); } });
  return (
    <div className="space-y-4">
      <Panel title="Weekly CEO review reminder">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field id="n-day" l="Day"><select id="n-day" className="field" value={f.reviewDay} onChange={(e) => set("reviewDay", Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Field>
          <Field id="n-time" l="Time (Africa/Accra)"><input id="n-time" type="time" className="field" value={f.reviewTime} onChange={(e) => set("reviewTime", e.target.value)} /></Field>
          <Field id="n-freq" l="Frequency"><select id="n-freq" className="field" value={f.reviewEveryWeeks} onChange={(e) => set("reviewEveryWeeks", Number(e.target.value))}><option value={1}>Every week</option><option value={2}>Every 2 weeks</option><option value={4}>Every 4 weeks</option></select></Field>
        </div>
        <p className="mt-2 text-[11px] text-muted">Default is Sunday at 6:00 PM. The reminder is sent by the server, so it does not need the app to be open.</p>
      </Panel>
      <Panel title="Which reminders to send">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Toggle id="t1" l="Weekly review" v={f.notifyReview} on={(b) => set("notifyReview", b)} /><Toggle id="t2" l="Task deadlines and overdue tasks" v={f.notifyTasks} on={(b) => set("notifyTasks", b)} />
          <Toggle id="t3" l="Customer follow-ups" v={f.notifyFollowUps} on={(b) => set("notifyFollowUps", b)} /><Toggle id="t4" l="Unpaid and overdue invoices" v={f.notifyInvoices} on={(b) => set("notifyInvoices", b)} />
          <Toggle id="t5" l="Critical unresolved problems" v={f.notifyProblems} on={(b) => set("notifyProblems", b)} /><Toggle id="t6" l="Strategic priority deadlines" v={f.notifyPriority} on={(b) => set("notifyPriority", b)} />
          <Toggle id="t7" l="Contract expiry" v={f.notifyContracts} on={(b) => set("notifyContracts", b)} />
        </div>
        <div className="mt-3 max-w-xs"><Field id="n-conv" l="Warn when win rate falls below (%)"><input id="n-conv" type="number" min={1} max={90} className="field" value={f.lowConversionPct} onChange={(e) => set("lowConversionPct", Number(e.target.value))} /></Field></div>
        <div className="mt-4 flex justify-end"><Button variant="primary" onClick={() => save({ section: "notifications", ...f })}>Save reminders</Button></div>
      </Panel>
      <Panel title="Browser and phone notifications">
        <div className="flex flex-wrap items-center gap-3">
          {perm === "granted" ? <Badge tone="green"><Bell className="mr-1 h-3 w-3" />Allowed</Badge> : perm === "denied" ? <Badge tone="red"><BellOff className="mr-1 h-3 w-3" />Blocked in this browser</Badge> : perm === "unsupported" ? <Badge tone="orange">Not supported here</Badge> : <Badge>Not enabled</Badge>}
          <Button variant="primary" onClick={enable} disabled={perm === "granted" && s.push.subscriptions > 0}>Enable notifications on this device</Button>
          <Button onClick={() => test.mutate()} loading={test.isPending}>Send a test</Button>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>The browser asks for permission only when you press the button. If you say no, in-app reminders (the bell) still work.</li>
          <li>Background push (notifications when the app is closed): {s.push.configured ? <b className="text-good">configured on the server; {s.push.subscriptions} device(s) subscribed</b> : <b className="text-warn">not configured. Run pnpm vapid and add the keys to .env</b>}.</li>
          <li>On iPhone, install the app to the Home Screen first (Share, then Add to Home Screen), then enable notifications.</li>
        </ul>
      </Panel>
    </div>
  );
}

function Targets() {
  const toast = useToast(); const qc = useQueryClient();
  const year = new Date().getFullYear();
  const q = useQuery({ queryKey: ["targets", year], queryFn: () => api<{ targets: Record<string, number> }>(`/api/targets?year=${year}`) });
  const [vals, setVals] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setVals(Object.fromEntries(INCOME_CATEGORIES.map((c) => [c.value, q.data.targets[c.value] ? String(q.data.targets[c.value]) : ""]))); }, [q.data]);
  const save = useMutation({
    mutationFn: async () => { for (const c of INCOME_CATEGORIES) { const n = Number(vals[c.value] || 0); await api("/api/targets", { method: "PUT", body: { year, category: c.value, annual: n } }); } },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targets"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.ok("Targets saved."); }, onError: (e: Error) => toast.err(e.message),
  });
  if (q.isLoading) return <Skeleton className="h-64 rounded-panel" />;
  return (
    <Panel title={`Annual revenue targets · ${year}`}>
      <p className="mb-3 text-sm text-muted">Set what you aim to earn this year for each product or service (GHS). The dashboard compares what you have earned to date with the share of the target that should be reached by today. Leave blank for no target.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{INCOME_CATEGORIES.map((c) => <Field key={c.value} id={`tg-${c.value}`} l={c.label}><input id={`tg-${c.value}`} type="number" min={0} step="100" inputMode="decimal" className="field" value={vals[c.value] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [c.value]: e.target.value }))} /></Field>)}</div>
      <div className="mt-4 flex justify-end"><Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>Save targets</Button></div>
    </Panel>
  );
}

function AI({ s, save }: { s: S; save: (b: any) => void }) {
  const [f, setF] = useState({ aiProvider: s.settings.aiProvider, aiModel: s.settings.aiModel ?? "", aiBaseUrl: s.settings.aiBaseUrl ?? "", aiAutoSummary: s.settings.aiAutoSummary });
  const [key, setKey] = useState("");
  return (
    <Panel title="AI executive summary">
      <p className="mb-3 text-sm text-muted">When you complete a weekly review, an AI model can write the executive summary from your saved records. It is told never to invent figures and to say “not recorded” when something is missing. Without a key, a built-in rule-based writer does the same job.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="ai-p" l="Provider"><select id="ai-p" className="field" value={f.aiProvider} onChange={(e) => setF({ ...f, aiProvider: e.target.value })}><option value="none">None (rule-based summary)</option><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI or compatible</option></select></Field>
        <Field id="ai-m" l="Model" hint="Leave blank for the default."><input id="ai-m" className="field" value={f.aiModel} onChange={(e) => setF({ ...f, aiModel: e.target.value })} placeholder={f.aiProvider === "anthropic" ? "claude-sonnet-5-5" : "gpt-4o-mini"} /></Field>
        <Field id="ai-k" l="API key" hint={s.settings.aiKeySet ? "A key is saved (encrypted on the server). Type a new one to replace it." : "Stored encrypted on the server. Never sent back to the browser."}><input id="ai-k" type="password" autoComplete="off" className="field" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.settings.aiKeySet ? "••••••••••••" : "Paste your API key"} /></Field>
        <Field id="ai-u" l="Custom base URL (optional)"><input id="ai-u" className="field" value={f.aiBaseUrl} onChange={(e) => setF({ ...f, aiBaseUrl: e.target.value })} placeholder="https://…" /></Field>
      </div>
      <div className="mt-3"><Toggle id="ai-auto" l="Write the summary with AI automatically when I complete a review" v={f.aiAutoSummary} on={(b) => setF({ ...f, aiAutoSummary: b })} /></div>
      {!s.encryptionConfigured && <p className="mt-2 text-xs text-warn">ENCRYPTION_KEY is not set, so an API key cannot be saved yet. Run <code>pnpm secrets</code>.</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {s.settings.aiKeySet && <Button variant="danger" onClick={() => save({ section: "ai", ...f, aiModel: f.aiModel || null, aiBaseUrl: f.aiBaseUrl || null, clearKey: true })}>Remove saved key</Button>}
        <Button variant="primary" onClick={() => { save({ section: "ai", ...f, aiModel: f.aiModel || null, aiBaseUrl: f.aiBaseUrl || null, ...(key ? { apiKey: key } : {}) }); setKey(""); }}>Save AI settings</Button>
      </div>
    </Panel>
  );
}

function Data({ s }: { s: S }) {
  return (
    <div className="space-y-4">
      <Panel title="Export company data">
        <p className="mb-3 text-sm text-muted">Download every record as one JSON file (customers, contracts, invoices, transactions, reviews and more). Passwords, sessions and your AI key are never included. Uploaded files stay in the server storage folder.</p>
        <a className="btn btn-primary" href="/api/export"><Download className="h-4 w-4" />Download export</a>
      </Panel>
      <Panel title="Database backup and restore">
        <p className="text-sm text-muted">A real database backup is made on the server, not in the browser, so it is safe and complete. Run these from the project folder:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-panel2 p-3 text-xs">{`pnpm db:backup                       # creates backups/ceo-desk-YYYY-MM-DD-HHMM.sql
pnpm db:restore backups/<file>.sql   # restores (asks you to type RESTORE first)`}</pre>
        <p className="mt-2 text-xs text-muted">Restoring from inside the app is intentionally not offered: replacing the live database from a web page is too risky. Back up the <code>storage/uploads</code> folder as well.</p>
      </Panel>
      <Panel title="Account security">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Passwords are hashed with Argon2id. Five wrong passwords lock the account for 15 minutes.</li>
          <li>Sessions last 14 days and are cleared when you sign out or reset your password.</li>
          <li>Password reset links are {s.emailConfigured ? "emailed to you" : "printed in the server console (email is not configured; see README)"}.</li>
        </ul>
      </Panel>
    </div>
  );
}

export function SettingsPage() {
  const { q, save } = useSettings();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["settings"] });
  return (
    <>
      <PageHeader title="Settings" subtitle="Company, account, reminders, targets and data." />
      {q.isLoading || !q.data ? <Skeleton className="h-64 rounded-panel" /> : (
        <ModuleTabs fallback="company" tabs={[{ id: "company", label: "Company" }, { id: "profile", label: "Profile & password" }, { id: "appearance", label: "Appearance" }, { id: "notifications", label: "Notifications" }, { id: "targets", label: "Revenue targets" }, { id: "ai", label: "AI summary" }, { id: "data", label: "Data & security" }]}>
          {(tab) => tab === "company" ? <Company s={q.data} save={save.mutate} refresh={() => { refresh(); window.location.reload(); }} />
            : tab === "profile" ? <Profile s={q.data} save={save.mutate} refresh={refresh} /> : tab === "appearance" ? <Appearance s={q.data} save={save.mutate} />
            : tab === "notifications" ? <Notifications s={q.data} save={save.mutate} /> : tab === "targets" ? <Targets /> : tab === "ai" ? <AI s={q.data} save={save.mutate} /> : <Data s={q.data} />}
        </ModuleTabs>
      )}
    </>
  );
}
