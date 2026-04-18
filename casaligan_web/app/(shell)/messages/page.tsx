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
	const pageSize = 10;

	// Modal States
	const [viewModal, setViewModal] = useState<any>(null);
	
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictingConversation, setRestrictingConversation] = useState<any>(null);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [processing, setProcessing] = useState(false);
	
	const [convoToUnrestrict, setConvoToUnrestrict] = useState<any>(null);
	const [convoToDelete, setConvoToDelete] = useState<any>(null);
	
	const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
		show: false, title: "", message: "", isError: false,
	});

	useEffect(() => {
		loadConversations();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	// Lock body scroll when any modal is open
	useEffect(() => {
		if (viewModal || showRestrictModal || convoToUnrestrict || convoToDelete || alertModal.show) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [viewModal, showRestrictModal, convoToUnrestrict, convoToDelete, alertModal.show]);

	async function loadConversations() {
		setLoading(true);
		const { data, error, count: total } = await getConversations(100, 0);
		
		if (error) {
			setAlertModal({ show: true, title: "Loading Error", message: error.message, isError: true });
		} else if (data) {
			const rows = data.map((convo: any) => {
				const participants = convo.conversation_participants || [];
				const employer = participants.find((p: any) => p.users?.active_role === "owner" || p.role === "owner");
				const worker = participants.find((p: any) => p.users?.active_role === "housekeeper" || p.role === "housekeeper");
				
				// Format user names
				const employerName = employer?.users 
					? `${employer.users.first_name || ''} ${employer.users.last_name || ''}`.trim() 
					: "N/A";
				const workerName = worker?.users 
					? `${worker.users.first_name || ''} ${worker.users.last_name || ''}`.trim() 
					: "N/A";
				
				return {
					id: convo.conversation_id,
					employer: employerName,
					employerId: employer?.users?.id,
					worker: workerName,
					workerId: worker?.users?.id,
					lastMessage: convo.last_message || "No messages yet",
					lastMessageAt: convo.last_message_at || convo.created_at,
					status: convo.status,
					isRestricted: convo.status === "restricted",
					participants: participants.map((p: any) => ({
						...p.users,
						user_id: p.users?.id,
						name: p.users ? `${p.users.first_name || ''} ${p.users.last_name || ''}`.trim() : 'N/A',
						role: p.users?.active_role || p.role,
						email: p.users?.email || 'N/A'
					})),
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
					if (new Date(r.lastMessageAt) < start) return false;
				} catch (e) { }
			}
			if (f?.endDate) {
				try {
					const end = new Date(f.endDate);
					if (new Date(r.lastMessageAt) > end) return false;
				} catch (e) { }
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
					participants: data.conversation_participants?.map((p: any) => ({
						...p.users,
						role: p.role || p.users?.active_role
					})) || [],
				});
			} else if (error) {
				setAlertModal({ show: true, title: "Error", message: `Error loading conversation: ${error.message}`, isError: true });
			}
		} else if (action === "restrict") {
			setRestrictingConversation(row);
			setRestrictionReason("");
			setShowRestrictModal(true);
		} else if (action === "unrestrict") {
			setConvoToUnrestrict(row);
		} else if (action === "delete") {
			setConvoToDelete(row);
		}
	};

	const handleConfirmRestrict = async () => {
		if (!restrictingConversation) return;
		
		if (!restrictionReason.trim()) {
			setAlertModal({ show: true, title: "Missing Information", message: "Please provide a reason for restricting this conversation.", isError: true });
			return;
		}

		setProcessing(true);
		const { error } = await restrictConversation(restrictingConversation.id, restrictionReason.trim());
		
		if (error) {
			setAlertModal({ show: true, title: "Restriction Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Conversation has been restricted successfully.", isError: false });
			setShowRestrictModal(false);
			setRestrictingConversation(null);
			setRestrictionReason("");
			await loadConversations();
		}
		setProcessing(false);
	};

	const executeUnrestrict = async () => {
		if (!convoToUnrestrict) return;
		const { error } = await unrestrictConversation(convoToUnrestrict.id);
		
		if (error) {
			setAlertModal({ show: true, title: "Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Conversation has been unrestricted successfully.", isError: false });
			await loadConversations();
		}
		setConvoToUnrestrict(null);
	};

	const executeDelete = async () => {
		if (!convoToDelete) return;
		const { error } = await deleteConversation(convoToDelete.id);
		
		if (error) {
			setAlertModal({ show: true, title: "Deletion Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Conversation has been deleted successfully.", isError: false });
			await loadConversations();
		}
		setConvoToDelete(null);
	};

	const handleFilterChange = useCallback((f: any) => setFilters(f), []);
	const handleSearch = useCallback((v: string) => setQuery(v), []);

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
						<SearchBar defaultValue={query} onSearch={handleSearch} placeholder="Search messages..." />
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
										<td className="px-4 py-3 text-sm text-foreground font-medium">{convo.employer}</td>
										<td className="px-4 py-3 text-sm text-foreground font-medium">{convo.worker}</td>
										<td className="px-4 py-3 text-sm">
											<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${
												convo.status === 'active' ? 'bg-green-100 text-green-800' :
												convo.status === 'restricted' ? 'bg-red-100 text-red-800' :
												'bg-gray-100 text-gray-800'
											}`}>
												{convo.status}
											</span>
										</td>
										<td className="px-4 py-3 text-sm text-right">
											<div className="inline-flex items-center gap-2">
												<button
													type="button"
													onClick={() => handleAction("view", convo)}
													title="View Conversation"
													className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tertiary/10 text-foreground hover:bg-tertiary/50 transition-colors"
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

			{/* ==============================================
			    PRETTIFIED VIEW CONVERSATION MODAL
			    ============================================== */}
			{viewModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewModal(null)}>
					<div 
						className="bg-background border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 text-primary rounded-lg">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
								</div>
								<div>
									<h2 className="text-lg font-semibold leading-tight">Conversation Details</h2>
									<p className="text-xs text-muted-foreground">ID: {viewModal.id}</p>
								</div>
							</div>
							<button onClick={() => setViewModal(null)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{/* Scrollable Content Body */}
						<div className="p-6 overflow-y-auto space-y-6">
							
							{/* Participants Section */}
							<div>
								<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Participants</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									{viewModal.participants?.map((participant: any, idx: number) => {
										// Assign specific colors based on role (employer = purple, worker = blue)
										const isOwner = participant.role === "owner";
										const iconBg = isOwner ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600";
										const badgeBg = isOwner ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800";
										
										return (
											<div key={idx} className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
												<div className={`p-2.5 rounded-full mt-1 ${iconBg}`}>
													<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
													</svg>
												</div>
												<div className="flex-1">
													<div className="flex items-center justify-between mb-1">
														<p className="font-medium text-foreground">{participant.first_name ? `${participant.first_name} ${participant.last_name}` : "N/A"}</p>
														<span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${badgeBg}`}>
															{participant.role || "User"}
														</span>
													</div>
													<p className="text-sm text-muted-foreground">{participant.email || "No email provided"}</p>
												</div>
											</div>
										);
									})}
								</div>
							</div>

							{/* Message Status Section */}
							<div className="bg-card border border-border rounded-xl p-5 shadow-sm">
								<div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 pb-4 border-b border-border/50">
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Conversation Status</p>
										<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
											viewModal.status === 'active' ? 'bg-green-100 text-green-800' :
											viewModal.status === 'restricted' ? 'bg-red-100 text-red-800' :
											'bg-gray-100 text-gray-800'
										}`}>
											{viewModal.status}
										</span>
									</div>
									<div className="text-left sm:text-right">
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Last Activity</p>
										<p className="text-sm font-medium text-foreground">
											{new Date(viewModal.lastMessageAt).toLocaleString(undefined, { 
												weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' 
											})}
										</p>
									</div>
								</div>
								
								<div>
									<p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Last Message Snapshot</p>
									<div className="bg-muted/30 p-4 rounded-lg border border-border/50 italic text-foreground/80">
										"{viewModal.lastMessage}"
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
			{/* ============================================== */}

			{/* Restrict Modal */}
			{showRestrictModal && restrictingConversation && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => {
					if (!processing) {
						setShowRestrictModal(false);
						setRestrictingConversation(null);
						setRestrictionReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-2xl max-w-2xl w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center px-6 py-4 border-b border-border">
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
								className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none disabled:opacity-50"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						<div className="p-6 space-y-4">
							<div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
								<p className="text-sm text-orange-700 dark:text-orange-500 leading-relaxed">
									<strong>Warning:</strong> You are about to restrict a conversation between <strong>{restrictingConversation.employer}</strong> and <strong>{restrictingConversation.worker}</strong>. This will prevent further messages from being sent in this thread.
								</p>
							</div>

							<div>
								<label htmlFor="restriction-reason" className="block text-sm font-semibold text-foreground mb-2">
									Reason for Restriction <span className="text-red-500">*</span>
								</label>
								<textarea
									id="restriction-reason"
									value={restrictionReason}
									onChange={(e) => setRestrictionReason(e.target.value)}
									placeholder="Please provide a detailed reason for restricting this conversation..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-2 text-xs text-muted-foreground">
									This reason will be recorded for administrative and moderation purposes.
								</p>
							</div>
						</div>

						<div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10 rounded-b-2xl">
							<button
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingConversation(null);
										setRestrictionReason("");
									}
								}}
								disabled={processing}
								className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button
								onClick={handleConfirmRestrict}
								disabled={processing || !restrictionReason.trim()}
								className="px-4 py-2 text-sm rounded-md bg-orange-600 text-white hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px]"
							>
								{processing ? "Processing..." : "Confirm Restriction"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Unrestrict Confirm Modal */}
			{convoToUnrestrict && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConvoToUnrestrict(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Confirm Action</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to <strong>unrestrict</strong> this conversation? The users will be able to message each other again.
						</p>
						<div className="flex justify-end gap-3">
							<button onClick={() => setConvoToUnrestrict(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button onClick={executeUnrestrict} className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">Unrestrict</button>
						</div>
					</div>
				</div>
			)}

			{/* Delete Confirm Modal */}
			{convoToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setConvoToDelete(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to delete this conversation completely? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button onClick={() => setConvoToDelete(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button onClick={executeDelete} className="px-4 py-2 text-sm rounded-md bg-danger text-destructive-foreground hover:bg-danger/90 transition-colors">Delete</button>
						</div>
					</div>
				</div>
			)}

			{/* Alert Feedback Modal */}
			{alertModal.show && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-destructive" : ""}`}>{alertModal.title}</h2>
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