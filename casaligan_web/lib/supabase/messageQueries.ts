import { createClient } from "./client";
import { getAdminId } from "./adminQueries";

export async function getConversations(limit = 50, offset = 0) {
	const supabase = createClient();

	const { data, error, count } = await supabase
		.from("conversations")
		.select(`
			conversation_id,
			created_at,
			last_message_at,
			last_message,
			topic,
			status,
			deleted_at,
			restricted_at,
			conversation_participants!inner (
				user_id,
				role,
				users (
					user_id,
					name,
					email,
					role
				)
			)
		`, { count: "exact" })
		.is("deleted_at", null)
		.order("last_message_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.range(offset, offset + limit - 1);

	return { data, error, count };
}

export async function getConversationDetails(conversationId: number) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("conversations")
		.select(`
			conversation_id,
			created_at,
			last_message_at,
			last_message,
			topic,
			status,
			restricted_at,
			conversation_participants (
				user_id,
				joined_at,
				role,
				users (
					user_id,
					name,
					email,
					role,
					phone_number
				)
			)
		`)
		.eq("conversation_id", conversationId)
		.single();

	return { data, error };
}

export async function restrictConversation(conversationId: number, reason?: string) {
	const supabase = createClient();
	
	// Get the current admin's ID from the database
	const { admin_id, error: adminError } = await getAdminId();
	
	if (adminError || !admin_id) {
		return { data: null, error: adminError || new Error("Admin not authenticated") };
	}

	const updateData: any = {
		status: "restricted",
		restricted_at: new Date().toISOString(),
		restricted_by_admin_id: admin_id,
	};

	// Add restriction reason if provided
	if (reason) {
		updateData.restriction_reason = reason;
	}

	const { data, error } = await supabase
		.from("conversations")
		.update(updateData)
		.eq("conversation_id", conversationId);

	return { data, error };
}

export async function unrestrictConversation(conversationId: number) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("conversations")
		.update({
			status: "active",
			restricted_at: null,
			restricted_by_admin_id: null,
			restriction_reason: null,
		})
		.eq("conversation_id", conversationId);

	return { data, error };
}

export async function deleteConversation(conversationId: number) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("conversations")
		.update({
			deleted_at: new Date().toISOString(),
			status: "closed",
		})
		.eq("conversation_id", conversationId);

	return { data, error };
}
