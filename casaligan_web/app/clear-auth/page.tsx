'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClearAuthPage() {
	const router = useRouter();

	useEffect(() => {
		// Clear all auth data
		localStorage.removeItem('auth_user');
		localStorage.removeItem('admin_id');
		localStorage.clear();
		
		console.log('Cleared localStorage');
		
		// Redirect to auth page
		setTimeout(() => {
			router.push('/auth');
		}, 500);
	}, [router]);

	return (
		<div className="flex items-center justify-center min-h-screen">
			<div className="text-center">
				<h1 className="text-2xl font-bold mb-4">Clearing authentication data...</h1>
				<p>Redirecting to login page...</p>
			</div>
		</div>
	);
}
