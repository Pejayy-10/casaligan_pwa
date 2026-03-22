import { createClient } from "./client";
import { getCurrentUser, getCurrentAdminId } from "./auth";

/**
 * Get the admin_id for the currently logged-in user
 * Uses database-based authentication (not Supabase Auth)
 */
export async function getAdminId() {
	const supabase = createClient();
	
	// Get current user from localStorage
	const user = getCurrentUser();
	
	if (!user) {
		return { admin_id: null, user_id: null, error: new Error("No user logged in") };
	}

	// Check if user is admin
	if (user.role !== "admin") {
		return { admin_id: null, user_id: null, error: new Error("User not authorized as admin") };
	}

	// Get admin_id from admins table
	const { data: adminData, error: adminError } = await supabase
		.from("admins")
		.select("admin_id")
		.eq("user_id", user.user_id)
		.maybeSingle();

	if (adminError || !adminData) {
		return { admin_id: null, user_id: null, error: new Error("User not authorized as admin") };
	}

	return { 
		admin_id: adminData.admin_id,
		user_id: user.user_id,
		error: null 
	};
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin() {
	const { admin_id, error } = await getAdminId();
	return !error && admin_id !== null;
}
