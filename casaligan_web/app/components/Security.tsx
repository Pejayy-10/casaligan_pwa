"use client";

import React from "react";

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
  <div className="flex flex-col items-center justify-center bg-[var(--color-muted)] border border-[var(--color-border)] rounded-lg p-6 w-full shadow-sm">
    <div
      className={`mb-3 flex items-center justify-center w-14 h-14 rounded-full text-white text-3xl ${bgColorVar}`}
    >
      {icon}
    </div>
    <h2 className="text-sm text-[var(--color-foreground)]/70 mb-1">{title}</h2>
    <p className="text-3xl font-bold text-[var(--color-foreground)]/80">
      {value}
    </p>
  </div>
);

const Security: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Security Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Login Attempts"
          value="122,334"
          icon={<span className="material-icons">person</span>}
          bgColorVar="bg-[var(--color-primary)]"
        />
        <MetricCard
          title="Successful Logins"
          value="117,234"
          icon={<span className="material-icons">check_circle</span>}
          bgColorVar="bg-[var(--color-secondary)]"
        />
        <MetricCard
          title="Failed Logins"
          value="4,354"
          icon={<span className="material-icons">cancel</span>}
          bgColorVar="bg-[var(--color-accent)]"
        />
        <MetricCard
          title="Suspicious Activities"
          value="124"
          icon={<span className="material-icons">warning</span>}
          bgColorVar="bg-[var(--color-tertiary)]"
        />
        <MetricCard
          title="Blocked Accounts"
          value="84"
          icon={<span className="material-icons">block</span>}
          bgColorVar="bg-[var(--color-danger)]"
        />
      </div>
    </div>
  );
};

export default Security;
