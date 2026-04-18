"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import MatchingAnalytics from "@/app/components/MatchingAnalytics";
import { SearchBar } from "@/app/components/SearchBar";
import FilterBar from "@/app/components/FilterBar";
import {
  getMatchingRecords,
  deleteMatchingRecord,
  type MatchingRecord,
} from "@/lib/supabase/matchingQueries";

export default function MatchingAnalyticsPage() {
  const [matchingRecords, setMatchingRecords] = useState<MatchingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<any>({});
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Modal States
  const [recordToDelete, setRecordToDelete] = useState<MatchingRecord | null>(null);
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
    show: false,
    title: "",
    message: "",
    isError: false,
  });

  useEffect(() => {
    loadMatchingRecords();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (recordToDelete || alertModal.show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [recordToDelete, alertModal.show]);

  const loadMatchingRecords = async () => {
    try {
      setIsLoading(true);
      const records = await getMatchingRecords(100, 0);
      setMatchingRecords(records);
    } catch (error: any) {
      console.error("Error loading matching records:", error);
      setAlertModal({
        show: true,
        title: "Loading Error",
        message: error.message || "Failed to load matching records.",
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = useCallback((v: string) => setQuery(v), []);
  const handleFilterChange = useCallback((f: any) => setFilters(f), []);

  const filterRecords = (records: MatchingRecord[], q: string, f: any) => {
    const search = (q || "").trim().toLowerCase();
    return records.filter((record) => {
      // Search filter
      if (search) {
        const searchText = [
          record.employer_name,
          record.worker_name,
          record.package_title,
          record.notes,
        ]
          .join(" ")
          .toLowerCase();
        if (!searchText.includes(search)) return false;
      }

      // Status filter
      if (f?.status) {
        if (record.status.toLowerCase() !== f.status.toLowerCase()) return false;
      }

      // Date filters
      if (f?.startDate) {
        try {
          const start = new Date(f.startDate);
          const recordDate = new Date(record.match_date);
          if (recordDate < start) return false;
        } catch (e) {
          // ignore invalid date
        }
      }

      if (f?.endDate) {
        try {
          const end = new Date(f.endDate);
          const recordDate = new Date(record.match_date);
          if (recordDate > end) return false;
        } catch (e) {
          // ignore invalid date
        }
      }

      return true;
    });
  };

  const filtered = useMemo(
    () => filterRecords(matchingRecords, query, filters),
    [matchingRecords, query, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Updated Delete Handlers for Custom Modal
  const handleDelete = (matchId: number) => {
    const record = matchingRecords.find(r => r.match_id === matchId);
    if (record) setRecordToDelete(record);
  };

  const executeDelete = async () => {
    if (!recordToDelete) return;
    
    const recordName = `${recordToDelete.employer_name} - ${recordToDelete.worker_name}`;

    try {
      await deleteMatchingRecord(recordToDelete.match_id);
      
      // Update state immediately without reloading
      setMatchingRecords(prevRecords => 
        prevRecords.filter(record => record.match_id !== recordToDelete.match_id)
      );
      
      setAlertModal({
        show: true,
        title: "Success",
        message: `Successfully deleted match record for ${recordName}!`,
        isError: false,
      });
    } catch (error) {
      console.error("Error deleting match record:", error);
      setAlertModal({
        show: true,
        title: "Deletion Error",
        message: "Failed to delete match record. Please try again.",
        isError: true,
      });
    } finally {
      setRecordToDelete(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "successful":
        return "bg-green-100 text-green-800 border-green-200";
      case "failed":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
      <MatchingAnalytics />

      {/* Matching Records Table */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Matching Records</h2>
          <p className="text-sm text-muted-foreground">
            View and manage employer-worker matching history
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
          {/* Search and Filters */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:w-80">
              <SearchBar
                defaultValue={query}
                onSearch={handleSearch}
                placeholder="Search employer, worker, notes..."
              />
            </div>

            <div className="w-full md:w-auto">
              <FilterBar onChange={handleFilterChange} />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Employer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Housekeeper
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Notes/Reason
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-muted-foreground"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : pagedRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-4 text-center text-muted-foreground"
                    >
                      No matching records found
                    </td>
                  </tr>
                ) : (
                  pagedRecords.map((record) => (
                    <tr key={record.match_id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {record.employer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                        {record.worker_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(record.match_date).toLocaleDateString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusBadgeColor(
                            record.status
                          )}`}
                        >
                          {record.status.charAt(0).toUpperCase() +
                            record.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground max-w-xs truncate">
                        {record.notes || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDelete(record.match_id)}
                            title="Delete Record"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-destructive hover:bg-danger/50 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`rounded-md px-3 py-1 text-sm border border-border ${
                page <= 1
                  ? "text-muted-foreground bg-muted/10"
                  : "bg-muted/5 hover:bg-muted/10"
              }`}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`rounded-md px-3 py-1 text-sm border border-border ${
                page >= totalPages
                  ? "text-muted-foreground bg-muted/10"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              Next
            </button>
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Delete Modal */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setRecordToDelete(null)}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Are you sure you want to delete the match record for <span className="font-semibold text-foreground">"{recordToDelete.employer_name} & {recordToDelete.worker_name}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={executeDelete}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Feedback Modal */}
      {alertModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-destructive" : ""}`}>
              {alertModal.title}
            </h2>
            <p className="text-muted-foreground text-sm mb-6">{alertModal.message}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setAlertModal({ ...alertModal, show: false })}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}