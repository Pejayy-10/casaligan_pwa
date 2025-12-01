"use client";

import React, { useState } from "react";
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
  Legend,
  Tooltip as LineTooltip,
} from "recharts";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const messageByUserType = [
  { name: "Workers", value: 420 },
  { name: "Employers", value: 280 },
];

const messageVolumeData = [
  { time: "Jan", volume: 50 },
  { time: "Feb", volume: 75 },
  { time: "Mar", volume: 100 },
  { time: "Apr", volume: 80 },
  { time: "May", volume: 120 },
];

const Messages: React.FC = () => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--color-primary)] mb-4">
            Message Distribution by User Type
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={messageByUserType as any[]}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label={(entry: any) => `${entry.name}: ${entry.value}`}
              >
                {messageByUserType.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={`var(--color-${index === 0 ? "primary" : "secondary"})`}
                  />
                ))}
              </Pie>
              <PieTooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-4 shadow-sm relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-primary)]">
              Message Volume Over Time
            </h2>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] rounded-md p-2 text-sm"
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
            <LineChart data={messageVolumeData}>
              <XAxis dataKey="time" />
              <YAxis />
              <LineTooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="volume"
                stroke="var(--color-primary)"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Messages;
