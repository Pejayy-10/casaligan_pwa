"use client";

import { useState, useEffect } from "react";
import { updateAdminProfile, updateAdminEmail, updateAdminPassword, verifyAdminPassword } from "@/lib/supabase/adminProfileQueries";
import { useAdminProfile } from "@/app/contexts/AdminProfileContext";

export default function ProfilePage() {
	const { profile, loading, refreshProfile } = useAdminProfile();
	const [editing, setEditing] = useState(false);
	const [changingEmail, setChangingEmail] = useState(false);
	const [changingPassword, setChangingPassword] = useState(false);

	// Form states
	const [formData, setFormData] = useState({
		name: "",
		phone_number: "",
	});

	const [emailData, setEmailData] = useState({
		currentEmail: "",
		newEmail: "",
		password: "",
	});

	const [passwordData, setPasswordData] = useState({
		currentPassword: "",
		newPassword: "",
		confirmPassword: "",
	});

	useEffect(() => {
		if (profile) {
			setFormData({
				name: profile.users.name || "",
				phone_number: profile.users.phone_number || "",
			});
			setEmailData(prev => ({
				...prev,
				currentEmail: profile.users.email || "",
			}));
		}
	}, [profile]);

	async function handleUpdateProfile() {
		console.log('Updating profile with:', formData);
		const { data, error } = await updateAdminProfile(formData);
		
		console.log('Update result:', { data, error });
		
		if (error) {
			alert(`Error updating profile: ${error.message}`);
		} else {
			alert("Profile updated successfully!");
			setEditing(false);
			await refreshProfile();
		}
	}

	async function handleUpdateEmail() {
		console.log('=== EMAIL UPDATE START ===');
		console.log('Current email:', emailData.currentEmail);
		console.log('New email:', emailData.newEmail);
		console.log('Profile email:', profile?.users?.email);
		
		// Validate new email
		if (!emailData.newEmail || emailData.newEmail.trim() === "") {
			alert("Please enter a new email address");
			return;
		}
		
		// Check if new email is same as current
		if (emailData.newEmail.toLowerCase().trim() === emailData.currentEmail.toLowerCase().trim()) {
			alert("New email is the same as current email");
			return;
		}
		
		// Check against actual profile email too
		if (profile && emailData.newEmail.toLowerCase().trim() === profile.users.email.toLowerCase().trim()) {
			alert("New email is the same as your current logged-in email");
			return;
		}
		
		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(emailData.newEmail)) {
			alert("Please enter a valid email address");
			return;
		}
		
		// Update email
		const { data, error } = await updateAdminEmail(emailData.newEmail);
		
		console.log('Email update result:', { data, error });
		console.log('=== EMAIL UPDATE END ===');
		
		if (error) {
			console.error('Full error object:', error);
			alert(`Error updating email: ${error.message}`);
		} else {
			alert("Email updated successfully! You can now login with your new email address.");
			setChangingEmail(false);
			setEmailData({ currentEmail: emailData.newEmail, newEmail: "", password: "" });
			await refreshProfile();
		}
	}

	async function handleUpdatePassword() {
		if (passwordData.newPassword !== passwordData.confirmPassword) {
			alert("New passwords do not match!");
			return;
		}

		if (passwordData.newPassword.length < 6) {
			alert("Password must be at least 6 characters long!");
			return;
		}

		// Verify current password
		const { isValid, error: verifyError } = await verifyAdminPassword(
			profile.users.email,
			passwordData.currentPassword
		);

		if (!isValid) {
			alert(`Password verification failed: ${verifyError?.message || "Invalid password"}`);
			return;
		}

		// Update password
		const { data, error } = await updateAdminPassword(passwordData.currentPassword, passwordData.newPassword);
		
		if (error) {
			alert(`Error updating password: ${error.message}`);
		} else {
			alert("Password updated successfully!");
			setChangingPassword(false);
			setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
		}
	}

	if (loading) {
		return (
			<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
				<div className="text-center py-12">Loading profile...</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
				<div className="text-center py-12 text-destructive">Failed to load profile</div>
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 sm:px-6 lg:px-8">
			<div>
				<h2 className="text-lg font-semibold">Admin Profile</h2>
				<p className="text-sm text-muted-foreground">Manage your account information and security settings</p>
			</div>

			{/* Profile Information Card */}
			<div className="rounded-2xl border border-border bg-card/70 p-6 space-y-6">
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold">Profile Information</h3>
					{!editing && (
						<button
							type="button"
							onClick={() => setEditing(true)}
							className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							Edit Profile
						</button>
					)}
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="text-sm font-medium text-muted-foreground">Name</label>
						{editing ? (
							<input
								type="text"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
								style={{ color: '#000000' }}
							/>
						) : (
							<p className="mt-1 text-sm">{profile.users.name}</p>
						)}
					</div>

					<div>
						<label className="text-sm font-medium text-muted-foreground">Email</label>
						<p className="mt-1 text-sm">{profile.users.email}</p>
					</div>

					<div>
						<label className="text-sm font-medium text-muted-foreground">Phone Number</label>
						{editing ? (
							<input
								type="text"
								value={formData.phone_number}
								onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
								className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
								style={{ color: '#000000' }}
							/>
						) : (
							<p className="mt-1 text-sm">{profile.users.phone_number || "Not set"}</p>
						)}
					</div>

					<div>
						<label className="text-sm font-medium text-muted-foreground">Admin ID</label>
						<p className="mt-1 text-sm">{profile.admin_id}</p>
					</div>

					<div>
						<label className="text-sm font-medium text-muted-foreground">Member Since</label>
						<p className="mt-1 text-sm">{new Date(profile.users.created_at).toLocaleDateString()}</p>
					</div>
				</div>

				{editing && (
					<div className="flex gap-2">
						<button
							type="button"
							onClick={handleUpdateProfile}
							className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							Save Changes
						</button>
						<button
							type="button"
							onClick={() => {
								setEditing(false);
								setFormData({
									name: profile.users.name || "",
									phone_number: profile.users.phone_number || "",
								});
							}}
							className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
						>
							Cancel
						</button>
					</div>
				)}
			</div>

		{/* Email Change Card */}
		<div className="rounded-2xl border border-border bg-card/70 p-6 space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-base font-semibold">Email Address</h3>
					<p className="text-sm text-muted-foreground">Update your email address</p>
					{profile?.users?.email?.includes('@example.com') && (
						<p className="text-xs text-amber-600 mt-1">
							⚠️ Current email uses test domain. Change it in Supabase Dashboard first to enable email updates.
						</p>
					)}
				</div>
				{!changingEmail && (
					<button
						type="button"
						onClick={() => setChangingEmail(true)}
						disabled={profile?.users?.email?.includes('@example.com')}
						className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						title={profile?.users?.email?.includes('@example.com') ? "Cannot change email from example.com domain" : ""}
					>
						Change Email
					</button>
				)}
			</div>				{changingEmail && (
					<div className="space-y-3">
						<div>
							<label className="text-sm font-medium">Current Email</label>
							<input
								type="email"
								value={emailData.currentEmail}
								disabled
								className="mt-1 w-full px-3 py-2 border border-border rounded-md bg-muted text-muted-foreground"
							/>
						</div>
						<div>
							<label className="text-sm font-medium">New Email</label>
							<input
								type="email"
								value={emailData.newEmail}
								onChange={(e) => setEmailData({ ...emailData, newEmail: e.target.value })}
								className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Enter new email"
								style={{ color: '#000000' }}
							/>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleUpdateEmail}
								className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
							>
								Update Email
							</button>
							<button
								type="button"
								onClick={() => {
									setChangingEmail(false);
									setEmailData({ ...emailData, newEmail: "", password: "" });
								}}
								className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Password Change Card */}
			<div className="rounded-2xl border border-border bg-card/70 p-6 space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-base font-semibold">Password</h3>
						<p className="text-sm text-muted-foreground">Update your password</p>
					</div>
					{!changingPassword && (
						<button
							type="button"
							onClick={() => setChangingPassword(true)}
							className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
						>
							Change Password
						</button>
					)}
				</div>

				{changingPassword && (
					<div className="space-y-3">
					<div>
						<label className="text-sm font-medium">Current Password</label>
						<input
							type="password"
							value={passwordData.currentPassword}
							onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
							className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter current password"
							style={{ color: '#000000' }}
						/>
						</div>
					<div>
						<label className="text-sm font-medium">New Password</label>
						<input
							type="password"
							value={passwordData.newPassword}
							onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
							className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Enter new password (min 6 characters)"
							style={{ color: '#000000' }}
						/>
						</div>
					<div>
						<label className="text-sm font-medium">Confirm New Password</label>
						<input
							type="password"
							value={passwordData.confirmPassword}
							onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
							className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Confirm new password"
							style={{ color: '#000000' }}
						/>
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleUpdatePassword}
								className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
							>
								Update Password
							</button>
							<button
								type="button"
								onClick={() => {
									setChangingPassword(false);
									setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
								}}
								className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors"
							>
								Cancel
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}


