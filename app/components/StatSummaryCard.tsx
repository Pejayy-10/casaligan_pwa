"use client";

import type { ReactNode } from "react";

type StatTrend = {
  value: string;
  isPositive?: boolean;
  label?: string;
};

type StatSummaryCardProps = {
  title: string;
  value: number | string;
  icon?: ReactNode;
  iconColor?: string;
  trend?: StatTrend;
  className?: string;
};

const positiveColor = "text-emerald-500";
const negativeColor = "text-red-500";

const formatNumber = (value: number | string) => {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  return value;
};

export function StatSummaryCard({
  title,
  value,
  icon,
  iconColor,
  trend,
  className = "",
}: StatSummaryCardProps) {
  const trendColor = trend?.isPositive ?? true ? positiveColor : negativeColor;

  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border border-border bg-muted px-5 py-4 text-card-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      <header className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          {title}
        </p>
        {icon ? (
          <span
            className="grid h-10 w-10 place-items-center rounded-full bg-muted"
            style={iconColor ? { color: iconColor } : undefined}
          >
            {icon}
          </span>
        ) : null}
      </header>

      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-semibold leading-none text-foreground">{formatNumber(value)}</p>
      </div>

      {trend ? (
        <p className="flex items-center gap-2 text-xs">
          <span className={`${trendColor} font-semibold`}>
            {trend.isPositive ? "↑" : "↓"} {trend.value}
          </span>
          {trend.label ? <span className="text-muted-foreground">{trend.label}</span> : null}
        </p>
      ) : null}
    </article>
  );
}


