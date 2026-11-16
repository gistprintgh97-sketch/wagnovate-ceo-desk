"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate } from "@/lib/dates";
import { ghs, ghsCompact } from "@/lib/money";
import { ChartTip, useChartStyle } from "./dashboard/charts";
import { EmptyState, Panel } from "./ui";
import type { Report, Section } from "@/server/reports";

const PALETTE = ["accent", "cyan", "good", "warn", "violet", "bad"] as const;

function Chart({ s }: { s: NonNullable<Section["chart"]> }) {
  const { c, anim, tick, grid } = useChartStyle();
  const hasData = s.data.some((d) => s.series.some((x) => Number(d[x.key] ?? 0) !== 0));
  if (!s.data.length || !hasData) return <EmptyState title="No data to chart for this period." />;
  const fmt = (v: number) => (s.money ? ghsCompact(v) : String(v));
  if (s.kind === "pie") {
    const key = s.series[0].key;
    return (
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-[200px] w-[200px] shrink-0"><ResponsiveContainer><PieChart><Pie data={s.data} dataKey={key} nameKey={s.x} innerRadius={50} outerRadius={85} paddingAngle={2} stroke="none" {...anim}>{s.data.map((_, i) => <Cell key={i} fill={c[PALETTE[i % PALETTE.length]]} />)}</Pie><Tooltip content={({ active, payload }) => active && payload?.[0] ? <div className="rounded-lg border border-line bg-panel px-2 py-1 text-xs">{payload[0].name}: <b className="num">{s.money ? ghs(payload[0].value as number) : payload[0].value}</b></div> : null} /></PieChart></ResponsiveContainer></div>
        <ul className="min-w-[160px] flex-1 space-y-1 text-xs">{s.data.map((d, i) => <li key={i} className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: c[PALETTE[i % PALETTE.length]] }} /><span className="flex-1 truncate">{String(d[s.x])}</span><span className="num">{s.money ? ghs(Number(d[key])) : d[key]}</span></li>)}</ul>
      </div>
    );
  }
  const Ch = s.kind === "line" ? LineChart : BarChart;
  return (
    <div className="h-[240px]"><ResponsiveContainer>
      <Ch data={s.data} margin={{ top: 6, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey={s.x} tick={tick} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" />
        <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={fmt} width={48} allowDecimals={false} />
        <Tooltip content={<ChartTip money={s.money} />} />{s.series.length > 1 && <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
        {s.series.map((x, i) => s.kind === "line"
          ? <Line key={x.key} name={x.label} dataKey={x.key} stroke={c[PALETTE[i % PALETTE.length]]} strokeWidth={2} dot={false} {...anim} />
          : <Bar key={x.key} name={x.label} dataKey={x.key} fill={c[PALETTE[i % PALETTE.length]]} radius={[3, 3, 0, 0]} {...anim} />)}
      </Ch>
    </ResponsiveContainer></div>
  );
}

function cell(v: string | number | null, t?: string) {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (t === "money") return <span className="num">{ghs(Number(v))}</span>;
  if (t === "date") return <span className="num">{fmtDate(String(v))}</span>;
  if (t === "percent") return <span className={`num ${Number(v) >= 0 ? "text-good" : "text-bad"}`}>{Number(v) > 0 ? "+" : ""}{v}%</span>;
  if (t === "number") return <span className="num">{v}</span>;
  return <span>{String(v)}</span>;
}

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {report.kpis.map((k) => <div key={k.label} className="rounded-xl border border-line bg-panel px-3 py-2.5"><p className="eyebrow">{k.label}</p><p className="num mt-0.5 text-lg font-semibold">{k.value}</p>{k.sub && <p className="text-[11px] text-muted">{k.sub}</p>}</div>)}
      </div>
      {report.sections.map((s) => (
        <Panel key={s.title} title={s.title}>
          {s.note && <p className="mb-2 text-xs text-muted">{s.note}</p>}
          {s.chart && <Chart s={s.chart} />}
          {s.table && (
            <div className={s.chart ? "mt-3" : ""}>
              {!s.table.rows.length ? <EmptyState title="No records for this period." /> : (
                <>
                <ul className="space-y-2 md:hidden">
                  {s.table.rows.slice(0, 100).map((r, i) => (
                    <li key={i} className="rounded-xl border border-line bg-panel2/50 p-3">
                      <p className="break-words text-sm font-medium">{cell(r[s.table!.columns[0].key], s.table!.columns[0].type)}</p>
                      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {s.table!.columns.slice(1).map((c) => <div key={c.key} className="min-w-0"><dt className="eyebrow">{c.label}</dt><dd className="break-words">{cell(r[c.key], c.type)}</dd></div>)}
                      </dl>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto rounded-xl border border-line md:block">
                  <table className="w-full text-sm">
                    <thead className="bg-panel2 text-left"><tr>{s.table.columns.map((c) => <th key={c.key} className={`eyebrow whitespace-nowrap px-3 py-2 font-medium ${c.type === "money" || c.type === "number" || c.type === "percent" ? "text-right" : ""}`}>{c.label}</th>)}</tr></thead>
                    <tbody>{s.table.rows.slice(0, 200).map((r, i) => <tr key={i} className="border-t border-line/60">{s.table!.columns.map((c) => <td key={c.key} className={`px-3 py-1.5 ${c.type === "money" || c.type === "number" || c.type === "percent" ? "text-right" : ""}`}>{cell(r[c.key], c.type)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
                </>
              )}
              {s.table.rows.length > 200 && <p className="mt-1 text-[11px] text-muted">Showing the first 200 rows. Export CSV for the full list.</p>}
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
