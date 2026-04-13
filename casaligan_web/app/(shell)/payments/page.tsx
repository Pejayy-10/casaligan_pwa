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

	useEffect(() => {
		loadPayments();
		loadFinanceOverview();
	}, []);

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

	async function loadPayments() {
		setLoading(true);
		const { data, count: total, error } = await getPayments(50, 0);
		if (error) {
			console.error("Error loading payments:", error);
			alert(`Error loading payments: ${error.message}`);
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
		
		// Get employer name (the one who employed the job)
		const employerName = employerUser.name || "N/A";
		
		// Get worker name (the one getting paid)
		const workerName = workerUser.name || "N/A";
		
		// Format amount with currency symbol (no decimals, with commas)
		const amount = parseFloat(payment.amount || 0);
		const amountFormatted = `P${Math.round(amount).toLocaleString('en-US')}`;
		
		// Get date - use booking_date (when job was accepted) or payment_date as fallback
		const dateValue = booking.booking_date || payment.payment_date || new Date().toISOString();
		const dateObj = new Date(dateValue);
		const month = String(dateObj.getMonth() + 1).padStart(2, '0');
		const day = String(dateObj.getDate()).padStart(2, '0');
		const year = dateObj.getFullYear();
		const dateFormatted = `${month}-${day}-${year}`;
		
		// Determine status - check if overdue (pending and past due date)
		let status = payment.status || "pending";
		if (status.toLowerCase() === "pending") {
			const paymentDate = payment.payment_date ? new Date(payment.payment_date) : null;
			const bookingDate = booking.booking_date ? new Date(booking.booking_date) : null;
			const dueDate = paymentDate || bookingDate;
			
			if (dueDate && dueDate < new Date()) {
				status = "overdue";
			}
		}
		
		// Get transaction method (how payment was handled)
		const transactionMethod = paymentMethod.provider_name || "-";
		// Format transaction method - handle common cases like "gcash" -> "Gcash", "bank transfer" -> "Bank Transfer"
		let transaction = "-";
		if (transactionMethod !== "-") {
			const method = transactionMethod.toLowerCase();
			if (method === "gcash") {
				transaction = "Gcash";
			} else if (method.includes("bank") || method.includes("transfer")) {
				transaction = "Bank Transfer";
			} else {
				// Capitalize first letter of each word
				transaction = transactionMethod.split(' ').map((word: string) => 
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				).join(' ');
			}
		}

		return {
			id: payment.payment_id,
			userId: payment.payment_id, // Use the unique prefixed ID directly
			payment_id: payment.payment_id,
			employer_name: employerName,
			amount_formatted: amountFormatted,
			paid_to: workerName,
			date_formatted: dateFormatted,
			date: dateValue, // Keep original for filtering
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
		}
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
				<div className="text-center py-8">Loading payments...</div>
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
		</div>
	);
}


