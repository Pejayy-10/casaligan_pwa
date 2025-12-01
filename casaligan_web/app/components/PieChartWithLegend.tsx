"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  browser: string;
  visitors: number;
  color: string;
};

const chartData: ChartDatum[] = [
  { browser: "Chrome", visitors: 275, color: "hsl(var(--chart-1, 12 86% 62%))" },
  { browser: "Safari", visitors: 200, color: "hsl(var(--chart-2, 197 83% 64%))" },
  { browser: "Firefox", visitors: 187, color: "hsl(var(--chart-3, 43 96% 56%))" },
  { browser: "Edge", visitors: 173, color: "hsl(var(--chart-4, 261 80% 62%))" },
  { browser: "Other", visitors: 90, color: "hsl(var(--chart-5, 164 95% 43%))" },
];

export const description = "A pie chart with a responsive legend.";

function TooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) {
    return null;
  }

  const { browser, visitors } = payload[0].payload as ChartDatum;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-sm">
      <p className="text-sm font-semibold">{browser}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Visitors: <span className="font-semibold">{visitors}</span>
      </p>
    </div>
  );
}

export function PieChartWithLegend() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-muted p-6 text-card-foreground shadow-sm">
      <header className="text-center">
        <h2 className="text-lg font-semibold">Browser Breakdown</h2>
        <p className="text-sm text-muted-foreground">January - June 2024</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="mx-auto h-64 w-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="visitors"
                nameKey="browser"
                innerRadius="50%"
                outerRadius="80%"
                paddingAngle={2}
                cornerRadius={6}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.browser} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<TooltipContent />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {chartData.map((item) => (
            <li
              key={item.browser}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden
                />
                <span className="font-medium">{item.browser}</span>
              </div>
              <span className="font-semibold text-foreground">{item.visitors}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}


