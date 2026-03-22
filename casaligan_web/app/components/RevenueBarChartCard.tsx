"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  week: string;
  revenue: number;
};

const chartData: ChartDatum[] = [
  { week: "W1", revenue: 32000 },
  { week: "W2", revenue: 61000 },
  { week: "W3", revenue: 28000 },
  { week: "W4", revenue: 45000 },
  { week: "W5", revenue: 72000 },
];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function TooltipContent({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) return null;
  const { week, revenue } = payload[0].payload as ChartDatum;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sm">
      <p className="text-sm font-semibold">{week}</p>
      <p className="text-xs text-muted-foreground mt-1">{currencyFormatter.format(revenue)}</p>
    </div>
  );
}

export function RevenueBarChartCard() {
  const totalRevenue = chartData.reduce((acc, item) => acc + item.revenue, 0);

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-muted p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-m font-semibold text-muted-foreground">Revenue</p>
          <p className="text-3xl font-semibold text-emerald-600">
            {currencyFormatter.format(totalRevenue)}
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
        >
          Weekly
        </button>
      </header>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barSize={28}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickFormatter={(value) => `${Math.round(value / 1000)}K`}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<TooltipContent />} cursor={{ fill: "rgba(34,197,94,0.12)" }} />
            <Bar
              dataKey="revenue"
              fill="#1fbf74"
              radius={[8, 8, 0, 0]}
              className="transition-transform hover:opacity-90"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}


