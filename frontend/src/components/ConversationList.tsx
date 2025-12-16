import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Archive, Clock, CheckCircle, Circle } from 'lucide-react';
import api from '../services/api';

// Helper function to format time
const formatTimeAgo = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
};

interface Conversation {
  conversation_id: number;
  job_id: number | null;
  hire_id: number | null;
  participant_ids: number[];
  participant_names: string[];
  status: 'active' | 'read_only' | 'archived';
  title: string;
  other_participant_name: string;
  last_message: string | null;
  last_message_time: string | null;
  unread_count: number;
  created_at: string;
}

interface ConversationListProps {
  filter?: 'all' | 'active' | 'archived';
  onConversationCountChange?: (count: number) => void;
}

export default function ConversationList({ filter = 'all', onConversationCountChange }: ConversationListProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<number | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filter === 'archived') {
        params.include_archived = 'true';
      }
      
      const response = await api.get('/messages/conversations', { params });
      let data = response.data;
      
      // Filter based on prop
      if (filter === 'active') {
        data = data.filter((c: Conversation) => c.status === 'active');
      } else if (filter === 'archived') {
        data = data.filter((c: Conversation) => c.status === 'archived');
      }
      
      setConversations(data);
      onConversationCountChange?.(data.length);
      setError(null);
    } catch (err: unknown) {
      console.error('Error fetching conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [filter, onConversationCountChange]);

  useEffect(() => {
    fetchConversations();
    
    // Poll for new conversations every 10 seconds
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const handleArchive = async (conversationId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiving(conversationId);
    
    try {
      await api.post(`/messages/conversations/${conversationId}/archive`);
      await fetchConversations();
    } catch (err) {
      console.error('Error archiving conversation:', err);
    } finally {
      setArchiving(null);
    }
  };

  const handleOpenChat = (conversation: Conversation) => {
    const params = new URLSearchParams({
      name: conversation.other_participant_name || 'Unknown',
      title: conversation.title || '',
    });
    navigate(`/chat/${conversation.conversation_id}?${params.toString()}`);
  };

  const truncateMessage = (message: string, maxLength = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Circle className="w-3 h-3 text-green-500 fill-green-500" />;
      case 'completed':
        return <CheckCircle className="w-3 h-3 text-blue-500" />;
      case 'archived':
        return <Archive className="w-3 h-3 text-gray-400" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>{error}</p>
        <button 
          onClick={fetchConversations}
          className="mt-2 text-primary-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No conversations yet</h3>
        <p className="text-gray-500">
          {filter === 'archived' 
            ? "You haven't archived any conversations" 
            : "Start a conversation by messaging someone on an accepted job or hire"}
        </p>
      </div>
    );
  }

   return (
    <div className="space-y-3">
      {conversations.map((conversation) => (
        <div
          key={conversation.conversation_id}
          onClick={() => handleOpenChat(conversation)}
          className={`
            flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all border
            ${conversation.unread_count > 0 
              ? 'bg-[#EA526F]/10 dark:bg-[#EA526F]/20 border-[#EA526F]/30 dark:border-[#EA526F]/40' 
              : 'bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10'}
          `}
        >
            {/* Avatar placeholder */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4B244A] to-[#6B3468] dark:from-[#EA526F] dark:to-[#d4486a] flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md">
              {conversation.other_participant_name?.charAt(0).toUpperCase() || '?'}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h4 className={`font-bold truncate ${conversation.unread_count > 0 ? 'text-[#4B244A] dark:text-white' : 'text-[#4B244A]/80 dark:text-white/80'}`}>
                    {conversation.other_participant_name || 'Unknown User'}
                  </h4>
                  {getStatusIcon(conversation.status)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {conversation.last_message_time && (
                    <span className="text-xs text-[#4B244A]/60 dark:text-white/60 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(conversation.last_message_time)}
                    </span>
                  )}
                </div>
              </div>

              {/* Job/Hire title */}
              <p className="text-xs text-[#EA526F] dark:text-[#EA526F] font-semibold truncate mb-1">
                {conversation.title || 'Direct Message'}
              </p>

              {/* Last message preview */}
              {conversation.last_message ? (
                <p className={`text-sm truncate ${conversation.unread_count > 0 ? 'text-[#4B244A] dark:text-white font-bold' : 'text-[#4B244A]/60 dark:text-white/60'}`}>
                  {truncateMessage(conversation.last_message)}
                </p>
              ) : (
                <p className="text-sm text-[#4B244A]/40 dark:text-white/40 italic">No messages yet</p>
              )}
            </div>

            {/* Right side: unread badge & archive button */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              {conversation.unread_count > 0 && (
                <span className="bg-[#EA526F] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                  {conversation.unread_count}
                </span>
              )}
              
              {conversation.status !== 'archived' && (
                <button
                  onClick={(e) => handleArchive(conversation.conversation_id, e)}
                  disabled={archiving === conversation.conversation_id}
                  className="p-1.5 text-[#4B244A]/40 dark:text-white/40 hover:text-[#4B244A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                  title="Archive conversation"
                >
                  {archiving === conversation.conversation_id ? (
                    <div className="w-4 h-4 border-2 border-[#4B244A]/40 dark:border-white/40 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}