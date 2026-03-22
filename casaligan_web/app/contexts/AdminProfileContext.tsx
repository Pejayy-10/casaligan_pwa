"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getAdminProfile } from "@/lib/supabase/adminProfileQueries";

interface AdminProfile {
	admin_id: number;
	admin_actions: number;
	users: {
		user_id: number;
		name: string;
		email: string;
		phone_number: string | null;
		profile_picture: string | null;
		created_at: string;
	};
}

interface AdminProfileContextType {
	profile: AdminProfile | null;
	loading: boolean;
	refreshProfile: () => Promise<void>;
}

const AdminProfileContext = createContext<AdminProfileContextType | undefined>(undefined);

export function AdminProfileProvider({ children }: { children: ReactNode }) {
	const [profile, setProfile] = useState<AdminProfile | null>(null);
	const [loading, setLoading] = useState(true);

	const refreshProfile = async () => {
		// Check if user is authenticated first
		const { isAuthenticated, isAdmin } = await import("@/lib/supabase/auth");
		
		if (!isAuthenticated() || !isAdmin()) {
			console.log("User not authenticated or not admin, skipping profile load");
			setLoading(false);
			return;
		}

		const { data, error } = await getAdminProfile();
		if (data) {
			setProfile(data as AdminProfile);
		} else if (error) {
			console.error("Error loading profile:", error.message || error);
		}
		setLoading(false);
	};

	useEffect(() => {
		refreshProfile();
	}, []);

	return (
		<AdminProfileContext.Provider value={{ profile, loading, refreshProfile }}>
			{children}
		</AdminProfileContext.Provider>
	);
}

export function useAdminProfile() {
	const context = useContext(AdminProfileContext);
	if (context === undefined) {
		throw new Error("useAdminProfile must be used within an AdminProfileProvider");
	}
	return context;
}
