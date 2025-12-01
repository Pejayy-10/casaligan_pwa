"use client";

import React, { useState } from "react";
import "@/app/theme.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  PieChart,
  Pie,
  Cell,
  PieLabelRenderProps,
  Tooltip as PieTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  Tooltip as BarTooltip,
} from "recharts";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  bgColorVar: string; 
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  bgColorVar,
}) => (
  <div className="flex flex-col items-center justify-center bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-4 w-full shadow-sm">
    <div
      className={`mb-2 flex items-center justify-center w-12 h-12 rounded-full text-white text-2xl ${bgColorVar}`}
    >
      {icon}
    </div>
    <h2 className="text-sm text-[var(--color-foreground)]/80">{title}</h2>
    <p className="text-2xl font-bold text-[var(--color-foreground)]/80">
      {value}
    </p>
  </div>
);

const skillData = [
  { name: "Cooking", value: 400 },
  { name: "Cleaning", value: 300 },
  { name: "Child Care", value: 200 },
  { name: "Pet Care", value: 150 },
];

const matchOutcomeData = [
  { month: "Jan", Successful: 80, Unsuccessful: 20 },
  { month: "Feb", Successful: 60, Unsuccessful: 30 },
  { month: "Mar", Successful: 100, Unsuccessful: 50 },
  { month: "Apr", Successful: 70, Unsuccessful: 40 },
  { month: "May", Successful: 90, Unsuccessful: 30 },
  { month: "Jun", Successful: 85, Unsuccessful: 45 },
];

const MatchingAnalytics: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <div className="space-y-6 relative">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Searches"
          value="12,540"
          icon={<span className="material-icons">search</span>}
          bgColorVar="bg-[var(--color-primary)]"
        />
        <MetricCard
          title="Matches Made"
          value="3,210"
          icon={<span className="material-icons">handshake</span>}
          bgColorVar="bg-[var(--color-secondary)]"
        />
        <MetricCard
          title="Conversion Rate"
          value="85.6%"
          icon={<span className="material-icons">trending_up</span>}
          bgColorVar="bg-[var(--color-accent)]"
        />
        <MetricCard
          title="Avg. Time to Match"
          value="1 minute"
          icon={<span className="material-icons">timer</span>}
          bgColorVar="bg-[var(--color-tertiary)]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80 mb-4">
            Most Searched Skills
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={skillData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                labelLine={false}
                label={(props: PieLabelRenderProps) => {
                  const {
                    name,
                    value,
                    cx,
                    cy,
                    midAngle,
                    outerRadius,
                    index,
                  } = props;
                  const RADIAN = Math.PI / 180;
                  const radius = outerRadius! * 1.35;
                  const x = cx! + radius * Math.cos(-midAngle! * RADIAN);
                  const y = cy! + radius * Math.sin(-midAngle! * RADIAN);

                  const colorVars = [
                    "var(--color-primary)",
                    "var(--color-secondary)",
                    "var(--color-accent)",
                    "var(--color-tertiary)",
                  ];

                  return (
                    <text
                      x={x}
                      y={y}
                      fill={colorVars[index! % colorVars.length]}
                      textAnchor={x > cx! ? "start" : "end"}
                      dominantBaseline="central"
                      fontSize={13}
                      fontWeight={600}
                    >
                      {`${name}: ${value}`}
                    </text>
                  );
                }}
              >
                <Cell fill="var(--color-primary)" />
                <Cell fill="var(--color-secondary)" />
                <Cell fill="var(--color-accent)" />
                <Cell fill="var(--color-tertiary)" />
              </Pie>
              <PieTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-4 shadow-sm relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-foreground)]/80">
              Match Outcome Over Time
            </h2>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]/80 rounded-md p-2 text-sm"
            >
              {startDate && endDate
                ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                : "Select Date"}
            </button>
          </div>

          {showDatePicker && (
            <div className="absolute z-50 mt-2">
              <DatePicker
                selected={startDate}
                onChange={(dates: Date | [Date | null, Date | null]) => {
                  if (Array.isArray(dates)) {
                    const [start, end] = dates;
                    setStartDate(start || null);
                    setEndDate(end || null);
                  } else {
                    setStartDate(dates);
                    setEndDate(dates);
                  }
                }}
                startDate={startDate}
                endDate={endDate}
                selectsRange
                inline
                onClickOutside={() => setShowDatePicker(false)}
              />
            </div>
          )}

          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={matchOutcomeData}
              margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
            >
              <XAxis dataKey="month" stroke="var(--color-foreground)" />
              <YAxis stroke="var(--color-foreground)" />
              <BarTooltip
                contentStyle={{
                  backgroundColor: "var(--color-muted)",
                  color: "var(--color-foreground)",
                }}
              />
              <Legend wrapperStyle={{ color: "var(--color-foreground)" }} />
              <Bar
                dataKey="Successful"
                fill="var(--color-primary)"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="Unsuccessful"
                fill="var(--color-secondary)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default MatchingAnalytics;
