"use client";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
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
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={56} />
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
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={56} />
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
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} minTickGap={20} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ ...AXIS_TICK, fill: colors.axis }} axisLine={false} tickLine={false} width={56} />
        <Tooltip content={(props: unknown) => <TooltipBox {...(props as Record<string, never>)} colors={colors} />} />
        <Area type="monotone" dataKey="value" name={name} stroke={stroke} strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
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
