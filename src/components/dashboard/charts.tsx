"use client";
import Link from "next/link";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTHS } from "@/lib/dates";
import { ghs, ghsCompact } from "@/lib/money";
import { useReducedMotion, useThemeColors } from "@/lib/use-theme-colors";
import { EmptyState } from "@/components/ui";
import type { Dashboard } from "@/server/metrics";

type TipProps = { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: string | number; money?: boolean };
export function ChartTip({ active, payload, label, money = true }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs shadow-soft">
      <p className="mb-1 font-medium">{label}</p>
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
        <p key={p.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}: <b className="num">{money ? ghs(p.value as number) : p.value}</b></p>
      ))}
    </div>
  );
}

export function useChartStyle() {
  const c = useThemeColors(); const reduced = useReducedMotion();
  return { c, anim: { isAnimationActive: !reduced, animationDuration: 900, animationEasing: "ease-out" as const }, tick: { fill: c.muted, fontSize: 10 }, grid: c.rgba("line", 0.5) };
}

export function TrendChart({ d }: { d: Dashboard }) {
  const { c, anim, tick, grid } = useChartStyle();
  const data = d.trend.map((t) => ({ ...t, name: MONTHS[t.month] }));
  const has = data.some((t) => (t.actual ?? 0) > 0) || d.monthlyTarget;
  if (!has) return <EmptyState title="No revenue trend yet" hint="Record income and set a revenue target to see actual versus target." action={<Link href="/finance?tab=transactions" className="text-xs text-accent hover:underline">Record income</Link>} />;
  return (
    <div className="h-[190px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: grid }} />
          <YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => ghsCompact(v)} width={48} />
          <Tooltip content={<ChartTip />} />
          <Legend verticalAlign="top" align="right" iconType="plainline" wrapperStyle={{ fontSize: 10, top: -6 }} />
          <Line name="Actual revenue" dataKey="actual" stroke={c.accent} strokeWidth={2.5} dot={{ r: 2.5, fill: c.accent }} connectNulls {...anim} />
          {d.monthlyTarget && <Line name="Target" dataKey="target" stroke={c.warn} strokeWidth={1.5} dot={false} {...anim} />}
          <Line name="Forecast (3-month average)" dataKey="forecast" stroke={c.fg} strokeWidth={1.5} strokeDasharray="2 4" dot={false} connectNulls {...anim} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CollectionsChart({ d }: { d: Dashboard }) {
  const { c, anim, tick, grid } = useChartStyle();
  const data = d.collections.map((m) => ({ ...m, name: MONTHS[m.month] }));
  if (!data.some((m) => m.invoiced || m.collected)) return <EmptyState title="No collections yet" hint="Invoices and income you record will chart here by month." action={<Link href="/finance?tab=invoices" className="text-xs text-accent hover:underline">Add an invoice</Link>} />;
  return (
    <div className="h-[200px]">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: grid }} interval="preserveStartEnd" />
          <YAxis yAxisId="l" tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => ghsCompact(v)} width={44} />
          <YAxis yAxisId="r" orientation="right" tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => ghsCompact(v)} width={44} />
          <Tooltip content={<ChartTip />} />
          <Legend verticalAlign="top" align="left" iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10, top: -6 }} />
          <Bar yAxisId="l" name="Invoiced" dataKey="invoiced" fill={c.rgba("accent", 0.7)} radius={[3, 3, 0, 0]} {...anim} />
          <Bar yAxisId="l" name="Cash collected" dataKey="collected" fill={c.cyan} radius={[3, 3, 0, 0]} {...anim} />
          <Line yAxisId="r" name="Net cash flow" dataKey="net" stroke={c.good} strokeWidth={2} dot={false} {...anim} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyRevExp({ d }: { d: Dashboard }) {
  const { c, anim, tick, grid } = useChartStyle();
  const data = d.performance.weekly.map((w) => ({ ...w, name: w.weekStart.slice(5) }));
  if (!data.some((w) => w.income || w.expense)) return <EmptyState title="No weekly figures yet" hint="Record income and expenses to compare them week by week." />;
  return (
    <div className="h-[170px]"><ResponsiveContainer>
      <BarChart data={data} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: grid }} /><YAxis tick={tick} tickLine={false} axisLine={false} tickFormatter={(v) => ghsCompact(v)} width={44} />
        <Tooltip content={<ChartTip />} /><Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        <Bar name="Revenue" dataKey="income" fill={c.accent} radius={[3, 3, 0, 0]} {...anim} /><Bar name="Expenses" dataKey="expense" fill={c.warn} radius={[3, 3, 0, 0]} {...anim} />
      </BarChart></ResponsiveContainer></div>
  );
}

export function ProductivityChart({ d }: { d: Dashboard }) {
  const { c, anim, tick, grid } = useChartStyle();
  const data = d.performance.productivity.map((w) => ({ ...w, name: w.weekStart.slice(5) }));
  if (!data.some((w) => w.tasks || w.shipped)) return <EmptyState title="No completed work yet" hint="Completed tasks and engineering achievements chart here weekly." />;
  return (
    <div className="h-[170px]"><ResponsiveContainer>
      <ComposedChart data={data} margin={{ top: 6, right: 0, left: -24, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="name" tick={tick} tickLine={false} axisLine={{ stroke: grid }} /><YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={36} />
        <Tooltip content={<ChartTip money={false} />} /><Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
        <Area name="Tasks completed" dataKey="tasks" fill={c.rgba("accent", 0.25)} stroke={c.accent} {...anim} /><Bar name="Features shipped" dataKey="shipped" fill={c.good} radius={[3, 3, 0, 0]} {...anim} />
      </ComposedChart></ResponsiveContainer></div>
  );
}
