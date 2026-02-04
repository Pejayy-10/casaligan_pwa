"use client";

import { useEffect, useState } from "react";
import ActivityLog from "@/app/components/ActivityLog";
import TableShell from "@/app/components/TableShell";
import { getActivityLogs, deleteActivityLog } from "@/lib/supabase/activityLogQueries";

export default function ActivityLogPage() {
	const [activities, setActivities] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadActivities();
	}, []);

	async function loadActivities() {
		setLoading(true);
		const { data, count: total, error } = await getActivityLogs(50, 0);
		if (error) {
			console.error("Error loading activities:", error);
			const errorMessage = (error as any)?.message || 'Unknown error';
			alert(`Error loading activities: ${errorMessage}`);
		} else {
			setActivities(data || []);
			setCount(total || 0);
		}
		setLoading(false);
	}

	// Helper function to truncate text to 3 words
	const truncateToThreeWords = (text: string): string => {
		if (!text || text === "N/A") return text;
		const words = text.trim().split(/\s+/);
		if (words.length <= 3) {
			return text;
		}
		return words.slice(0, 3).join(' ') + '...';
	};

	// Transform activities data to match TableShell row format
	const rows = activities.map((activity: any) => {
		// Format timestamp as MM-DD-YYYY HH:MMAM/PM
		const timestamp = activity.timestamp ? new Date(activity.timestamp) : new Date();
		const month = String(timestamp.getMonth() + 1).padStart(2, '0');
		const day = String(timestamp.getDate()).padStart(2, '0');
		const year = timestamp.getFullYear();
		const hours = timestamp.getHours();
		const minutes = String(timestamp.getMinutes()).padStart(2, '0');
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const displayHours = hours % 12 || 12;
		const timestampFormatted = `${month}-${day}-${year} ${displayHours}:${minutes}${ampm}`;

		// Capitalize user type
		const userType = activity.user_type 
			? activity.user_type.charAt(0).toUpperCase() + activity.user_type.slice(1).toLowerCase()
			: "N/A";

		// Get full details and truncated version
		const fullDetails = activity.details || "N/A";
		const truncatedDetails = truncateToThreeWords(fullDetails);

		return {
			id: activity.activity_id,
			activity_id: activity.activity_id,
			user_type: userType,
			user_name: activity.user_name || "N/A",
			action: activity.action || "N/A",
			timestamp: activity.timestamp,
			timestamp_formatted: timestampFormatted,
			details: truncatedDetails, // Show truncated version in table
			details_full: fullDetails, // Store full details for view action
			entity_type: activity.entity_type,
			entity_id: activity.entity_id,
			user_id: activity.user_id,
		};
	});

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict" | "delete" | "dismiss" | "warn", row: any) => {
		if (action === "view") {
			// Show full activity details
			const activity = activities.find(a => a.activity_id === row.activity_id);
			if (activity) {
				// Use full details from the row or fallback to activity details
				const fullDetails = row.details_full || activity.details || row.details;
				alert(`Activity Details:\nUser Type: ${row.user_type}\nName: ${row.user_name}\nAction: ${row.action}\nTimestamp: ${row.timestamp_formatted}\nDetails/Remarks: ${fullDetails}`);
			}
		} else if (action === "delete") {
			// Delete activity
			if (confirm(`Are you sure you want to delete this activity record for ${row.user_name}?`)) {
				const { error } = await deleteActivityLog(row.activity_id);
				
				if (error) {
					alert(`Error deleting activity: ${error.message}`);
				} else {
					alert(`Activity record has been deleted successfully.`);
					loadActivities(); // Reload data
				}
			}
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h1 className="heading">Activity Log</h1>
				<p className="text-muted-foreground">
					Track and monitor user activities across the platform. Total: {count} activities
				</p>
			</div>

			<ActivityLog />

			{loading ? (
				<div className="text-center py-8">Loading activities...</div>
			) : (
				<TableShell 
					rows={rows} 
					title="Activity Records" 
					description="Recent activity and audit trail." 
					pageSize={10} 
					onAction={handleAction}
					actionType="activity-log"
				/>
			)}
		</div>
	);
}


