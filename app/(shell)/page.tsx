import { getDashboardAnalytics, getDashboardStats, getRecentActivities } from "@/lib/supabase/queries";
import DashboardClient from "./dashboard-client";

export const dynamic = 'force-dynamic';

export default async function Home() {
	// Fetch data server-side (no auth check here - auth is handled client-side)
	const [stats, activitiesResult, analyticsResult] = await Promise.all([
		getDashboardStats(),
		getRecentActivities(4),
		getDashboardAnalytics(),
	]);

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	});

	return (
		<DashboardClient
			stats={{
				totalUsers: stats.totalUsers,
				totalJobs: stats.totalJobs,
				totalBookings: stats.totalBookings,
				trends: stats.trends,
			}}
			today={today}
			activities={activitiesResult.data}
			analytics={analyticsResult.data}
		/>
	);
}

