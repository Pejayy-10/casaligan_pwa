"use client";

import { useEffect, useState } from "react";
import Employers from "@/app/components/Employers";
import TableShell from "@/app/components/TableShell";
import { getEmployers, banEmployer, restrictEmployer, unbanEmployer, unrestrictEmployer } from "@/lib/supabase/employerQueries";
import Image from "next/image";
import { ShieldAlert, Ban, CheckCircle2, User, Eye, Home, Users } from "lucide-react";

type ModalType = "view" | "ban" | "unban" | "restrict" | "unrestrict" | null;

// ─── Helper components defined OUTSIDE the page component ───────────────────

const ModalWrapper = ({ children, onClose, maxWidth = "max-w-md" }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className={`bg-background border border-border rounded-2xl ${maxWidth} w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200`} onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ModalHeader = ({ title, onClose, processing, icon }: { title: string; onClose: () => void; processing: boolean; icon?: React.ReactNode }) => (
    <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30 shrink-0">
        <div className="flex items-center gap-3">
            {icon && (
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    {icon}
                </div>
            )}
            <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        </div>
        <button onClick={onClose} disabled={processing} className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>
);

const FeedbackMessages = ({ errorMessage, successMessage }: { errorMessage: string; successMessage: string }) => (
    <>
        {errorMessage && (
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-4">
                <p className="text-sm text-danger">{errorMessage}</p>
            </div>
        )}
        {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                <p className="text-sm text-green-800">{successMessage}</p>
            </div>
        )}
    </>
);

const UserDetails = ({ user }: { user: any }) => (
    <div className="bg-muted/10 border border-border rounded-xl p-4 flex items-center gap-4 mb-4">
        <div className="h-12 w-12 rounded-full overflow-hidden border border-border bg-muted shrink-0 relative">
            {user?.profile_picture ? (
                <Image src={user.profile_picture} alt={user?.name || 'User'} fill className="object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                    <User className="w-6 h-6" />
                </div>
            )}
        </div>
        <div className="flex-1 overflow-hidden">
            <p className="font-medium text-foreground truncate">{user?.name}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            user?.status === 'active' ? 'bg-green-100 text-green-800' :
            user?.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
            user?.status === 'banned' ? 'bg-danger/10 text-danger' :
            'bg-gray-100 text-gray-800'
        }`}>
            {user?.status}
        </span>
    </div>
);

const ModalFooter = ({
    onConfirm,
    onClose,
    confirmLabel,
    confirmClass,
    processing,
    successMessage,
    disabled,
}: {
    onConfirm: () => void;
    onClose: () => void;
    confirmLabel: string;
    confirmClass: string;
    processing: boolean;
    successMessage: string;
    disabled?: boolean;
}) => (
    <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 shrink-0 rounded-b-2xl">
        <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
            {successMessage ? "Close" : "Cancel"}
        </button>
        {!successMessage && (
            <button
                onClick={onConfirm}
                disabled={processing || disabled}
                className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors disabled:opacity-50 min-w-[120px] ${confirmClass}`}
            >
                {processing ? "Processing..." : confirmLabel}
            </button>
        )}
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function EmployersPage() {
    const [employers, setEmployers] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [restrictionReason, setRestrictionReason] = useState("");
    const [processing, setProcessing] = useState(false);
    const [analyticsKey, setAnalyticsKey] = useState(0);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        loadEmployers();
    }, []);
    
    useEffect(() => {
      if (activeModal) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
    
      return () => {
        document.body.style.overflow = "unset";
      };
    }, [activeModal]);

    async function loadEmployers() {
        setLoading(true);
        const { data, count: total } = await getEmployers(50, 0);
        setEmployers(data || []);
        setCount(total || 0);
        setLoading(false);
    }

    const rows = employers.map((employer: any) => {
        const user = employer.users || {};
        return {
            id: employer.employer_id,
            user_id: employer.user_id,
            name: user.name || "N/A",
            email: user.email || "N/A",
            status: user.status || "active",
            date: user.created_at || new Date().toISOString(),
            phone: user.phone_number || "N/A",
            profile_picture: user.profile_picture || null,
            household_size: employer.household_size || 0,
            number_of_children: employer.number_of_children || 0,
            residence_type: employer.residence_type || "N/A",
        };
    });

    const updateEmployerStatus = (userId: number, newStatus: string) => {
        setEmployers(prevEmployers =>
            prevEmployers.map(emp => {
                if (emp.user_id === userId && emp.users) {
                    return { ...emp, users: { ...emp.users, status: newStatus } };
                }
                return emp;
            })
        );
        if (selectedUser?.user_id === userId) {
            setSelectedUser((prev: any) => ({ ...prev, status: newStatus }));
        }
    };

    const openModal = (type: ModalType, row: any) => {
        setSelectedUser(row);
        setActiveModal(type);
        setRestrictionReason("");
        setSuccessMessage("");
        setErrorMessage("");
    };

    const closeModal = () => {
        if (processing) return;
        setActiveModal(null);
        setSelectedUser(null);
        setRestrictionReason("");
        setSuccessMessage("");
        setErrorMessage("");
    };

    const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
        openModal(action, row);
    };

    const handleConfirmBan = async () => {
        if (!selectedUser) return;
        setProcessing(true);
        setErrorMessage("");
        const { error } = await banEmployer(selectedUser.user_id);
        if (error) {
            setErrorMessage(`Error banning user: ${error.message}`);
        } else {
            updateEmployerStatus(selectedUser.user_id, 'banned');
            setAnalyticsKey(prev => prev + 1);
            setSuccessMessage(`${selectedUser.name} has been banned successfully.`);
        }
        setProcessing(false);
    };

    const handleConfirmUnban = async () => {
        if (!selectedUser) return;
        setProcessing(true);
        setErrorMessage("");
        const { error } = await unbanEmployer(selectedUser.user_id);
        if (error) {
            setErrorMessage(`Error unbanning user: ${error.message}`);
        } else {
            updateEmployerStatus(selectedUser.user_id, 'active');
            setAnalyticsKey(prev => prev + 1);
            setSuccessMessage(`${selectedUser.name} has been unbanned successfully.`);
        }
        setProcessing(false);
    };

    const handleConfirmRestrict = async () => {
        if (!selectedUser) return;
        if (!restrictionReason.trim()) {
            setErrorMessage("Please provide a reason for restricting this employer.");
            return;
        }
        setProcessing(true);
        setErrorMessage("");
        const { error } = await restrictEmployer(selectedUser.user_id, restrictionReason.trim());
        if (error) {
            setErrorMessage(`Error restricting user: ${error.message}`);
        } else {
            updateEmployerStatus(selectedUser.user_id, 'restricted');
            setAnalyticsKey(prev => prev + 1);
            setSuccessMessage(`${selectedUser.name} has been restricted successfully.`);
        }
        setProcessing(false);
    };

    const handleConfirmUnrestrict = async () => {
        if (!selectedUser) return;
        setProcessing(true);
        setErrorMessage("");
        const { error } = await unrestrictEmployer(selectedUser.user_id);
        if (error) {
            setErrorMessage(`Error unrestricting user: ${error.message}`);
        } else {
            updateEmployerStatus(selectedUser.user_id, 'active');
            setAnalyticsKey(prev => prev + 1);
            setSuccessMessage(`${selectedUser.name} has been unrestricted successfully.`);
        }
        setProcessing(false);
    };

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
                <div className="text-center py-12">Loading employers...</div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
            <div>
                <h1 className="heading">Employers</h1>
                <p className="text-muted-foreground">
                    Manage employer accounts and profiles. Total: {count} employers
                </p>
            </div>

            <Employers key={analyticsKey} />

            <TableShell
                rows={rows}
                title="Employers"
                description="Employer accounts and statuses."
                onAction={handleAction}
            />

            {/* Ban Modal */}
            {activeModal === "ban" && selectedUser && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Ban Employer" onClose={closeModal} processing={processing} icon={<Ban className="w-5 h-5 text-danger" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-danger leading-relaxed">
                                        <strong>Warning:</strong> You are about to ban <strong>{selectedUser.name}</strong>. This will permanently deactivate their account and prevent them from accessing the platform.
                                    </p>
                                </div>
                                <UserDetails user={selectedUser} />
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleConfirmBan}
                        onClose={closeModal}
                        confirmLabel="Confirm Ban"
                        confirmClass="bg-danger hover:bg-danger/90"
                        processing={processing}
                        successMessage={successMessage}
                    />
                </ModalWrapper>
            )}

            {/* Unban Modal */}
            {activeModal === "unban" && selectedUser && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Unban Employer" onClose={closeModal} processing={processing} icon={<CheckCircle2 className="w-5 h-5" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-green-800 leading-relaxed">
                                        <strong>Confirm:</strong> You are about to unban <strong>{selectedUser.name}</strong>. They will regain full access to their account.
                                    </p>
                                </div>
                                <UserDetails user={selectedUser} />
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleConfirmUnban}
                        onClose={closeModal}
                        confirmLabel="Confirm Unban"
                        confirmClass="bg-green-600 hover:bg-green-700"
                        processing={processing}
                        successMessage={successMessage}
                    />
                </ModalWrapper>
            )}

            {/* Restrict Modal */}
            {activeModal === "restrict" && selectedUser && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Restrict Employer" onClose={closeModal} processing={processing} icon={<ShieldAlert className="w-5 h-5 text-yellow-600" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-500 leading-relaxed">
                                        <strong>Warning:</strong> You are about to restrict <strong>{selectedUser.name}</strong>. This will limit their account access temporarily.
                                    </p>
                                </div>
                                <UserDetails user={selectedUser} />
                                <div>
                                    <label htmlFor="restriction-reason" className="block text-sm font-semibold text-foreground mb-2">
                                        Reason for Restriction <span className="text-danger">*</span>
                                    </label>
                                    <textarea
                                        id="restriction-reason"
                                        value={restrictionReason}
                                        onChange={(e) => setRestrictionReason(e.target.value)}
                                        placeholder="Please provide a detailed reason for restricting this employer..."
                                        className="w-full min-h-[120px] px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                        disabled={processing}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleConfirmRestrict}
                        onClose={closeModal}
                        confirmLabel="Restrict User"
                        confirmClass="bg-yellow-600 hover:bg-yellow-700"
                        processing={processing}
                        successMessage={successMessage}
                        disabled={!restrictionReason.trim()}
                    />
                </ModalWrapper>
            )}

            {/* Unrestrict Modal */}
            {activeModal === "unrestrict" && selectedUser && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Unrestrict Employer" onClose={closeModal} processing={processing} icon={<CheckCircle2 className="w-5 h-5" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-blue-800 leading-relaxed">
                                        <strong>Confirm:</strong> You are about to unrestrict <strong>{selectedUser.name}</strong>. They will regain full access to their account.
                                    </p>
                                </div>
                                <UserDetails user={selectedUser} />
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleConfirmUnrestrict}
                        onClose={closeModal}
                        confirmLabel="Unrestrict User"
                        confirmClass="bg-blue-600 hover:bg-blue-700"
                        processing={processing}
                        successMessage={successMessage}
                    />
                </ModalWrapper>
            )}

            {/* View Modal */}
            {activeModal === "view" && selectedUser && (
                <ModalWrapper onClose={closeModal} maxWidth="max-w-2xl">
                    <ModalHeader title="Employer Details" onClose={closeModal} processing={processing} icon={<Eye className="w-5 h-5" />} />
                    
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
                        
                        {/* Profile Header Card */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-card border border-border rounded-xl p-6 shadow-sm">
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-background shadow-md bg-muted shrink-0">
                                {selectedUser.profile_picture ? (
                                    <Image src={selectedUser.profile_picture} alt={selectedUser.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                        <User className="w-12 h-12" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 text-center sm:text-left space-y-2">
                                <div>
                                    <h3 className="text-2xl font-bold text-foreground leading-tight">{selectedUser.name}</h3>
                                    <p className="text-muted-foreground">{selectedUser.email}</p>
                                </div>
                                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                    selectedUser.status === 'active' ? 'bg-green-100 text-green-800' :
                                    selectedUser.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
                                    selectedUser.status === 'banned' ? 'bg-danger/10 text-danger' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                    {selectedUser.status}
                                </span>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-muted/10 border border-border rounded-xl p-4">
                                <div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
                                    <User className="w-4 h-4 text-muted-foreground" />
                                    Contact Info
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone Number</p>
                                        <p className="font-medium text-sm">{selectedUser.phone}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined Date</p>
                                        <p className="font-medium text-sm">{new Date(selectedUser.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-muted/10 border border-border rounded-xl p-4">
                                <div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
                                    <Home className="w-4 h-4 text-muted-foreground" />
                                    Household Info
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Residence Type</p>
                                        <p className="font-medium text-sm capitalize">{selectedUser.residence_type}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Size</p>
                                            <p className="font-medium text-sm flex items-center gap-1">
                                                <Users className="w-3 h-3" /> {selectedUser.household_size}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Children</p>
                                            <p className="font-medium text-sm">{selectedUser.number_of_children}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 shrink-0 rounded-b-2xl">
                        {selectedUser.status === 'banned' && (
                            <button onClick={() => openModal("unban", selectedUser)} className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                                Unban User
                            </button>
                        )}
                        {selectedUser.status === 'restricted' && (
                            <button onClick={() => openModal("unrestrict", selectedUser)} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                Unrestrict User
                            </button>
                        )}
                        <button onClick={closeModal} className="px-4 py-2 text-sm font-medium bg-background border border-border text-foreground rounded-md hover:bg-muted/50 transition-colors">
                            Close
                        </button>
                    </div>
                </ModalWrapper>
            )}
        </div>
    );
}