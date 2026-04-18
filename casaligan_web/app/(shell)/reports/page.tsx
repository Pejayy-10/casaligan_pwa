"use client";

import { useEffect, useState, useMemo } from "react";
import ReportsDashboard from "@/app/components/Reports"; 
import TableShell from "@/app/components/TableShell";
import { getReports, resolveReport, dismissReport, restrictReportedUser, unrestrictReportedUser, deleteReport, warnReportedUser, approveBackJobReport } from "@/lib/supabase/reportsqueriesSimplified";
import { Eye } from "lucide-react";

export default function ReportsPage() {
	const [reports, setReports] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [processing, setProcessing] = useState(false);

	// Modal States
	const [viewReport, setViewReport] = useState<any>(null);
	
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictionDays, setRestrictionDays] = useState<number | null>(null);
	const [restrictingReport, setRestrictingReport] = useState<any>(null);
	
	const [showWarnModal, setShowWarnModal] = useState(false);
	const [warnReason, setWarnReason] = useState("");
	const [warningReport, setWarningReport] = useState<any>(null);

	// Confirmation Modal States
	const [reportToResolve, setReportToResolve] = useState<any>(null);
	const [reportToDismiss, setReportToDismiss] = useState<any>(null);
	const [reportToApproveBackjob, setReportToApproveBackjob] = useState<any>(null);
	const [reportToUnrestrict, setReportToUnrestrict] = useState<any>(null);

	const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
		show: false, title: "", message: "", isError: false,
	});

	useEffect(() => {
		loadReports();
	}, []);

	// Lock body scroll when any modal is open
	useEffect(() => {
		if (
			viewReport || showRestrictModal || showWarnModal || 
			reportToResolve || reportToDismiss || reportToApproveBackjob || 
			reportToUnrestrict || alertModal.show
		) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [viewReport, showRestrictModal, showWarnModal, reportToResolve, reportToDismiss, reportToApproveBackjob, reportToUnrestrict, alertModal.show]);

	async function loadReports() {
		setLoading(true);
		const { data, count: total, error } = await getReports(50, 0);
		if (error) {
			console.error("Error loading reports:", error);
			setAlertModal({ show: true, title: "Loading Error", message: error.message, isError: true });
		} else {
			setReports(data || []);
			setCount(total || 0);
		}
		setLoading(false);
	}

	// Update reported user restriction status for ALL reports of the same user
	const updateReportedUserRestriction = (reportId: number, isRestricted: boolean) => {
		setReports(prevReports => {
			const targetReport = prevReports.find(r => r.report_id === reportId);
			if (!targetReport || !targetReport.reported_user_id) {
				return prevReports;
			}
			
			const userId = targetReport.reported_user_id;
			
			return prevReports.map(report => {
				if (report.reported_user_id === userId) {
					return {
						...report,
						reported_user: {
							...report.reported_user,
							is_restricted: isRestricted
						}
					};
				}
				return report;
			});
		});
	};

	// Transform reports data to match TableShell row format - memoized for performance
	const rows = useMemo(() => {
		const isBackJobReport = (report: any) => {
			const reportType = String(report?.report_type || '').toLowerCase().trim();
			if (reportType === 'back_job_request') return true;
			if (reportType !== 'other') return false;
			const marker = '[BACK_JOB_REQUEST]';
			const title = String(report?.title || '');
			const reason = String(report?.reason || '');
			const notes = String(report?.admin_notes || '');
			return title.includes(marker) || reason.includes(marker) || notes.includes(marker);
		};

		const computeBackJobSlaLabel = (report: any) => {
			if (!isBackJobReport(report)) return null;
			if (!report.resolved_at) return 'SLA starts after admin approval';

			const resolvedAt = new Date(report.resolved_at);
			if (Number.isNaN(resolvedAt.getTime())) return null;

			const deadlineMs = resolvedAt.getTime() + (48 * 60 * 60 * 1000);
			const nowMs = Date.now();
			const remainingMs = deadlineMs - nowMs;

			if (String(report.status || '').toLowerCase() === 'escalated') {
				return 'SLA breached (escalated)';
			}

			if (remainingMs <= 0) {
				return 'SLA overdue (awaiting escalation check)';
			}

			const totalHours = Math.ceil(remainingMs / (1000 * 60 * 60));
			if (totalHours >= 24) {
				const days = Math.floor(totalHours / 24);
				const hours = totalHours % 24;
				return `SLA due in ${days}d ${hours}h`;
			}

			return `SLA due in ${totalHours}h`;
		};

		return reports.map((report: any) => {
			const reporter = report.reporter || {};
			const reportedUser = report.reported_user || {};
			
			const reporterName = reporter.first_name && reporter.last_name 
				? `${reporter.first_name} ${reporter.last_name}` 
				: reporter.first_name || reporter.last_name || "N/A";
			const reportedName = reportedUser.first_name && reportedUser.last_name 
				? `${reportedUser.first_name} ${reportedUser.last_name}` 
				: reportedUser.first_name || reportedUser.last_name || "N/A";
			
			const rawStatus = reportedUser.status;
			const statusValue = (rawStatus != null && rawStatus !== undefined) 
				? String(rawStatus).toLowerCase().trim() 
				: 'active';
			
			const isRestricted = reportedUser.is_restricted === true;
			
			const effectiveReportType = isBackJobReport(report) ? 'back_job_request' : report.report_type;

			return {
				id: report.report_id,
				report_id: report.report_id,
				report_type: effectiveReportType,
				back_job_sla_label: computeBackJobSlaLabel(report),
				post_id: report.post_id,
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
				reported_user: {
					user_id: reportedUser.id,
					name: reportedName,
					email: reportedUser.email || '',
					status: statusValue,
					phone_number: reportedUser.phone_number,
					profile_picture: reportedUser.profile_picture,
					is_restricted: isRestricted,
					restriction_reason: reportedUser.restriction_reason,
					restriction_start: reportedUser.restriction_start,
					restriction_end: reportedUser.restriction_end
				},
				target_user: {
					user_id: reportedUser.id,
					name: reportedName,
					email: reportedUser.email || '',
					status: statusValue,
					phone_number: reportedUser.phone_number,
					profile_picture: reportedUser.profile_picture,
					is_restricted: isRestricted,
					restriction_reason: reportedUser.restriction_reason,
					restriction_start: reportedUser.restriction_start,
					restriction_end: reportedUser.restriction_end
				},
			};
		});
	}, [reports]);

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict" | "warn" | "delete" | "dismiss" | "approve_backjob", row: any) => {
		const report = reports.find(r => r.report_id === row.report_id);
		
		if (action === "view") {
			if (report) setViewReport(row); // Use transformed row for better display
		} else if (action === "restrict") {
			setRestrictingReport(row);
			setRestrictionReason("");
			setShowRestrictModal(true);
		} else if (action === "warn") {
			setWarningReport(row);
			setWarnReason("");
			setShowWarnModal(true);
		} else if (action === "unrestrict") {
			setReportToUnrestrict(row);
		} else if (action === "delete") {
			setReportToResolve(row); // Mapping "delete" action to resolve report
		} else if (action === "dismiss") {
			setReportToDismiss(row);
		} else if (action === "approve_backjob") {
			setReportToApproveBackjob(row);
		}
	};

	// Execution Functions
	const executeUnrestrict = async () => {
		if (!reportToUnrestrict) return;
		setProcessing(true);
		const { error } = await unrestrictReportedUser(reportToUnrestrict.report_id);
		
		if (error) {
			setAlertModal({ show: true, title: "Error", message: error.message, isError: true });
		} else {
			updateReportedUserRestriction(reportToUnrestrict.report_id, false);
			setAlertModal({ show: true, title: "Success", message: `${reportToUnrestrict.reported_user.name} has been unrestricted successfully.`, isError: false });
		}
		setProcessing(false);
		setReportToUnrestrict(null);
	};

	const executeResolve = async () => {
		if (!reportToResolve) return;
		setProcessing(true);
		const { error } = await resolveReport(reportToResolve.report_id);
		
		if (error) {
			setAlertModal({ show: true, title: "Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Report has been resolved successfully.", isError: false });
			await loadReports();
		}
		setProcessing(false);
		setReportToResolve(null);
	};

	const executeDismiss = async () => {
		if (!reportToDismiss) return;
		setProcessing(true);
		const { error } = await dismissReport(reportToDismiss.report_id);
		
		if (error) {
			setAlertModal({ show: true, title: "Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Report has been dismissed successfully.", isError: false });
			await loadReports();
		}
		setProcessing(false);
		setReportToDismiss(null);
	};

	const executeApproveBackjob = async () => {
		if (!reportToApproveBackjob) return;
		setProcessing(true);
		const { error } = await approveBackJobReport(reportToApproveBackjob.report_id);
		
		if (error) {
			setAlertModal({ show: true, title: "Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Back job approved. Job reopened for free rework.", isError: false });
			await loadReports();
		}
		setProcessing(false);
		setReportToApproveBackjob(null);
	};

	const handleConfirmRestrict = async () => {
		if (!restrictingReport) return;
		if (!restrictionReason.trim()) {
			setAlertModal({ show: true, title: "Missing Information", message: "Please provide a reason for restricting this user.", isError: true });
			return;
		}

		setProcessing(true);
		const { error } = await restrictReportedUser(restrictingReport.report_id, restrictionReason.trim(), restrictionDays);
		
		if (error) {
			setAlertModal({ show: true, title: "Restriction Error", message: error.message, isError: true });
		} else {
			updateReportedUserRestriction(restrictingReport.report_id, true);
			const durationType = restrictionDays ? `${restrictionDays} days` : 'permanently';
			setAlertModal({ show: true, title: "Success", message: `${restrictingReport.reported_user.name} has been restricted ${durationType}.`, isError: false });
			setShowRestrictModal(false);
			setRestrictingReport(null);
			setRestrictionReason("");
			setRestrictionDays(null);
		}
		setProcessing(false);
	};

	const handleConfirmWarn = async () => {
		if (!warningReport) return;
		if (!warnReason.trim()) {
			setAlertModal({ show: true, title: "Missing Information", message: "Please provide a reason for warning this user.", isError: true });
			return;
		}

		setProcessing(true);
		const { error } = await warnReportedUser(warningReport.report_id, warnReason.trim());
		
		if (error) {
			setAlertModal({ show: true, title: "Warning Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: `${warningReport.reported_user?.name || "User"} has been warned successfully.`, isError: false });
			setShowWarnModal(false);
			setWarningReport(null);
			setWarnReason("");
			await loadReports();
		}
		setProcessing(false);
	};

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<ReportsDashboard />

			{loading ? (
				<div className="text-center py-12 text-muted-foreground">Loading reports...</div>
			) : (
				<TableShell 
					rows={rows} 
					title="Reports" 
					description="User reports and violations management." 
					onAction={handleAction} 
					actionType="reports"
					statusOptions={[
						{ value: "pending", label: "Pending" },
						{ value: "escalated", label: "Escalated" },
						{ value: "resolved", label: "Resolved" },
						{ value: "dismissed", label: "Dismissed" }
					]}
				/>
			)}

			{/* ==============================================
			    PRETTIFIED VIEW REPORT MODAL
			    ============================================== */}
			{viewReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setViewReport(null)}>
					<div 
						className="bg-background border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
									<Eye className="h-5 w-5" />
								</div>
								<div>
									<h2 className="text-lg font-semibold leading-tight">Report Details</h2>
									<p className="text-xs text-muted-foreground">ID: {viewReport.userId}</p>
								</div>
							</div>
							<button onClick={() => setViewReport(null)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{/* Scrollable Content */}
						<div className="p-6 overflow-y-auto space-y-6">
							
							{/* Status Card */}
							<div className="flex flex-col sm:flex-row justify-between items-center bg-card border border-border rounded-xl p-4 shadow-sm">
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
									<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
										viewReport.status === 'resolved' ? 'bg-green-100 text-green-800' :
										viewReport.status === 'dismissed' ? 'bg-gray-100 text-gray-800' :
										viewReport.status === 'escalated' ? 'bg-danger/10 text-danger' :
										'bg-yellow-100 text-yellow-800'
									}`}>
										{viewReport.status || "pending"}
									</span>
								</div>
								<div className="text-left sm:text-right mt-4 sm:mt-0">
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Created At</p>
									<p className="text-sm font-medium text-foreground">
										{viewReport.created_at ? new Date(viewReport.created_at).toLocaleString() : "N/A"}
									</p>
								</div>
								{viewReport.resolved_at && (
									<div className="text-left sm:text-right mt-4 sm:mt-0">
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Resolved At</p>
										<p className="text-sm font-medium text-foreground">
											{new Date(viewReport.resolved_at).toLocaleString()}
										</p>
									</div>
								)}
							</div>

							{/* People Involved */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
									<div className="bg-blue-100 text-blue-600 p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reporter</p>
										<p className="font-medium text-foreground">{viewReport.reporter_name}</p>
										<p className="text-sm text-muted-foreground">{viewReport.reporter_email}</p>
									</div>
								</div>

								<div className="bg-danger/5 border border-danger/20 rounded-xl p-4 flex items-start gap-4">
									<div className="bg-danger/10 text-danger p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-danger uppercase tracking-wider mb-1">Reported User</p>
										<p className="font-medium text-foreground">{viewReport.reported_user_name}</p>
										<p className="text-sm text-muted-foreground">{viewReport.reported_user_email}</p>
									</div>
								</div>
							</div>

							{/* Complaint Details */}
							<div className="bg-muted/30 border border-border/50 rounded-xl p-5 space-y-4">
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</p>
									<p className="font-medium text-foreground text-lg">{viewReport.reason || "N/A"}</p>
								</div>
								{viewReport.description && (
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Detailed Description</p>
										<div className="bg-background border border-border p-4 rounded-lg text-sm text-foreground/80 whitespace-pre-wrap shadow-sm">
											{viewReport.description}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* ==============================================
			    FORM MODALS
			    ============================================== */}

			{/* Warn Modal */}
			{showWarnModal && warningReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => {
					if (!processing) {
						setShowWarnModal(false);
						setWarningReport(null);
						setWarnReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-2xl max-w-2xl w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center px-6 py-4 border-b border-border">
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
								className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none disabled:opacity-50"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						<div className="p-6 space-y-4">
							<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
								<p className="text-sm text-yellow-700 dark:text-yellow-500 leading-relaxed">
									<strong>Warning:</strong> You are about to send a warning to <strong>{warningReport.reported_user?.name || "N/A"}</strong> based on report <strong>{warningReport.userId}</strong>. This will notify the user about the violation.
								</p>
							</div>

							<div className="bg-muted/30 border border-border/50 rounded-xl p-4">
								<p className="text-sm font-semibold text-foreground mb-3">Report Details:</p>
								<div className="space-y-1 text-sm text-muted-foreground">
									<p><strong>Report ID:</strong> {warningReport.userId}</p>
									<p><strong>Reporter:</strong> {warningReport.reporter_name}</p>
									<p><strong>Reason:</strong> {warningReport.reason}</p>
								</div>
							</div>

							<div>
								<label htmlFor="warn-reason" className="block text-sm font-semibold text-foreground mb-2">
									Warning Reason <span className="text-danger">*</span>
								</label>
								<textarea
									id="warn-reason"
									value={warnReason}
									onChange={(e) => setWarnReason(e.target.value)}
									placeholder="Please provide a detailed reason for warning this user based on the report..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-2 text-xs text-muted-foreground">
									This reason will be included in the warning notification sent to the user.
								</p>
							</div>
						</div>

						<div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10 rounded-b-2xl">
							<button
								onClick={() => {
									if (!processing) {
										setShowWarnModal(false);
										setWarningReport(null);
										setWarnReason("");
									}
								}}
								disabled={processing}
								className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								onClick={handleConfirmWarn}
								disabled={processing || !warnReason.trim()}
								className="px-4 py-2 text-sm rounded-md bg-yellow-600 text-white hover:bg-yellow-700 transition-colors disabled:opacity-50 min-w-[140px]"
							>
								{processing ? "Processing..." : "Send Warning"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Restrict Modal */}
			{showRestrictModal && restrictingReport && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => {
					if (!processing) {
						setShowRestrictModal(false);
						setRestrictingReport(null);
						setRestrictionReason("");
						setRestrictionDays(null);
					}
				}}>
					<div className="bg-background border border-border rounded-2xl max-w-2xl w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center px-6 py-4 border-b border-border">
							<h2 className="text-xl font-semibold">Restrict Reported User</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingReport(null);
										setRestrictionReason("");
										setRestrictionDays(null);
									}
								}} 
								disabled={processing}
								className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none disabled:opacity-50"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						<div className="p-6 space-y-4">
							<div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
								<p className="text-sm text-orange-700 dark:text-orange-500 leading-relaxed">
									<strong>Warning:</strong> You are about to restrict <strong>{restrictingReport.reported_user?.name || "N/A"}</strong> based on report <strong>{restrictingReport.userId}</strong>. This will limit their account access.
								</p>
							</div>

							<div>
								<label htmlFor="restriction-duration" className="block text-sm font-semibold text-foreground mb-2">
									Restriction Duration <span className="text-danger">*</span>
								</label>
								<select
									id="restriction-duration"
									value={restrictionDays === null ? "" : restrictionDays}
									onChange={(e) => setRestrictionDays(e.target.value ? parseInt(e.target.value) : null)}
									className="w-full px-3 py-2 border border-border rounded-xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
									disabled={processing}
								>
									<option value="">Select duration...</option>
									<option value="1">1 Day</option>
									<option value="3">3 Days</option>
									<option value="7">7 Days</option>
									<option value="14">14 Days</option>
									<option value="30">30 Days</option>
									<option value="0">Permanent</option>
								</select>
							</div>

							<div>
								<label htmlFor="restriction-reason" className="block text-sm font-semibold text-foreground mb-2">
									Reason for Restriction <span className="text-danger">*</span>
								</label>
								<textarea
									id="restriction-reason"
									value={restrictionReason}
									onChange={(e) => setRestrictionReason(e.target.value)}
									placeholder="Please provide a detailed reason for restricting this user..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
									disabled={processing}
								/>
							</div>
						</div>

						<div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10 rounded-b-2xl">
							<button
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingReport(null);
										setRestrictionReason("");
										setRestrictionDays(null);
									}
								}}
								disabled={processing}
								className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								onClick={handleConfirmRestrict}
								disabled={processing || !restrictionReason.trim() || restrictionDays === null}
								className="px-4 py-2 text-sm rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50 min-w-[140px]"
							>
								{processing ? "Processing..." : "Confirm Restriction"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ==============================================
			    CONFIRMATION MODALS
			    ============================================== */}

			{/* Resolve Report Modal (Formerly "Delete" Action) */}
			{reportToResolve && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setReportToResolve(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Resolve Report</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to mark report <strong>{reportToResolve.userId}</strong> as resolved? This indicates the issue has been handled.
						</p>
						<div className="flex justify-end gap-3">
							<button disabled={processing} onClick={() => setReportToResolve(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button disabled={processing} onClick={executeResolve} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Resolve Report</button>
						</div>
					</div>
				</div>
			)}

			{/* Dismiss Report Modal */}
			{reportToDismiss && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setReportToDismiss(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Dismiss Report</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to dismiss report <strong>{reportToDismiss.userId}</strong>? Use this for false or invalid reports.
						</p>
						<div className="flex justify-end gap-3">
							<button disabled={processing} onClick={() => setReportToDismiss(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button disabled={processing} onClick={executeDismiss} className="px-4 py-2 text-sm rounded-md bg-danger text-white hover:bg-danger/90 transition-colors">Dismiss Report</button>
						</div>
					</div>
				</div>
			)}

			{/* Approve Back Job Modal */}
			{reportToApproveBackjob && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setReportToApproveBackjob(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Approve Back Job</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Approve back job for report <strong>{reportToApproveBackjob.userId}</strong>? This will reopen the job as free rework without additional payment.
						</p>
						<div className="flex justify-end gap-3">
							<button disabled={processing} onClick={() => setReportToApproveBackjob(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button disabled={processing} onClick={executeApproveBackjob} className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors">Approve Rework</button>
						</div>
					</div>
				</div>
			)}

			{/* Unrestrict User Modal */}
			{reportToUnrestrict && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setReportToUnrestrict(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Unrestrict User</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to unrestrict <strong>{reportToUnrestrict.reported_user?.name}</strong>? This will fully restore their platform access.
						</p>
						<div className="flex justify-end gap-3">
							<button disabled={processing} onClick={() => setReportToUnrestrict(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button disabled={processing} onClick={executeUnrestrict} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">Unrestrict User</button>
						</div>
					</div>
				</div>
			)}

			{/* Alert Feedback Modal (Danger for errors) */}
			{alertModal.show && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-danger" : ""}`}>
							{alertModal.title}
						</h2>
						<p className="text-muted-foreground text-sm mb-6">{alertModal.message}</p>
						<div className="flex justify-end">
							<button onClick={() => setAlertModal({ ...alertModal, show: false })} className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}