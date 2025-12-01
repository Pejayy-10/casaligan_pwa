import { getDashboardStats, getCurrentUser, getRecentActivities } from "@/lib/supabase/queries";
import DashboardClient from "./dashboard-client";

export default async function Home() {
	const [stats, userResult, activitiesResult] = await Promise.all([
		getDashboardStats(),
		getCurrentUser(),
		getRecentActivities(4),
	]);

	const userName = userResult.user?.email?.split("@")[0] || "Admin";
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
			}}
			userName={userName}
			today={today}
			activities={activitiesResult.data}
		/>
	);
}

