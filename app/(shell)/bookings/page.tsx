"use client";

import { useEffect, useState, useCallback } from "react";
import BookingDetailsModal from "@/app/components/BookingDetailsModal";
import { SearchBar } from "@/app/components/SearchBar";
import BookingFilterBar from "@/app/components/BookingFilterBar";
import { getBookings, updateBookingStatus, deleteBooking } from "@/lib/supabase/booking";

export default function BookingsPage() {
	const [bookings, setBookings] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedBooking, setSelectedBooking] = useState<any>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<any>({});
	const [page, setPage] = useState(1);
	const pageSize = 10;

	useEffect(() => {
		loadBookings();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	async function loadBookings() {
		setLoading(true);
		const { data, error } = await getBookings(500, 0);
		if (error) {
			console.error("Error loading bookings:", error);
			alert(`Error loading bookings: ${error.message}`);
		} else {
			setBookings(data || []);
		}
		setLoading(false);
	}

	function filterBookings(bookings: any[], q: string, f: any) {
		const search = (q || "").trim().toLowerCase();
		return bookings.filter((booking) => {
			const worker = booking.workers || {};
			const employer = booking.employers || {};
			const workerUser = worker.users || {};
			const employerUser = employer.users || {};
			const packageData = booking.packages || {};

			if (search) {
				const hay = `${workerUser.name} ${employerUser.name} ${packageData.title}`.toLowerCase();
				if (!hay.includes(search)) return false;
			}

			if (f?.status) {
				if (String(booking.status).toLowerCase() !== String(f.status).toLowerCase()) return false;
			}

			if (f?.startDate) {
				try {
					const start = new Date(f.startDate);
					const bookingDate = new Date(booking.booking_date);
					if (bookingDate < start) return false;
				} catch (e) {
					// ignore
				}
			}

			if (f?.endDate) {
				try {
					const end = new Date(f.endDate);
					const bookingDate = new Date(booking.booking_date);
					if (bookingDate > end) return false;
				} catch (e) {
					// ignore
				}
			}

			return true;
		});
	}

	const filtered = filterBookings(bookings, query, filters);
	const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
	const pagedBookings = filtered.slice((page - 1) * pageSize, page * pageSize);

	const handleViewBooking = (booking: any) => {
		const worker = booking.workers || {};
		const employer = booking.employers || {};
		const workerUser = worker.users || {};
		const employerUser = employer.users || {};
		const schedule = booking.schedules || {};
		const packageData = booking.packages || {};

		// Calculate duration
		let duration = "N/A";
		if (schedule.start_time && schedule.end_time && schedule.start_time !== "N/A" && schedule.end_time !== "N/A") {
			const start = schedule.start_time.split(':');
			const end = schedule.end_time.split(':');
			const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
			const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
			const diffMinutes = endMinutes - startMinutes;
			const hours = Math.floor(diffMinutes / 60);
			const minutes = diffMinutes % 60;
			duration = minutes > 0 ? `${hours}-${hours + 1} hours` : `${hours} hours`;
		}

		// Get location from employer address
		const location = employerUser.address || "Baliwasan, Zamboanga City";

		setSelectedBooking({
			booking_id: booking.booking_id,
			worker_name: workerUser.name || "N/A",
			worker_email: workerUser.email || "N/A",
			worker_phone: workerUser.phone_number || "N/A",
			employer_name: employerUser.name || "N/A",
			employer_email: employerUser.email || "N/A",
			employer_phone: employerUser.phone_number || "N/A",
			package_title: packageData.title || "N/A",
			package_description: packageData.description || "No description provided",
			package_price: packageData.price || 0,
			status: booking.status || "pending",
			booking_date: booking.booking_date || new Date().toISOString(),
			schedule_date: schedule.available_date || "N/A",
			start_time: schedule.start_time || "N/A",
			end_time: schedule.end_time || "N/A",
			duration: duration,
			location: location,
			notes: booking.notes || "",
		});
		setIsModalOpen(true);
	};

	const handleCancelBooking = async (bookingId: number) => {
		if (confirm("Are you sure you want to cancel this booking? This action cannot be undone.")) {
			const { error } = await updateBookingStatus(bookingId, "cancelled");
			
			if (error) {
				alert(`Error cancelling booking: ${error.message}`);
			} else {
				alert("Booking has been cancelled successfully.");
				loadBookings();
			}
		}
	};

	const handleDeleteBooking = async (bookingId: number) => {
		if (confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
			const { error } = await deleteBooking(bookingId);
			
			if (error) {
				alert(`Error deleting booking: ${error.message}`);
			} else {
				alert("Booking has been deleted successfully.");
				loadBookings();
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
				<div className="text-center py-12">Loading bookings...</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h2 className="text-lg font-semibold">Bookings</h2>
				<p className="text-sm text-muted-foreground">Manage bookings and schedules. Total: {bookings.length}</p>
			</div>

			<div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="w-full md:w-80">
						<SearchBar defaultValue={query} onSearch={handleSearch} placeholder="Search bookings..." />
					</div>

					<div className="w-full md:w-auto">
						<BookingFilterBar onChange={handleFilterChange} />
					</div>
				</div>

				<div className="rounded-2xl border border-border bg-muted p-4">
					<div className="mb-3 flex items-center justify-between">
						<div className="text-sm text-muted-foreground">Showing {pagedBookings.length} of {filtered.length} result{filtered.length !== 1 ? "s" : ""}</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full table-auto">
							<thead>
								<tr className="bg-muted/10">
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Worker</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Employer</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Package</th>
									<th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
									<th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-muted/20">
								{pagedBookings.map((booking, i) => {
									const worker = booking.workers || {};
									const employer = booking.employers || {};
									const workerUser = worker.users || {};
									const employerUser = employer.users || {};
									const packageData = booking.packages || {};

									return (
										<tr key={booking.booking_id} className={`${i % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
											<td className="px-4 py-3 text-sm text-foreground">
												<div className="font-medium">{workerUser.name || "N/A"}</div>
												<div className="text-xs text-muted-foreground">{workerUser.email || "N/A"}</div>
											</td>
											<td className="px-4 py-3 text-sm text-foreground">
												<div className="font-medium">{employerUser.name || "N/A"}</div>
												<div className="text-xs text-muted-foreground">{employerUser.email || "N/A"}</div>
											</td>
											<td className="px-4 py-3 text-sm text-foreground">
												<div className="font-medium">{packageData.title || "N/A"}</div>
												<div className="text-xs text-muted-foreground">₱{packageData.price?.toFixed(2) || "0.00"}</div>
											</td>
											<td className="px-4 py-3 text-sm">
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
														booking.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
														booking.status === 'completed' ? 'bg-green-100 text-green-800' :
														booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
														booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
														'bg-gray-100 text-gray-800'
													}`}
												>
													{booking.status}
												</span>
											</td>
											<td className="px-4 py-3 text-sm text-right">
												<div className="inline-flex items-center gap-2">
													<button
														type="button"
														onClick={() => handleViewBooking(booking)}
														title="View"
														className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tertiary/10 text-foreground hover:bg-tertiary/50 transition-colors"
													>
														<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
															<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
														</svg>
													</button>
													{booking.status === "cancelled" ? (
														<button
															type="button"
															onClick={() => handleDeleteBooking(booking.booking_id)}
															title="Delete Booking"
															className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-destructive hover:bg-danger/50 transition-colors"
														>
															<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
															</svg>
														</button>
													) : booking.status !== "completed" && (
														<button
															type="button"
															onClick={() => handleCancelBooking(booking.booking_id)}
															title="Cancel Booking"
															className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-destructive hover:bg-danger/50 transition-colors"
														>
															<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{pagedBookings.length === 0 && (
						<div className="text-center py-12 text-muted-foreground">
							No bookings found
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

			<BookingDetailsModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				booking={selectedBooking}
			/>
		</div>
	);
}


