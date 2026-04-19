"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  category: string;
  revenue: number;
};

type RevenueBarChartCardProps = {
  data: ChartDatum[];
  rangeLabel?: string;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  onResetDates?: () => void;
};

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function TooltipContent({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) return null;
  const { category, revenue } = payload[0].payload as ChartDatum;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sm dark:bg-muted dark:border-border">
      <p className="text-sm font-semibold dark:text-white">{category}</p>
      <p className="text-xs text-muted-foreground dark:text-white mt-1">{currencyFormatter.format(revenue)}</p>
    </div>
  );
}

export function RevenueBarChartCard({
  data,
  rangeLabel,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onResetDates,
}: RevenueBarChartCardProps) {
  const totalRevenue = data.reduce((acc, item) => acc + item.revenue, 0);

  return (
    <section className="flex flex-col rounded-2xl border border-border bg-muted p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-m font-semibold text-muted-foreground dark:text-white">Revenue</p>
          <p className="text-3xl font-semibold text-emerald-600">
            {currencyFormatter.format(totalRevenue)}
          </p>
          <p className="text-xs text-muted-foreground dark:text-white mt-1">{rangeLabel || "Recent weeks"}</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground dark:text-white">Date Range</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => onStartDateChange?.(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground dark:bg-background dark:text-white"
            />
            <span className="text-xs text-muted-foreground dark:text-white">to</span>
            <input
              type="date"
              value={endDate || ""}
              onChange={(e) => onEndDateChange?.(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground dark:bg-background dark:text-white"
            />
            <button
              type="button"
              onClick={onResetDates}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground dark:text-white hover:bg-muted/40"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={28}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} />
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


