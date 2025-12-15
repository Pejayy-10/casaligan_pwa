"use client";

import { useEffect, useState, useMemo } from "react";
import ReportsDashboard from "@/app/components/Reports"; 
import TableShell from "@/app/components/TableShell";
import { getReports, resolveReport, dismissReport, restrictReportedUser, unrestrictReportedUser, deleteReport, warnReportedUser } from "@/lib/supabase/reportsqueriesSimplified";
import { Eye } from "lucide-react";

export default function ReportsPage() {
	const [reports, setReports] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [selectedReport, setSelectedReport] = useState<any>(null);
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictingReport, setRestrictingReport] = useState<any>(null);
	const [showWarnModal, setShowWarnModal] = useState(false);
	const [warnReason, setWarnReason] = useState("");
	const [warningReport, setWarningReport] = useState<any>(null);
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		loadReports();
	}, []);

	async function loadReports() {
		setLoading(true);
		const { data, count: total, error } = await getReports(50, 0);
		if (error) {
			console.error("Error loading reports:", error);
		} else {
			setReports(data || []);
			setCount(total || 0);
		}
		setLoading(false);
	}

	// Update reported user status for a specific report
	const updateReportedUserStatus = (reportId: number, newStatus: string) => {
		setReports(prevReports => 
			prevReports.map(report => {
				if (report.report_id === reportId) {
					return {
						...report,
						reported_user: {
							...report.reported_user,
							status: newStatus
						}
					};
				}
				return report;
			})
		);
	};

	// Transform reports data to match TableShell row format - memoized for performance
	const rows = useMemo(() => {
		return reports.map((report: any) => {
			const reporter = report.reporter || {};
			const reportedUser = report.reported_user || {};
			
			// Construct full names
			const reporterName = reporter.first_name && reporter.last_name 
				? `${reporter.first_name} ${reporter.last_name}` 
				: reporter.first_name || reporter.last_name || "N/A";
			const reportedName = reportedUser.first_name && reportedUser.last_name 
				? `${reportedUser.first_name} ${reportedUser.last_name}` 
				: reportedUser.first_name || reportedUser.last_name || "N/A";
			
			// Get status from reported user
			const rawStatus = reportedUser.status;
			const statusValue = (rawStatus != null && rawStatus !== undefined) 
				? String(rawStatus).toLowerCase().trim() 
				: 'active';
			
			return {
				id: report.report_id,
				report_id: report.report_id,
				userId: `R${String(report.report_id).padStart(3, '0')}`,
				name: report.title || report.report_type || "N/A",
				reporter_name: reporterName,
				reporter_email: reporter.email || "N/A",
				reported_user_name: reportedName,
				reported_user_email: reportedUser.email || "N/A",
				status: report.status || "pending",
				date: report.created_at || new Date().toISOString(),
				created_at: report.created_at,
				resolved_at: report.resolved_at,
				reason: report.reason || "N/A",
				description: report.description || "",
				reported_to: reportedName,
				// Store reported user info for restrict/unrestrict (as both names for compatibility)
				reported_user: {
					user_id: reportedUser.id,
					name: reportedName,
					email: reportedUser.email || '',
					status: statusValue,
					phone_number: reportedUser.phone_number,
					profile_picture: reportedUser.profile_picture,
				},
				// Also keep as target_user for ActionTable compatibility
				target_user: {
					user_id: reportedUser.id,
					name: reportedName,
					email: reportedUser.email || '',
					status: statusValue,
					phone_number: reportedUser.phone_number,
					profile_picture: reportedUser.profile_picture,
				},
			};
		});
	}, [reports]); // Recalculate when reports change

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict" | "warn" | "delete" | "dismiss", row: any) => {
		const report = reports.find(r => r.report_id === row.report_id);
		
		if (action === "view") {
			if (report) {
				setSelectedReport(report);
				setShowModal(true);
			}
		} else if (action === "restrict") {
			setRestrictingReport(row);
			setRestrictionReason("");
			setShowRestrictModal(true);
		} else if (action === "warn") {
			setWarningReport(row);
			setWarnReason("");
			setShowWarnModal(true);
		} else if (action === "unrestrict") {
			if (row.reported_user?.name && confirm(`Are you sure you want to unrestrict ${row.reported_user.name}?`)) {
				setProcessing(true);
				const { error } = await unrestrictReportedUser(row.report_id);
				
				if (error) {
					alert(`Error unrestricting user: ${error.message}`);
					setProcessing(false);
				} else {
					updateReportedUserStatus(row.report_id, 'active');
					alert(`${row.reported_user.name} has been unrestricted successfully.`);
					setProcessing(false);
				}
			}
		} else if (action === "delete") {
			if (confirm(`Are you sure you want to resolve report ${row.userId}?`)) {
				setProcessing(true);
				const { error } = await resolveReport(row.report_id);
				if (error) {
					alert(`Error resolving report: ${error.message}`);
					setProcessing(false);
				} else {
					alert(`Report has been resolved successfully.`);
					await loadReports();
					setProcessing(false);
				}
			}
		} else if (action === "dismiss") {
			if (confirm(`Are you sure you want to dismiss report ${row.userId}?`)) {
				setProcessing(true);
				const { error } = await dismissReport(row.report_id);
				if (error) {
					alert(`Error dismissing report: ${error.message}`);
					setProcessing(false);
				} else {
					alert(`Report has been dismissed successfully.`);
					await loadReports();
					setProcessing(false);
				}
			}
		}
	};

	const handleConfirmRestrict = async () => {
		if (!restrictingReport) return;
		
		if (!restrictionReason.trim()) {
			alert("Please provide a reason for restricting this user.");
			return;
		}

		setProcessing(true);
		const { error } = await restrictReportedUser(restrictingReport.report_id, restrictionReason.trim());
		
		if (error) {
			alert(`Error restricting user: ${error.message}`);
			setProcessing(false);
		} else {
			updateReportedUserStatus(restrictingReport.report_id, 'restricted');
			alert(`${restrictingReport.reported_user.name} has been restricted successfully.`);
			setShowRestrictModal(false);
			setRestrictingReport(null);
			setRestrictionReason("");
			setProcessing(false);
		}
	};

	const handleConfirmWarn = async () => {
		if (!warningReport) return;
		
		if (!warnReason.trim()) {
			alert("Please provide a reason for warning this user.");
			return;
		}

		setProcessing(true);
		const { error } = await warnReportedUser(warningReport.report_id, warnReason.trim());
		
		if (error) {
			alert(`Error warning user: ${error.message}`);
			setProcessing(false);
		} else {
			alert(`${warningReport.reported_user?.name || "User"} has been warned successfully.`);
			setShowWarnModal(false);
			setWarningReport(null);
			setWarnReason("");
			setProcessing(false);
			await loadReports();
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<ReportsDashboard />

			{loading ? (
				<div className="text-center py-8">Loading reports...</div>
			) : (
				<TableShell 
					rows={rows} 
					title="Reports" 
					description="User reports and violations management." 
					onAction={handleAction} 
					actionType="reports"
					statusOptions={[
						{ value: "pending", label: "Pending" },
						{ value: "resolved", label: "Resolved" },
						{ value: "dismissed", label: "Dismissed" }
					]}
				/>
			)}

			{/* Warn Modal */}
			{showWarnModal && warningReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowWarnModal(false);
						setWarningReport(null);
						setWarnReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Warn Reported User</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowWarnModal(false);
										setWarningReport(null);
										setWarnReason("");
									}
								}} 
								disabled={processing}
								className="text-muted-foreground hover:text-foreground text-2xl leading-none disabled:opacity-50"
							>
								✕
							</button>
						</div>

						<div className="space-y-4 mb-6">
							<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
								<p className="text-sm text-yellow-800">
									<strong>Warning:</strong> You are about to send a warning to <strong>{warningReport.reported_user?.name || "N/A"}</strong> based on report <strong>{warningReport.userId}</strong>. This will notify the user about the violation.
								</p>
							</div>

							<div className="bg-muted/50 border border-border rounded-lg p-4">
								<p className="text-sm font-medium text-foreground mb-2">Report Details:</p>
								<div className="space-y-1 text-sm text-muted-foreground">
									<p><strong>Report ID:</strong> {warningReport.userId}</p>
									<p><strong>Reporter:</strong> {warningReport.reporter_name}</p>
									<p><strong>Reported User:</strong> {warningReport.reported_user?.name || "N/A"}</p>
									<p><strong>Reason:</strong> {warningReport.reason}</p>
									{warningReport.description && (
										<p><strong>Description:</strong> {warningReport.description}</p>
									)}
								</div>
							</div>

							<div>
								<label htmlFor="warn-reason" className="block text-sm font-medium text-foreground mb-2">
									Warning Reason <span className="text-red-500">*</span>
								</label>
								<textarea
									id="warn-reason"
									value={warnReason}
									onChange={(e) => setWarnReason(e.target.value)}
									placeholder="Please provide a detailed reason for warning this user based on the report..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									This reason will be included in the warning notification sent to the user and recorded in the report.
								</p>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<button
								onClick={handleConfirmWarn}
								disabled={processing || !warnReason.trim()}
								className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{processing ? "Processing..." : "Send Warning"}
							</button>
							<button
								onClick={() => {
									if (!processing) {
										setShowWarnModal(false);
										setWarningReport(null);
										setWarnReason("");
									}
								}}
								disabled={processing}
								className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Restriction Modal */}
			{showRestrictModal && restrictingReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowRestrictModal(false);
						setRestrictingReport(null);
						setRestrictionReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Restrict Reported User</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingReport(null);
										setRestrictionReason("");
									}
								}} 
								disabled={processing}
								className="text-muted-foreground hover:text-foreground text-2xl leading-none disabled:opacity-50"
							>
								✕
							</button>
						</div>

						<div className="space-y-4 mb-6">
							<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
								<p className="text-sm text-yellow-800">
									<strong>Warning:</strong> You are about to restrict <strong>{restrictingReport.reported_user?.name || "N/A"}</strong> based on report <strong>{restrictingReport.userId}</strong>. This will limit their account access.
								</p>
							</div>

							<div className="bg-muted/50 border border-border rounded-lg p-4">
								<p className="text-sm font-medium text-foreground mb-2">Report Details:</p>
								<div className="space-y-1 text-sm text-muted-foreground">
									<p><strong>Report ID:</strong> {restrictingReport.userId}</p>
									<p><strong>Reporter:</strong> {restrictingReport.reporter_name}</p>
									<p><strong>Reported User:</strong> {restrictingReport.reported_user?.name || "N/A"}</p>
									<p><strong>Reason:</strong> {restrictingReport.reason}</p>
									{restrictingReport.description && (
										<p><strong>Description:</strong> {restrictingReport.description}</p>
									)}
								</div>
							</div>

							<div>
								<label htmlFor="restriction-reason" className="block text-sm font-medium text-foreground mb-2">
									Reason for Restriction <span className="text-red-500">*</span>
								</label>
								<textarea
									id="restriction-reason"
									value={restrictionReason}
									onChange={(e) => setRestrictionReason(e.target.value)}
									placeholder="Please provide a detailed reason for restricting this user based on the report..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									This reason will be recorded for administrative purposes and stored with the user's account.
								</p>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<button
								onClick={handleConfirmRestrict}
								disabled={processing || !restrictionReason.trim()}
								className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{processing ? "Processing..." : "Confirm Restriction"}
							</button>
							<button
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingReport(null);
										setRestrictionReason("");
									}
								}}
								disabled={processing}
								className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* View Report Modal */}
			{showModal && selectedReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowModal(false);
						setSelectedReport(null);
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center gap-3 mb-4">
							<div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
								<Eye className="h-6 w-6 text-blue-600" />
							</div>
							<h2 className="text-xl font-semibold">Report Details</h2>
							<button 
								onClick={() => {
									setShowModal(false);
									setSelectedReport(null);
								}} 
								className="ml-auto text-muted-foreground hover:text-foreground text-2xl leading-none"
							>
								✕
							</button>
						</div>
						
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Report ID</p>
									<p className="font-medium">R{String(selectedReport.report_id).padStart(3, '0')}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										selectedReport.status === 'resolved' ? 'bg-green-100 text-green-800' :
										selectedReport.status === 'dismissed' ? 'bg-gray-100 text-gray-800' :
										'bg-yellow-100 text-yellow-800'
									}`}>
										{selectedReport.status || "pending"}
									</span>
								</div>
								<div className="col-span-2">
									<p className="text-sm text-muted-foreground">Reason</p>
									<p className="font-medium">{selectedReport.reason || "N/A"}</p>
								</div>
								{selectedReport.description && (
									<div className="col-span-2">
										<p className="text-sm text-muted-foreground">Description</p>
										<p className="font-medium">{selectedReport.description}</p>
									</div>
								)}
								<div>
									<p className="text-sm text-muted-foreground">Reporter</p>
									<p className="font-medium">{selectedReport.reporter?.name || "N/A"}</p>
									<p className="text-xs text-muted-foreground">{selectedReport.reporter?.email || ""}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Reported User</p>
									<p className="font-medium">{selectedReport.reported_user?.name || "N/A"}</p>
									<p className="text-xs text-muted-foreground">{selectedReport.reported_user?.email || ""}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Created At</p>
									<p className="font-medium">
										{selectedReport.created_at 
											? new Date(selectedReport.created_at).toLocaleString() 
											: "N/A"}
									</p>
								</div>
								{selectedReport.resolved_at && (
									<div>
										<p className="text-sm text-muted-foreground">Resolved At</p>
										<p className="font-medium">
											{new Date(selectedReport.resolved_at).toLocaleString()}
										</p>
									</div>
								)}
							</div>
							<div className="mt-6 flex justify-end">
								<button 
									onClick={() => {
										setShowModal(false);
										setSelectedReport(null);
									}} 
									className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
								>
									Close
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
