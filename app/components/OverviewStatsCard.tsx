"use client";

import { BriefcaseBusiness, CalendarCheck, Users2 } from "lucide-react";

type StatItem = {
  key: "users" | "jobs" | "bookings";
  label: string;
  value: number;
  changeLabel?: string;
};

const defaultStats: StatItem[] = [
  { key: "users", label: "Total Users", value: 1280, changeLabel: "+8.3% vs last month" },
  { key: "jobs", label: "Total Jobs", value: 342, changeLabel: "+4.1% vs last month" },
  { key: "bookings", label: "Total Bookings", value: 198, changeLabel: "+12.5% vs last month" },
];

const iconMap: Record<StatItem["key"], JSX.Element> = {
  users: <Users2 className="h-5 w-5 text-primary" />,
  jobs: <BriefcaseBusiness className="h-5 w-5 text-primary" />,
  bookings: <CalendarCheck className="h-5 w-5 text-primary" />,
};

type OverviewStatsCardProps = {
  stats?: StatItem[];
  title?: string;
  subtitle?: string;
};

export function OverviewStatsCard({
  stats = defaultStats,
  title = "Platform Overview",
  subtitle = "Key totals across the marketplace",
}: OverviewStatsCardProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-border bg-muted text-card-foreground shadow-sm">
      <header className="border-b border-border p-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Summary</p>
        <h2 className="mt-2 text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <div className="grid gap-4 p-6 sm:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.key}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border/80 bg-muted/40 p-4 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                {iconMap[stat.key]}
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-semibold">{stat.value.toLocaleString()}</p>
              </div>
            </div>
            {stat.changeLabel ? (
              <p className="text-xs text-muted-foreground">{stat.changeLabel}</p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}


