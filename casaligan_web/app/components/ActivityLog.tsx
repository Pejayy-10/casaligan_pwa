"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as BarTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip as LineTooltip,
  Legend,
} from "recharts";
import { getActivityLogAnalytics } from "@/lib/supabase/activityLogQueries";

const ActivityLog: React.FC = () => {
  const [actionsData, setActionsData] = useState([
    { name: "Jobs Created", value: 0 },
    { name: "Bookings Made", value: 0 },
    { name: "Payments Completed", value: 0 },
    { name: "Messages sent", value: 0 },
    { name: "Reviews Submitted", value: 0 },
  ]);
  const [activityData, setActivityData] = useState<{ month: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    const { actionsData: actions, activityData: monthly, error } = await getActivityLogAnalytics();
    if (error) {
      console.error("Error loading analytics:", error);
    } else {
      setActionsData(actions);
      setActivityData(monthly);
    }
    setLoading(false);
  }
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
            <div className="text-center py-20 text-muted-foreground">Loading chart data...</div>
          </div>
          <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
            <div className="text-center py-20 text-muted-foreground">Loading chart data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actions by Type - Bar Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-6">
            Actions by Type
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={actionsData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis type="number" stroke="var(--color-foreground)" />
              <YAxis
                type="category"
                dataKey="name"
                stroke="var(--color-foreground)"
              />
              <BarTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                  border: "1px solid var(--color-border)",
                }}
              />
              <Bar
                dataKey="value"
                fill="var(--color-primary)"
                radius={[0, 6, 6, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity Overtime - Line Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-6">
            Activity overtime
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={activityData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <XAxis dataKey="month" stroke="var(--color-foreground)" />
              <YAxis stroke="var(--color-foreground)" />
              <LineTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                  border: "1px solid var(--color-border)",
                }}
              />
              <Legend wrapperStyle={{ color: "var(--color-foreground)" }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={3}
                dot={{ fill: "var(--color-primary)", r: 5 }}
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

export default ActivityLog;
