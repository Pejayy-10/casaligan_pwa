import { getDashboardStats, getCurrentUser } from "@/lib/supabase/queries";
import DashboardClient from "./dashboard-client";

export default async function Home() {
	const [stats, userResult] = await Promise.all([
		getDashboardStats(),
		getCurrentUser(),
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
		/>
	);
}

