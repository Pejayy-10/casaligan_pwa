import { createClient } from "./client";
import { getAdminId } from "./adminQueries";

export async function getReviews(limit = 50, offset = 0) {
	const supabase = createClient();

	const { data, error, count } = await supabase
		.from("reviews")
		.select(`
			review_id,
			rating,
			comment,
			created_at,
			is_hidden,
			deleted_at,
			reviewer:reviewer_user_id (
				user_id,
				name,
				email,
				role,
				status
			),
			target:target_user_id (
				user_id,
				name,
				email,
				role,
				status
			)
		`, { count: "exact" })
		.is("deleted_at", null)
		.order("created_at", { ascending: false })
		.range(offset, offset + limit - 1);

	return { data, error, count };
}

export async function hideReview(reviewId: number) {
	const supabase = createClient();
	
	// Get the current admin's ID from the database
	const { admin_id, error: adminError } = await getAdminId();
	
	if (adminError || !admin_id) {
		return { data: null, error: adminError || new Error("Admin not authenticated") };
	}

	const { data, error } = await supabase
		.from("reviews")
		.update({
			is_hidden: true,
			hidden_at: new Date().toISOString(),
			hidden_by_admin_id: admin_id,
		})
		.eq("review_id", reviewId);

	return { data, error };
}

export async function unhideReview(reviewId: number) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("reviews")
		.update({
			is_hidden: false,
			hidden_at: null,
			hidden_by_admin_id: null,
		})
		.eq("review_id", reviewId);

	return { data, error };
}

export async function warnReviewer(reviewId: number, reason?: string) {
	const supabase = createClient();
	
	// Get the current admin's ID from the database
	const { admin_id, error: adminError } = await getAdminId();
	
	if (adminError || !admin_id) {
		return { data: null, error: adminError || new Error("Admin not authenticated") };
	}

	// Get the review to find the reviewer user ID
	const { data: review, error: reviewError } = await supabase
		.from("reviews")
		.select("reviewer_user_id")
		.eq("review_id", reviewId)
		.single();

	if (reviewError || !review) {
		return { data: null, error: reviewError || new Error("Review not found") };
	}

	// Update the review with warning timestamp and admin ID
	const { data, error } = await supabase
		.from("reviews")
		.update({
			warned_at: new Date().toISOString(),
			warned_by_admin_id: admin_id,
		})
		.eq("review_id", reviewId);

	if (error) {
		return { data, error };
	}

	// Create notification for the reviewer if reason is provided
	if (reason && review.reviewer_user_id) {
		await supabase
			.from("notifications")
			.insert({
				user_id: review.reviewer_user_id,
				type: "warning",
				entity_type: "review",
				entity_id: reviewId,
				content: `Policy Violation Warning: You have received a warning regarding your review. Reason: ${reason}`,
				created_at: new Date().toISOString(),
			});
	}

	return { data, error };
}

export async function restrictReviewer(reviewId: number, userId: number, reason?: string) {
	const supabase = createClient();
	
	// Get the current admin's ID from the database
	const { admin_id, error: adminError } = await getAdminId();
	
	if (adminError || !admin_id) {
		return { data: null, error: adminError || new Error("Admin not authenticated") };
	}

	// Update the review record
	const reviewUpdate = await supabase
		.from("reviews")
		.update({
			restricted_at: new Date().toISOString(),
			restricted_by_admin_id: admin_id,
		})
		.eq("review_id", reviewId);

	if (reviewUpdate.error) return reviewUpdate;

	// Also restrict the user account with reason
	const userUpdateData: any = {
		status: "restricted",
		restricted_at: new Date().toISOString(),
		restricted_by_admin_id: admin_id,
	};

	// Add restriction reason if provided
	if (reason) {
		userUpdateData.restriction_reason = reason;
	}

	const userUpdate = await supabase
		.from("users")
		.update(userUpdateData)
		.eq("user_id", userId);

	return userUpdate;
}

export async function unrestrictReviewer(reviewId: number, userId: number) {
	const supabase = createClient();

	// Clear the restriction timestamp in the review record
	const reviewUpdate = await supabase
		.from("reviews")
		.update({
			restricted_at: null,
			restricted_by_admin_id: null,
		})
		.eq("review_id", reviewId);

	if (reviewUpdate.error) return reviewUpdate;

	// Restore the user account status to active and clear restriction data
	const userUpdate = await supabase
		.from("users")
		.update({
			status: "active",
			restriction_reason: null,
			restricted_at: null,
			restricted_by_admin_id: null,
		})
		.eq("user_id", userId);

	return userUpdate;
}

export async function deleteReview(reviewId: number) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("reviews")
		.update({
			deleted_at: new Date().toISOString(),
		})
		.eq("review_id", reviewId);

	return { data, error };
}

export async function getReviewDetails(reviewId: number) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("reviews")
		.select(`
			review_id,
			rating,
			comment,
			created_at,
			is_hidden,
			hidden_at,
			warned_at,
			restricted_at,
			deleted_at,
			reviewer:reviewer_user_id (
				user_id,
				name,
				email,
				role,
				phone_number,
				status
			),
			target:target_user_id (
				user_id,
				name,
				email,
				role,
				phone_number,
				status
			),
			hidden_by:hidden_by_admin_id (
				admin_id,
				users (
					name
				)
			),
			warned_by:warned_by_admin_id (
				admin_id,
				users (
					name
				)
			),
			restricted_by:restricted_by_admin_id (
				admin_id,
				users (
					name
				)
			)
		`)
		.eq("review_id", reviewId)
		.single();

	return { data, error };
}
