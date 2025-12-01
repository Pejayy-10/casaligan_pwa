"use client";

import React, { useEffect, useState } from "react";
import "@/app/theme.css";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { getReportAnalytics } from "@/lib/supabase/reportsqueriesSimplified";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: string;
  bgColorVar: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, bgColorVar }) => (
  <div className="flex flex-col items-center justify-center bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm w-full h-36">
    <div
      className={`mb-3 flex items-center justify-center w-14 h-14 rounded-full text-white text-3xl ${bgColorVar}`}
    >
      <span className="material-icons">{icon}</span>
    </div>
    <h3 className="text-base text-[var(--color-foreground)]/80">{title}</h3>
    <p className="text-2xl font-bold text-[var(--color-foreground)]/80">{value}</p>
  </div>
);

const COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-tertiary)",
  "var(--color-danger)",
];

const Reports: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    const data = await getReportAnalytics();
    setAnalytics(data);
    setLoading(false);
  }

  // Use real data from database, fallback to defaults if loading or no data
  const totalReports = analytics?.totalReports || 0;
  const pending = analytics?.pending || 0;
  const resolved = analytics?.resolved || 0;
  const dismissed = analytics?.dismissed || 0;
  const reportDistributionData = analytics?.distributionData && analytics.distributionData.length > 0
    ? analytics.distributionData
    : [
        { name: "Offensive Reviews", value: 120 },
        { name: "Abusive Messages", value: 80 },
        { name: "Fake Documents", value: 50 },
        { name: "Threats", value: 30 },
        { name: "Others", value: 20 },
      ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full items-center justify-center">
      <div className="grid grid-cols-2 gap-6 w-full lg:w-1/2 max-w-lg">
        <MetricCard
          title="Total Reports"
          value={totalReports}
          icon="description"
          bgColorVar="bg-[var(--color-primary)]"
        />
        <MetricCard
          title="Pending"
          value={pending}
          icon="hourglass_top"
          bgColorVar="bg-[var(--color-secondary)]"
        />
        <MetricCard
          title="Resolved"
          value={resolved}
          icon="check_circle"
          bgColorVar="bg-[var(--color-accent)]"
        />
        <MetricCard
          title="Dismissed"
          value={dismissed}
          icon="cancel"
          bgColorVar="bg-[var(--color-muted-foreground)]"
        />
      </div>

      <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-4 w-full lg:w-1/2 h-80 shadow-sm flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
          Report Distribution
        </h3>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={reportDistributionData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              labelLine={false}
            >
              {reportDistributionData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-muted)",
                color: "var(--color-foreground)",
              }}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              wrapperStyle={{
                color: "var(--color-foreground)",
                fontSize: "0.85rem",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Reports;
