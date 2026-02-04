import { createClient } from "./client";
import bcrypt from "bcryptjs";

/**
 * Custom database-based authentication (not using Supabase Auth)
 */

export interface AuthUser {
	user_id: number;
	email: string;
	name: string;
	role: "admin" | "employer" | "worker";
	phone_number: string | null;
	profile_picture: string | null;
}

/**
 * Login with email and password using database
 */
export async function loginWithDatabase(email: string, password: string) {
	const supabase = createClient();

	// Find user in database
	const { data: user, error: userError } = await supabase
		.from("users")
		.select("*")
		.eq("email", email)
		.eq("status", "active")
		.single();

	if (userError || !user) {
		return { 
			data: null, 
			error: new Error("Invalid email or password") 
		};
	}

	// Verify password (assuming passwords are hashed with bcrypt)
	const isPasswordValid = await bcrypt.compare(password, user.password_hash);

	if (!isPasswordValid) {
		return { 
			data: null, 
			error: new Error("Invalid email or password") 
		};
	}

	// Check if user is admin
	let isAdmin = false;
	let admin_id = null;

	if (user.role === "admin") {
		const { data: adminData } = await supabase
			.from("admins")
			.select("admin_id")
			.eq("user_id", user.id)  // Fixed: use user.id instead of user.user_id
			.single();

		if (adminData) {
			isAdmin = true;
			admin_id = adminData.admin_id;
		}
	}

	// Create session in localStorage
	const authData: AuthUser = {
		user_id: user.user_id || user.id,  // Fixed: support both id and user_id
		email: user.email,
		name: user.name,
		role: user.role,
		phone_number: user.phone_number,
		profile_picture: user.profile_picture,
	};

	// Store in localStorage
	if (typeof window !== "undefined") {
		localStorage.setItem("auth_user", JSON.stringify(authData));
		if (admin_id) {
			localStorage.setItem("admin_id", admin_id.toString());
		}
	}

	return { 
		data: { user: authData, admin_id, isAdmin }, 
		error: null 
	};
}

/**
 * Get current logged-in user from localStorage
 */
export function getCurrentUser(): AuthUser | null {
	if (typeof window === "undefined") return null;
	
	const userStr = localStorage.getItem("auth_user");
	if (!userStr) return null;

	try {
		return JSON.parse(userStr);
	} catch {
		return null;
	}
}

/**
 * Get current admin ID
 */
export function getCurrentAdminId(): number | null {
	if (typeof window === "undefined") return null;
	
	const adminIdStr = localStorage.getItem("admin_id");
	return adminIdStr ? parseInt(adminIdStr) : null;
}

/**
 * Logout - clear localStorage
 */
export function logout() {
	if (typeof window !== "undefined") {
		localStorage.removeItem("auth_user");
		localStorage.removeItem("admin_id");
	}
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
	return getCurrentUser() !== null;
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
	const user = getCurrentUser();
	return user?.role === "admin";
}

/**
 * Update user profile in database
 */
export async function updateUserProfile(updates: {
	name?: string;
	phone_number?: string;
	profile_picture?: string;
}) {
	const user = getCurrentUser();
	if (!user) {
		return { data: null, error: new Error("Not authenticated") };
	}

	const supabase = createClient();

	const { data, error } = await supabase
		.from("users")
		.update(updates)
		.eq("user_id", user.user_id)
		.select()
		.single();

	if (!error && data) {
		// Update localStorage
		const updatedUser = { ...user, ...updates };
		localStorage.setItem("auth_user", JSON.stringify(updatedUser));
	}

	return { data, error };
}

/**
 * Update user email in database
 */
export async function updateUserEmail(newEmail: string) {
	const user = getCurrentUser();
	if (!user) {
		return { data: null, error: new Error("Not authenticated") };
	}

	const supabase = createClient();

	// Check if email already exists
	const { data: existingUser } = await supabase
		.from("users")
		.select("user_id")
		.eq("email", newEmail)
		.neq("user_id", user.user_id)
		.single();

	if (existingUser) {
		return { data: null, error: new Error("Email already in use") };
	}

	const { data, error } = await supabase
		.from("users")
		.update({ email: newEmail })
		.eq("user_id", user.user_id)
		.select()
		.single();

	if (!error && data) {
		// Update localStorage
		const updatedUser = { ...user, email: newEmail };
		localStorage.setItem("auth_user", JSON.stringify(updatedUser));
	}

	return { data, error };
}

/**
 * Update user password in database
 */
export async function updateUserPassword(currentPassword: string, newPassword: string) {
	const user = getCurrentUser();
	if (!user) {
		return { data: null, error: new Error("Not authenticated") };
	}

	const supabase = createClient();

	// Get current password hash
	const { data: userData, error: fetchError } = await supabase
		.from("users")
		.select("password_hash")
		.eq("user_id", user.user_id)
		.single();

	if (fetchError || !userData) {
		return { data: null, error: new Error("Failed to verify current password") };
	}

	// Verify current password
	const isValid = await bcrypt.compare(currentPassword, userData.password_hash);
	if (!isValid) {
		return { data: null, error: new Error("Current password is incorrect") };
	}

	// Hash new password
	const newPasswordHash = await bcrypt.hash(newPassword, 10);

	// Update password
	const { data, error } = await supabase
		.from("users")
		.update({ password_hash: newPasswordHash })
		.eq("user_id", user.user_id)
		.select()
		.single();

	return { data, error };
}
