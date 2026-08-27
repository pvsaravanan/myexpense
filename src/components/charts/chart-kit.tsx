"use client";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  PolarAngleAxis, RadialBar, RadialBarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useTheme } from "@/components/theme-provider";
import { formatINR, formatINRCompact } from "@/lib/money";

/** Resolve themed colors from CSS variables at runtime (client only). */
export function useChartColors() {
  const { resolved } = useTheme();
  const [colors, setColors] = useState({
    brand: "#d88060", income: "#2c6b4f", expense: "#b84b3a",
    grid: "#e5e7eb", axis: "#5f5f5f", surface: "#f4f1ea", border: "#1a1a1a", fg: "#1a1a1a",
  });
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (name: string) => {
      const raw = cs.getPropertyValue(name).trim();
      return raw ? `hsl(${raw})` : "";
    };
    setColors({
      brand: v("--brand") || "#d88060",
      income: v("--income") || "#2c6b4f",
      expense: v("--expense") || "#b84b3a",
      // Gridlines must use the FAINT rule, not the ink card border.
      grid: v("--border-faint") || "#e5e7eb",
      axis: v("--muted") || "#5f5f5f",
      surface: v("--surface") || "#f4f1ea",
      border: v("--border") || "#1a1a1a",
      fg: v("--fg") || "#1a1a1a",
    });
  }, [resolved]);
  return colors;
}

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
}

function TooltipBox({
  active, payload, label, colors,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  colors: ReturnType<typeof useChartColors>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-none border px-3 py-2 text-xs"
      style={{ background: colors.surface, borderColor: colors.border, color: colors.fg }}
    >
      {label && <p className="mb-1 text-label-sm uppercase">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 tabular-nums">
          <span className="h-2 w-2" style={{ background: p.color }} />
          <span className="text-muted">{String(p.name ?? "")}</span>
          <span className="ml-auto font-semibold">{formatINR(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

const AXIS_TICK = { fontSize: 11 };

/** Grouped income-vs-expense (or any multi-series) bar chart. */
export function IncomeExpenseBars({
  data, height = 260,
}: {
  data: { label: string; income: number; expense: number }[];
  height?: number;
}) {
  const colors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={60} />
        <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Bar dataKey="income" name="Income" fill={colors.income} radius={0} maxBarSize={40} />
        <Bar dataKey="expense" name="Expenses" fill={colors.expense} radius={0} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Single-series bar chart (e.g. daily spending). */
export function SpendBars({
  data, height = 220, color,
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const colors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={60} />
        <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Bar dataKey="value" name="Spent" fill={color ?? colors.fg} radius={0} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Area trend chart (spending / balance over time). */
export function TrendArea({
  data, height = 240, color, name = "Spending",
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  name?: string;
}) {
  const colors = useChartColors();
  const stroke = color ?? colors.brand;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={60} />
        <Tooltip content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Area type="monotone" dataKey="value" name={name} stroke={stroke} strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Net savings per month (income − expenses) as diverging bars around a zero
 * baseline: green when positive (saved), red when negative (overspent).
 */
export function NetSavingsBars({
  data, height = 260,
}: {
  data: { label: string; net: number }[];
  height?: number;
}) {
  const colors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={12} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={60} />
        <ReferenceLine y={0} stroke={colors.border} strokeWidth={1} />
        <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Bar dataKey="net" name="Net savings" radius={0} maxBarSize={40}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.net >= 0 ? colors.income : colors.expense} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Change in net spend per category vs last month, as horizontal diverging bars:
 * bars extend right + red when spend rose, left + green when it fell.
 */
export function CategoryChangeBars({
  data, height = 300,
}: {
  data: { name: string; delta: number }[];
  height?: number;
}) {
  const colors = useChartColors();
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart layout="vertical" data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis type="number" tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={96} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} />
        <ReferenceLine x={0} stroke={colors.border} strokeWidth={1} />
        <Tooltip cursor={{ fill: colors.grid, opacity: 0.4 }} content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Bar dataKey="delta" name="Change" radius={0} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.delta >= 0 ? colors.expense : colors.income} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Cumulative spend through the month vs an even "ideal pace" line and (when set)
 * a budget ceiling — shows whether spending is ahead of plan.
 */
export function SpendingPaceLine({
  data, budget, height = 260,
}: {
  data: { label: string; cumulative: number; ideal: number | null }[];
  budget: number | null;
  height?: number;
}) {
  const colors = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={60} />
        {budget ? <ReferenceLine y={budget} stroke={colors.expense} strokeDasharray="4 4" strokeWidth={1.5} /> : null}
        <Tooltip content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
        {data.some((d) => d.ideal !== null) && (
          <Line type="monotone" dataKey="ideal" name="Even pace" stroke={colors.axis} strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
        )}
        <Line type="monotone" dataKey="cumulative" name="Spent so far" stroke={colors.brand} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Shared semicircular-gauge rendering — see SavingsGauge/BudgetGauge below. */
function GaugeBase({
  value, height, color, gridColor, valueLabel, subtitle,
}: {
  value: number;
  height: number;
  color: string;
  gridColor: string;
  valueLabel: string;
  subtitle: string;
}) {
  const data = [{ name: "value", value: Math.max(0, Math.min(value, 100)), fill: color }];
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart innerRadius="68%" outerRadius="100%" data={data} startAngle={180} endAngle={0} barSize={18}>
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background={{ fill: gridColor }} dataKey="value" cornerRadius={0} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-col items-center">
        <span className="tnum text-headline-md tracking-tight" style={{ color }}>
          {valueLabel}
        </span>
        <span className="text-label-sm uppercase text-muted">{subtitle}</span>
      </div>
    </div>
  );
}

/** Semicircular gauge for a percentage (e.g. savings rate). */
export function SavingsGauge({ value, height = 168 }: { value: number; height?: number }) {
  const colors = useChartColors();
  const color = value >= 20 ? colors.income : value >= 0 ? colors.brand : colors.expense;
  return (
    <GaugeBase value={value} height={height} color={color} gridColor={colors.grid} valueLabel={`${value.toFixed(0)}%`} subtitle="of income saved" />
  );
}

/** Semicircular gauge for budget utilization (e.g. a category's monthly budget). */
export function BudgetGauge({ value, height = 168 }: { value: number; height?: number }) {
  const colors = useChartColors();
  const color = value > 100 ? colors.expense : value >= 90 ? colors.brand : colors.income;
  return (
    <GaugeBase value={value} height={height} color={color} gridColor={colors.grid} valueLabel={`${value.toFixed(0)}%`} subtitle="of budget used" />
  );
}

/** Donut chart for category breakdown. Each slice carries its own color. */
export function CategoryDonut({
  data, height = 260,
}: {
  data: { name: string; value: number; color: string }[];
  height?: number;
}) {
  const colors = useChartColors();
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="58%" outerRadius="82%" paddingAngle={1} stroke={colors.border} strokeWidth={1}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
