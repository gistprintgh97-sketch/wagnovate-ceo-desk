"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, FileText, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate, iso, parseDate, today, weekStart } from "@/lib/dates";
import { label } from "@/config/enums";
import { Badge, Button, EmptyState, PageHeader, Panel, Skeleton, statusTone } from "@/components/ui";
import { useToast } from "@/components/toast";

type Row = { id: string; weekStart: string; weekEnd: string; status: "DRAFT" | "COMPLETED"; currentStep: number; completedAt: string | null; summarySource: string | null; priorOutcome: string | null; nextPriority: string | null };

export function ReviewHome() {
  const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const q = useQuery({ queryKey: ["reviews"], queryFn: () => api<{ items: Row[] }>("/api/reviews") });
  const start = useMutation({
    mutationFn: (ws?: string) => api<{ id: string }>("/api/reviews", { body: ws ? { weekStart: ws } : {} }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["reviews"] }); router.push(`/review/${r.id}`); },
    onError: (e: Error) => toast.err(e.message),
  });
  const thisWeek = iso(weekStart(today()));
  const current = q.data?.items.find((r) => r.weekStart.slice(0, 10) === thisWeek);
  const lastWeek = iso(new Date(weekStart(today()).getTime() - 7 * 864e5));
  const lastExists = q.data?.items.some((r) => r.weekStart.slice(0, 10) === lastWeek);

  return (
    <>
      <PageHeader title="Weekly CEO Review" subtitle="Seven questions, once a week. Every review is saved to history and never overwritten." />
      <Panel title="This week" className="mb-4">
        {q.isLoading ? <Skeleton className="h-16" /> : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold">Week of {fmtDate(parseDate(thisWeek))}</p>
              <p className="text-sm text-muted">{!current ? "Not started yet." : current.status === "COMPLETED" ? "Completed. Open it to read the report." : `Draft in progress — step ${Math.min(7, current.currentStep)} of 7.`}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {current ? <Link className="btn btn-primary" href={`/review/${current.id}`}>{current.status === "COMPLETED" ? <><FileText className="h-4 w-4" />View report</> : <><PlayCircle className="h-4 w-4" />Continue review</>}</Link>
                : <Button variant="primary" loading={start.isPending} onClick={() => start.mutate(undefined)}><ClipboardCheck className="h-4 w-4" />Start this week's review</Button>}
              {!lastExists && <Button loading={start.isPending} onClick={() => start.mutate(lastWeek)}>Catch up on last week</Button>}
            </div>
          </div>
        )}
      </Panel>
      <Panel title="Review history">
        {q.isLoading ? <Skeleton className="h-32" /> : !q.data?.items.length ? <EmptyState title="No reviews yet" hint="Your first completed review will appear here, with its report." /> : (
          <ul className="divide-y divide-line/60">
            {q.data.items.map((r) => (
              <li key={r.id}>
                <Link href={`/review/${r.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 transition hover:bg-panel2">
                  <span className="w-44 shrink-0 text-sm font-medium">{fmtDate(parseDate(r.weekStart.slice(0, 10)))} – {fmtDate(parseDate(r.weekEnd.slice(0, 10)))}</span>
                  <Badge tone={r.status === "COMPLETED" ? "green" : "orange"}>{r.status === "COMPLETED" ? "Completed" : `Draft · step ${Math.min(7, r.currentStep)}`}</Badge>
                  {r.priorOutcome && <Badge tone={statusTone(r.priorOutcome)}>Last priority: {label(r.priorOutcome)}</Badge>}
                  <span className="min-w-0 flex-1 truncate text-sm text-muted">{r.nextPriority ? `Next priority: ${r.nextPriority}` : "No next priority chosen"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
