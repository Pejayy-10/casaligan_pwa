"use client";

import { useEffect, useState } from "react";
import Employers from "@/app/components/Employers";
import TableShell from "@/app/components/TableShell";
import { getEmployers, banEmployer, restrictEmployer, unbanEmployer, unrestrictEmployer } from "@/lib/supabase/employerQueries";
import Image from "next/image";

export default function EmployersPage() {
	const [employers, setEmployers] = useState<any[]>([]);
	const [count, setCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [selectedUser, setSelectedUser] = useState<any>(null);
	const [showModal, setShowModal] = useState(false);
	const [showRestrictModal, setShowRestrictModal] = useState(false);
	const [restrictionReason, setRestrictionReason] = useState("");
	const [restrictingUser, setRestrictingUser] = useState<any>(null);
	const [processing, setProcessing] = useState(false);
	const [analyticsKey, setAnalyticsKey] = useState(0);

	useEffect(() => {
		loadEmployers();
	}, []);

	async function loadEmployers() {
		setLoading(true);
		const { data, count: total } = await getEmployers(50, 0);
		setEmployers(data || []);
		setCount(total || 0);
		setLoading(false);
	}

	// Transform employers data to match TableShell row format
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
					return {
						...emp,
						users: {
							...emp.users,
							status: newStatus
						}
					};
				}
				return emp;
			})
		);
	};

	const handleAction = async (action: "view" | "ban" | "restrict" | "unban" | "unrestrict", row: any) => {
		if (action === "view") {
			setSelectedUser(row);
			setShowModal(true);
		} else if (action === "ban") {
			if (confirm(`Are you sure you want to ban ${row.name}? This will deactivate their account.`)) {
				const { error } = await banEmployer(row.user_id);
				
				if (error) {
					alert(`Error banning user: ${error.message}`);
				} else {
					updateEmployerStatus(row.user_id, 'banned');
					setAnalyticsKey(prev => prev + 1);
					alert(`${row.name} has been banned successfully.`);
				}
			}
		} else if (action === "unban") {
			if (confirm(`Are you sure you want to unban ${row.name}?`)) {
				const { error } = await unbanEmployer(row.user_id);
				
				if (error) {
					alert(`Error unbanning user: ${error.message}`);
				} else {
					updateEmployerStatus(row.user_id, 'active');
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
				const { error } = await unrestrictEmployer(row.user_id);
				
				if (error) {
					alert(`Error unrestricting user: ${error.message}`);
				} else {
					updateEmployerStatus(row.user_id, 'active');
					setAnalyticsKey(prev => prev + 1);
					alert(`${row.name} has been unrestricted successfully.`);
				}
			}
		}
	};

	const handleUnban = async (userId: number, name: string) => {
		if (confirm(`Are you sure you want to unban ${name}?`)) {
			const { error } = await unbanEmployer(userId);
			
			if (error) {
				alert(`Error unbanning user: ${error.message}`);
			} else {
				alert(`${name} has been unbanned successfully.`);
				setShowModal(false);
				setAnalyticsKey(prev => prev + 1);
				await loadEmployers();
			}
		}
	};

	const handleUnrestrict = async (userId: number, name: string) => {
		if (confirm(`Are you sure you want to unrestrict ${name}?`)) {
			const { error } = await unrestrictEmployer(userId);
			
			if (error) {
				alert(`Error unrestricting user: ${error.message}`);
			} else {
				alert(`${name} has been unrestricted successfully.`);
				setShowModal(false);
				setAnalyticsKey(prev => prev + 1);
				await loadEmployers();
			}
		}
	};

	const handleConfirmRestrict = async () => {
		if (!restrictingUser) return;
		
		if (!restrictionReason.trim()) {
			alert("Please provide a reason for restricting this employer.");
			return;
		}

		setProcessing(true);
		const { error } = await restrictEmployer(restrictingUser.user_id, restrictionReason.trim());
		
		if (error) {
			alert(`Error restricting user: ${error.message}`);
			setProcessing(false);
		} else {
			updateEmployerStatus(restrictingUser.user_id, 'restricted');
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
							<h2 className="text-xl font-semibold">Restrict Employer</h2>
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
									placeholder="Please provide a detailed reason for restricting this employer..."
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
			{showModal && selectedUser && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
					<div className="bg-background border border-border rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-semibold">Employer Details</h2>
							<button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">✕</button>
						</div>
						
						{/* Profile Picture */}
						<div className="flex justify-center mb-6">
							<div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted">
								{selectedUser.profile_picture ? (
									<Image 
										src={selectedUser.profile_picture} 
										alt={selectedUser.name}
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

						<div className="space-y-3">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Name</p>
									<p className="font-medium">{selectedUser.name}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Email</p>
									<p className="font-medium">{selectedUser.email}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Phone</p>
									<p className="font-medium">{selectedUser.phone}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Status</p>
									<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
										selectedUser.status === 'active' ? 'bg-green-100 text-green-800' :
										selectedUser.status === 'restricted' ? 'bg-yellow-100 text-yellow-800' :
										selectedUser.status === 'banned' ? 'bg-red-100 text-red-800' :
										'bg-gray-100 text-gray-800'
									}`}>
										{selectedUser.status}
									</span>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Household Size</p>
									<p className="font-medium">{selectedUser.household_size}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Number of Children</p>
									<p className="font-medium">{selectedUser.number_of_children}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Residence Type</p>
									<p className="font-medium">{selectedUser.residence_type}</p>
								</div>
								<div>
									<p className="text-sm text-muted-foreground">Joined Date</p>
									<p className="font-medium">{new Date(selectedUser.date).toLocaleDateString()}</p>
								</div>
							</div>
						</div>
						<div className="mt-6 flex justify-end gap-2">
							{selectedUser.status === 'banned' && (
								<button
									onClick={() => handleUnban(selectedUser.user_id, selectedUser.name)}
									className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
								>
									Unban User
								</button>
							)}
							{selectedUser.status === 'restricted' && (
								<button
									onClick={() => handleUnrestrict(selectedUser.user_id, selectedUser.name)}
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


