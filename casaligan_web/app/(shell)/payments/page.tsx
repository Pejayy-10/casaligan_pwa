"use client";

import { useEffect, useState } from "react";
import TableShell from "@/app/components/TableShell";
import { getPayments, deletePayment, updatePaymentStatus, getPlatformFinanceOverview, updatePlatformFeeSettings } from "@/lib/supabase/paymentsqueries";

export default function PaymentsPage() {
	const [payments, setPayments] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [finance, setFinance] = useState({
		flatPostFeeRevenue: 0,
		insuranceFeeRevenue: 0,
		directHireFeeRevenue: 0,
		totalPlatformWallet: 0,
		flatPostFeeAmount: 20,
		insuranceFeePercentage: 7,
		directHireFeePercentage: 7,
	});
	const [flatPostFeeInput, setFlatPostFeeInput] = useState("20.00");
	const [insuranceFeeInput, setInsuranceFeeInput] = useState("7.00");
	const [directHireFeeInput, setDirectHireFeeInput] = useState("7.00");
	const [savingFees, setSavingFees] = useState(false);

	// Modal States
	const [viewPayment, setViewPayment] = useState<any>(null);
	const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
	const [paymentToComplete, setPaymentToComplete] = useState<any>(null);
	const [processing, setProcessing] = useState(false);
	const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
		show: false, title: "", message: "", isError: false,
	});

	useEffect(() => {
		loadPayments();
		loadFinanceOverview();
	}, []);

<<<<<<< Updated upstream
	async function loadFinanceOverview() {
		const { data, error } = await getPlatformFinanceOverview();
		if (error) {
			console.error("Error loading finance overview:", error);
			return;
		}

		if (data) {
			setFinance(data);
			setFlatPostFeeInput(Number(data.flatPostFeeAmount ?? 20).toFixed(2));
			setInsuranceFeeInput(Number(data.insuranceFeePercentage || 7).toFixed(2));
			setDirectHireFeeInput(Number(data.directHireFeePercentage || 7).toFixed(2));
		}
	}

	async function handleSaveFees() {
		const flatPostFee = Number(flatPostFeeInput);
		const insuranceFee = Number(insuranceFeeInput);
		const directHireFee = Number(directHireFeeInput);

		if (Number.isNaN(flatPostFee) || Number.isNaN(insuranceFee) || Number.isNaN(directHireFee)) {
			alert("Please enter valid fee values.");
			return;
		}

		if (flatPostFee < 0) {
			alert("Flat post fee must be 0 or higher.");
			return;
		}

		if (insuranceFee < 0 || insuranceFee > 100 || directHireFee < 0 || directHireFee > 100) {
			alert("Fee percentages must be between 0 and 100.");
			return;
		}

		setSavingFees(true);
		const { error } = await updatePlatformFeeSettings(insuranceFee, directHireFee, flatPostFee);
		setSavingFees(false);

		if (error) {
			alert(`Failed to update fee settings: ${error.message}`);
			return;
		}

		await loadFinanceOverview();
		alert("Platform fee settings updated successfully.");
	}
=======
	// Lock body scroll when any modal is open
	useEffect(() => {
		if (viewPayment || paymentToDelete || paymentToComplete || alertModal.show) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [viewPayment, paymentToDelete, paymentToComplete, alertModal.show]);
>>>>>>> Stashed changes

	async function loadPayments() {
		setLoading(true);
		const { data, count: total, error } = await getPayments(50, 0);
		if (error) {
			console.error("Error loading payments:", error);
			setAlertModal({ show: true, title: "Loading Error", message: `Error loading payments: ${error.message}`, isError: true });
		} else {
			setPayments(data || []);
			setCount(total || 0);
		}
		setLoading(false);
	}

	// Transform payments data to match TableShell row format
	const rows = payments.map((payment: any) => {
		const employer = payment.employers || {};
		const employerUser = employer.users || {};
		const worker = payment.workers || {};
		const workerUser = worker.users || {};
		const paymentMethod = payment.payment_methods || {};
		const booking = payment.bookings || {};
		
		const employerName = employerUser.name || "N/A";
		const workerName = workerUser.name || "N/A";
		
		const amount = parseFloat(payment.amount || 0);
		const amountFormatted = `₱${Math.round(amount).toLocaleString('en-US')}`;
		
		const dateValue = booking.booking_date || payment.payment_date || new Date().toISOString();
		const dateObj = new Date(dateValue);
		const month = String(dateObj.getMonth() + 1).padStart(2, '0');
		const day = String(dateObj.getDate()).padStart(2, '0');
		const year = dateObj.getFullYear();
		const dateFormatted = `${month}-${day}-${year}`;
		
		let status = payment.status || "pending";
		if (status.toLowerCase() === "pending") {
			const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null;
			const bookingDate = booking.booking_date ? new Date(booking.booking_date) : null;
			const dueDate = paymentDate || bookingDate;
			
			if (dueDate && dueDate < new Date()) {
				status = "overdue";
			}
		}
		
		const transactionMethod = paymentMethod.provider_name || "-";
		let transaction = "-";
		if (transactionMethod !== "-") {
			const method = transactionMethod.toLowerCase();
			if (method === "gcash") {
				transaction = "Gcash";
			} else if (method.includes("bank") || method.includes("transfer")) {
				transaction = "Bank Transfer";
			} else {
<<<<<<< Updated upstream
				// Capitalize first letter of each word
=======
>>>>>>> Stashed changes
				transaction = transactionMethod.split(' ').map((word: string) => 
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				).join(' ');
			}
		}

		return {
			id: payment.payment_id,
			userId: payment.payment_id, 
			payment_id: payment.payment_id,
			employer_name: employerName,
			amount_formatted: amountFormatted,
			paid_to: workerName,
			date_formatted: dateFormatted,
			date: dateValue, 
			status: status,
			transaction: transaction,
			amount: payment.amount || 0,
			payment_date: payment.payment_date,
			payment_method: paymentMethod.provider_name || "N/A",
			contract_id: payment.contract_id,
			booking_id: booking.booking_id || null,
		};
	});

	const handleAction = (action: "delete" | "restrict" | "warn" | "view" | "ban" | "unban" | "unrestrict" | "dismiss", row: Record<string, unknown>) => {
		if (action === "view") {
<<<<<<< Updated upstream
			// Handle view action - you can add a modal here
			const payment = payments.find(p => p.payment_id === row.payment_id);
			if (payment) {
				const employer = payment.employers?.users || {};
				const worker = payment.workers?.users || {};
				const paymentMethod = payment.payment_methods || {};
				
				alert(`Payment Details:\nPayment ID: ${row.payment_id}\nPayer (Employer): ${employer.name || "N/A"}\nPayee (Worker): ${worker.name || "N/A"}\nAmount: ₱${row.amount}\nStatus: ${row.status}\nPayment Method: ${paymentMethod.provider_name || "N/A"}\nDate: ${new Date(row.date as string).toLocaleString()}`);
			}
		} else if (action === "ban" || action === "delete") {
			// Delete payment
			if (confirm(`Are you sure you want to delete payment ${row.userId} for ${row.employer_name}?`)) {
				deletePayment(row.payment_id as number).then(({ error }) => {
					if (error) {
						alert(`Error deleting payment: ${error.message}`);
					} else {
						alert(`Payment has been deleted successfully.`);
						loadPayments(); // Reload data
					}
				});
			}
		} else if (action === "restrict") {
			// Update payment status (e.g., mark as completed)
			if (confirm(`Are you sure you want to mark payment ${row.userId} as completed?`)) {
				updatePaymentStatus(row.payment_id as number, "completed").then(({ error }) => {
					if (error) {
						alert(`Error updating payment: ${error.message}`);
					} else {
						alert(`Payment has been marked as completed successfully.`);
						loadPayments(); // Reload data
					}
				});
			}
=======
			const paymentData = payments.find(p => p.payment_id === row.payment_id);
			if (paymentData) {
				setViewPayment({ ...row, rawData: paymentData });
			}
		} else if (action === "ban") {
			// Map "ban" to Delete Action
			setPaymentToDelete(row);
		} else if (action === "restrict") {
			// Map "restrict" to Mark Completed Action
			setPaymentToComplete(row);
>>>>>>> Stashed changes
		}
	};

	const executeDelete = async () => {
		if (!paymentToDelete) return;
		setProcessing(true);
		const { error } = await deletePayment(paymentToDelete.payment_id);
		
		if (error) {
			setAlertModal({ show: true, title: "Deletion Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Payment has been deleted successfully.", isError: false });
			await loadPayments();
		}
		setProcessing(false);
		setPaymentToDelete(null);
	};

	const executeComplete = async () => {
		if (!paymentToComplete) return;
		setProcessing(true);
		const { error } = await updatePaymentStatus(paymentToComplete.payment_id, "completed");
		
		if (error) {
			setAlertModal({ show: true, title: "Update Error", message: error.message, isError: true });
		} else {
			setAlertModal({ show: true, title: "Success", message: "Payment has been marked as completed successfully.", isError: false });
			await loadPayments();
		}
		setProcessing(false);
		setPaymentToComplete(null);
	};

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h1 className="heading">Payments</h1>
				<p className="text-muted-foreground">
					Track and reconcile payments and transactions. Total: {count} payments
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-4">
				<div className="rounded-xl border p-4">
					<p className="text-sm text-muted-foreground">Flat Post Fee Revenue</p>
					<p className="text-2xl font-semibold">₱{finance.flatPostFeeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
				</div>
				<div className="rounded-xl border p-4">
					<p className="text-sm text-muted-foreground">Insurance Fee Revenue</p>
					<p className="text-2xl font-semibold">₱{finance.insuranceFeeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
				</div>
				<div className="rounded-xl border p-4">
					<p className="text-sm text-muted-foreground">Direct Hire Fee Revenue</p>
					<p className="text-2xl font-semibold">₱{finance.directHireFeeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
				</div>
				<div className="rounded-xl border p-4">
					<p className="text-sm text-muted-foreground">Company Wallet (Total Platform Revenue)</p>
					<p className="text-2xl font-semibold">₱{finance.totalPlatformWallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
				</div>
			</div>

			<div className="rounded-xl border p-4">
				<h2 className="text-lg font-semibold">Platform Fee Settings</h2>
				<p className="mt-1 text-sm text-muted-foreground">Edit the flat post fee and insurance percentages used for new transactions.</p>
				<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
					<label className="space-y-1">
						<span className="text-sm font-medium">Flat Job Post Fee (PHP)</span>
						<input
							type="number"
							min={0}
							step={0.01}
							value={flatPostFeeInput}
							onChange={(e) => setFlatPostFeeInput(e.target.value)}
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-sm font-medium">Insurance Fee (%)</span>
						<input
							type="number"
							min={0}
							max={100}
							step={0.01}
							value={insuranceFeeInput}
							onChange={(e) => setInsuranceFeeInput(e.target.value)}
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-sm font-medium">Direct Hire Fee (%)</span>
						<input
							type="number"
							min={0}
							max={100}
							step={0.01}
							value={directHireFeeInput}
							onChange={(e) => setDirectHireFeeInput(e.target.value)}
							className="w-full rounded-md border px-3 py-2"
						/>
					</label>
				</div>
				<button
					onClick={handleSaveFees}
					disabled={savingFees}
					className="mt-4 rounded-md bg-black px-4 py-2 text-white disabled:opacity-60"
				>
					{savingFees ? "Saving..." : "Save Fee Settings"}
				</button>
			</div>

			{loading ? (
				<div className="text-center py-12 text-muted-foreground">Loading payments...</div>
			) : (
				<TableShell 
					rows={rows} 
					title="Payments" 
					description="Track and reconcile payments and transactions." 
					pageSize={10} 
					onAction={handleAction}
					actionType="payments"
				/>
			)}

			{/* ==============================================
			    PRETTIFIED PAYMENT DETAILS MODAL
			    ============================================== */}
			{viewPayment && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setViewPayment(null)}>
					<div 
						className="bg-background border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
						onClick={(e) => e.stopPropagation()}
					>
						{/* Header */}
						<div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
							<div className="flex items-center gap-3">
								<div className="p-2 bg-primary/10 text-primary rounded-lg">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div>
									<h2 className="text-lg font-semibold leading-tight">Payment Details</h2>
									<p className="text-xs text-muted-foreground">ID: {viewPayment.payment_id}</p>
								</div>
							</div>
							<button onClick={() => setViewPayment(null)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{/* Scrollable Content Body */}
						<div className="p-6 overflow-y-auto space-y-6">
							
							{/* Transaction Summary Card */}
							<div className="bg-card border border-border rounded-xl p-5 shadow-sm text-center">
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Amount</p>
								<h3 className="text-4xl font-bold text-foreground mb-3">{viewPayment.amount_formatted}</h3>
								<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
									viewPayment.status === 'completed' ? 'bg-green-100 text-green-800' :
									viewPayment.status === 'overdue' ? 'bg-danger/10 text-danger' :
									viewPayment.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
									'bg-yellow-100 text-yellow-800'
								}`}>
									{viewPayment.status}
								</span>
							</div>

							{/* People Involved */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
									<div className="bg-purple-100 text-purple-600 p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">From (Employer)</p>
										<p className="font-medium text-foreground">{viewPayment.employer_name}</p>
									</div>
								</div>

								<div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
									<div className="bg-blue-100 text-blue-600 p-2.5 rounded-full mt-1">
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
									</div>
									<div>
										<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">To (Worker)</p>
										<p className="font-medium text-foreground">{viewPayment.paid_to}</p>
									</div>
								</div>
							</div>

							{/* Metadata */}
							<div className="grid grid-cols-2 gap-4 bg-muted/10 border border-border rounded-xl p-4">
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Payment Method</p>
									<p className="font-medium text-foreground">{viewPayment.transaction}</p>
								</div>
								<div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Date Logged</p>
									<p className="font-medium text-foreground">
										{new Date(viewPayment.date).toLocaleString(undefined, { 
											month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' 
										})}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
			{/* ============================================== */}

			{/* Confirm Mark as Completed Modal */}
			{paymentToComplete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setPaymentToComplete(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Mark as Completed?</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to mark the payment for <span className="font-semibold text-foreground">"{paymentToComplete.employer_name}"</span> as completed? This implies the transaction was successfully verified.
						</p>
						<div className="flex justify-end gap-3">
							<button 
								disabled={processing}
								onClick={() => setPaymentToComplete(null)} 
								className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button 
								disabled={processing}
								onClick={executeComplete} 
								className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
							>
								{processing ? "Processing..." : "Complete Payment"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Confirm Delete Modal (Using Danger instead of Destructive) */}
			{paymentToDelete && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => !processing && setPaymentToDelete(null)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-xl font-semibold mb-2">Confirm Deletion</h2>
						<p className="text-muted-foreground text-sm mb-6">
							Are you sure you want to delete this payment record completely? This action cannot be undone.
						</p>
						<div className="flex justify-end gap-3">
							<button 
								disabled={processing}
								onClick={() => setPaymentToDelete(null)} 
								className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
							<button 
								disabled={processing}
								onClick={executeDelete} 
								className="px-4 py-2 text-sm rounded-md bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
							>
								{processing ? "Processing..." : "Delete"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Alert Feedback Modal (Using Danger instead of Destructive for errors) */}
			{alertModal.show && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
						<h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-danger" : ""}`}>
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