"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBar } from "./SearchBar";
import FilterBar from "./FilterBar";
import ActionTable from "./ActionTable";

type Row = any;

type StatusOption = {
	value: string;
	label: string;
};

type Props = {
	rows?: Row[];
	title?: string;
	description?: string;
	pageSize?: number;
	onAction?: (action: "view" | "ban" | "restrict" | "unban" | "unrestrict" | "warn" | "delete" | "dismiss", row: Row) => void;
	className?: string;
	actionType?: "default" | "verification" | "reports" | "payments" | "activity-log";
	statusOptions?: StatusOption[];
};

export default function TableShell({ rows = [], title, description, pageSize = 10, onAction, className = "", actionType = "default", statusOptions }: Props) {
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<any>({});
	const [page, setPage] = useState(1);

	const handleSearch = useCallback((v: string) => setQuery(v), [setQuery]);
	const handleFilterChange = useCallback((f: any) => setFilters(f), [setFilters]);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	function filterRows(rows: Row[], q: string, f: any) {
		const search = (q || "").trim().toLowerCase();
		return rows.filter((r) => {
			if (search) {
				const hay = Object.values(r).join(" ").toLowerCase();
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

	const filtered = useMemo(() => filterRows(rows, query, filters), [rows, query, filters]);
	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const pagedRows = useMemo(() => {
		const start = (page - 1) * pageSize;
		return filtered.slice(start, start + pageSize);
	}, [filtered, page, pageSize]);

	return (
		<div className={className}>
			<div className="space-y-4">
				{(title || description) && (
					<div>
						{title && <h2 className="text-lg font-semibold">{title}</h2>}
						{description && <p className="text-sm text-muted-foreground">{description}</p>}
					</div>
				)}

				<div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="w-full md:w-80">
							<SearchBar defaultValue={query} onSearch={handleSearch} />
						</div>

						<div className="w-full md:w-auto">
							<FilterBar onChange={handleFilterChange} statusOptions={statusOptions} />
						</div>
					</div>

					<ActionTable rows={pagedRows} onAction={onAction} actionType={actionType} />

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
			</div>
		</div>
	);
}

