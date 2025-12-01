"use client";

import { useState, useEffect, useCallback } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import FilterBar from "@/app/components/FilterBar";
import { getConversations, getConversationDetails, restrictConversation, unrestrictConversation, deleteConversation } from "@/lib/supabase/messageQueries";

export default function MessagesPage() {
	const [conversations, setConversations] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<any>({});
	const [page, setPage] = useState(1);
	const [count, setCount] = useState(0);
	const [viewModal, setViewModal] = useState<any>(null);
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictingConversation, setRestrictingConversation] = useState<any>(null);
	const [processing, setProcessing] = useState(false);
	const pageSize = 10;

	useEffect(() => {
		loadConversations();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	async function loadConversations() {
		setLoading(true);
		const { data, error, count: total } = await getConversations(100, 0);
		
		if (data) {
			const rows = data.map((convo: any) => {
				const participants = convo.conversation_participants || [];
				const employer = participants.find((p: any) => p.users?.role === "employer");
				const worker = participants.find((p: any) => p.users?.role === "worker");
				
				return {
					id: convo.conversation_id,
					employer: employer?.users?.name || "N/A",
					employerId: employer?.users?.user_id,
					worker: worker?.users?.name || "N/A",
					workerId: worker?.users?.user_id,
					lastMessage: convo.last_message || "No messages yet",
					lastMessageAt: convo.last_message_at || convo.created_at,
					status: convo.status,
					isRestricted: convo.status === "restricted",
					participants: participants.map((p: any) => p.users),
				};
			});
			setConversations(rows);
			setCount(total || 0);
		}
		setLoading(false);
	}

	function filterRows(rows: any[], q: string, f: any) {
		const search = (q || "").trim().toLowerCase();
		return rows.filter((r) => {
			if (search) {
				const hay = `${r.employer} ${r.worker} ${r.lastMessage}`.toLowerCase();
				if (!hay.includes(search)) return false;
			}

			if (f?.status) {
				if (String(r.status).toLowerCase() !== String(f.status).toLowerCase()) return false;
			}

			if (f?.startDate) {
				try {
					const start = new Date(f.startDate);
					const rd = new Date(r.lastMessageAt);
					if (rd < start) return false;
				} catch (e) {
					// ignore
				}
			}

			if (f?.endDate) {
				try {
					const end = new Date(f.endDate);
					const rd = new Date(r.lastMessageAt);
					if (rd > end) return false;
				} catch (e) {
					// ignore
				}
			}

			return true;
		});
	}

	const filtered = filterRows(conversations, query, filters);
	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const pagedConversations = filtered.slice((page - 1) * pageSize, page * pageSize);

	const handleAction = async (action: "view" | "restrict" | "unrestrict" | "delete", row: any) => {
		if (action === "view") {
			const { data, error } = await getConversationDetails(row.id);
			if (data) {
				setViewModal({
					...row,
					participants: data.conversation_participants?.map((p: any) => p.users) || [],
				});
			} else if (error) {
				alert(`Error loading conversation: ${error.message}`);
			}
		} else if (action === "restrict") {
			setRestrictingConversation(row);
			setRestrictionReason("");
			setShowRestrictModal(true);
		} else if (action === "unrestrict") {
			if (confirm(`Are you sure you want to unrestrict this conversation?`)) {
				const { error } = await unrestrictConversation(row.id);
				
				if (error) {
					alert(`Error unrestricting conversation: ${error.message}`);
				} else {
					alert(`Conversation has been unrestricted successfully.`);
					await loadConversations();
				}
			}
		} else if (action === "delete") {
			if (confirm(`Are you sure you want to delete this conversation? This action cannot be undone.`)) {
				const { error } = await deleteConversation(row.id);
				
				if (error) {
					alert(`Error deleting conversation: ${error.message}`);
				} else {
					alert(`Conversation has been deleted successfully.`);
					await loadConversations();
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

	const handleConfirmRestrict = async () => {
		if (!restrictingConversation) return;
		
		if (!restrictionReason.trim()) {
			alert("Please provide a reason for restricting this conversation.");
			return;
		}

		setProcessing(true);
		const { error } = await restrictConversation(restrictingConversation.id, restrictionReason.trim());
		
		if (error) {
			alert(`Error restricting conversation: ${error.message}`);
			setProcessing(false);
		} else {
			alert(`Conversation has been restricted successfully.`);
			setShowRestrictModal(false);
			setRestrictingConversation(null);
			setRestrictionReason("");
			setProcessing(false);
			await loadConversations();
		}
	};

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
				<div className="text-center py-12">Loading conversations...</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h2 className="text-lg font-semibold">Messages</h2>
				<p className="text-sm text-muted-foreground">Manage conversations between employers and workers. Total: {count} conversations</p>
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
						<div className="text-sm text-muted-foreground">Showing {pagedConversations.length} of {filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full table-auto">
							<thead>
								<tr className="bg-muted/10">
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Employer</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Worker</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
									<th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-muted/20">
								{pagedConversations.map((convo, i) => (
									<tr key={convo.id} className={`${i % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
										<td className="px-4 py-3 text-sm text-foreground">{convo.employer}</td>
										<td className="px-4 py-3 text-sm text-foreground">{convo.worker}</td>
										<td className="px-4 py-3 text-sm">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													convo.status === 'active' ? 'bg-green-100 text-green-800' :
													convo.status === 'restricted' ? 'bg-red-100 text-red-800' :
													'bg-gray-100 text-gray-800'
												}`}
											>
												{convo.status}
											</span>
										</td>
										<td className="px-4 py-3 text-sm text-right">
											<div className="inline-flex items-center gap-2">
												<button
													type="button"
													onClick={() => handleAction("view", convo)}
													title="View Conversation"
													className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/30 transition-colors"
												>
													<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
													</svg>
												</button>
												{convo.isRestricted ? (
													<button
														type="button"
														onClick={() => handleAction("unrestrict", convo)}
														title="Unrestrict Conversation"
														className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/30 transition-colors"
													>
														<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
													</button>
												) : (
													<button
														type="button"
														onClick={() => handleAction("restrict", convo)}
														title="Restrict Conversation"
														className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-orange-500/10 text-orange-600 hover:bg-orange-500/30 transition-colors"
													>
														<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
														</svg>
													</button>
												)}
												<button
													type="button"
													onClick={() => handleAction("delete", convo)}
													title="Delete Conversation"
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

					{pagedConversations.length === 0 && (
						<div className="text-center py-12 text-muted-foreground">
							No conversations found
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

			{/* Restriction Modal */}
			{showRestrictModal && restrictingConversation && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowRestrictModal(false);
						setRestrictingConversation(null);
						setRestrictionReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Restrict Conversation</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingConversation(null);
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
									<strong>Warning:</strong> You are about to restrict a conversation between <strong>{restrictingConversation.employer}</strong> and <strong>{restrictingConversation.worker}</strong>. This will prevent further messages in this conversation.
								</p>
							</div>

							<div>
								<label htmlFor="restriction-reason" className="block text-sm font-medium text-foreground mb-2">
									Reason for Restriction <span className="text-red-500">*</span>
								</label>
								<textarea
									id="restriction-reason"
									value={restrictionReason}
									onChange={(e) => setRestrictionReason(e.target.value)}
									placeholder="Please provide a detailed reason for restricting this conversation..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									This reason will be recorded for administrative purposes.
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
										setRestrictingConversation(null);
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

			{/* View Modal */}
			{viewModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewModal(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-semibold">Conversation Details</h3>
							<button
								type="button"
								onClick={() => setViewModal(null)}
								className="text-muted-foreground hover:text-foreground"
							>
								<svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div className="space-y-4">
							<div>
								<label className="text-sm font-medium text-muted-foreground">Participants</label>
								<div className="mt-1 space-y-2">
									{viewModal.participants?.map((participant: any) => (
										<div key={participant.user_id} className="flex items-center justify-between p-2 bg-muted rounded-md">
											<div>
												<p className="text-sm font-medium">{participant.name}</p>
												<p className="text-xs text-muted-foreground">{participant.email}</p>
											</div>
											<span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
												{participant.role}
											</span>
										</div>
									))}
								</div>
							</div>

							<div>
								<label className="text-sm font-medium text-muted-foreground">Last Message</label>
								<p className="mt-1 text-sm p-3 bg-muted rounded-md">
									{viewModal.lastMessage}
								</p>
							</div>

							<div>
								<label className="text-sm font-medium text-muted-foreground">Status</label>
								<p className="mt-1 text-sm">
									<span
										className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
											viewModal.status === 'active' ? 'bg-green-100 text-green-800' :
											viewModal.status === 'restricted' ? 'bg-red-100 text-red-800' :
											'bg-gray-100 text-gray-800'
										}`}
									>
										{viewModal.status}
									</span>
								</p>
							</div>

							<div>
								<label className="text-sm font-medium text-muted-foreground">Last Activity</label>
								<p className="mt-1 text-sm text-muted-foreground">
									{new Date(viewModal.lastMessageAt).toLocaleString()}
								</p>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
