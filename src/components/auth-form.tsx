"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Button, Label } from "./ui";

export type AuthField = { name: string; label: string; type?: string; autoComplete?: string; hint?: string };

export function AuthForm({ fields, submit, endpoint, onSuccess, extra, initial }: {
  fields: AuthField[]; submit: string; endpoint: string; onSuccess: (r: { message?: string }) => void; extra?: ReactNode; initial?: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      onSuccess(await api(endpoint, { body: values }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={go} className="space-y-4" noValidate>
      {fields.map((f) => (
        <div key={f.name}>
          <Label htmlFor={f.name}>{f.label}</Label>
          <input
            id={f.name} name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} className="field"
            value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} required
          />
          {f.hint && <p className="mt-1 text-[11px] text-muted">{f.hint}</p>}
        </div>
      ))}
      {error && <p role="alert" className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <Button type="submit" variant="primary" loading={busy} className="w-full">{submit}</Button>
      {extra}
    </form>
  );
}
