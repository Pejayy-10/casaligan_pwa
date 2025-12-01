"use client";

import React from "react";

type Filters = {
  startDate?: string;
  endDate?: string;
  status?: string;
};

type StatusOption = {
  value: string;
  label: string;
};

type Props = {
  initial?: Filters;
  onChange?: (filters: Filters) => void;
  className?: string;
  statusOptions?: StatusOption[];
};

export default function FilterBar({ 
  initial = {}, 
  onChange, 
  className = "",
  statusOptions = [
    { value: "active", label: "Active" },
    { value: "banned", label: "Banned" },
    { value: "restricted", label: "Restricted" }
  ]
}: Props) {
  const [startDate, setStartDate] = React.useState(initial.startDate ?? "");
  const [endDate, setEndDate] = React.useState(initial.endDate ?? "");
  const [status, setStatus] = React.useState(initial.status ?? "");

  React.useEffect(() => {
    onChange?.({ startDate: startDate || undefined, endDate: endDate || undefined, status: status || undefined });
  }, [startDate, endDate, status, onChange]);

  const reset = () => {
    setStartDate("");
    setEndDate("");
    setStatus("");
  };

  return (
    <div className={`rounded-md border border-border bg-muted p-3 flex flex-wrap items-center gap-3 ${className}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">From</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-border bg-primary/50 px-2 py-1 text-sm text-foreground"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">To</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-border bg-primary/50 px-2 py-1 text-sm text-foreground"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-border bg-primary/50 px-2 py-1 text-sm text-foreground"
        >
          <option value="">All</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted/20"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
