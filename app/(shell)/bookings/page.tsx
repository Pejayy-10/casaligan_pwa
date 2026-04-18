"use client";

import { useEffect, useState, useCallback } from "react";
import { SearchBar } from "@/app/components/SearchBar";
import BookingFilterBar from "@/app/components/BookingFilterBar";
import { getBookings, updateBookingStatus, deleteBooking } from "@/lib/supabase/booking";

export default function BookingsPage() {
	const [bookings, setBookings] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	
	// Data states
	const [query, setQuery] = useState("");
	const [filters, setFilters] = useState<any>({});
	const [page, setPage] = useState(1);
	const pageSize = 10;

	// Modal States
	const [selectedBooking, setSelectedBooking] = useState<any>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
	const [bookingToDelete, setBookingToDelete] = useState<number | null>(null);
	const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
		show: false,
		title: "",
		message: "",
		isError: false,
	});

	useEffect(() => {
		loadBookings();
	}, []);

	useEffect(() => {
		setPage(1);
	}, [query, filters]);

	// Lock body scroll when any modal is open
	useEffect(() => {
		if (isModalOpen || bookingToCancel || bookingToDelete || alertModal.show) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isModalOpen, bookingToCancel, bookingToDelete, alertModal.show]);

	async function loadBookings() {
		setLoading(true);
		const { data, error } = await getBookings(500, 0);
		if (error) {
			console.error("Error loading bookings:", error);
			setAlertModal({
				show: true,
				title: "Loading Error",
				message: `Error loading bookings: ${error.message}`,
				isError: true,
			});
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
				} catch (e) { }
			}

			if (f?.endDate) {
				try {
					const end = new Date(f.endDate);
					const bookingDate = new Date(booking.booking_date);
					if (bookingDate > end) return false;
				} catch (e) { }
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

	const handleCancelBooking = (bookingId: number) => setBookingToCancel(bookingId);
	const executeCancel = async () => {
		if (!bookingToCancel) return;
		const { error } = await updateBookingStatus(bookingToCancel, "cancelled");
		if (error) {
			setAlertModal({ show: true, title: "Cancellation Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Booking has been cancelled successfully.", isError: false });
			await loadBookings();
		}
		setBookingToCancel(null);
	};

	const handleDeleteBooking = (bookingId: number) => setBookingToDelete(bookingId);
	const executeDelete = async () => {
		if (!bookingToDelete) return;
		const { error } = await deleteBooking(bookingToDelete);
		if (error) {
			setAlertModal({ show: true, title: "Deletion Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Booking has been deleted successfully.", isError: false });
			await loadBookings();
		}
		setBookingToDelete(null);
	};

	const handleFilterChange = useCallback((f: any) => setFilters(f), []);
	const handleSearch = useCallback((v: string) => setQuery(v), []);

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
									const workerUser = booking.workers?.users || {};
									const employerUser = booking.employers?.users || {};
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
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													booking.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
													booking.status === 'completed' ? 'bg-green-100 text-green-800' :
													booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
													booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
													'bg-gray-100 text-gray-800'
												}`}>
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

			{/* ==============================================
			    PRETTIFIED BOOKING DETAILS MODAL
			    ============================================== */}
			{isModalOpen && selectedBooking && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsModalOpen(false)}>
					<div 
						className="bg-background border border-border rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 text-primary rounded-lg">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
								</div>
								<div>
									<h2 className="text-lg font-semibold leading-tight">Booking #{selectedBooking.booking_id}</h2>
									<p className="text-xs text-muted-foreground">Placed on {new Date(selectedBooking.booking_date).toLocaleDateString()}</p>
								</div>
							</div>
							<button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{/* Scrollable Content Body */}
						<div className="p-6 overflow-y-auto space-y-6">
							
							{/* Section: People Involved */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{/* Worker Card */}
								<div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
									<div className="bg-blue-100 text-blue-600 p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Worker</p>
										<p className="font-medium text-foreground">{selectedBooking.worker_name}</p>
										<p className="text-sm text-muted-foreground">{selectedBooking.worker_email}</p>
										<p className="text-sm text-muted-foreground">{selectedBooking.worker_phone}</p>
									</div>
								</div>

								{/* Employer Card */}
								<div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
									<div className="bg-purple-100 text-purple-600 p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Employer</p>
										<p className="font-medium text-foreground">{selectedBooking.employer_name}</p>
										<p className="text-sm text-muted-foreground">{selectedBooking.employer_email}</p>
										<p className="text-sm text-muted-foreground">{selectedBooking.employer_phone}</p>
									</div>
								</div>
							</div>

							{/* Section: Package Details */}
							<div className="bg-card border border-border rounded-xl p-5 shadow-sm">
								<div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 pb-4 border-b border-border/50">
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Package Booked</p>
										<h3 className="text-lg font-semibold text-foreground">{selectedBooking.package_title}</h3>
									</div>
									<div className="text-left sm:text-right">
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Price</p>
										<p className="text-2xl font-bold text-foreground">₱{selectedBooking.package_price?.toFixed(2) || "0.00"}</p>
									</div>
								</div>
								
								<div className="space-y-4">
									<div>
										<p className="text-sm font-medium mb-1">Description</p>
										<p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
											{selectedBooking.package_description}
										</p>
									</div>
									
									<div className="flex items-center gap-3 bg-muted/20 p-3 rounded-lg w-fit border border-border/50">
										<span className="text-sm text-muted-foreground font-medium">Current Status:</span>
										<span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
											selectedBooking.status === 'confirmed' ? 'bg-purple-100 text-purple-800' :
											selectedBooking.status === 'completed' ? 'bg-green-100 text-green-800' :
											selectedBooking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
											selectedBooking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
											'bg-gray-100 text-gray-800'
										}`}>
											{selectedBooking.status}
										</span>
									</div>
								</div>
							</div>

							{/* Section: Logistics (Schedule & Location) */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div className="bg-muted/10 border border-border rounded-xl p-4">
									<div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
										<svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
										Schedule
									</div>
									<div className="space-y-2">
										<div>
											<p className="text-xs text-muted-foreground">Date</p>
											<p className="text-sm font-medium">{selectedBooking.schedule_date !== "N/A" ? new Date(selectedBooking.schedule_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}</p>
										</div>
										<div>
											<p className="text-xs text-muted-foreground">Time & Duration</p>
											<p className="text-sm font-medium">
												{selectedBooking.start_time !== "N/A" ? `${selectedBooking.start_time} - ${selectedBooking.end_time}` : "N/A"} 
												<span className="text-muted-foreground ml-1">({selectedBooking.duration})</span>
											</p>
										</div>
									</div>
								</div>

								<div className="bg-muted/10 border border-border rounded-xl p-4">
									<div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
										<svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
										Location
									</div>
									<p className="text-sm font-medium leading-relaxed mt-1">
										{selectedBooking.location}
									</p>
								</div>
							</div>

							{/* Notes Section (Only renders if there are notes) */}
							{selectedBooking.notes && (
								<div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
									<div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500 font-medium mb-2">
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
										Additional Notes
									</div>
									<p className="text-sm text-foreground/80 whitespace-pre-wrap pl-6">
										{selectedBooking.notes}
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
			{/* ============================================== */}


			{/* Confirmation Cancel Modal */}
			{bookingToCancel && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBookingToCancel(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Confirm Cancellation</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to cancel this booking? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button onClick={() => setBookingToCancel(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Go Back</button>
							<button onClick={executeCancel} className="px-4 py-2 text-sm rounded-md bg-danger text-destructive-foreground hover:bg-danger/90 transition-colors">Cancel Booking</button>
						</div>
					</div>
				</div>
			)}

			{/* Confirmation Delete Modal */}
			{bookingToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setBookingToDelete(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to delete this booking completely? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button onClick={() => setBookingToDelete(null)} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors">Cancel</button>
							<button onClick={executeDelete} className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors">Delete</button>
						</div>
					</div>
				</div>
			)}

			{/* Alert Feedback Modal */}
			{alertModal.show && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setAlertModal({ ...alertModal, show: false })}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
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