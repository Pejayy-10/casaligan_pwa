"use client";

import { Eye, Ban, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Trash2, X } from "lucide-react";
import React from "react";

type Row = {
  id?: string | number;
  user_id?: string | number;
  userId?: string | number;
  name?: string;
  date?: string;
  status?: string;
  [key: string]: any; // Allow any additional properties
};

type Props = {
  rows: Row[];
  onAction?: (action: "view" | "ban" | "restrict" | "unban" | "unrestrict" | "warn" | "delete" | "dismiss", row: Row) => void;
  className?: string;
  actionType?: "default" | "verification" | "reports" | "payments" | "activity-log";
};

export default function ActionTable({ rows, onAction, className = "", actionType = "default" }: Props) {
  // Get unique key for each row - try id, user_id, or userId, fallback to index
  const getRowKey = (row: Row, index: number) => {
    // For reports, use report_id and user_id combination to ensure uniqueness
    if (actionType === "reports" && row.report_id) {
      const userId = row.target_user?.user_id || row.target_id || 'unknown';
      return `report-${row.report_id}-user-${userId}`;
    }
    return row.id || row.user_id || row.userId || `row-${index}`;
  };

  // Get display ID - show user_id if available, otherwise id
  const getDisplayId = (row: Row) => {
    return row.user_id || row.id || row.userId || "N/A";
  };

  return (
    <div className={className}>
  <div className="rounded-2xl border border-border bg-muted p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Showing {rows.length} result{rows.length !== 1 ? "s" : ""}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-muted/10">
                {actionType === "reports" ? (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Report Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Reported By</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Reported To</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date Reported</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                  </>
                ) : actionType === "verification" ? (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Application Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                  </>
                ) : actionType === "payments" ? (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Employer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Paid To</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Transaction</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                  </>
                ) : actionType === "activity-log" ? (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">User Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Timestamp</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Details/Remarks</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/20">
              {rows.map((row, i) => (
                <tr key={getRowKey(row, i)} className={`${i % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
                  {actionType === "reports" ? (
                    <>
                      <td className="px-4 py-3 text-sm text-foreground">{row.reason || row.report_type || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.reporter_name || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.target_user?.name || row.reported_to || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.created_at ? new Date(row.created_at).toLocaleDateString() : (row.date ? new Date(row.date).toLocaleDateString() : "N/A")}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status || "")}`}
                        >
                          {row.status || "N/A"}
                        </span>
                      </td>
                    </>
                  ) : actionType === "verification" ? (
                    <>
                      <td className="px-4 py-3 text-sm text-foreground">{String(getDisplayId(row))}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.name || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.role || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.application_date_formatted || (row.application_date ? new Date(row.application_date).toLocaleDateString() : "N/A")}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status || "")}`}
                        >
                          {row.status || "N/A"}
                        </span>
                      </td>
                    </>
                  ) : actionType === "payments" ? (
                    <>
                      <td className="px-4 py-3 text-sm text-foreground">{row.employer_name || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.amount_formatted || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.paid_to || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.date_formatted || "N/A"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status || "")}`}
                        >
                          {row.status || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.transaction || "N/A"}</td>
                    </>
                  ) : actionType === "activity-log" ? (
                    <>
                      <td className="px-4 py-3 text-sm text-foreground">{row.user_type || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.user_name || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.action || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.timestamp_formatted || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.details || "N/A"}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-sm text-foreground">{String(getDisplayId(row))}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.name || "N/A"}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.date ? new Date(row.date).toLocaleDateString() : "N/A"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status || "")}`}
                        >
                          {row.status || "N/A"}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAction?.("view", row)}
                        title="View"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tertiary/10 text-foreground hover:bg-tertiary/50 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {actionType === "verification" ? (
                        <>
                          {row.status?.toLowerCase() === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => onAction?.("ban", row)}
                                title="Approve Verification"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/30 transition-colors"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onAction?.("restrict", row)}
                                title="Reject Verification"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/30 transition-colors"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </>
                      ) : actionType === "payments" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onAction?.("restrict", row)}
                            title="Complete Payment"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/30 transition-colors"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        </>
                       ) : actionType === "activity-log" ? (
                         <>
                           <button
                             type="button"
                             onClick={() => onAction?.("delete", row)}
                             title="Delete"
                             className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/30 transition-colors"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                         </>
                       ) : actionType === "reports" ? (
                        <>
                          {/* Only show action buttons if report is not resolved or dismissed */}
                          {row.status?.toLowerCase() !== 'resolved' && row.status?.toLowerCase() !== 'dismissed' && (
                            <>
                              <button
                                type="button"
                                onClick={() => onAction?.("warn", row)}
                                title="Warn User"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/30 transition-colors"
                              >
                                <AlertTriangle className="h-4 w-4" />
                              </button>
                              {(() => {
                                // Check the target user's status for THIS specific row
                                // Each row should check its own target_user's status independently
                                // IMPORTANT: This function is called for EACH row separately
                                const targetUserId = row.target_user?.user_id;
                                const reportId = row.report_id;
                                
                                // Get status from target_user object (most reliable)
                                // Read directly from the object to ensure we get the row-specific value
                                let finalStatus = 'active'; // Default
                                
                                if (row.target_user) {
                                  // Get status directly from target_user object for this specific row
                                  const rawStatus = row.target_user.status;
                                  if (rawStatus != null && rawStatus !== undefined) {
                                    finalStatus = String(rawStatus).toLowerCase().trim();
                                  }
                                } else if (row.target_user_status) {
                                  // Fallback to target_user_status field
                                  finalStatus = String(row.target_user_status).toLowerCase().trim();
                                }
                                
                                // Only show shield (unrestrict) if:
                                // 1. Status is exactly 'restricted'
                                // 2. We have a valid user_id
                                const isRestricted = finalStatus === 'restricted' && 
                                  targetUserId != null &&
                                  targetUserId !== undefined &&
                                  Number.isInteger(Number(targetUserId)); // Ensure user_id is a valid number
                                
                                return isRestricted;
                              })() ? (
                                <button
                                  type="button"
                                  onClick={() => onAction?.("unrestrict", row)}
                                  title="Remove Restriction"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/30 transition-colors"
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onAction?.("restrict", row)}
                                  title="Restrict User"
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/30 transition-colors"
                                >
                                  <ShieldAlert className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onAction?.("delete", row)}
                                title="Mark as Resolved"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/30 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onAction?.("dismiss", row)}
                                title="Dismiss Report"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-gray-500/10 text-gray-600 hover:bg-gray-500/30 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          {/* For Workers/Employers pages - check users.status */}
                          {(() => {
                            // Get the user status for this specific row
                            const userStatus = row.users?.status || row.status || 'active';
                            const normalizedStatus = String(userStatus).toLowerCase().trim();
                            
                            return normalizedStatus === 'banned';
                          })() ? (
                            <button
                              type="button"
                              onClick={() => onAction?.("unban", row)}
                              title="Unban User"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/30 transition-colors"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAction?.("ban", row)}
                              title="Ban User"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-destructive hover:bg-danger/50 transition-colors"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                          {(() => {
                            // Get the user status for this specific row
                            const userStatus = row.users?.status || row.status || 'active';
                            const normalizedStatus = String(userStatus).toLowerCase().trim();
                            
                            return normalizedStatus === 'restricted';
                          })() ? (
                            <button
                              type="button"
                              onClick={() => onAction?.("unrestrict", row)}
                              title="Unrestrict User"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 hover:bg-blue-500/30 transition-colors"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onAction?.("restrict", row)}
                              title="Restrict User"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/30 transition-colors"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function statusClass(s: string) {
  switch (s?.toLowerCase?.()) {
    case "active":
      return "bg-green-100 border text-green-800";
    case "completed":
      return "bg-green-100 border text-green-800";
    case "pending":
      return "bg-yellow-100 border text-yellow-800";
    case "overdue":
      return "bg-red-100 border text-red-800";
    case "open":
      return "bg-yellow-100 border text-yellow-800";
    case "restricted":
      return "bg-orange-100 border text-orange-800";
    case "resolved":
      return "bg-green-100 border text-green-800";
    case "dismissed":
      return "bg-gray-100 border text-gray-800";
    case "escalated":
      return "bg-red-100 border text-red-800";
    case "inactive":
      return "bg-yellow-100 border text-yellow-800";
    case "banned":
      return "bg-red-100 border text-red-800";
    case "suspended":
      return "bg-red-100 border text-red-800";
    case "disabled":
      return "bg-red-100 border text-red-800";
    default:
      return "bg-gray-100 border text-gray-800";
  }
}
