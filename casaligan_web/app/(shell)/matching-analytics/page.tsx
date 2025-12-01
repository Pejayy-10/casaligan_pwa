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

  useEffect(() => {
    loadMatchingRecords();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  const loadMatchingRecords = async () => {
    try {
      setIsLoading(true);
      const records = await getMatchingRecords(100, 0);
      setMatchingRecords(records);
    } catch (error) {
      console.error("Error loading matching records:", error);
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

  const handleDelete = async (matchId: number) => {
    const recordToDelete = matchingRecords.find(r => r.match_id === matchId);
    const recordName = recordToDelete ? `${recordToDelete.employer_name} - ${recordToDelete.worker_name}` : "this record";
    
    if (!confirm(`Are you sure you want to delete the match record for ${recordName}?`)) {
      return;
    }

    try {
      await deleteMatchingRecord(matchId);
      
      // Update state immediately without reloading
      setMatchingRecords(prevRecords => 
        prevRecords.filter(record => record.match_id !== matchId)
      );
      
      alert(`Successfully deleted match record for ${recordName}!`);
    } catch (error) {
      console.error("Error deleting match record:", error);
      alert("Failed to delete match record. Please try again.");
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
            <table className="w-full bg-white">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-border">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDelete(record.match_id)}
                          className="text-red-600 hover:text-red-900 font-medium"
                          title="Delete"
                        >
                          <svg
                            className="w-5 h-5 inline"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
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
    </div>
  );
}