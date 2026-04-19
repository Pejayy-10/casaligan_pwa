"use client";

import { useEffect, useState } from "react";
import Workers from "@/app/components/Workers";
import TableShell from "@/app/components/TableShell";
import {
    getWorkers,
    banWorker,
    restrictWorker,
    unbanWorker,
    unrestrictWorker,
    getWorkerSkills,
    getWorkerCertifications,
    getWorkerLanguages
} from "@/lib/supabase/workerQueries";
import Image from "next/image";
import { ShieldAlert, Ban, CheckCircle2, User, Eye, Award, BookOpen, Clock } from "lucide-react";

type ModalType = "view" | "ban" | "unban" | "restrict" | "unrestrict" | null;

// ─────────────────────────────────────────────
// MODAL COMPONENTS
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────

export default function WorkersPage() {
    const [workers, setWorkers] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const [selectedWorker, setSelectedWorker] = useState<any>(null);
    const [activeModal, setActiveModal] = useState<ModalType>(null);

    const [processing, setProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    const [restrictionReason, setRestrictionReason] = useState("");

    const [workerSkills, setWorkerSkills] = useState<any[]>([]);
    const [workerCertifications, setWorkerCertifications] = useState<any[]>([]);
    const [workerLanguages, setWorkerLanguages] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const [analyticsKey, setAnalyticsKey] = useState(0);

    // ─────────────────────────────────────────────
    // EFFECTS
    // ─────────────────────────────────────────────

    useEffect(() => {
        loadWorkers();
    }, []);

    // lock background scroll
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

    // ─────────────────────────────────────────────
    // DATA
    // ─────────────────────────────────────────────

    async function loadWorkers() {
        setLoading(true);
        const { data, count: total } = await getWorkers(50, 0);
        setWorkers(data || []);
        setCount(total || 0);
        setLoading(false);
    }

    async function loadWorkerDetails(workerId: number) {
        setLoadingDetails(true);

        const [skills, certs, langs] = await Promise.all([
            getWorkerSkills(workerId),
            getWorkerCertifications(workerId),
            getWorkerLanguages(workerId)
        ]);

        setWorkerSkills(skills.data || []);
        setWorkerCertifications(certs.data || []);
        setWorkerLanguages(langs.data || []);
        setLoadingDetails(false);
    }

    // ─────────────────────────────────────────────
    // TABLE ROWS
    // ─────────────────────────────────────────────

    const rows = workers.map((w: any) => {
        const u = w.users || {};
        const isBanned = Boolean(u.deleted_at);
        const isRestricted = Boolean(u.restricted_at);
        const effectiveStatus = isBanned ? "banned" : isRestricted ? "restricted" : (u.status || "active");
        return {
            id: w.worker_id,
            user_id: w.user_id,
            name: u.name || "N/A",
            email: u.email || "N/A",
            status: effectiveStatus,
            is_restricted: isRestricted,
            is_banned: isBanned,
            date: u.created_at || new Date().toISOString(),
            phone: u.phone_number || "N/A",
            profile_picture: u.profile_picture || null,
            years_experience: w.years_experience || 0,
            bio: w.bio || ""
        };
    });

    // ─────────────────────────────────────────────
    // STATUS UPDATE
    // ─────────────────────────────────────────────

    const updateStatus = (userId: number, status: string) => {
        setWorkers(prev =>
            prev.map(w =>
                w.user_id === userId
                    ? {
                        ...w,
                        users: {
                            ...w.users,
                            status,
                            deleted_at: status === "banned" ? new Date().toISOString() : null,
                            restricted_at: status === "restricted" ? new Date().toISOString() : null,
                        }
                    }
                    : w
            )
        );
        if (selectedWorker?.user_id === userId) {
            setSelectedWorker((prev: any) => ({ ...prev, status: status }));
        }
    };

    // ─────────────────────────────────────────────
    // MODAL CONTROL
    // ─────────────────────────────────────────────

    const openModal = async (type: ModalType, row: any) => {
        setSelectedWorker(row);
        setActiveModal(type);
        setSuccessMessage("");
        setErrorMessage("");
        setRestrictionReason("");

        if (type === "view") {
            await loadWorkerDetails(row.id);
        }
    };

    const closeModal = () => {
        if (processing) return;
        setActiveModal(null);
        setSelectedWorker(null);
        setSuccessMessage("");
        setErrorMessage("");
        setRestrictionReason("");
    };

    // ─────────────────────────────────────────────
    // ACTION HANDLERS
    // ─────────────────────────────────────────────

    const handleBan = async () => {
        setProcessing(true);
        setErrorMessage("");
        const { error } = await banWorker(selectedWorker.user_id);

        if (error) setErrorMessage(error.message);
        else {
            updateStatus(selectedWorker.user_id, "banned");
            setSuccessMessage(`${selectedWorker.name} has been banned successfully.`);
            setAnalyticsKey(p => p + 1);
        }

        setProcessing(false);
    };

    const handleUnban = async () => {
        setProcessing(true);
        setErrorMessage("");
        const { error } = await unbanWorker(selectedWorker.user_id);

        if (error) setErrorMessage(error.message);
        else {
            updateStatus(selectedWorker.user_id, "active");
            setSuccessMessage(`${selectedWorker.name} has been unbanned successfully.`);
            setAnalyticsKey(p => p + 1);
        }

        setProcessing(false);
    };

    const handleRestrict = async () => {
        if (!restrictionReason.trim()) {
            setErrorMessage("Please provide a reason for restricting this worker.");
            return;
        }

        setProcessing(true);
        setErrorMessage("");
        const { error } = await restrictWorker(
            selectedWorker.user_id,
            restrictionReason.trim()
        );

        if (error) setErrorMessage(error.message);
        else {
            updateStatus(selectedWorker.user_id, "restricted");
            setSuccessMessage(`${selectedWorker.name} has been restricted successfully.`);
            setAnalyticsKey(p => p + 1);
        }

        setProcessing(false);
    };

    const handleUnrestrict = async () => {
        setProcessing(true);
        setErrorMessage("");
        const { error } = await unrestrictWorker(selectedWorker.user_id);

        if (error) setErrorMessage(error.message);
        else {
            updateStatus(selectedWorker.user_id, "active");
            setSuccessMessage(`${selectedWorker.name} has been unrestricted successfully.`);
            setAnalyticsKey(p => p + 1);
        }

        setProcessing(false);
    };

    // ─────────────────────────────────────────────
    // ACTION ROUTER
    // ─────────────────────────────────────────────

    const handleAction = (action: ModalType, row: any) => {
        openModal(action, row);
    };

    // ─────────────────────────────────────────────
    // UI
    // ─────────────────────────────────────────────

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
                <div className="text-center py-12">Loading workers...</div>
            </div>
        );
    }

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
            <div>
                <h1 className="heading">Workers</h1>
                <p className="text-muted-foreground">
                    Manage worker accounts and profiles. Total: {count} workers
                </p>
            </div>

            <Workers key={analyticsKey} />

            <TableShell
                rows={rows}
                title="Workers"
                description="Worker accounts and statuses."
                onAction={handleAction}
            />

            {/* ───────── VIEW ───────── */}
            {activeModal === "view" && selectedWorker && (
                <ModalWrapper onClose={closeModal} maxWidth="max-w-3xl">
                    <ModalHeader title="Worker Details" onClose={closeModal} processing={processing} icon={<Eye className="w-5 h-5" />} />
                    
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-6">
                        
                        {/* Profile Header Card */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-card border border-border rounded-xl p-6 shadow-sm">
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-4 border-background shadow-md bg-muted shrink-0">
                                {selectedWorker.profile_picture ? (
                                    <Image src={selectedWorker.profile_picture} alt={selectedWorker.name} fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                                        <User className="w-12 h-12" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 text-center sm:text-left space-y-2">
                                <div>
                                    <h3 className="text-2xl font-bold text-foreground leading-tight">{selectedWorker.name}</h3>
                                    <p className="text-muted-foreground">{selectedWorker.email}</p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                                        selectedWorker.status === 'active' ? 'bg-green-100 text-green-800' :
                                        selectedWorker.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
                                        selectedWorker.status === 'banned' ? 'bg-danger/10 text-danger' :
                                        'bg-gray-100 text-gray-800'
                                    }`}>
                                        {selectedWorker.status}
                                    </span>
                                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {selectedWorker.years_experience} Years Exp.
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Bio Section */}
                        {selectedWorker.bio && (
                            <div className="bg-muted/10 border border-border rounded-xl p-5">
                                <h4 className="text-sm font-semibold text-foreground mb-2">About / Bio</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{selectedWorker.bio}</p>
                            </div>
                        )}

                        {loadingDetails ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Contact & Basic Info */}
                                <div className="bg-muted/10 border border-border rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        Basic Info
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone Number</p>
                                            <p className="font-medium text-sm">{selectedWorker.phone}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Joined Date</p>
                                            <p className="font-medium text-sm">{new Date(selectedWorker.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Skills & Languages */}
                                <div className="bg-muted/10 border border-border rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
                                        <BookOpen className="w-4 h-4 text-muted-foreground" />
                                        Qualifications
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Languages</p>
                                            {workerLanguages.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {workerLanguages.map(l => (
                                                        <span key={l.id || l.name} className="px-2 py-1 bg-background border border-border rounded-md text-xs font-medium">{l.name}</span>
                                                    ))}
                                                </div>
                                            ) : <p className="text-sm text-muted-foreground italic">None specified</p>}
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Skills</p>
                                            {workerSkills.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {workerSkills.map(s => (
                                                        <span key={s.id || s.name} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium">{s.name}</span>
                                                    ))}
                                                </div>
                                            ) : <p className="text-sm text-muted-foreground italic">None specified</p>}
                                        </div>
                                    </div>
                                </div>

                                {/* Certifications (Full Width) */}
                                <div className="col-span-1 md:col-span-2 bg-muted/10 border border-border rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-foreground font-medium mb-3 pb-2 border-b border-border/50">
                                        <Award className="w-4 h-4 text-muted-foreground" />
                                        Certifications
                                    </div>
                                    {workerCertifications.length > 0 ? (
                                        <ul className="space-y-2">
                                            {workerCertifications.map((c, idx) => (
                                                <li key={idx} className="flex items-start gap-2 text-sm">
                                                    <span className="text-primary mt-0.5">•</span>
                                                    <span className="font-medium text-foreground">{c.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">No certifications provided</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 shrink-0 rounded-b-2xl">
                        {selectedWorker.status === 'banned' && (
                            <button onClick={() => openModal("unban", selectedWorker)} className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                                Unban Worker
                            </button>
                        )}
                        {selectedWorker.status === 'restricted' && (
                            <button onClick={() => openModal("unrestrict", selectedWorker)} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                                Unrestrict Worker
                            </button>
                        )}
                        <button onClick={closeModal} className="px-4 py-2 text-sm font-medium bg-background border border-border text-foreground rounded-md hover:bg-muted/50 transition-colors">
                            Close
                        </button>
                    </div>
                </ModalWrapper>
            )}

            {/* ───────── BAN ───────── */}
            {activeModal === "ban" && selectedWorker && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Ban Worker" onClose={closeModal} processing={processing} icon={<Ban className="w-5 h-5 text-danger" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-danger leading-relaxed">
                                        <strong>Warning:</strong> You are about to ban <strong>{selectedWorker.name}</strong>. This will permanently deactivate their account and prevent them from accessing the platform.
                                    </p>
                                </div>
                                <UserDetails user={selectedWorker} />
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleBan}
                        onClose={closeModal}
                        confirmLabel="Confirm Ban"
                        confirmClass="bg-danger hover:bg-danger/90"
                        processing={processing}
                        successMessage={successMessage}
                    />
                </ModalWrapper>
            )}

            {/* ───────── UNBAN ───────── */}
            {activeModal === "unban" && selectedWorker && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Unban Worker" onClose={closeModal} processing={processing} icon={<CheckCircle2 className="w-5 h-5" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-green-800 leading-relaxed">
                                        <strong>Confirm:</strong> You are about to unban <strong>{selectedWorker.name}</strong>. They will regain full access to their account.
                                    </p>
                                </div>
                                <UserDetails user={selectedWorker} />
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleUnban}
                        onClose={closeModal}
                        confirmLabel="Confirm Unban"
                        confirmClass="bg-green-600 hover:bg-green-700"
                        processing={processing}
                        successMessage={successMessage}
                    />
                </ModalWrapper>
            )}

            {/* ───────── RESTRICT ───────── */}
            {activeModal === "restrict" && selectedWorker && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Restrict Worker" onClose={closeModal} processing={processing} icon={<ShieldAlert className="w-5 h-5 text-yellow-600" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-500 leading-relaxed">
                                        <strong>Warning:</strong> You are about to restrict <strong>{selectedWorker.name}</strong>. This will limit their account access temporarily.
                                    </p>
                                </div>
                                <UserDetails user={selectedWorker} />
                                <div>
                                    <label htmlFor="restriction-reason" className="block text-sm font-semibold text-foreground mb-2">
                                        Reason for Restriction <span className="text-danger">*</span>
                                    </label>
                                    <textarea
                                        id="restriction-reason"
                                        value={restrictionReason}
                                        onChange={(e) => setRestrictionReason(e.target.value)}
                                        placeholder="Please provide a detailed reason for restricting this worker..."
                                        className="w-full min-h-[120px] px-3 py-2 border border-border rounded-xl bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
                                        disabled={processing}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleRestrict}
                        onClose={closeModal}
                        confirmLabel="Restrict Worker"
                        confirmClass="bg-yellow-600 hover:bg-yellow-700"
                        processing={processing}
                        successMessage={successMessage}
                        disabled={!restrictionReason.trim()}
                    />
                </ModalWrapper>
            )}

            {/* ───────── UNRESTRICT ───────── */}
            {activeModal === "unrestrict" && selectedWorker && (
                <ModalWrapper onClose={closeModal}>
                    <ModalHeader title="Unrestrict Worker" onClose={closeModal} processing={processing} icon={<CheckCircle2 className="w-5 h-5" />} />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <FeedbackMessages errorMessage={errorMessage} successMessage={successMessage} />
                        {!successMessage && (
                            <>
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-blue-800 leading-relaxed">
                                        <strong>Confirm:</strong> You are about to unrestrict <strong>{selectedWorker.name}</strong>. They will regain full access to their account.
                                    </p>
                                </div>
                                <UserDetails user={selectedWorker} />
                            </>
                        )}
                    </div>
                    <ModalFooter
                        onConfirm={handleUnrestrict}
                        onClose={closeModal}
                        confirmLabel="Unrestrict Worker"
                        confirmClass="bg-blue-600 hover:bg-blue-700"
                        processing={processing}
                        successMessage={successMessage}
                    />
                </ModalWrapper>
            )}
        </div>
    );
}