"use client";

import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  month: string;
  desktop: number;
};

const chartData: ChartDatum[] = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
];

export const description = "A horizontal bar chart with top labels.";

const barColor = "hsl(var(--chart-1, 12 86% 62%))";

function TooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const { month, desktop } = payload[0].payload as ChartDatum;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-sm">
      <p className="text-sm font-medium">{month}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Desktop visitors: <span className="font-semibold">{desktop}</span>
      </p>
    </div>
  );
}

export function BarChartWithTopLabels() {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-muted text-card-foreground shadow-sm">
      <header className="gap-1 border-b border-border p-6">
        <h2 className="text-lg font-semibold">Bar Chart - Label</h2>
        <p className="text-sm text-muted-foreground">January - June 2024</p>
      </header>

      <div className="px-4 py-6 sm:px-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 24, left: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value.slice(0, 3)}
              />
              <Tooltip cursor={{ fill: "transparent" }} content={<TooltipContent />} />
              <Bar dataKey="desktop" fill={barColor} radius={[8, 8, 0, 0]}>
                <LabelList
                  position="top"
                  offset={12}
                  style={{ fill: "hsl(var(--foreground))" }}
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-border p-6 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <p className="text-muted-foreground leading-none">
          Showing total visitors for the last 6 months
        </p>
      </footer>
    </section>
  );
}


