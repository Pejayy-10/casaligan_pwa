"use client";

import { BriefcaseBusiness, CalendarCheck, Users2 } from "lucide-react";

import { BookingsLineChartCard } from "@/app/components/BookingsLineChartCard";
import { PieChartUsersCard } from "@/app/components/PieChartUsersCard";
import { RadarChartWithSummary } from "@/app/components/RadarChartWithSummary";
import { RecentActivitiesCard } from "@/app/components/RecentActivitiesCard";
import { RevenueBarChartCard } from "@/app/components/RevenueBarChartCard";
import { SearchBar } from "@/app/components/SearchBar";
import { StatSummaryCard } from "@/app/components/StatSummaryCard";

type DashboardClientProps = {
	stats: {
		totalUsers: number;
		totalJobs: number;
		totalBookings: number;
	};
	userName: string;
	today: string;
	activities: any[];
};

export default function DashboardClient({ stats, userName, today, activities }: DashboardClientProps) {
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
								trend={{ value: "59%", isPositive: true, label: "vs last month" }}
							/>
							<StatSummaryCard
								title="Jobs"
								value={stats.totalJobs}
								icon={<BriefcaseBusiness className="h-6 w-6" />}
								iconColor="#0f766e"
								trend={{ value: "59%", isPositive: false, label: "vs last month" }}
							/>
							<StatSummaryCard
								title="Bookings"
								value={stats.totalBookings}
								icon={<CalendarCheck className="h-6 w-6" />}
								iconColor="#6d28d9"
								trend={{ value: "59%", isPositive: true, label: "vs last month" }}
							/>
						</div>

						<div className="grid gap-4 lg:grid-cols-2">
							<PieChartUsersCard />
							<RadarChartWithSummary />
						</div>

						<BookingsLineChartCard />
					</section>

				<aside className="space-y-4">
					<RevenueBarChartCard />
					<RecentActivitiesCard activities={activities} />
				</aside>
				</div>
			</div>
		</>
	);
}
