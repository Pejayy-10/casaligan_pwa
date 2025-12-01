import { createClient } from "./client";
import { getAdminId } from "./adminQueries";

export async function getConversations(limit = 50, offset = 0) {
	const supabase = createClient();

	// First, let's try to get all messages grouped by conversation
	const { data: allMessages, error: messagesError } = await supabase
		.from("messages")
		.select(`
			message_id,
			conversation_id,
			sender_id,
			content,
			sent_at,
			conversations (
				conversation_id,
				status,
				created_at,
				deleted_at
			)
		`)
		.order("sent_at", { ascending: false })
		.limit(1000);

	if (messagesError) {
		console.error('Error fetching messages:', messagesError);
		return { data: [], error: messagesError, count: 0 };
	}

	if (!allMessages || allMessages.length === 0) {
		return { data: [], error: null, count: 0 };
	}

	// Group messages by conversation
	const conversationMap = new Map();
	
	allMessages.forEach(msg => {
		const convId = msg.conversation_id;
		if (!conversationMap.has(convId)) {
			conversationMap.set(convId, {
				conversation_id: convId,
				created_at: msg.conversations?.created_at || msg.sent_at,
				status: msg.conversations?.status || 'active',
				deleted_at: msg.conversations?.deleted_at,
				last_message: msg.content,
				last_message_at: msg.sent_at,
				sender_ids: new Set([msg.sender_id])
			});
		} else {
			const convo = conversationMap.get(convId);
			convo.sender_ids.add(msg.sender_id);
		}
	});

	// Filter out deleted conversations
	const activeConversations = Array.from(conversationMap.values())
		.filter(c => !c.deleted_at)
		.slice(offset, offset + limit);

	// Get user details for all participants
	const allUserIds = new Set<number>();
	activeConversations.forEach(c => {
		c.sender_ids.forEach((id: number) => allUserIds.add(id));
	});

	const { data: users } = await supabase
		.from("users")
		.select("id, first_name, last_name, email, active_role")
		.in("id", Array.from(allUserIds));

	// Build conversation participants
	const conversationsWithParticipants = activeConversations.map(convo => {
		const participants = Array.from(convo.sender_ids).map((userId: any) => {
			const user = users?.find(u => u.id === userId);
			return {
				user_id: userId,
				role: user?.active_role || 'owner',
				users: user
			};
		});

		return {
			conversation_id: convo.conversation_id,
			created_at: convo.created_at,
			status: convo.status,
			last_message: convo.last_message,
			last_message_at: convo.last_message_at,
			conversation_participants: participants
		};
	});

	return { 
		data: conversationsWithParticipants, 
		error: null, 
		count: conversationMap.size 
	};
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
					id,
					first_name,
					last_name,
					email,
					active_role,
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
			status: "archived",
		})
		.eq("conversation_id", conversationId);

	return { data, error };
}
