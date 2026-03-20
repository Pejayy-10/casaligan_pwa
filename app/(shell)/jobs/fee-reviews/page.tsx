"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SearchBar } from "@/app/components/SearchBar";

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

export default function JobFeeReviewsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);

  useEffect(() => {
    loadRows();
  }, []);

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
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  }

  function reviewStatusClass(status: string) {
    switch ((status || "").toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  }

  async function updateRow(row: FeeRow, action: "confirm_fee" | "approve" | "reject") {
    if (!schemaReady) {
      alert("Fee review columns are not in the database yet. Please run the SQL migration first.");
      return;
    }

    setBusyId(row.id);
    try {
      if (action === "confirm_fee") {
        const { error } = await supabase
          .from("forumposts")
          .update({
            platform_fee_status: "paid",
            platform_fee_paid_at: new Date().toISOString(),
            admin_review_status: "pending",
          })
          .eq("post_id", row.id);

        if (error) {
          alert(`Failed to confirm fee: ${error.message}`);
          return;
        }
      }

      if (action === "approve") {
        const { error } = await supabase
          .from("forumposts")
          .update({
            admin_review_status: "approved",
            admin_reviewed_at: new Date().toISOString(),
          })
          .eq("post_id", row.id);

        if (error) {
          alert(`Failed to approve job: ${error.message}`);
          return;
        }
      }

      if (action === "reject") {
        const { error } = await supabase
          .from("forumposts")
          .update({
            admin_review_status: "rejected",
            admin_reviewed_at: new Date().toISOString(),
          })
          .eq("post_id", row.id);

        if (error) {
          alert(`Failed to reject job: ${error.message}`);
          return;
        }
      }

      await loadRows();
    } finally {
      setBusyId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return rows;

    return rows.filter((row) => {
      const haystack = `${row.title} ${row.category} ${row.postedBy} ${row.postedByEmail}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [query, rows]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
      <div>
        <h2 className="text-lg font-semibold">Job Fee Reviews</h2>
        <p className="text-sm text-muted-foreground">
          Review platform-fee payment status before final admin approval.
        </p>
      </div>

      {!schemaReady && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900">
          Fee-review columns are not yet available in your `forumposts` table. This page still loads jobs, but actions are disabled until schema is updated.
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
        <div className="w-full md:w-80">
          <SearchBar defaultValue={query} onSearch={setQuery} />
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">Loading fee reviews...</div>
        ) : (
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
                {filteredRows.map((row, index) => (
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
                        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${feeStatusClass(row.platformFeeStatus)}`}>
                          {row.platformFeeStatus}
                        </span>
                        <span className="text-xs text-muted-foreground">{peso(row.platformFeeTotal)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${reviewStatusClass(row.adminReviewStatus)}`}>
                        {row.adminReviewStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="inline-flex items-center gap-2">
                        {(row.platformFeeStatus || "").toLowerCase() !== "paid" && (
                          <button
                            type="button"
                            onClick={() => updateRow(row, "confirm_fee")}
                            disabled={!schemaReady || busyId === row.id}
                            className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/20 disabled:opacity-60"
                          >
                            Confirm Fee
                          </button>
                        )}

                        {(row.platformFeeStatus || "").toLowerCase() === "paid" && (row.adminReviewStatus || "").toLowerCase() === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateRow(row, "approve")}
                              disabled={!schemaReady || busyId === row.id}
                              className="inline-flex items-center rounded-md border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => updateRow(row, "reject")}
                              disabled={!schemaReady || busyId === row.id}
                              className="inline-flex items-center rounded-md border border-border bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
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

            {filteredRows.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">No jobs found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
