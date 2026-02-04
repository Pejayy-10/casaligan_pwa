"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SearchBar } from "@/app/components/SearchBar";
import FilterBar from "@/app/components/FilterBar";
import { ShieldAlert } from "lucide-react";
import { getReviews, hideReview, unhideReview, warnReviewer, restrictReviewer, unrestrictReviewer, deleteReview } from "@/lib/supabase/reviewQueries";

export default function ReviewsPage() {
	const [reviews, setReviews] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<any>({});
	const [page, setPage] = useState(1);
	const [count, setCount] = useState(0);
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictingReview, setRestrictingReview] = useState<any>(null);
	const [showWarnModal, setShowWarnModal] = useState(false);
	const [warnReason, setWarnReason] = useState("");
	const [warningReview, setWarningReview] = useState<any>(null);
	const [processing, setProcessing] = useState(false);
	const pageSize = 10;
	const supabase = createClient();

	useEffect(() => {
		loadReviews();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	async function loadReviews() {
		setLoading(true);
		const { data, error, count: total } = await getReviews(100, 0);
		
		if (data) {
			const rows = data.map((review: any) => ({
				id: review.review_id,
				reviewer: review.reviewer?.name || "N/A",
				reviewerEmail: review.reviewer?.email || "N/A",
				reviewerRole: review.reviewer?.role || "N/A",
				reviewerId: review.reviewer?.user_id,
				reviewerStatus: review.reviewer?.status,
				target: review.target?.name || "N/A",
				targetEmail: review.target?.email || "N/A",
				targetRole: review.target?.role || "N/A",
				targetId: review.target?.user_id,
				rating: review.rating,
				feedback: review.comment || "No comment provided",
				date: review.created_at,
				isHidden: review.is_hidden,
				status: review.is_hidden ? "hidden" : "visible",
			}));
			setReviews(rows);
			setCount(total || 0);
		}
		setLoading(false);
	}

	function filterRows(rows: any[], q: string, f: any) {
		const search = (q || "").trim().toLowerCase();
		return rows.filter((r) => {
			if (search) {
				const hay = `${r.reviewer} ${r.target} ${r.feedback}`.toLowerCase();
				if (!hay.includes(search)) return false;
			}

			if (f?.status) {
				if (String(r.status).toLowerCase() !== String(f.status).toLowerCase()) return false;
			}

			if (f?.startDate) {
				try {
					const start = new Date(f.startDate);
					const rd = new Date(r.date);
					if (rd < start) return false;
				} catch (e) {
					// ignore
				}
			}

			if (f?.endDate) {
				try {
					const end = new Date(f.endDate);
					const rd = new Date(r.date);
					if (rd > end) return false;
				} catch (e) {
					// ignore
				}
			}

			return true;
		});
	}

	const filtered = filterRows(reviews, query, filters);
	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const pagedReviews = filtered.slice((page - 1) * pageSize, page * pageSize);

	const handleAction = async (action: "hide" | "unhide" | "warn" | "restrict" | "unrestrict" | "delete", row: any) => {
		if (action === "hide") {
			if (confirm(`Are you sure you want to hide this review?`)) {
				const { error } = await hideReview(row.id);
				
				if (error) {
					alert(`Error hiding review: ${error.message}`);
				} else {
					alert(`Review has been hidden successfully.`);
					await loadReviews();
				}
			}
		} else if (action === "unhide") {
			if (confirm(`Are you sure you want to unhide this review?`)) {
				const { error } = await unhideReview(row.id);
				
				if (error) {
					alert(`Error unhiding review: ${error.message}`);
				} else {
					alert(`Review has been unhidden successfully.`);
					await loadReviews();
				}
			}
		} else if (action === "warn") {
			setWarningReview(row);
			setWarnReason("");
			setShowWarnModal(true);
		} else if (action === "restrict") {
			setRestrictingReview(row);
			setRestrictionReason("");
			setShowRestrictModal(true);
		} else if (action === "unrestrict") {
			if (confirm(`Are you sure you want to unrestrict ${row.reviewer}? This will restore their account access.`)) {
				const { error } = await unrestrictReviewer(row.id, row.reviewerId);
				
				if (error) {
					alert(`Error unrestricting reviewer: ${error.message}`);
				} else {
					alert(`${row.reviewer} has been unrestricted successfully.`);
					await loadReviews();
				}
			}
		} else if (action === "delete") {
			if (confirm(`Are you sure you want to delete this review? This action cannot be undone.`)) {
				const { error } = await deleteReview(row.id);
				
				if (error) {
					alert(`Error deleting review: ${error.message}`);
				} else {
					alert(`Review has been deleted successfully.`);
					await loadReviews();
				}
			}
		}
	};

	const handleFilterChange = useCallback((f: any) => {
		setFilters(f);
	}, []);

	const handleSearch = useCallback((v: string) => {
		setQuery(v);
	}, []);

	const handleConfirmWarn = async () => {
		if (!warningReview) return;
		
		if (!warnReason.trim()) {
			alert("Please provide a reason for warning this reviewer.");
			return;
		}

		setProcessing(true);
		const { error } = await warnReviewer(warningReview.id, warnReason.trim());
		
		if (error) {
			alert(`Error warning reviewer: ${error.message}`);
			setProcessing(false);
		} else {
			alert(`${warningReview.reviewer} has been warned successfully.`);
			setShowWarnModal(false);
			setWarningReview(null);
			setWarnReason("");
			setProcessing(false);
			await loadReviews();
		}
	};

	const handleConfirmRestrict = async () => {
		if (!restrictingReview) return;
		
		if (!restrictionReason.trim()) {
			alert("Please provide a reason for restricting this reviewer.");
			return;
		}

		setProcessing(true);
		const { error } = await restrictReviewer(restrictingReview.id, restrictingReview.reviewerId, restrictionReason.trim());
		
		if (error) {
			alert(`Error restricting reviewer: ${error.message}`);
			setProcessing(false);
		} else {
			alert(`${restrictingReview.reviewer} has been restricted successfully.`);
			setShowRestrictModal(false);
			setRestrictingReview(null);
			setRestrictionReason("");
			setProcessing(false);
			await loadReviews();
		}
	};

	const renderStars = (rating: number) => {
		return (
			<div className="flex items-center gap-1">
				{[1, 2, 3, 4, 5].map((star) => (
					<svg
						key={star}
						className={`h-4 w-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
						viewBox="0 0 20 20"
					>
						<path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
					</svg>
				))}
				<span className="ml-1 text-sm font-medium">{rating}/5</span>
			</div>
		);
	};

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
				<div className="text-center py-12">Loading reviews...</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h2 className="text-lg font-semibold">Reviews</h2>
				<p className="text-sm text-muted-foreground">Manage user reviews and ratings. Total: {count} reviews</p>
			</div>

			<div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="w-full md:w-80">
						<SearchBar defaultValue={query} onSearch={handleSearch} />
					</div>

					<div className="w-full md:w-auto">
						<FilterBar onChange={handleFilterChange} />
					</div>
				</div>

				<div className="rounded-2xl border border-border bg-muted p-4">
					<div className="mb-3 flex items-center justify-between">
						<div className="text-sm text-muted-foreground">Showing {pagedReviews.length} of {filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full table-auto">
							<thead>
								<tr className="bg-muted/10">
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Reviewer</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Target</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Rating</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Feedback</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
									<th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-muted/20">
								{pagedReviews.map((review, i) => (
									<tr key={review.id} className={`${i % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
										<td className="px-4 py-3 text-sm text-foreground">{review.reviewer}</td>
										<td className="px-4 py-3 text-sm text-foreground">{review.target}</td>
										<td className="px-4 py-3 text-sm">{renderStars(review.rating)}</td>
										<td className="px-4 py-3 text-sm text-foreground max-w-xs truncate">{review.feedback}</td>
										<td className="px-4 py-3 text-sm text-foreground">{new Date(review.date).toLocaleDateString()}</td>
										<td className="px-4 py-3 text-sm">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													review.status === 'visible' ? 'bg-green-100 text-green-800' :
													'bg-gray-100 text-gray-800'
												}`}
											>
												{review.status}
											</span>
										</td>
										<td className="px-4 py-3 text-sm text-right">
											<div className="inline-flex items-center gap-2">
												{review.isHidden ? (
													<button
														type="button"
														onClick={() => handleAction("unhide", review)}
														title="Unhide Review"
														className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/30 transition-colors"
													>
														<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
														</svg>
													</button>
												) : (
													<button
														type="button"
														onClick={() => handleAction("hide", review)}
														title="Hide Review"
														className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-500/10 text-gray-600 hover:bg-gray-500/30 transition-colors"
													>
														<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
														</svg>
													</button>
												)}
												<button
													type="button"
													onClick={() => handleAction("warn", review)}
													title="Warn Reviewer"
													className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/30 transition-colors"
												>
													<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
													</svg>
												</button>
											{review.reviewerStatus === 'restricted' ? (
												<button
													type="button"
													onClick={() => handleAction("unrestrict", review)}
													title="Unrestrict Reviewer"
													className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/30 transition-colors"
												>
													<ShieldAlert className="h-4 w-4" />
												</button>
											) : (
												<button
													type="button"
													onClick={() => handleAction("restrict", review)}
													title="Restrict Reviewer"
													className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/30 transition-colors"
												>
													<ShieldAlert className="h-4 w-4" />
												</button>
											)}
											<button
													type="button"
													onClick={() => handleAction("delete", review)}
													title="Delete Review"
													className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-destructive hover:bg-danger/50 transition-colors"
												>
													<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{pagedReviews.length === 0 && (
						<div className="text-center py-12 text-muted-foreground">
							No reviews found
						</div>
					)}
				</div>

				<div className="mt-3 flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}
						className={`rounded-md px-3 py-1 text-sm border border-border ${page <= 1 ? "text-muted-foreground bg-muted/10" : "bg-muted/5 hover:bg-muted/10"}`}
					>
						Previous
					</button>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
						disabled={page >= totalPages}
						className={`rounded-md px-3 py-1 text-sm border border-border ${page >= totalPages ? "text-muted-foreground bg-muted/10" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
					>
						Next
					</button>
					<div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
				</div>
			</div>

			{/* Warn Modal */}
			{showWarnModal && warningReview && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowWarnModal(false);
						setWarningReview(null);
						setWarnReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Warn Reviewer</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowWarnModal(false);
										setWarningReview(null);
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
									<strong>Warning:</strong> You are about to send a warning to <strong>{warningReview.reviewer}</strong> (Reviewer). This will notify them about the violation in their review.
								</p>
							</div>

							<div className="bg-muted/50 border border-border rounded-lg p-4">
								<p className="text-sm font-medium text-foreground mb-2">Review Details:</p>
								<div className="space-y-1 text-sm text-muted-foreground">
									<p><strong>Reviewer:</strong> {warningReview.reviewer}</p>
									<p><strong>Target:</strong> {warningReview.target}</p>
									<p><strong>Rating:</strong> {warningReview.rating}/5</p>
									<p><strong>Feedback:</strong> {warningReview.feedback}</p>
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
									placeholder="Please provide a detailed reason for warning this reviewer..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									This reason will be included in the warning notification sent to the reviewer and recorded with the review.
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
										setWarningReview(null);
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
			{showRestrictModal && restrictingReview && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowRestrictModal(false);
						setRestrictingReview(null);
						setRestrictionReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Restrict Reviewer</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingReview(null);
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
									<strong>Warning:</strong> You are about to restrict <strong>{restrictingReview.reviewer}</strong> (Reviewer). This will limit their account access and mark this review as the reason for restriction.
								</p>
							</div>

							<div className="bg-muted/50 border border-border rounded-lg p-4">
								<p className="text-sm font-medium text-foreground mb-2">Review Details:</p>
								<div className="space-y-1 text-sm text-muted-foreground">
									<p><strong>Reviewer:</strong> {restrictingReview.reviewer}</p>
									<p><strong>Target:</strong> {restrictingReview.target}</p>
									<p><strong>Rating:</strong> {restrictingReview.rating}/5</p>
									<p><strong>Feedback:</strong> {restrictingReview.feedback}</p>
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
									placeholder="Please provide a detailed reason for restricting this reviewer..."
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
										setRestrictingReview(null);
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
		</div>
	);
}
