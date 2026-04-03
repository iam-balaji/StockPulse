"use client";

import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart
} from "recharts";
import { CandlePoint } from "@/types/stock";

type Props = {
  candles: CandlePoint[];
};

export default function StockChart({ candles }: Props) {
  if (!candles.length) {
    return <p className="text-sm text-slate-500">No chart data available.</p>;
  }

  const data = candles.map((c) => ({
    ...c,
    dateLabel: c.date.slice(5)
  }));

  return (
    <div className="h-72 w-full rounded-lg border border-slate-200/80 bg-slate-50/50 p-2 dark:border-slate-700 dark:bg-slate-900/40">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spLineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="spAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 6"
            stroke="currentColor"
            className="text-slate-300 dark:text-slate-600"
            vertical={false}
          />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
            tickLine={false}
            axisLine={{ stroke: "currentColor", className: "text-slate-300 dark:text-slate-600" }}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 11, fill: "currentColor" }}
            className="text-slate-500"
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(148, 163, 184, 0.35)",
              borderRadius: "8px",
              fontSize: "12px"
            }}
            labelStyle={{ color: "#e2e8f0", marginBottom: 4 }}
            formatter={(value: number | string) => [
              typeof value === "number" ? value.toFixed(2) : value,
              "Close"
            ]}
            labelFormatter={(_label, payload) => {
              const row = payload?.[0]?.payload as (CandlePoint & { dateLabel?: string }) | undefined;
              return row?.date ?? "";
            }}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="none"
            fill="url(#spAreaGradient)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke="url(#spLineGradient)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "#fff", fill: "#6366f1" }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
