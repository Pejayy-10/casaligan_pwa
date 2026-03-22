"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SearchBar } from "@/app/components/SearchBar";
import FilterBar from "@/app/components/FilterBar";

export default function JobsPage() {
	const [jobs, setJobs] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<any>({});
	const [page, setPage] = useState(1);
	const pageSize = 10;
	const supabase = createClient();

	useEffect(() => {
		loadJobs();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	async function loadJobs() {
		setLoading(true);
		const { data, error } = await supabase
			.from("forumposts")
			.select(`
				post_id,
				title,
				description,
				category,
				status,
				created_at,
				employers (
					users (
						name,
						email
					)
				)
			`)
			.order("created_at", { ascending: false });

		if (data) {
			const rows = data.map((job: any) => ({
				id: job.post_id,
				title: job.title || "Untitled",
				postedBy: job.employers?.users?.name || "N/A",
				postedByEmail: job.employers?.users?.email || "N/A",
				date: job.created_at,
				status: job.status || "open",
				description: job.description || "No description provided",
				category: job.category || "N/A",
			}));
			setJobs(rows);
		}
		setLoading(false);
	}

	function filterRows(rows: any[], q: string, f: any) {
		const search = (q || "").trim().toLowerCase();
		return rows.filter((r) => {
			if (search) {
				const hay = `${r.title} ${r.postedBy}`.toLowerCase();
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

	const filtered = filterRows(jobs, query, filters);
	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const pagedJobs = filtered.slice((page - 1) * pageSize, page * pageSize);

	const [selectedJob, setSelectedJob] = useState<any>(null);
	const [showModal, setShowModal] = useState(false);

	const handleAction = async (action: "view" | "delete", row: any) => {
		if (action === "view") {
			setSelectedJob(row);
			setShowModal(true);
		} else if (action === "delete") {
			if (confirm(`Are you sure you want to delete the job post "${row.title}"?`)) {
				const { error } = await supabase
					.from("forumposts")
					.delete()
					.eq("post_id", row.id);
				
				if (error) {
					alert(`Error deleting job post: ${error.message}`);
				} else {
					alert(`Job post "${row.title}" has been deleted successfully.`);
					await loadJobs();
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

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
				<div className="text-center py-12">Loading job posts...</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h2 className="text-lg font-semibold">Job Posts</h2>
				<p className="text-sm text-muted-foreground">List of job postings and their statuses. Total: {jobs.length}</p>
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
						<div className="text-sm text-muted-foreground">Showing {pagedJobs.length} of {filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full table-auto">
							<thead>
								<tr className="bg-muted/10">
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Job Title</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Posted By</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date Posted</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
									<th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-muted/20">
								{pagedJobs.map((job, i) => (
									<tr key={job.id} className={`${i % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
										<td className="px-4 py-3 text-sm text-foreground">{job.title}</td>
										<td className="px-4 py-3 text-sm text-foreground">{job.postedBy}</td>
										<td className="px-4 py-3 text-sm text-foreground">{new Date(job.date).toLocaleDateString()}</td>
										<td className="px-4 py-3 text-sm">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													job.status === 'open' ? 'bg-green-100 text-green-800' :
													job.status === 'closed' ? 'bg-red-100 text-red-800' :
													'bg-gray-100 text-gray-800'
												}`}
											>
												{job.status}
											</span>
										</td>
									<td className="px-4 py-3 text-sm text-right">
										<div className="inline-flex items-center gap-2">
											<button
												type="button"
												onClick={() => handleAction("view", job)}
												title="View"
												className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tertiary/10 text-foreground hover:bg-tertiary/50 transition-colors"
											>
												<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
													<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
												</svg>
											</button>
											<button
												type="button"
												onClick={() => handleAction("delete", job)}
												title="Delete Job Post"
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

					{pagedJobs.length === 0 && (
						<div className="text-center py-12 text-muted-foreground">
							No job posts found
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

			{showModal && selectedJob && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Job Post Details</h2>
							<button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">✕</button>
						</div>

						<div className="space-y-3">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Job Title</p>
									<p className="font-medium">{selectedJob.title}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Posted By</p>
									<p className="font-medium">{selectedJob.postedBy}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Category</p>
									<p className="font-medium">{selectedJob.category}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										selectedJob.status === 'open' ? 'bg-green-100 text-green-800' :
										selectedJob.status === 'closed' ? 'bg-red-100 text-red-800' :
										'bg-gray-100 text-gray-800'
									}`}>
										{selectedJob.status}
									</span>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Date Posted</p>
									<p className="font-medium">{new Date(selectedJob.date).toLocaleDateString()}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Email</p>
									<p className="font-medium">{selectedJob.postedByEmail}</p>
								</div>
							</div>
							<div>
								<p className="text-sm text-muted-foreground">Description</p>
								<p className="font-medium whitespace-pre-wrap mt-1">{selectedJob.description}</p>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


