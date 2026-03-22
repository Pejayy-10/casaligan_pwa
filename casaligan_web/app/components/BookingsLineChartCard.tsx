"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TooltipProps } from "recharts";

type ChartDatum = {
  week: string;
  bookings: number;
};

const chartData: ChartDatum[] = [
  { week: "W1", bookings: 52 },
  { week: "W2", bookings: 81 },
  { week: "W3", bookings: 65 },
  { week: "W4", bookings: 54 },
  { week: "W5", bookings: 83 },
];

function TooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const { week, bookings } = payload[0].payload as ChartDatum;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-sm">
      <p className="text-sm font-semibold">Week {week.replace("W", "")}</p>
      <p className="text-xs text-muted-foreground mt-1">{bookings} bookings</p>
    </div>
  );
}

export function BookingsLineChartCard() {
  return (
    <section className="flex flex-col rounded-2xl border border-border bg-muted p-5 text-card-foreground shadow-sm">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Bookings</p>
          <p className="text-xs text-muted-foreground">September, 2025</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
        >
          Weekly
        </button>
      </header>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--muted-foreground)/0.1)" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<TooltipContent />} />
            <Line
              type="monotone"
              dataKey="bookings"
              stroke="#1f6ae7"
              strokeWidth={3}
              dot={{ r: 4, fill: "#1f6ae7" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}


