"use client";

import { useEffect, useState } from "react";
import TableShell from "@/app/components/TableShell";
import { getPayments, deletePayment, updatePaymentStatus } from "@/lib/supabase/paymentsqueries";

export default function PaymentsPage() {
	const [payments, setPayments] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		loadPayments();
	}, []);

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
				transaction = transactionMethod.split(' ').map(word => 
					word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
				).join(' ');
			}
		}

		return {
			id: payment.payment_id,
			userId: `p${String(payment.payment_id).padStart(3, '0')}`,
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

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
		if (action === "view") {
			// Handle view action - you can add a modal here
			const payment = payments.find(p => p.payment_id === row.payment_id);
			if (payment) {
				const employer = payment.employers?.users || {};
				const worker = payment.workers?.users || {};
				const paymentMethod = payment.payment_methods || {};
				
				alert(`Payment Details:\nPayment ID: ${row.payment_id}\nPayer (Employer): ${employer.name || "N/A"}\nPayee (Worker): ${worker.name || "N/A"}\nAmount: ₱${row.amount}\nStatus: ${row.status}\nPayment Method: ${paymentMethod.provider_name || "N/A"}\nDate: ${new Date(row.date).toLocaleString()}`);
			}
		} else if (action === "ban") {
			// Delete payment
			if (confirm(`Are you sure you want to delete payment ${row.userId} for ${row.employer_name}?`)) {
				const { error } = await deletePayment(row.payment_id);
				
				if (error) {
					alert(`Error deleting payment: ${error.message}`);
				} else {
					alert(`Payment has been deleted successfully.`);
					loadPayments(); // Reload data
				}
			}
		} else if (action === "restrict") {
			// Update payment status (e.g., mark as completed)
			if (confirm(`Are you sure you want to mark payment ${row.userId} as completed?`)) {
				const { error } = await updatePaymentStatus(row.payment_id, "completed");
				
				if (error) {
					alert(`Error updating payment: ${error.message}`);
				} else {
					alert(`Payment has been marked as completed successfully.`);
					loadPayments(); // Reload data
				}
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


