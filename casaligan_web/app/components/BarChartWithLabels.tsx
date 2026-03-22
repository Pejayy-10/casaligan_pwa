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
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  month: string;
  desktop: number;
  mobile: number;
};

const chartData: ChartDatum[] = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 73, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

export const description = "A vertical bar chart with inline labels.";

const barColor = "hsl(var(--chart-2, 215 95% 62%))";
const labelFill = "hsl(var(--foreground))";

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const datum = payload[0];

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-sm">
      <p className="text-sm font-medium">{datum.payload.month}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Desktop visitors: <span className="font-semibold">{datum.value}</span>
      </p>
    </div>
  );
}

export function BarChartWithLabels() {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-muted text-card-foreground shadow-sm">
      <header className="gap-1 border-b border-border p-6">
        <h2 className="text-lg font-semibold">Bar Chart - Custom Label</h2>
        <p className="text-sm text-muted-foreground">January - June 2024</p>
      </header>

      <div className="px-4 py-6 sm:px-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ right: 24, left: 12 }}
              barSize={32}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <YAxis
                dataKey="month"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={0}
                hide
              />
              <XAxis dataKey="desktop" type="number" hide />
              <Tooltip cursor={{ fill: "transparent" }} content={<CustomTooltip />} />
              <Bar dataKey="desktop" fill={barColor} radius={[6, 6, 6, 6]}>
                <LabelList
                  dataKey="month"
                  position="insideLeft"
                  offset={8}
                  style={{ fill: "hsl(var(--background))" }}
                  fontSize={12}
                />
                <LabelList
                  dataKey="desktop"
                  position="right"
                  offset={12}
                  style={{ fill: labelFill }}
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


