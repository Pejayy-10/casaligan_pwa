"use client";

import { useEffect, useState } from "react";
import ActivityLog from "@/app/components/ActivityLog";
import TableShell from "@/app/components/TableShell";
import { getActivityLogs, deleteActivityLog } from "@/lib/supabase/activityLogQueries";

export default function ActivityLogPage() {
	const [activities, setActivities] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);

	// Modal States
	const [viewActivity, setViewActivity] = useState<any>(null);
	const [activityToDelete, setActivityToDelete] = useState<any>(null);
	const [processing, setProcessing] = useState(false);
	const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
		show: false, title: "", message: "", isError: false,
	});

	useEffect(() => {
		loadActivities();
	}, []);

	// Lock body scroll when any modal is open
	useEffect(() => {
		if (viewActivity || activityToDelete || alertModal.show) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [viewActivity, activityToDelete, alertModal.show]);

	async function loadActivities() {
		setLoading(true);
		const { data, count: total, error } = await getActivityLogs(50, 0);
		if (error) {
			console.error("Error loading activities:", error);
			const errorMessage = (error as any)?.message || 'Unknown error';
			setAlertModal({ 
				show: true, 
				title: "Loading Error", 
				message: `Error loading activities: ${errorMessage}`, 
				isError: true 
			});
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
			setViewActivity(row);
		} else if (action === "delete") {
			setActivityToDelete(row);
		}
	};

	const executeDelete = async () => {
		if (!activityToDelete) return;
		setProcessing(true);
		
		const { error } = await deleteActivityLog(activityToDelete.activity_id);
		
		if (error) {
			setAlertModal({ 
				show: true, 
				title: "Deletion Error", 
				message: error.message, 
				isError: true 
			});
		} else {
			setAlertModal({ 
				show: true, 
				title: "Success", 
				message: "Activity record has been deleted successfully.", 
				isError: false 
			});
			await loadActivities();
		}
		
		setProcessing(false);
		setActivityToDelete(null);
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
				<div className="text-center py-12 text-muted-foreground">Loading activities...</div>
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

			{/* ==============================================
			    PRETTIFIED VIEW ACTIVITY MODAL
			    ============================================== */}
			{viewActivity && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewActivity(null)}>
					<div 
						className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 text-primary rounded-lg">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
								</div>
								<div>
									<h2 className="text-lg font-semibold leading-tight">Activity Details</h2>
									<p className="text-xs text-muted-foreground">Log ID: {viewActivity.activity_id}</p>
								</div>
							</div>
							<button onClick={() => setViewActivity(null)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{/* Scrollable Content Body */}
						<div className="p-6 overflow-y-auto space-y-6">
							
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{/* User Details */}
								<div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
									<div className="bg-blue-100 text-blue-600 p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
										</svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">User / Actor</p>
										<p className="font-medium text-foreground">{viewActivity.user_name}</p>
										<span className="inline-block mt-1 px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded-full font-medium">
											{viewActivity.user_type}
										</span>
									</div>
								</div>

								{/* Action Snapshot */}
								<div className="bg-card border border-border rounded-xl p-4 shadow-sm">
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Action Performed</p>
									<h3 className="text-lg font-semibold text-foreground mb-3">{viewActivity.action}</h3>
									
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Timestamp</p>
									<p className="text-sm font-medium text-foreground">{viewActivity.timestamp_formatted}</p>
								</div>
							</div>

							{/* Details Block */}
							<div className="bg-muted/30 border border-border/50 rounded-xl p-5">
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Remarks / Details</p>
								<div className="bg-background border border-border p-4 rounded-lg font-mono text-sm text-foreground/80 whitespace-pre-wrap shadow-sm">
									{viewActivity.details_full}
								</div>
							</div>

							{/* Meta Info */}
							{(viewActivity.entity_type || viewActivity.entity_id) && (
								<div className="grid grid-cols-2 gap-4 bg-muted/10 border border-border rounded-xl p-4">
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Entity Type</p>
										<p className="font-medium text-foreground text-sm">{viewActivity.entity_type || "N/A"}</p>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Entity ID</p>
										<p className="font-medium text-foreground text-sm">{viewActivity.entity_id || "N/A"}</p>
									</div>
								</div>
							)}

						</div>
					</div>
				</div>
			)}
			{/* ============================================== */}

			{/* Confirm Delete Modal (Using Danger) */}
			{activityToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setActivityToDelete(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to delete this activity record for <span className="font-semibold text-foreground">"{activityToDelete.user_name}"</span>? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button 
								disabled={processing}
								onClick={() => setActivityToDelete(null)} 
								className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button 
								disabled={processing}
								onClick={executeDelete} 
								className="px-4 py-2 text-sm rounded-md bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
							>
								{processing ? "Processing..." : "Delete Record"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Alert Feedback Modal (Using Danger for errors) */}
			{alertModal.show && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-danger" : ""}`}>
							{alertModal.title}
						</h2>
						<p className="text-muted-foreground text-sm mb-6">{alertModal.message}</p>
						<div className="flex justify-end">
							<button 
								onClick={() => setAlertModal({ ...alertModal, show: false })} 
								className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}