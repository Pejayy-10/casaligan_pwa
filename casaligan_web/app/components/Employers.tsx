"use client";

import React, { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as PieTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as BarTooltip,
  Legend,
  LineChart,
  Line,
  Tooltip as LineTooltip,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getEmployerAnalytics, getEmployerActivityStats } from "@/lib/supabase/employerQueries";

const Employers: React.FC = () => {
  // State for analytics data
  const [activityData, setActivityData] = useState<any[]>([]);
  const [restrictedData, setRestrictedData] = useState<any[]>([]);
  const [topEmployers, setTopEmployers] = useState<any[]>([]);
  const [newAccountsData, setNewAccountsData] = useState<any[]>([]);
  const [employersActivityData, setEmployersActivityData] = useState<any[]>([]);

  const [activityStartDate, setActivityStartDate] = useState<Date | null>(null);
  const [activityEndDate, setActivityEndDate] = useState<Date | null>(null);
  const [showActivityDatePicker, setShowActivityDatePicker] = useState(false);
  
  const [accountsStartDate, setAccountsStartDate] = useState<Date | null>(null);
  const [accountsEndDate, setAccountsEndDate] = useState<Date | null>(null);
  const [showAccountsDatePicker, setShowAccountsDatePicker] = useState(false);

  // Fetch analytics data on component mount and when dates change
  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const analytics = await getEmployerAnalytics(accountsStartDate || undefined, accountsEndDate || undefined);
        const activityStats = await getEmployerActivityStats(activityStartDate || undefined, activityEndDate || undefined);
        
        setActivityData(analytics.activityData);
        setRestrictedData(analytics.restrictedData);
        setTopEmployers(analytics.topEmployers);
        setNewAccountsData(analytics.newAccountsData);
        setEmployersActivityData(activityStats);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      }
    }
    
    fetchAnalytics();
  }, [activityStartDate, activityEndDate, accountsStartDate, accountsEndDate]);

  const COLORS = {
    active: "var(--color-secondary)",
    inactive: "var(--color-primary)",
    restricted: "var(--color-accent)",
    banned: "var(--color-danger)",
    thisMonth: "var(--color-primary)",
    lastMonth: "var(--color-secondary)",
  };

  return (
    <div className="space-y-6">
      {/* Top Row - 3 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Pie Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            Activity
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={activityData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                animationDuration={1000}
              >
                <Cell fill={COLORS.active} />
                <Cell fill={COLORS.inactive} />
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
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.active }}
              />
              <span className="text-sm text-[var(--color-foreground)]/70">
                Active
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.inactive }}
              />
              <span className="text-sm text-[var(--color-foreground)]/70">
                Inactive
              </span>
            </div>
          </div>
        </div>

        {/* Restricted/Banned Pie Chart */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            Restricted/Banned
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={restrictedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                animationDuration={1000}
              >
                <Cell fill={COLORS.restricted} />
                <Cell fill={COLORS.banned} />
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
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.restricted }}
              />
              <span className="text-sm text-[var(--color-foreground)]/70">
                Restricted
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS.banned }}
              />
              <span className="text-sm text-[var(--color-foreground)]/70">
                Banned
              </span>
            </div>
          </div>
        </div>

        {/* Top Employers */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            Top Employers
          </h2>
          <div className="space-y-4">
            {topEmployers.map((employer, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-[var(--color-background)] rounded-lg"
              >
                <span className="material-icons text-4xl text-[var(--color-accent)]">
                  stars
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-border)] flex items-center justify-center">
                      <span className="material-icons text-sm">person</span>
                    </div>
                    <span className="font-medium text-[var(--color-foreground)]/80">
                      {employer.name}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-foreground)]/60 mt-1">
                    {employer.jobs}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row - 2 Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employers Activity */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80">
              Employers Activity
            </h2>
            <button
              onClick={() => setShowActivityDatePicker(!showActivityDatePicker)}
              className="border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]/80 rounded-md px-3 py-2 text-sm hover:bg-[var(--color-border)] transition-colors"
            >
              {activityStartDate && activityEndDate
                ? `${activityStartDate.toLocaleDateString()} - ${activityEndDate.toLocaleDateString()}`
                : "Select Date"}
            </button>
          </div>
          {showActivityDatePicker && (
            <div className="absolute z-50 right-6 top-16">
              <DatePicker
                selected={activityStartDate}
                onChange={(dates: Date | [Date | null, Date | null]) => {
                  if (Array.isArray(dates)) {
                    const [start, end] = dates;
                    setActivityStartDate(start || null);
                    setActivityEndDate(end || null);
                  } else {
                    setActivityStartDate(dates);
                    setActivityEndDate(dates);
                  }
                }}
                startDate={activityStartDate}
                endDate={activityEndDate}
                selectsRange
                inline
                onClickOutside={() => setShowActivityDatePicker(false)}
              />
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={employersActivityData}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <XAxis
                dataKey="activity"
                stroke="var(--color-foreground)"
                tick={{ fontSize: 12 }}
              />
              <YAxis stroke="var(--color-foreground)" />
              <BarTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                  border: "1px solid var(--color-border)",
                }}
              />
              <Legend wrapperStyle={{ color: "var(--color-foreground)" }} />
              <Bar
                dataKey="thisMonth"
                name="This Month"
                fill={COLORS.thisMonth}
                radius={[6, 6, 0, 0]}
                animationDuration={1000}
              />
              <Bar
                dataKey="lastMonth"
                name="Last Month"
                fill={COLORS.lastMonth}
                radius={[6, 6, 0, 0]}
                animationDuration={1000}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* New Accounts in last 4 months */}
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 shadow-sm relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80">
              New Accounts in last 4 months:
            </h2>
            <button
              onClick={() => setShowAccountsDatePicker(!showAccountsDatePicker)}
              className="border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]/80 rounded-md px-3 py-2 text-sm hover:bg-[var(--color-border)] transition-colors"
            >
              {accountsStartDate && accountsEndDate
                ? `${accountsStartDate.toLocaleDateString()} - ${accountsEndDate.toLocaleDateString()}`
                : "Select Date"}
            </button>
          </div>
          {showAccountsDatePicker && (
            <div className="absolute z-50 right-6 top-16">
              <DatePicker
                selected={accountsStartDate}
                onChange={(dates: Date | [Date | null, Date | null]) => {
                  if (Array.isArray(dates)) {
                    const [start, end] = dates;
                    setAccountsStartDate(start || null);
                    setAccountsEndDate(end || null);
                  } else {
                    setAccountsStartDate(dates);
                    setAccountsEndDate(dates);
                  }
                }}
                startDate={accountsStartDate}
                endDate={accountsEndDate}
                selectsRange
                inline
                onClickOutside={() => setShowAccountsDatePicker(false)}
              />
            </div>
          )}
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={newAccountsData}
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
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS.lastMonth}
                strokeWidth={3}
                dot={{ fill: COLORS.lastMonth, r: 5 }}
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

export default Employers;
