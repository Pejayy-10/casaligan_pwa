"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SearchBar } from "@/app/components/SearchBar";
import FilterBar from "@/app/components/FilterBar";
import { Eye, Trash2, Briefcase, User, Calendar, FileText, CheckCircle2, XCircle, X } from "lucide-react";

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
    
    // New Modal States
    const [jobToDelete, setJobToDelete] = useState<any>(null);
    const [processing, setProcessing] = useState(false);
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
        show: false,
        title: "",
        message: "",
        isError: false,
    });

    // Lock body scroll when any modal is open
    useEffect(() => {
        if (showModal || jobToDelete || alertModal.show) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        
        // Cleanup on unmount
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [showModal, jobToDelete, alertModal.show]);

    const handleAction = async (action: "view" | "delete", row: any) => {
        if (action === "view") {
            setSelectedJob(row);
            setShowModal(true);
        } else if (action === "delete") {
            setJobToDelete(row); // Triggers custom confirm modal
        }
    };

    const executeDelete = async () => {
        if (!jobToDelete) return;
        setProcessing(true);

        const { error } = await supabase
            .from("forumposts")
            .delete()
            .eq("post_id", jobToDelete.id);
        
        if (error) {
            setAlertModal({
                show: true,
                title: "Error Deleting Post",
                message: error.message,
                isError: true,
            });
        } else {
            setAlertModal({
                show: true,
                title: "Success",
                message: `Job post "${jobToDelete.title}" has been deleted successfully.`,
                isError: false,
            });
            await loadJobs();
        }
        setProcessing(false);
        setJobToDelete(null); // Close confirm modal
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
                <div className="text-center py-12 text-muted-foreground">Loading job posts...</div>
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
                                        <td className="px-4 py-3 text-sm text-foreground font-medium">{job.title}</td>
                                        <td className="px-4 py-3 text-sm text-foreground">{job.postedBy}</td>
                                        <td className="px-4 py-3 text-sm text-foreground">{new Date(job.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-sm">
                                            <span
                                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
                                                    title="View Details"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tertiary/10 text-foreground hover:bg-tertiary/50 transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleAction("delete", job)}
                                                    title="Delete Job Post"
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-danger hover:bg-danger/30 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {/* ==============================================
                PRETTIFIED VIEW DETAILS MODAL
                ============================================== */}
            {showModal && selectedJob && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowModal(false)}>
                    <div 
                        className="bg-background border border-border rounded-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Briefcase className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-semibold leading-tight">Job Post Details</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
                            
                            {/* Title & Status Card */}
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 bg-card border border-border rounded-xl p-5 shadow-sm">
                                <div className="flex-1">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Job Title</p>
                                    <h3 className="text-2xl font-bold text-foreground leading-tight mb-2">{selectedJob.title}</h3>
                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                        {selectedJob.category}
                                    </span>
                                </div>
                                <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                        selectedJob.status === 'open' ? 'bg-green-100 text-green-800' :
                                        selectedJob.status === 'closed' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {selectedJob.status}
                                    </span>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-3">
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-full mt-1 shrink-0">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Posted By</p>
                                        <p className="font-medium text-foreground truncate">{selectedJob.postedBy}</p>
                                        <p className="text-sm text-muted-foreground truncate">{selectedJob.postedByEmail}</p>
                                    </div>
                                </div>

                                <div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-3">
                                    <div className="bg-purple-100 text-purple-600 p-2 rounded-full mt-1 shrink-0">
                                        <Calendar className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date Posted</p>
                                        <p className="font-medium text-foreground">
                                            {new Date(selectedJob.date).toLocaleDateString(undefined, { 
                                                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
                                            })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Description Block */}
                            <div className="bg-muted/30 border border-border/50 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                                    <FileText className="w-4 h-4 text-muted-foreground" />
                                    <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">Description</h4>
                                </div>
                                <div className="bg-background border border-border p-4 rounded-lg text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-sm">
                                    {selectedJob.description}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end shrink-0 rounded-b-2xl">
                            <button 
                                onClick={() => setShowModal(false)} 
                                className="px-4 py-2 text-sm font-medium bg-background border border-border text-foreground rounded-md hover:bg-muted/50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================
                CONFIRMATION & FEEDBACK MODALS
                ============================================== */}

            {/* Confirmation Delete Modal */}
            {jobToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setJobToDelete(null)}>
                    <div 
                        className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
                        <p className="text-muted-foreground text-sm mb-6">
                            Are you sure you want to delete the job post <span className="font-semibold text-foreground">"{jobToDelete.title}"</span>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                disabled={processing}
                                onClick={() => setJobToDelete(null)}
                                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                disabled={processing}
                                onClick={executeDelete}
                                className="px-4 py-2 text-sm rounded-md bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
                            >
                                {processing ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert Feedback Modal (Danger for errors) */}
            {alertModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
                    <div 
                        className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4 ${alertModal.isError ? 'bg-danger/10' : 'bg-green-100'}`}>
                            {alertModal.isError 
                                ? <XCircle className="h-6 w-6 text-danger" /> 
                                : <CheckCircle2 className="h-6 w-6 text-green-600" />
                            }
                        </div>
                        <h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-danger" : ""}`}>
                            {alertModal.title}
                        </h2>
                        <p className="text-muted-foreground text-sm mb-6">{alertModal.message}</p>
                        <button 
                            onClick={() => setAlertModal({ ...alertModal, show: false })}
                            className="w-full px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}