import { createClient } from "./client";
import { getAdminId } from "./adminQueries";
import { getCurrentUser, updateUserProfile, updateUserEmail, updateUserPassword } from "./auth";

/**
 * Get the current admin's profile information
 */
export async function getAdminProfile() {
	const supabase = createClient();
	
	// Get current user from localStorage
	const user = getCurrentUser();
	
	if (!user || user.role !== "admin") {
		return { data: null, error: new Error("Admin not authenticated") };
	}

	// Get admin info from database
	const { data: adminData, error: adminError } = await supabase
		.from("admins")
		.select("admin_id, admin_actions")
		.eq("user_id", user.user_id)
		.single();

	if (adminError || !adminData) {
		return { data: null, error: adminError || new Error("Admin not found") };
	}

	// Get user's created_at from users table
	const { data: userData, error: userError } = await supabase
		.from("users")
		.select("created_at")
		.eq("user_id", user.user_id)
		.single();

	// Combine user and admin data
	const profileData = {
		admin_id: adminData.admin_id,
		admin_actions: adminData.admin_actions,
		users: {
			user_id: user.user_id,
			name: user.name,
			email: user.email,
			phone_number: user.phone_number,
			profile_picture: user.profile_picture,
			created_at: userData?.created_at || new Date().toISOString()
		}
	};

	return { data: profileData, error: null };
}

/**
 * Update admin profile information (name, phone number, profile picture)
 */
export async function updateAdminProfile(updates: {
	name?: string;
	phone_number?: string;
	profile_picture?: string;
}) {
	// Use database auth function
	return await updateUserProfile(updates);
}

/**
 * Update admin email in database
 */
export async function updateAdminEmail(newEmail: string) {
	// Use database auth function
	return await updateUserEmail(newEmail);
}

/**
 * Update admin password in database
 */
export async function updateAdminPassword(currentPassword: string, newPassword: string) {
	// Use database auth function
	return await updateUserPassword(currentPassword, newPassword);
}

/**
 * Verify current password before allowing changes
 */
export async function verifyAdminPassword(email: string, password: string) {
	const supabase = createClient();
	
	// Get user's password hash from database
	const { data: user, error } = await supabase
		.from("users")
		.select("password_hash")
		.eq("email", email)
		.single();

	if (error || !user) {
		return { isValid: false, error: new Error("User not found") };
	}

	// Verify password using bcrypt
	const bcrypt = require("bcryptjs");
	const isValid = await bcrypt.compare(password, user.password_hash);

	return { isValid, error: isValid ? null : new Error("Invalid password") };
}

/**
 * Upload admin profile picture
 */
export async function uploadAdminProfilePicture(file: File) {
	const supabase = createClient();
	
	// Get the current admin's ID
	const { admin_id, error: adminError } = await getAdminId();
	
	if (adminError || !admin_id) {
		return { data: null, error: adminError || new Error("Admin not authenticated") };
	}

	// Create unique filename
	const fileExt = file.name.split('.').pop();
	const fileName = `admin_${admin_id}_${Date.now()}.${fileExt}`;
	const filePath = `profile-pictures/${fileName}`;

	// Upload to Supabase Storage
	const { data: uploadData, error: uploadError } = await supabase.storage
		.from('avatars')
		.upload(filePath, file, {
			cacheControl: '3600',
			upsert: true
		});

	if (uploadError) {
		return { data: null, error: uploadError };
	}

	// Get public URL
	const { data: urlData } = supabase.storage
		.from('avatars')
		.getPublicUrl(filePath);

	// Update profile picture in Auth user metadata
	const { data, error } = await supabase.auth.updateUser({
		data: {
			avatar_url: urlData.publicUrl
		}
	});

	return { data: { ...data, publicUrl: urlData.publicUrl }, error };
}
