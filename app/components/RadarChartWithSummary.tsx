"use client";

import { TrendingUp } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  label: string;
  value: number;
};

type RadarChartWithSummaryProps = {
  data: ChartDatum[];
  summary: {
    topLabel: string;
    total: number;
  };
};

export const description = "A radar chart with circular grid lines and summary footer.";

function TooltipContent({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) {
    return null;
  }

  const { label, value } = payload[0].payload as ChartDatum;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-sm">
      <p className="text-sm font-small">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Count: <span className="font-semibold">{value}</span>
      </p>
    </div>
  );
}

export function RadarChartWithSummary({ data, summary }: RadarChartWithSummaryProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-muted p-6 text-card-foreground shadow-sm">
      <header className="space-y-1">
        <p className="text-m font-semibold text-muted-foreground">Job Status Mix</p>
        <p className="text-xs text-muted-foreground">Distribution across active job statuses</p>
      </header>

      <div className="mx-auto h-60 w-full max-w-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <Tooltip cursor={false} content={<TooltipContent />} />
            <PolarGrid gridType="circle" strokeDasharray="4 4" />
            <PolarAngleAxis dataKey="label" />
            <Radar
              dataKey="value"
              fill="hsl(var(--chart-1, 12 86% 62%))"
              stroke="hsl(var(--chart-1, 12 86% 62%))"
              fillOpacity={0.6}
              strokeWidth={2}
              dot={{ r: 4, fillOpacity: 1 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <footer className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-emerald-600">
          <TrendingUp className="h-4 w-4" />
          Total jobs: {summary.total}
        </div>
        <p className="font-medium text-foreground">Top status: {summary.topLabel}</p>
      </footer>
    </section>
  );
}


