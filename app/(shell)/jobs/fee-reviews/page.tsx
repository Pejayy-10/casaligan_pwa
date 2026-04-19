"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SearchBar } from "@/app/components/SearchBar";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type FeeRow = {
  id: number;
  title: string;
  category: string;
  postedBy: string;
  postedByEmail: string;
  date: string;
  status: string;
  platformFeeTotal: number;
  platformFeeStatus: string;
  platformFeePaidAt: string | null;
  platformFeePaymentRef: string | null;
  adminReviewStatus: string;
  adminReviewedAt: string | null;
};

type ModalType = "approve" | "reject" | null;

export default function JobFeeReviewsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal States
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedRow, setSelectedRow] = useState<FeeRow | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRows();
  }, []);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setPage(1);
  }, [query]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [activeModal]);

  async function loadRows() {
    setLoading(true);

    const { data: baseData, error: baseError } = await supabase
      .from("forumposts")
      .select(`
        post_id,
        title,
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

    if (baseError) {
      console.error("Failed to load fee review base data:", baseError);
      alert(`Failed to load job fee reviews: ${baseError.message}`);
      setRows([]);
      setLoading(false);
      return;
    }

    const baseRows: FeeRow[] = (baseData || []).map((job: any) => ({
      id: job.post_id,
      title: job.title || "Untitled",
      category: job.category || "N/A",
      postedBy: job.employers?.users?.name || "N/A",
      postedByEmail: job.employers?.users?.email || "N/A",
      date: job.created_at,
      status: job.status || "open",
      platformFeeTotal: 0,
      platformFeeStatus: "pending",
      platformFeePaidAt: null,
      platformFeePaymentRef: null,
      adminReviewStatus: "pending",
      adminReviewedAt: null,
    }));

    const { data: feeData, error: feeError } = await supabase
      .from("forumposts")
      .select(`
        post_id,
        platform_fee_total,
        platform_fee_status,
        platform_fee_paid_at,
        platform_fee_payment_ref,
        admin_review_status,
        admin_reviewed_at
      `);

    if (feeError) {
      if (feeError.code === "42703") {
        setSchemaReady(false);
        setRows(baseRows);
        setLoading(false);
        return;
      }

      console.error("Failed to load fee review columns:", feeError);
      alert(`Failed to load fee columns: ${feeError.message}`);
      setRows(baseRows);
      setLoading(false);
      return;
    }

    const feeById = new Map<number, any>();
    (feeData || []).forEach((row: any) => feeById.set(row.post_id, row));

    const mergedRows = baseRows.map((row) => {
      const fee = feeById.get(row.id);
      return {
        ...row,
        platformFeeTotal: Number(fee?.platform_fee_total || 0),
        platformFeeStatus: fee?.platform_fee_status || "pending",
        platformFeePaidAt: fee?.platform_fee_paid_at || null,
        platformFeePaymentRef: fee?.platform_fee_payment_ref || null,
        adminReviewStatus: fee?.admin_review_status || "pending",
        adminReviewedAt: fee?.admin_reviewed_at || null,
      };
    });

    setSchemaReady(true);
    setRows(mergedRows);
    setLoading(false);
  }

  function peso(value: number) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  function feeStatusClass(status: string) {
    switch ((status || "").toLowerCase()) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-danger/10 text-danger";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  }

  function reviewStatusClass(status: string) {
    switch ((status || "").toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-danger/10 text-danger";
      default:
        return "bg-blue-100 text-blue-800";
    }
  }

  const openConfirmModal = (action: ModalType, row: FeeRow) => {
    if (!schemaReady) {
      alert("Fee review columns are not in the database yet. Please run the SQL migration first.");
      return;
    }
    setSelectedRow(row);
    setActiveModal(action);
  };

  const closeModal = () => {
    if (processing) return;
    setActiveModal(null);
    setSelectedRow(null);
  };

  const executeAction = async () => {
    if (!selectedRow || !activeModal) return;
    
    setProcessing(true);
    try {
      const updateData: any = {
        admin_review_status: activeModal === "approve" ? "approved" : "rejected",
        admin_reviewed_at: new Date().toISOString(),
      };

      // If approving, we automatically mark the fee as paid
      if (activeModal === "approve") {
          updateData.platform_fee_status = "paid";
          updateData.platform_fee_paid_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("forumposts")
        .update(updateData)
        .eq("post_id", selectedRow.id);

      if (error) {
        alert(`Failed to ${activeModal} job: ${error.message}`);
      } else {
        await loadRows();
        closeModal();
      }
    } finally {
      setProcessing(false);
    }
  };

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter((row) => {
      const haystack = `${row.title} ${row.category} ${row.postedBy} ${row.postedByEmail}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [query, rows]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-lg font-semibold">Job Fee Reviews</h2>
        <p className="text-sm text-muted-foreground">
          Review platform-fee payment status before final admin approval. Total: {rows.length}
        </p>
      </div>

      {!schemaReady && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          Fee-review columns are not yet available in your `forumposts` table. This page still loads jobs, but actions are disabled until schema is updated.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
        <div className="w-full md:w-80">
          <SearchBar defaultValue={query} onSearch={setQuery} placeholder="Search jobs or users..." />
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading fee reviews...</div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-muted p-4">
              <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {pagedRows.length} of {filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""}
                  </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-muted/10">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Job</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Posted By</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Fee</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Review</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/20">
                    {pagedRows.map((row, index) => (
                      <tr key={row.id} className={`${index % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-xs text-muted-foreground">{row.category}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div>{row.postedBy}</div>
                          <div className="text-xs text-muted-foreground">{row.postedByEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${feeStatusClass(row.platformFeeStatus)}`}>
                              {row.platformFeeStatus}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground">{peso(row.platformFeeTotal)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${reviewStatusClass(row.adminReviewStatus)}`}>
                            {row.adminReviewStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="inline-flex items-center gap-2">
                            {(row.adminReviewStatus || "").toLowerCase() === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openConfirmModal("approve", row)}
                                  disabled={!schemaReady}
                                  className="inline-flex items-center rounded-md bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openConfirmModal("reject", row)}
                                  disabled={!schemaReady}
                                  className="inline-flex items-center rounded-md bg-danger text-white px-3 py-1.5 text-xs font-medium hover:bg-danger/90 transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagedRows.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">No records found.</div>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`rounded-md px-3 py-1 text-sm border border-border ${page <= 1 ? "text-muted-foreground bg-muted/10" : "bg-muted/5 hover:bg-muted/10 transition-colors"}`}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`rounded-md px-3 py-1 text-sm border border-border ${page >= totalPages ? "text-muted-foreground bg-muted/10" : "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"}`}
              >
                Next
              </button>
              <div className="text-sm text-muted-foreground ml-2">Page {page} of {totalPages}</div>
            </div>
          </>
        )}
      </div>

      {/* ==============================================
          CONFIRMATION MODALS
          ============================================== */}

      {/* Approve Modal */}
      {activeModal === "approve" && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="bg-background border border-border rounded-2xl max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold leading-tight">Approve Job Post</h2>
              </div>
            </div>
            
            <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-green-800 leading-relaxed">
                        You are about to approve the job post <strong>"{selectedRow.title}"</strong>.
                        <br/><br/>
                        <strong>Note:</strong> Approving this post will automatically mark the platform fee as <span className="font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded-full bg-green-200">Paid</span>.
                    </p>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={closeModal}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={processing}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 min-w-[120px]"
              >
                {processing ? "Processing..." : "Approve Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {activeModal === "reject" && selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={closeModal}>
          <div className="bg-background border border-border rounded-2xl max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-danger/10 text-danger rounded-lg">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-semibold leading-tight">Reject Job Post</h2>
              </div>
            </div>
            
            <div className="p-6">
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4">
                    <p className="text-sm text-danger leading-relaxed">
                        You are about to reject the job post <strong>"{selectedRow.title}"</strong>. This will mark the review status as rejected and the job will not be visible on the platform.
                    </p>
                </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={closeModal}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={processing}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-danger text-white rounded-md hover:bg-danger/90 transition-colors disabled:opacity-50 min-w-[120px]"
              >
                {processing ? "Processing..." : "Reject Post"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}