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
  skill: string;
  score: number;
};

const chartData: ChartDatum[] = [
  { skill: "Cleaning", score: 86 },
  { skill: "Laundry", score: 78 },
  { skill: "Additional Duties", score: 68 },
  { skill: "Kitchen", score: 72 },
  { skill: "Organization", score: 81 },
];

export const description = "A radar chart with circular grid lines and summary footer.";

function TooltipContent({ active, payload }: TooltipProps<number, string> & { payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload?.length) {
    return null;
  }

  const { skill, score } = payload[0].payload as ChartDatum;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-sm">
      <p className="text-sm font-small">{skill}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Score: <span className="font-semibold">{score}</span>
      </p>
    </div>
  );
}

export function RadarChartWithSummary() {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-muted p-6 text-card-foreground shadow-sm">
      <header className="space-y-1">
        <p className="text-m font-semibold text-muted-foreground">Skills</p>
        <p className="text-xs text-muted-foreground">Assessment across core housekeeping skills</p>
      </header>

      <div className="mx-auto h-60 w-full max-w-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <Tooltip cursor={false} content={<TooltipContent />} />
            <PolarGrid gridType="circle" strokeDasharray="4 4" />
            <PolarAngleAxis dataKey="skill" />
            <Radar
              dataKey="score"
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
          +5.2% this month
        </div>
        <p className="font-medium text-foreground">Top Skill: Cleaning</p>
      </footer>
    </section>
  );
}


