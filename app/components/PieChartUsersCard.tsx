"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  label: string;
  value: number;
  color: string;
};

const chartData: ChartDatum[] = [
  { label: "Workers", value: 75, color: "#e7467b" },
  { label: "Employers", value: 25, color: "#173d6c" },
];

function TooltipContent({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) {
    return null;
  }

  const { label, value } = payload[0].payload as ChartDatum;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sm">
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{value}% of users</p>
    </div>
  );
}

export function PieChartUsersCard() {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-muted p-5 text-card-foreground shadow-sm">
      <header className="mb-4">
        <p className="text-m font-semibold text-muted-foreground">Users</p>
      </header>
      <div className="mx-auto h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<TooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <footer className="mt-auto grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden
            />
            <p className="font-medium">{item.label}</p>
            <span className="text-muted-foreground">{item.value}%</span>
          </div>
        ))}
      </footer>
    </section>
  );
}


