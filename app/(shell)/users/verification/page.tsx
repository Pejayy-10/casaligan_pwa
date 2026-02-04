"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Verification from "@/app/components/Verification";
import TableShell from "@/app/components/TableShell";
import { getVerifications, approveVerification, rejectVerification } from "@/lib/supabase/verficationQueries";

export default function VerificationPage() {
	const [verifications, setVerifications] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [selectedVerification, setSelectedVerification] = useState<any>(null);
	const [modalAction, setModalAction] = useState<"view" | "approve" | "reject" | null>(null);
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		loadVerifications();
	}, []);

	async function loadVerifications() {
		setLoading(true);
		const { data, count: total, error } = await getVerifications(50, 0);
		if (error) {
			console.error("Error loading verifications:", error);
			alert(`Error loading verifications: ${error.message}`);
		} else {
			setVerifications(data || []);
			setCount(total || 0);
		}
		setLoading(false);
	}

	// Transform verifications data to match TableShell row format
	const rows = verifications.map((verification: any) => {
		const user = verification.users || {};
		const worker = verification.workers || {};
		
		// Format application date (submitted_at)
		const applicationDate = verification.submitted_at || new Date().toISOString();
		const applicationDateObj = new Date(applicationDate);
		const month = String(applicationDateObj.getMonth() + 1).padStart(2, '0');
		const day = String(applicationDateObj.getDate()).padStart(2, '0');
		const year = applicationDateObj.getFullYear();
		const applicationDateFormatted = `${month}-${day}-${year}`;
		
		// Get role - verifications are for workers, so role should be "worker"
		const role = user.role || "worker";
		
		return {
			id: verification.verification_id,
			verification_id: verification.verification_id,
			worker_id: verification.worker_id,
			name: user.name || "N/A",
			email: user.email || "N/A",
			role: role.charAt(0).toUpperCase() + role.slice(1).toLowerCase(), // Capitalize first letter
			status: verification.status || "pending",
			application_date: applicationDate,
			application_date_formatted: applicationDateFormatted,
			date: applicationDate, // Keep for backward compatibility
			document_type: verification.document_type || "N/A",
			document_number: verification.document_number || "N/A",
			submitted_at: verification.submitted_at,
			reviewed_at: verification.reviewed_at,
		};
	});

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
		console.log('Action triggered:', action, 'Row:', row);
		// Find the full verification data
		const verification = verifications.find(v => v.verification_id === row.verification_id);
		console.log('Found verification:', verification);
		
		if (action === "view") {
			setSelectedVerification(verification || row);
			setModalAction("view");
			setShowModal(true);
		} else if (action === "ban") {
			// "ban" action is mapped to "approve verification"
			setSelectedVerification(verification || row);
			setModalAction("approve");
			setShowModal(true);
		} else if (action === "restrict") {
			// "restrict" action is mapped to "reject verification"
			setSelectedVerification(verification || row);
			setModalAction("reject");
			setShowModal(true);
		}
	};

	const handleApprove = async () => {
		if (!selectedVerification) return;
		
		setProcessing(true);
		const adminId = 1; // TODO: Get from auth session
		const { error } = await approveVerification(selectedVerification.verification_id, adminId);
		
		if (error) {
			alert(`Error approving verification: ${error.message}`);
			setProcessing(false);
		} else {
			alert(`Verification for ${selectedVerification.users?.name || selectedVerification.name} has been approved successfully.`);
			setShowModal(false);
			setSelectedVerification(null);
			setModalAction(null);
			setProcessing(false);
			loadVerifications(); // Reload data
		}
	};

	const handleReject = async () => {
		if (!selectedVerification) return;
		
		setProcessing(true);
		const adminId = 1; // TODO: Get from auth session
		const { error } = await rejectVerification(selectedVerification.verification_id, adminId);
		
		if (error) {
			alert(`Error rejecting verification: ${error.message}`);
			setProcessing(false);
		} else {
			alert(`Verification for ${selectedVerification.users?.name || selectedVerification.name} has been rejected.`);
			setShowModal(false);
			setSelectedVerification(null);
			setModalAction(null);
			setProcessing(false);
			loadVerifications(); // Reload data
		}
	};

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h1 className="heading">User Verification</h1>
				<p className="text-muted-foreground">Review and process user verification requests.</p>
			</div>

			<Verification />

			{loading ? (
				<div className="text-center py-8">Loading verifications...</div>
			) : (
				<TableShell 
					rows={rows} 
					title="Verifications" 
					description="Pending and processed verification requests." 
					onAction={handleAction}
					actionType="verification"
				/>
			)}

			{/* Verification Modal */}
			{showModal && selectedVerification && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowModal(false);
						setSelectedVerification(null);
						setModalAction(null);
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">
								{modalAction === "view" && "Verification Details"}
								{modalAction === "approve" && "Approve Verification"}
								{modalAction === "reject" && "Reject Verification"}
							</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowModal(false);
										setSelectedVerification(null);
										setModalAction(null);
									}
								}} 
								disabled={processing}
								className="text-muted-foreground hover:text-foreground text-2xl leading-none disabled:opacity-50"
							>
								✕
							</button>
						</div>

						{/* User Information */}
						<div className="space-y-4 mb-6">
							<h3 className="text-lg font-semibold border-b pb-2">User Information</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Name</p>
									<p className="font-medium">{selectedVerification.users?.name || selectedVerification.name || "N/A"}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Email</p>
									<p className="font-medium">{selectedVerification.users?.email || selectedVerification.email || "N/A"}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Phone</p>
									<p className="font-medium">{selectedVerification.users?.phone_number || "N/A"}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">User Status</p>
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										selectedVerification.users?.status === 'active' ? 'bg-green-100 text-green-800' :
										selectedVerification.users?.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
										selectedVerification.users?.status === 'banned' ? 'bg-red-100 text-red-800' :
										'bg-gray-100 text-gray-800'
									}`}>
										{selectedVerification.users?.status || "N/A"}
									</span>
								</div>
							</div>
						</div>

						{/* Verification Information */}
						<div className="space-y-4 mb-6">
							<h3 className="text-lg font-semibold border-b pb-2">Verification Information</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Verification ID</p>
									<p className="font-medium">{selectedVerification.verification_id || "N/A"}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										selectedVerification.status === 'approved' ? 'bg-green-100 text-green-800' :
										selectedVerification.status === 'rejected' ? 'bg-red-100 text-red-800' :
										selectedVerification.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
										'bg-gray-100 text-gray-800'
									}`}>
										{selectedVerification.status || "pending"}
									</span>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Document Type</p>
									<p className="font-medium">{selectedVerification.document_type || "N/A"}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Document Number</p>
									<p className="font-medium">{selectedVerification.document_number || "N/A"}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Submitted At</p>
									<p className="font-medium">
										{selectedVerification.submitted_at 
											? new Date(selectedVerification.submitted_at).toLocaleString() 
											: "N/A"}
									</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Reviewed At</p>
									<p className="font-medium">
										{selectedVerification.reviewed_at 
											? new Date(selectedVerification.reviewed_at).toLocaleString() 
											: "Not reviewed yet"}
									</p>
								</div>
							</div>
						</div>

						{/* Document File */}
						{selectedVerification.file_path && (
							<div className="space-y-4 mb-6">
								<h3 className="text-lg font-semibold border-b pb-2">Document</h3>
								<div className="border border-border rounded-lg p-4 bg-muted/50">
									{selectedVerification.file_path.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
										<div className="relative w-full h-64 rounded-lg overflow-hidden border border-border">
											<Image
												src={selectedVerification.file_path}
												alt="Verification Document"
												fill
												className="object-contain"
											/>
										</div>
									) : (
										<div className="flex items-center gap-2">
											<a 
												href={selectedVerification.file_path} 
												target="_blank" 
												rel="noopener noreferrer"
												className="text-accent hover:underline"
											>
												View Document
											</a>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Action Buttons */}
						<div className="mt-6 flex justify-end gap-2">
							{modalAction === "view" && (
								<button 
									onClick={() => {
										setShowModal(false);
										setSelectedVerification(null);
										setModalAction(null);
									}} 
									className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
								>
									Close
								</button>
							)}
							{modalAction === "approve" && (
								<>
									<button
										onClick={handleApprove}
										disabled={processing}
										className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{processing ? "Processing..." : "Confirm Approval"}
									</button>
									<button 
										onClick={() => {
											setShowModal(false);
											setSelectedVerification(null);
											setModalAction(null);
										}} 
										disabled={processing}
										className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
									>
										Cancel
									</button>
								</>
							)}
							{modalAction === "reject" && (
								<>
									<button
										onClick={handleReject}
										disabled={processing}
										className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{processing ? "Processing..." : "Confirm Rejection"}
									</button>
									<button 
										onClick={() => {
											setShowModal(false);
											setSelectedVerification(null);
											setModalAction(null);
										}} 
										disabled={processing}
										className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
									>
										Cancel
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


