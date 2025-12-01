"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginWithDatabase } from "@/lib/supabase/auth";
import LavaBackground from "./LavaBackground";

export default function AuthPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// Check if already logged in
	useEffect(() => {
		const checkAuth = async () => {
			const { isAuthenticated, isAdmin } = await import("@/lib/supabase/auth");
			if (isAuthenticated() && isAdmin()) {
				router.push("/");
			}
		};
		checkAuth();
	}, [router]);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			// Use database-based authentication
			const { data, error: loginError } = await loginWithDatabase(email, password);

			if (loginError) {
				setError(loginError.message || "Invalid email or password");
				setLoading(false);
				return;
			}

			if (data) {
				// Check if user is admin
				if (data.user.role !== "admin") {
					setError("Access denied. Admin access only.");
					setLoading(false);
					return;
				}

				// Redirect to dashboard after successful sign-in
				router.push("/");
				router.refresh();
			}
		} catch (err) {
			console.error("Login error:", err);
			setError("An unexpected error occurred. Please try again.");
			setLoading(false);
		}
	};

	return (
		<div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-accent">
			<LavaBackground />
			<div className="relative z-10 w-full max-w-sm rounded-lg border border-white/20 bg-background/60 backdrop-blur-md p-6 shadow-lg">
				<h1 className="heading mb-1">Sign in</h1>
				<p className="text-foreground/80 mb-6">Access your Casaligan dashboard.</p>
				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
							{error}
						</div>
					)}
					<div className="space-y-2">
						<label htmlFor="email" className="block text-sm">Email</label>
						<input
							id="email"
							name="email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
							className="w-full rounded-md border border-border bg-background/70 backdrop-blur-sm px-3 py-2 outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
							placeholder="you@example.com"
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="password" className="block text-sm">Password</label>
						<input
							id="password"
							name="password"
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={loading}
							className="w-full rounded-md border border-border bg-background/70 backdrop-blur-sm px-3 py-2 outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
							placeholder="••••••••"
						/>
					</div>
					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-md bg-primary text-primary-foreground px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? "Signing in..." : "Sign in"}
					</button>
				</form>
			</div>
		</div>
	);
}


