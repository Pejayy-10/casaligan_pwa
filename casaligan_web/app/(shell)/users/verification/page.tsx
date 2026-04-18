"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Verification from "@/app/components/Verification";
import TableShell from "@/app/components/TableShell";
import { getVerifications, approveVerification, rejectVerification } from "@/lib/supabase/verficationQueries";
import { CheckCircle2, XCircle, FileText } from "lucide-react";

type ModalAction = "view" | "approve" | "reject" | null;

// ─── Helper components defined OUTSIDE the page component ───────────────────

const ModalWrapper = ({ children, onClose, maxWidth = "max-w-md" }: { children: React.ReactNode; onClose: () => void; maxWidth?: string }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
        <div className={`bg-background border border-border rounded-2xl ${maxWidth} w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200`} onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ModalHeader = ({ title, onClose, processing, icon }: { title: string; onClose: () => void; processing: boolean, icon?: React.ReactNode }) => (
    <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
            {icon && (
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    {icon}
                </div>
            )}
            <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        </div>
        <button 
            onClick={onClose} 
            disabled={processing} 
            className="text-muted-foreground hover:bg-muted p-2 rounded-full transition-colors leading-none disabled:opacity-50"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────

export default function VerificationPage() {
    const [verifications, setVerifications] = useState<any[]>([]);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [selectedVerification, setSelectedVerification] = useState<any>(null);
    const [modalAction, setModalAction] = useState<ModalAction>(null);
    const [processing, setProcessing] = useState(false);
    
    const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string; isError: boolean }>({
        show: false, title: "", message: "", isError: false,
    });

    useEffect(() => {
        loadVerifications();
    }, []);
    
    useEffect(() => {
      if (showModal || alertModal.show) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
      return () => {
        document.body.style.overflow = "unset";
      };
    }, [showModal, alertModal.show]);

    async function loadVerifications() {
        setLoading(true);
        const { data, count: total, error } = await getVerifications(50, 0);
        if (error) {
            console.error("Error loading verifications:", error);
            setAlertModal({ show: true, title: "Loading Error", message: error.message, isError: true });
        } else {
            setVerifications(data || []);
            setCount(total || 0);
        }
        setLoading(false);
    }

    const rows = verifications.map((verification: any) => {
        const user = verification.users || {};
        const applicationDate = verification.submitted_at || new Date().toISOString();
        const applicationDateObj = new Date(applicationDate);
        const month = String(applicationDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(applicationDateObj.getDate()).padStart(2, '0');
        const year = applicationDateObj.getFullYear();
        const applicationDateFormatted = `${month}-${day}-${year}`;
        const role = user.role || "worker";

        return {
            id: verification.verification_id,
            verification_id: verification.verification_id,
            worker_id: verification.worker_id,
            name: user.name || "N/A",
            email: user.email || "N/A",
            role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(),
            status: verification.status || "pending",
            application_date: applicationDate,
            application_date_formatted: applicationDateFormatted,
            date: applicationDate,
            document_type: verification.document_type || "N/A",
            document_number: verification.document_number || "N/A",
            submitted_at: verification.submitted_at,
            reviewed_at: verification.reviewed_at,
            file_path: verification.file_path,
            users: user
        };
    });

    const openModal = (action: ModalAction, verification: any) => {
        setSelectedVerification(verification);
        setModalAction(action);
        setShowModal(true);
    };

    const closeModal = () => {
        if (processing) return;
        setShowModal(false);
        setSelectedVerification(null);
        setModalAction(null);
    };

    const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
        const verification = verifications.find(v => v.verification_id === row.verification_id) || row;
        
        // Mapping generic table actions to verification-specific actions
        if (action === "view") {
            openModal("view", verification);
        } else if (action === "ban") {
            // Ban mapped to Approve in TableShell based on previous implementation
            openModal("approve", verification);
        } else if (action === "restrict") {
            // Restrict mapped to Reject
            openModal("reject", verification);
        }
    };

    const handleApprove = async () => {
        if (!selectedVerification) return;
        setProcessing(true);
        
        const adminId = 1; // TODO: Get from auth session
        const { error } = await approveVerification(selectedVerification.verification_id, adminId);
        
        if (error) {
            setAlertModal({ show: true, title: "Approval Error", message: error.message, isError: true });
            setProcessing(false);
        } else {
            setAlertModal({ show: true, title: "Success", message: `Verification for ${selectedVerification.users?.name || selectedVerification.name} has been approved.`, isError: false });
            setShowModal(false);
            await loadVerifications();
            setProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedVerification) return;
        setProcessing(true);
        
        const adminId = 1; // TODO: Get from auth session
        const { error } = await rejectVerification(selectedVerification.verification_id, adminId);
        
        if (error) {
            setAlertModal({ show: true, title: "Rejection Error", message: error.message, isError: true });
            setProcessing(false);
        } else {
            setAlertModal({ show: true, title: "Success", message: `Verification for ${selectedVerification.users?.name || selectedVerification.name} has been rejected.`, isError: false });
            setShowModal(false);
            await loadVerifications();
            setProcessing(false);
        }
    };

    const userName = selectedVerification?.users?.name || selectedVerification?.name || "N/A";

    // Shared verification detail sections rendered inside modals
    const VerificationDetails = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Card */}
                <div className="bg-muted/10 border border-border rounded-xl p-4 flex items-start gap-4">
                    <div className="bg-blue-100 text-blue-600 p-2.5 rounded-full mt-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applicant</p>
                            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                                selectedVerification?.users?.status === 'active' ? 'bg-green-100 text-green-800' :
                                selectedVerification?.users?.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
                                selectedVerification?.users?.status === 'banned' ? 'bg-danger/10 text-danger' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                                {selectedVerification?.users?.status || "N/A"}
                            </span>
                        </div>
                        <p className="font-medium text-foreground truncate">{userName}</p>
                        <p className="text-sm text-muted-foreground truncate">{selectedVerification?.users?.email || selectedVerification?.email || "N/A"}</p>
                        <p className="text-sm text-muted-foreground truncate">{selectedVerification?.users?.phone_number || "N/A"}</p>
                    </div>
                </div>

                {/* Status Card */}
                <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Request Status</p>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                            selectedVerification?.status === 'approved' ? 'bg-green-100 text-green-800' :
                            selectedVerification?.status === 'rejected' ? 'bg-danger/10 text-danger' :
                            selectedVerification?.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                        }`}>
                            {selectedVerification?.status || "pending"}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">ID: {selectedVerification?.verification_id || "N/A"}</span>
                    </div>
                    
                    <div className="space-y-1 mt-3 pt-3 border-t border-border/50">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Submitted:</span>
                            <span className="font-medium">{selectedVerification?.submitted_at ? new Date(selectedVerification.submitted_at).toLocaleDateString() : "N/A"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Reviewed:</span>
                            <span className="font-medium">{selectedVerification?.reviewed_at ? new Date(selectedVerification.reviewed_at).toLocaleDateString() : "-"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Info */}
            <div className="bg-muted/30 border border-border/50 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border/50">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Provided Identification</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Document Type</p>
                        <p className="font-medium text-sm">{selectedVerification?.document_type || "N/A"}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Document Number</p>
                        <p className="font-medium text-sm">{selectedVerification?.document_number || "N/A"}</p>
                    </div>
                </div>

                {selectedVerification?.file_path && (
                    <div className="mt-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Attached File</p>
                        <div className="border border-border rounded-lg p-2 bg-background">
                            {selectedVerification.file_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                <div className="relative w-full h-48 sm:h-64 rounded-md overflow-hidden bg-muted/20">
                                    <Image
                                        src={selectedVerification.file_path}
                                        alt="Verification Document"
                                        fill
                                        className="object-contain"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-muted-foreground" />
                                        <span className="text-sm font-medium truncate max-w-[200px]">Document File</span>
                                    </div>
                                    <a
                                        href={selectedVerification.file_path}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-medium text-primary hover:underline px-3 py-1.5 bg-primary/10 rounded-md"
                                    >
                                        View / Download
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
            <div>
                <h1 className="heading">User Verification</h1>
                <p className="text-muted-foreground">Review and process user verification requests.</p>
            </div>

            <Verification />

            {loading ? (
                <div className="text-center py-12 text-muted-foreground">Loading verifications...</div>
            ) : (
                <TableShell
                    rows={rows}
                    title="Verifications"
                    description="Pending and processed verification requests."
                    onAction={handleAction}
                    actionType="verification"
                />
            )}

            {/* View Modal */}
            {showModal && selectedVerification && modalAction === "view" && (
                <ModalWrapper onClose={closeModal} maxWidth="max-w-2xl">
                    <ModalHeader 
                        title="Verification Details" 
                        onClose={closeModal} 
                        processing={processing} 
                        icon={<FileText className="w-5 h-5" />}
                    />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <VerificationDetails />
                    </div>
                    <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end rounded-b-2xl">
                        <button onClick={closeModal} className="px-4 py-2 text-sm font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors">
                            Close
                        </button>
                    </div>
                </ModalWrapper>
            )}

            {/* Approve Modal */}
            {showModal && selectedVerification && modalAction === "approve" && (
                <ModalWrapper onClose={closeModal} maxWidth="max-w-2xl">
                    <ModalHeader 
                        title="Approve Verification" 
                        onClose={closeModal} 
                        processing={processing}
                        icon={<CheckCircle2 className="w-5 h-5" />} 
                    />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                            <p className="text-sm text-green-800 leading-relaxed">
                                <strong>Confirm Approval:</strong> You are about to approve the verification request for <strong>{userName}</strong>. This will grant them a verified badge and full platform access.
                            </p>
                        </div>
                        <VerificationDetails />
                    </div>
                    <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
                        <button
                            onClick={closeModal}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={processing}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 min-w-[140px]"
                        >
                            {processing ? "Processing..." : "Approve Request"}
                        </button>
                    </div>
                </ModalWrapper>
            )}

            {/* Reject Modal */}
            {showModal && selectedVerification && modalAction === "reject" && (
                <ModalWrapper onClose={closeModal} maxWidth="max-w-2xl">
                    <ModalHeader 
                        title="Reject Verification" 
                        onClose={closeModal} 
                        processing={processing}
                        icon={<XCircle className="w-5 h-5" />}
                    />
                    <div className="p-6 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-6">
                            <p className="text-sm text-danger leading-relaxed">
                                <strong>Warning:</strong> You are about to reject the verification request for <strong>{userName}</strong>. The user will be notified and required to resubmit valid documentation.
                            </p>
                        </div>
                        <VerificationDetails />
                    </div>
                    <div className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-2xl">
                        <button
                            onClick={closeModal}
                            disabled={processing}
                            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleReject}
                            disabled={processing}
                            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-danger text-white rounded-md hover:bg-danger/90 transition-colors disabled:opacity-50 min-w-[140px]"
                        >
                            {processing ? "Processing..." : "Reject Request"}
                        </button>
                    </div>
                </ModalWrapper>
            )}

            {/* Alert Feedback Modal */}
            {alertModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setAlertModal({ ...alertModal, show: false })}>
                    <div className="bg-background border border-border rounded-2xl max-w-md w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 text-center">
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