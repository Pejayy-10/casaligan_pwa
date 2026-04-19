"use client";

import { useEffect, useState } from "react";
import TableShell from "@/app/components/TableShell";
import { getPayments, deletePayment, updatePaymentStatus } from "@/lib/supabase/paymentsqueries";
import { Banknote, User, Eye, CheckCircle2, XCircle, X } from "lucide-react";

export default function PaymentsPage() {
    const [payments, setPayments] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Finance States
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
    }, []);

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

    const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
        if (action === "view") {
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
                        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                    <Banknote className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold leading-tight">Payment Details</h2>
                                    <p className="text-xs text-muted-foreground">ID: {viewPayment.payment_id}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewPayment(null)} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
                            
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
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">From (Employer)</p>
                                        <p className="font-medium text-foreground">{viewPayment.employer_name}</p>
                                    </div>
                                </div>

                                <div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
                                    <div className="bg-blue-100 text-blue-600 p-2.5 rounded-full mt-1">
                                        <User className="w-5 h-5" />
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
                    <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
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
                    <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
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
                    <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4 ${alertModal.isError ? 'bg-danger/10' : 'bg-green-100'}`}>
                                {alertModal.isError 
                                    ? <XCircle className="h-6 w-6 text-danger" /> 
                                    : <CheckCircle2 className="h-6 w-6 text-green-600" />
                                }
                            </div>
                            <h2 className={`text-xl font-semibold mb-2 ${alertModal.isError ? "text-danger" : ""}`}>
                                {alertModal.title}
                            </h2>
                            <p className="text-muted-foreground text-sm mb-6">{alertModal.message}</p>
                            <div className="w-full flex justify-end">
                                <button 
                                    onClick={() => setAlertModal({ ...alertModal, show: false })} 
                                    className="w-full px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}