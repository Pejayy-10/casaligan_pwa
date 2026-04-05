import type { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

interface ListSkeletonProps {
  rows?: number;
  className?: string;
  itemClassName?: string;
}

function cx(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(' ');
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cx(
        'animate-pulse rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
        'dark:from-white/10 dark:via-white/5 dark:to-white/10',
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

export function ListSkeleton({ rows = 5, className, itemClassName }: ListSkeletonProps) {
  return (
    <div className={cx('space-y-4', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={cx('rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4', itemClassName)}>
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({
  titleWidth = 'w-52',
  withFilters = false,
  rows = 4,
}: {
  titleWidth?: string;
  withFilters?: boolean;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5">
        <Skeleton className={cx('h-7', titleWidth)} />
        <Skeleton className="mt-3 h-4 w-64 max-w-full" />
        {withFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-10 w-36 rounded-xl" />
            <Skeleton className="h-10 w-40 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        )}
      </div>

      <ListSkeleton rows={rows} />
    </div>
  );
}

export function JobsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5">
        <Skeleton className="h-7 w-52" />
        <div className="mt-4 grid grid-cols-2 gap-2 max-w-sm">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
        <div className="mt-4 flex gap-2 overflow-hidden">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsPageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-56 max-w-[80%]" />
                <Skeleton className="h-2 w-2 rounded-full" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-5/6" />
              <Skeleton className="mt-3 h-3 w-28" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DirectHiresSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 py-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-white/50 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-4 shadow-lg">
          <div className="flex flex-wrap items-start justify-between mb-3 gap-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-6 w-44 max-w-full" />
              <Skeleton className="mt-2 h-4 w-56 max-w-full" />
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>

          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-36 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-4">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="mt-4 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="space-y-4 p-1">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={cx('flex', index % 3 === 0 ? 'justify-end' : 'justify-start')}>
          <div className="max-w-[78%] rounded-2xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-slate-900/60 p-3 space-y-2">
            <Skeleton className="h-3 w-40 max-w-full" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
