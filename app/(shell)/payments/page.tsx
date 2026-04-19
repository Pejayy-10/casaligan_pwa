"use client";

import { useEffect, useState, useMemo } from "react";
import { getPayments, deletePayment, getPlatformFinanceOverview, updatePlatformFeeSettings } from "@/lib/supabase/paymentsqueries";
import { SearchBar } from "@/app/components/SearchBar";
import { Banknote, User, Eye, CheckCircle2, XCircle, X, Trash2, Settings, Wallet, FileText, Briefcase, ShieldAlert } from "lucide-react";

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

    // Table & Pagination States
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 10;

    // Modal States
    const [viewPayment, setViewPayment] = useState<any>(null);
    const [paymentToDelete, setPaymentToDelete] = useState<any>(null);
    const [processing, setProcessing] = useState(false);
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
        show: false, title: "", message: "", isError: false,
    });

    useEffect(() => {
        loadPayments();
        loadFinanceOverview();
    }, []);

    // Reset page to 1 when searching
    useEffect(() => {
        setPage(1);
    }, [query]);

    // Lock body scroll when any modal is open
    useEffect(() => {
        if (viewPayment || paymentToDelete || alertModal.show) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [viewPayment, paymentToDelete, alertModal.show]);

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
            setAlertModal({ show: true, title: "Invalid Input", message: "Please enter valid numeric fee values.", isError: true });
            return;
        }

        if (flatPostFee < 0) {
            setAlertModal({ show: true, title: "Invalid Input", message: "Flat post fee must be 0 or higher.", isError: true });
            return;
        }

        if (insuranceFee < 0 || insuranceFee > 100 || directHireFee < 0 || directHireFee > 100) {
            setAlertModal({ show: true, title: "Invalid Input", message: "Fee percentages must be between 0 and 100.", isError: true });
            return;
        }

        setSavingFees(true);
        const { error } = await updatePlatformFeeSettings(insuranceFee, directHireFee, flatPostFee);
        setSavingFees(false);

        if (error) {
            setAlertModal({ show: true, title: "Update Error", message: `Failed to update fee settings: ${error.message}`, isError: true });
            return;
        }

        await loadFinanceOverview();
        setAlertModal({ show: true, title: "Success", message: "Platform fee settings updated successfully.", isError: false });
    }

    async function loadPayments() {
        setLoading(true);
        const { data, count: total, error } = await getPayments(500, 0); // Increased limit for client-side pagination
        if (error) {
            console.error("Error loading payments:", error);
            setAlertModal({ show: true, title: "Loading Error", message: `Error loading payments: ${error.message}`, isError: true });
        } else {
            setPayments(data || []);
            setCount(total || 0);
        }
        setLoading(false);
    }

    // Transform payments data to match row format
    const rows = useMemo(() => {
        return payments.map((payment: any) => {
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
    }, [payments]);

    // Search / Filtering logic
    const filteredRows = useMemo(() => {
        const search = query.trim().toLowerCase();
        if (!search) return rows;

        return rows.filter((row) => {
            const haystack = `${row.employer_name} ${row.paid_to} ${row.payment_id} ${row.transaction}`.toLowerCase();
            return haystack.includes(search);
        });
    }, [query, rows]);

    // Pagination logic
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    const pagedRows = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredRows.slice(start, start + pageSize);
    }, [filteredRows, page]);

    const handleAction = async (action: "view" | "delete", row: any) => {
        if (action === "view") {
            const paymentData = payments.find(p => p.payment_id === row.payment_id);
            if (paymentData) {
                setViewPayment({ ...row, rawData: paymentData });
            }
        } else if (action === "delete") {
            setPaymentToDelete(row);
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

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
            <div>
                <h1 className="heading">Payments & Finance</h1>
                <p className="text-muted-foreground">
                    Track platform revenue, fee settings, and user transactions. Total: {count} records
                </p>
            </div>

            {/* Finance Overview Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Flat Post Fees</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">₱{finance.flatPostFeeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Insurance Fees</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">₱{finance.insuranceFeeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-muted-foreground">Direct Hire Fees</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">₱{finance.directHireFeeRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-10">
                        <Wallet className="w-24 h-24 text-primary" />
                    </div>
                    <div className="flex items-center gap-2 mb-2 relative z-10">
                        <Wallet className="w-4 h-4 text-primary" />
                        <p className="text-sm font-semibold text-primary">Total Platform Wallet</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground relative z-10">₱{finance.totalPlatformWallet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>

            {/* Fee Settings Configuration */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                    <Settings className="w-5 h-5 text-foreground" />
                    <h2 className="text-lg font-semibold text-foreground">Platform Fee Settings</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-6">Configure the standard rates and percentages applied to new transactions on the platform.</p>
                
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-6">
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">Flat Job Post Fee (₱)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₱</span>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={flatPostFeeInput}
                                onChange={(e) => setFlatPostFeeInput(e.target.value)}
                                disabled={savingFees}
                                className="w-full pl-8 pr-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">Insurance Fee (%)</label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={insuranceFeeInput}
                                onChange={(e) => setInsuranceFeeInput(e.target.value)}
                                disabled={savingFees}
                                className="w-full pr-8 pl-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-semibold text-foreground mb-2">Direct Hire Fee (%)</label>
                        <div className="relative">
                            <input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                value={directHireFeeInput}
                                onChange={(e) => setDirectHireFeeInput(e.target.value)}
                                disabled={savingFees}
                                className="w-full pr-8 pl-3 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end">
                    <button
                        onClick={handleSaveFees}
                        disabled={savingFees}
                        className="flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[160px]"
                    >
                        {savingFees ? "Saving Changes..." : "Save Configuration"}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/70 p-4 space-y-3">
                <div className="w-full md:w-80">
                    <SearchBar defaultValue={query} onSearch={setQuery} placeholder="Search names, methods, or IDs..." />
                </div>

                <div className="rounded-2xl border border-border bg-muted p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            Showing {pagedRows.length} of {filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""}
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center py-12 text-muted-foreground">Loading payments...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full table-auto">
                                <thead>
                                    <tr className="bg-muted/10">
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Employer (From)</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Worker (To)</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Amount & Method</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Date</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Status</th>
                                        <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-muted/20">
                                    {pagedRows.map((row, i) => (
                                        <tr key={row.id} className={`${i % 2 === 0 ? "bg-background" : "bg-background/5"} hover:bg-secondary/20`}>
                                            <td className="px-4 py-3 text-sm text-foreground font-medium">{row.employer_name}</td>
                                            <td className="px-4 py-3 text-sm text-foreground font-medium">{row.paid_to}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-foreground">{row.amount_formatted}</span>
                                                    <span className="text-xs text-muted-foreground">{row.transaction}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-foreground">
                                                {new Date(row.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                    row.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                    row.status === 'overdue' ? 'bg-danger/10 text-danger' :
                                                    row.status === 'cancelled' ? 'bg-muted text-muted-foreground' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-right">
                                                <div className="inline-flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction("view", row)}
                                                        title="View Details"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-tertiary/10 text-foreground hover:bg-tertiary/50 transition-colors"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAction("delete", row)}
                                                        title="Delete Record"
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-danger/10 text-danger hover:bg-danger/30 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {pagedRows.length === 0 && !loading && (
                        <div className="text-center py-12 text-muted-foreground">
                            No payment records found
                        </div>
                    )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className={`rounded-md px-3 py-1 text-sm border border-border ${page <= 1 ? "text-muted-foreground bg-muted/10" : "bg-muted/5 hover:bg-muted/10 transition-colors"}`}
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className={`rounded-md px-3 py-1 text-sm border border-border ${page >= totalPages ? "text-muted-foreground bg-muted/10" : "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"}`}
                    >
                        Next
                    </button>
                    <div className="text-sm text-muted-foreground ml-2">Page {page} of {totalPages}</div>
                </div>
            </div>

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

                        <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end shrink-0 rounded-b-2xl">
                            <button onClick={() => setViewPayment(null)} className="px-4 py-2 text-sm font-medium bg-background border border-border text-foreground rounded-md hover:bg-muted/50 transition-colors">
                                Close
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
                                className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button 
                                disabled={processing}
                                onClick={executeDelete} 
                                className="px-4 py-2 text-sm font-medium rounded-md bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50 min-w-[100px]"
                            >
                                {processing ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Alert Feedback Modal (Using Danger instead of Destructive for errors) */}
            {alertModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
                    <div className="bg-background border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center" onClick={(e) => e.stopPropagation()}>
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
                                className="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}