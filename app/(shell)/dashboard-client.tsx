"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, CalendarCheck, Users2 } from "lucide-react";

import { BookingsLineChartCard } from "@/app/components/BookingsLineChartCard";
import { PieChartUsersCard } from "@/app/components/PieChartUsersCard";
import { RadarChartWithSummary } from "@/app/components/RadarChartWithSummary";
import { RecentActivitiesCard } from "@/app/components/RecentActivitiesCard";
import { RevenueBarChartCard } from "@/app/components/RevenueBarChartCard";
import { SearchBar } from "@/app/components/SearchBar";
import { StatSummaryCard } from "@/app/components/StatSummaryCard";
import { getCurrentUser } from "@/lib/supabase/auth";

type DashboardClientProps = {
	stats: {
		totalUsers: number;
		totalJobs: number;
		totalBookings: number;
		trends?: {
			users: number;
			jobs: number;
			bookings: number;
		};
	};
	today: string;
	activities: any[];
	analytics: {
		bookingsByWeek: { week: string; bookings: number }[];
		revenueByWeek: { category: string; revenue: number }[];
		userDistribution: { label: string; value: number; color: string }[];
		jobStatusMix: { label: string; value: number }[];
		jobStatusSummary: { topLabel: string; total: number };
		rangeLabel: string;
	};
};

const formatTrend = (value?: number) => {
	if (value === undefined || value === null) {
		return undefined;
	}
	return {
		value: `${Math.abs(value).toFixed(1)}%`,
		isPositive: value >= 0,
		label: "vs previous 30d",
	};
};

const getDefaultRevenueStartDate = () => {
	const start = new Date();
	start.setDate(start.getDate() - 30);
	return start.toISOString().split("T")[0];
};

const getDefaultRevenueEndDate = () => new Date().toISOString().split("T")[0];

export default function DashboardClient({ stats, today, activities, analytics }: DashboardClientProps) {
	const router = useRouter();
	const [userName, setUserName] = useState("Admin");
	const [isLoading, setIsLoading] = useState(true);
	const [revenueByCategory, setRevenueByCategory] = useState(analytics.revenueByWeek);
	const [revenueRangeLabel, setRevenueRangeLabel] = useState(analytics.rangeLabel);
	const [revenueStartDate, setRevenueStartDate] = useState(getDefaultRevenueStartDate);
	const [revenueEndDate, setRevenueEndDate] = useState(getDefaultRevenueEndDate);

	useEffect(() => {
		const user = getCurrentUser();
		if (!user) {
			router.replace('/auth');
			return;
		}
		setUserName(user.name || user.email?.split("@")[0] || "Admin");
		setIsLoading(false);
	}, [router]);

	useEffect(() => {
		const loadRevenueCategories = async () => {
			try {
				const params = new URLSearchParams({
					startDate: revenueStartDate,
					endDate: revenueEndDate,
				});
				const response = await fetch(`/api/dashboard/revenue-categories?${params.toString()}`, { cache: 'no-store' });
				if (!response.ok) return;
				const payload = await response.json();
				if (Array.isArray(payload?.data)) {
					setRevenueByCategory(payload.data);
					const startLabel = new Date(`${revenueStartDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
					const endLabel = new Date(`${revenueEndDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
					setRevenueRangeLabel(`${startLabel} - ${endLabel}`);
				}
			} catch {
				// Keep server-provided analytics as fallback if API fetch fails.
			}
		};

		loadRevenueCategories();
	}, [revenueStartDate, revenueEndDate]);

	const resetRevenueDates = () => {
		setRevenueStartDate(getDefaultRevenueStartDate());
		setRevenueEndDate(getDefaultRevenueEndDate());
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
			</div>
		);
	}

	return (
		<>
			<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
				<header className="flex flex-col gap-4 rounded-2xl border border-border bg-muted p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
					<div className="space-y-1">
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
							Welcome, {userName}
						</p>
						<h1 className="text-xl font-semibold text-foreground">Today is {today}</h1>
					</div>
					<SearchBar className="max-w-md md:w-80" placeholder="Search..." />
				</header>

				<div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
					<section className="space-y-5">
						<div className="grid gap-4 md:grid-cols-3">
							<StatSummaryCard
								title="Total Users"
								value={stats.totalUsers}
								icon={<Users2 className="h-6 w-6" />}
								iconColor="#e7467b"
								trend={formatTrend(stats.trends?.users)}
							/>
							<StatSummaryCard
								title="Jobs"
								value={stats.totalJobs}
								icon={<BriefcaseBusiness className="h-6 w-6" />}
								iconColor="#0f766e"
								trend={formatTrend(stats.trends?.jobs)}
							/>
							<StatSummaryCard
								title="Bookings"
								value={stats.totalBookings}
								icon={<CalendarCheck className="h-6 w-6" />}
								iconColor="#6d28d9"
								trend={formatTrend(stats.trends?.bookings)}
							/>
						</div>

						<div className="grid gap-4 lg:grid-cols-2">
							<PieChartUsersCard data={analytics.userDistribution} />
							<RadarChartWithSummary data={analytics.jobStatusMix} summary={analytics.jobStatusSummary} />
						</div>

						<BookingsLineChartCard data={analytics.bookingsByWeek} rangeLabel={analytics.rangeLabel} />
					</section>

				<aside className="space-y-4">
					<RevenueBarChartCard
						data={revenueByCategory}
						rangeLabel={revenueRangeLabel}
						startDate={revenueStartDate}
						endDate={revenueEndDate}
						onStartDateChange={setRevenueStartDate}
						onEndDateChange={setRevenueEndDate}
						onResetDates={resetRevenueDates}
					/>
					<RecentActivitiesCard activities={activities} />
				</aside>
				</div>
			</div>
		</>
	);
}
