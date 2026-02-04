import { getDashboardStats, getCurrentUser, getRecentActivities } from "@/lib/supabase/queries";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const dynamic = 'force-dynamic';

export default async function Home() {
	try {
		const userResult = await getCurrentUser();
		
		// If not authenticated, redirect to auth page
		if (!userResult.user) {
			redirect('/auth');
		}

		const [stats, activitiesResult] = await Promise.all([
			getDashboardStats(),
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
	} catch (error) {
		console.error('Dashboard error:', error);
		redirect('/auth');
	}
}

