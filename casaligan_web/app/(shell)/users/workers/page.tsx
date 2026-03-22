"use client";

import { useEffect, useState } from "react";
import Workers from "@/app/components/Workers";
import TableShell from "@/app/components/TableShell";
import { getWorkers, banWorker, restrictWorker, unbanWorker, unrestrictWorker, getWorkerSkills, getWorkerCertifications, getWorkerLanguages } from "@/lib/supabase/workerQueries";
import Image from "next/image";

export default function WorkersPage() {
	const [workers, setWorkers] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [selectedWorker, setSelectedWorker] = useState<any>(null);
	const [showModal, setShowModal] = useState(false);
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictingUser, setRestrictingUser] = useState<any>(null);
	const [processing, setProcessing] = useState(false);
	const [analyticsKey, setAnalyticsKey] = useState(0);
	const [workerSkills, setWorkerSkills] = useState<any[]>([]);
	const [workerCertifications, setWorkerCertifications] = useState<any[]>([]);
	const [workerLanguages, setWorkerLanguages] = useState<any[]>([]);
	const [loadingDetails, setLoadingDetails] = useState(false);

	useEffect(() => {
		loadWorkers();
	}, []);

	async function loadWorkers() {
		setLoading(true);
		const { data, count: total } = await getWorkers(50, 0);
		setWorkers(data || []);
		setCount(total || 0);
		setLoading(false);
	}

	async function loadWorkerDetails(workerId: number) {
		setLoadingDetails(true);
		const [skills, certifications, languages] = await Promise.all([
			getWorkerSkills(workerId),
			getWorkerCertifications(workerId),
			getWorkerLanguages(workerId)
		]);
		
		setWorkerSkills(skills.data || []);
		setWorkerCertifications(certifications.data || []);
		setWorkerLanguages(languages.data || []);
		setLoadingDetails(false);
	}

	// Transform workers data to match TableShell row format
	const rows = workers.map((worker: any) => {
		const user = worker.users || {};
		return {
			id: worker.worker_id,
			user_id: worker.user_id,
			name: user.name || "N/A",
			email: user.email || "N/A",
			status: user.status || "active",
			date: user.created_at || new Date().toISOString(),
			phone: user.phone_number || "N/A",
			profile_picture: user.profile_picture || null,
			years_experience: worker.years_experience || 0,
			bio: worker.bio || "",
		};
	});

	const updateWorkerStatus = (userId: number, newStatus: string) => {
		setWorkers(prevWorkers => 
			prevWorkers.map(worker => {
				if (worker.user_id === userId && worker.users) {
					return {
						...worker,
						users: {
							...worker.users,
							status: newStatus
						}
					};
				}
				return worker;
			})
		);
	};

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
		if (action === "view") {
			setSelectedWorker(row);
			setShowModal(true);
			await loadWorkerDetails(row.id);
		} else if (action === "ban") {
			if (confirm(`Are you sure you want to ban ${row.name}? This will deactivate their account.`)) {
				const { error } = await banWorker(row.user_id);
				
				if (error) {
					alert(`Error banning user: ${error.message}`);
				} else {
					updateWorkerStatus(row.user_id, 'banned');
					setAnalyticsKey(prev => prev + 1);
					alert(`${row.name} has been banned successfully.`);
				}
			}
		} else if (action === "unban") {
			if (confirm(`Are you sure you want to unban ${row.name}?`)) {
				const { error } = await unbanWorker(row.user_id);
				
				if (error) {
					alert(`Error unbanning user: ${error.message}`);
				} else {
					updateWorkerStatus(row.user_id, 'active');
					setAnalyticsKey(prev => prev + 1);
					alert(`${row.name} has been unbanned successfully.`);
				}
			}
		} else if (action === "restrict") {
			setRestrictingUser(row);
			setRestrictionReason("");
			setShowRestrictModal(true);
		} else if (action === "unrestrict") {
			if (confirm(`Are you sure you want to unrestrict ${row.name}?`)) {
				const { error } = await unrestrictWorker(row.user_id);
				
				if (error) {
					alert(`Error unrestricting user: ${error.message}`);
				} else {
					updateWorkerStatus(row.user_id, 'active');
					setAnalyticsKey(prev => prev + 1);
					alert(`${row.name} has been unrestricted successfully.`);
				}
			}
		}
	};

	const handleUnban = async (userId: number, name: string) => {
		if (confirm(`Are you sure you want to unban ${name}?`)) {
			const { error } = await unbanWorker(userId);
			
			if (error) {
				alert(`Error unbanning user: ${error.message}`);
			} else {
				updateWorkerStatus(userId, 'active');
				setAnalyticsKey(prev => prev + 1);
				alert(`${name} has been unbanned successfully.`);
				setShowModal(false);
			}
		}
	};

	const handleUnrestrict = async (userId: number, name: string) => {
		if (confirm(`Are you sure you want to unrestrict ${name}?`)) {
			const { error } = await unrestrictWorker(userId);
			
			if (error) {
				alert(`Error unrestricting user: ${error.message}`);
			} else {
				updateWorkerStatus(userId, 'active');
				setAnalyticsKey(prev => prev + 1);
				alert(`${name} has been unrestricted successfully.`);
				setShowModal(false);
			}
		}
	};

	const handleConfirmRestrict = async () => {
		if (!restrictingUser) return;
		
		if (!restrictionReason.trim()) {
			alert("Please provide a reason for restricting this worker.");
			return;
		}

		setProcessing(true);
		const { error } = await restrictWorker(restrictingUser.user_id, restrictionReason.trim());
		
		if (error) {
			alert(`Error restricting user: ${error.message}`);
			setProcessing(false);
		} else {
			updateWorkerStatus(restrictingUser.user_id, 'restricted');
			setAnalyticsKey(prev => prev + 1);
			alert(`${restrictingUser.name} has been restricted successfully.`);
			setShowRestrictModal(false);
			setRestrictingUser(null);
			setRestrictionReason("");
			setProcessing(false);
		}
	};

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
					Manage worker accounts, profiles, and status. Total: {count} workers
				</p>
			</div>

			<Workers key={analyticsKey} />

			<TableShell 
				rows={rows} 
				title="Workers" 
				description="List of workers and account status." 
				onAction={handleAction}
			/>

			{/* Restriction Modal */}
			{showRestrictModal && restrictingUser && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => {
					if (!processing) {
						setShowRestrictModal(false);
						setRestrictingUser(null);
						setRestrictionReason("");
					}
				}}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Restrict Worker</h2>
							<button 
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingUser(null);
										setRestrictionReason("");
									}
								}} 
								disabled={processing}
								className="text-muted-foreground hover:text-foreground text-2xl leading-none disabled:opacity-50"
							>
								✕
							</button>
						</div>

						<div className="space-y-4 mb-6">
							<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
								<p className="text-sm text-yellow-800">
									<strong>Warning:</strong> You are about to restrict <strong>{restrictingUser.name}</strong>. This will limit their account access.
								</p>
							</div>

							<div>
								<label htmlFor="restriction-reason" className="block text-sm font-medium text-foreground mb-2">
									Reason for Restriction <span className="text-red-500">*</span>
								</label>
								<textarea
									id="restriction-reason"
									value={restrictionReason}
									onChange={(e) => setRestrictionReason(e.target.value)}
									placeholder="Please provide a detailed reason for restricting this worker..."
									className="w-full min-h-[120px] px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
									disabled={processing}
								/>
								<p className="mt-1 text-xs text-muted-foreground">
									This reason will be recorded for administrative purposes.
								</p>
							</div>
						</div>

						<div className="flex justify-end gap-2">
							<button
								onClick={handleConfirmRestrict}
								disabled={processing || !restrictionReason.trim()}
								className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{processing ? "Processing..." : "Confirm Restriction"}
							</button>
							<button
								onClick={() => {
									if (!processing) {
										setShowRestrictModal(false);
										setRestrictingUser(null);
										setRestrictionReason("");
									}
								}}
								disabled={processing}
								className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors disabled:opacity-50"
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* View Modal */}
			{showModal && selectedWorker && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Worker Details</h2>
							<button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">✕</button>
						</div>
						
						{/* Profile Picture */}
						<div className="flex justify-center mb-6">
							<div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted">
								{selectedWorker.profile_picture ? (
									<Image 
										src={selectedWorker.profile_picture} 
										alt={selectedWorker.name}
										fill
										className="object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center text-4xl text-muted-foreground">
										👤
									</div>
								)}
							</div>
						</div>

						{/* Basic Info */}
						<div className="space-y-3 mb-6">
							<h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Name</p>
									<p className="font-medium">{selectedWorker.name}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Email</p>
									<p className="font-medium">{selectedWorker.email}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Phone</p>
									<p className="font-medium">{selectedWorker.phone}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										selectedWorker.status === 'active' ? 'bg-green-100 text-green-800' :
										selectedWorker.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
										selectedWorker.status === 'banned' ? 'bg-red-100 text-red-800' :
										'bg-gray-100 text-gray-800'
									}`}>
										{selectedWorker.status}
									</span>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Years of Experience</p>
									<p className="font-medium">{selectedWorker.years_experience}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Joined Date</p>
									<p className="font-medium">{new Date(selectedWorker.date).toLocaleDateString()}</p>
								</div>
								<div className="col-span-2">
									<p className="text-sm text-muted-foreground">Bio</p>
									<p className="font-medium">{selectedWorker.bio || "No bio available"}</p>
								</div>
							</div>
						</div>

						{loadingDetails ? (
							<div className="text-center py-4 text-muted-foreground">Loading additional details...</div>
						) : (
							<>
								{/* Skills */}
								<div className="space-y-3 mb-6">
									<h3 className="text-lg font-semibold border-b pb-2">Skills</h3>
									{workerSkills.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{workerSkills.map((skill: any) => (
												<span key={skill.skill_id} className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
													{skill.name}
												</span>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">No skills listed</p>
									)}
								</div>

								{/* Certifications */}
								<div className="space-y-3 mb-6">
									<h3 className="text-lg font-semibold border-b pb-2">Certifications</h3>
									{workerCertifications.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{workerCertifications.map((cert: any) => (
												<span key={cert.certification_id} className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
													{cert.name}
												</span>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">No certifications listed</p>
									)}
								</div>

								{/* Languages */}
								<div className="space-y-3 mb-6">
									<h3 className="text-lg font-semibold border-b pb-2">Languages</h3>
									{workerLanguages.length > 0 ? (
										<div className="flex flex-wrap gap-2">
											{workerLanguages.map((lang: any) => (
												<span key={lang.language_id} className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
													{lang.name}
												</span>
											))}
										</div>
									) : (
										<p className="text-sm text-muted-foreground">No languages listed</p>
									)}
								</div>
							</>
						)}

						<div className="mt-6 flex justify-end gap-2">
							{selectedWorker.status === 'banned' && (
								<button
									onClick={() => handleUnban(selectedWorker.user_id, selectedWorker.name)}
									className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
								>
									Unban User
								</button>
							)}
							{selectedWorker.status === 'restricted' && (
								<button
									onClick={() => handleUnrestrict(selectedWorker.user_id, selectedWorker.name)}
									className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
								>
									Unrestrict User
								</button>
							)}
							<button onClick={() => setShowModal(false)} className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors">
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}


