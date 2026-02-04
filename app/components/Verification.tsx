"use client";

import React, { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as LineTooltip,
} from "recharts";
import { getVerificationAnalytics, getUserCounts } from "@/lib/supabase/verficationQueries";

const Verification: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [userCounts, setUserCounts] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    const [analyticsData, countsData] = await Promise.all([
      getVerificationAnalytics(),
      getUserCounts()
    ]);
    setAnalytics(analyticsData);
    setUserCounts(countsData);
    setLoading(false);
  }

  // Users data from database
  const usersData = userCounts ? [
    { name: "Workers", value: userCounts.workers || 0 },
    { name: "Employers", value: userCounts.employers || 0 },
  ] : [
    { name: "Workers", value: 0 },
    { name: "Employers", value: 0 },
  ];

  const verificationStatusData = analytics?.statusData || [
    { name: "Rejected", value: 0 },
    { name: "Accepted", value: 0 },
    { name: "Pending", value: 0 },
  ];

  const verificationRequestsData = analytics?.monthlyData || [
    { month: "No data", value: 0 },
  ];
  const COLORS = {
    workers: "var(--color-secondary)",
    employers: "var(--color-primary)",
    rejected: "var(--color-primary)",
    accepted: "var(--color-accent)",
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">Loading verification analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Row - 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users Pie Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            Users
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={usersData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                animationDuration={1000}
              >
                {usersData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === "Workers" ? COLORS.workers : COLORS.employers}
                  />
                ))}
              </Pie>
              <PieTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            {usersData.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: entry.name === "Workers" ? COLORS.workers : COLORS.employers
                  }}
                />
                <span className="text-sm text-[var(--color-foreground)]/70">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Verification Status Pie Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            Verification Status
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={verificationStatusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                animationDuration={1000}
              >
                {verificationStatusData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={
                      entry.name === "Accepted" ? COLORS.accepted :
                      entry.name === "Rejected" ? COLORS.rejected :
                      "var(--color-tertiary)"
                    } 
                  />
                ))}
              </Pie>
              <PieTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                  border: "1px solid var(--color-border)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4 flex-wrap">
            {verificationStatusData.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ 
                    backgroundColor: 
                      entry.name === "Accepted" ? COLORS.accepted :
                      entry.name === "Rejected" ? COLORS.rejected :
                      "var(--color-tertiary)"
                  }}
                />
                <span className="text-sm text-[var(--color-foreground)]/70">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* New Verification Requests Line Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            New Verification Requests in last 4 months:
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={verificationRequestsData}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <XAxis
                dataKey="month"
                stroke="var(--color-foreground)"
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="var(--color-foreground)" tick={{ fontSize: 12 }} />
              <LineTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                  border: "1px solid var(--color-border)",
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS.workers}
                strokeWidth={3}
                dot={{ fill: COLORS.workers, r: 5 }}
                activeDot={{ r: 7 }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Verification;
