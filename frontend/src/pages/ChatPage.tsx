import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import apiClient from '../services/api';
import { ChatSkeleton } from '../components/Skeleton';

interface Message {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  message_type: string;
  sent_at: string;
  read_at: string | null;
  is_mine: boolean;
  failed?: boolean;
  failure_reason?: string;
}

interface ConversationInfo {
  conversation_id: number;
  other_participant_name: string;
  title: string;
  status: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { conversationId: paramConvId } = useParams<{ conversationId: string }>();
  const [searchParams] = useSearchParams();
  
  // Get params from URL for creating new conversations
  const hireId = searchParams.get('hireId');
  const jobId = searchParams.get('jobId');
  const participantName = searchParams.get('name') || 'Chat';
  const titleParam = searchParams.get('title') || '';

  const [conversationId, setConversationId] = useState<number | null>(
    paramConvId ? parseInt(paramConvId) : null
  );
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [securityBlockedUntil, setSecurityBlockedUntil] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageTimeRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Initialize or get conversation
  const initializeConversation = useCallback(async () => {
    if (conversationId) return conversationId;

    try {
      const response = await apiClient.post('/messages/conversations', {
        hire_id: hireId ? parseInt(hireId) : null,
        job_id: jobId ? parseInt(jobId) : null,
      });
      setConversationId(response.data.conversation_id);
      setCanSend(response.data.status === 'active');
      setConversationInfo({
        conversation_id: response.data.conversation_id,
        other_participant_name: response.data.other_participant_name || participantName,
        title: response.data.title || titleParam,
        status: response.data.status,
      });
      return response.data.conversation_id;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(errorMessage);
      return null;
    }
  }, [conversationId, hireId, jobId, participantName, titleParam]);

  // Load conversation info
  const loadConversationInfo = useCallback(async (convId: number) => {
    try {
      const response = await apiClient.get(`/messages/conversations/${convId}`);
      setConversationInfo({
        conversation_id: response.data.conversation_id,
        other_participant_name: response.data.other_participant_name || participantName,
        title: response.data.title || titleParam,
        status: response.data.status,
      });
      setCanSend(response.data.status === 'active');
    } catch (err) {
      console.error('Failed to load conversation info:', err);
    }
  }, [participantName, titleParam]);

  // Load messages
  const loadMessages = useCallback(async (convId: number, since?: string) => {
    try {
      const params = since ? `?since=${encodeURIComponent(since)}` : '';
      const response = await apiClient.get(`/messages/conversations/${convId}/messages${params}`);

      if (since) {
        // Append new messages
        if (response.data.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.message_id));
            const newMsgs = response.data.filter((m: Message) => !existingIds.has(m.message_id));
            return [...prev, ...newMsgs];
          });
        }
      } else {
        setMessages(response.data);
      }

      if (response.data.length > 0) {
        lastMessageTimeRef.current = response.data[response.data.length - 1].sent_at;
      }

      setError(null);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const convId = await initializeConversation();
      if (convId) {
        await loadConversationInfo(convId);
        await loadMessages(convId);
      }
      setLoading(false);
    };

    init();
  }, [initializeConversation, loadConversationInfo, loadMessages]);

  // Polling for new messages and status updates
  useEffect(() => {
    if (!conversationId) return;

    let pollCount = 0;
    pollingRef.current = setInterval(() => {
      loadMessages(conversationId, lastMessageTimeRef.current || undefined);
      // Re-check conversation status every 5 polls (15 seconds)
      pollCount++;
      if (pollCount % 5 === 0) {
        loadConversationInfo(conversationId);
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [conversationId, loadMessages, loadConversationInfo]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when page loads
  useEffect(() => {
    if (inputRef.current && !loading) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const response = await apiClient.post(`/messages/conversations/${conversationId}/messages`, {
        content: messageContent,
        message_type: 'text',
      });

      setSecurityNotice(null);
      setMessages(prev => [...prev, response.data]);
      lastMessageTimeRef.current = response.data.sent_at;
    } catch (err: unknown) {
      console.error('Failed to send message:', err);

      const errorData = (err as { response?: { data?: { detail?: Record<string, unknown> | string } } })?.response?.data;
      const detail = errorData?.detail;
      const detailObj = typeof detail === 'object' && detail !== null ? detail as Record<string, unknown> : null;
      const code = typeof detailObj?.code === 'string' ? detailObj.code : null;

      if (code === 'MESSAGE_POLICY_VIOLATION' || code === 'MESSAGE_POLICY_BLOCKED') {
        const securityMessage =
          (typeof detailObj?.security_message === 'string' && detailObj.security_message) ||
          'Casaligan Security: Message not sent due to policy violation.';

        const warning = typeof detailObj?.warning === 'string' ? ` ${detailObj.warning}` : '';
        setSecurityNotice(`${securityMessage}${warning}`);

        const blockedUntil = typeof detailObj?.blocked_until === 'string' ? detailObj.blocked_until : null;
        setSecurityBlockedUntil(blockedUntil);

        setMessages(prev => [
          ...prev,
          {
            message_id: -Date.now(),
            conversation_id: conversationId,
            sender_id: -1,
            sender_name: 'You',
            content: messageContent,
            message_type: 'text',
            sent_at: new Date().toISOString(),
            read_at: null,
            is_mine: true,
            failed: true,
            failure_reason: securityMessage,
          }
        ]);

        setNewMessage(messageContent);
      } else {
        setNewMessage(messageContent); // Restore message on generic error
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  messages.forEach(msg => {
    const dateStr = formatDate(msg.sent_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dateStr) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: dateStr, messages: [msg] });
    }
  });

  const displayName = conversationInfo?.other_participant_name || participantName;
  const displayTitle = conversationInfo?.title || titleParam;
  const isSecurityBlocked = !!securityBlockedUntil && new Date(securityBlockedUntil) > new Date();

   return (
    <div className="fixed inset-0 flex flex-col bg-[#F8F9FA] dark:bg-slate-950 transition-colors duration-300 ">
      {/* Header */}
        <header className="sticky top-0 z-40 bg-gray-50 dark:bg-white/10 dark:backdrop-blur-xl border-b border-gray-200 dark:border-white/20 transition-all safe-area-top">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => navigate('/messages')}
            className="text-gray-600 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10 p-2 -ml-2 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
      
          {/* Avatar/Initial Circular Placeholder */}
          <div className="w-10 h-10 bg-gray-200 dark:bg-white/20 rounded-full flex items-center justify-center text-gray-700 dark:text-white font-bold text-lg shrink-0 shadow-sm">
            {displayName[0]?.toUpperCase() || '?'}
          </div>
      
          {/* Title and Subtitle Container */}
          <div className="flex-1 min-w-0">
            <h1 className="text-gray-900 dark:text-white font-bold truncate">
              {displayName}
            </h1>
            {displayTitle && (
              <p className="text-gray-500 dark:text-white/70 text-xs truncate font-medium">
                {displayTitle}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 min-h-0 bg-[#F8F9FA] dark:bg-slate-950"
      >
        {loading ? (
          <ChatSkeleton />
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-600 dark:text-red-400">
            <div className="text-center">
              <p className="font-medium">{error}</p>
              <button 
                onClick={() => navigate('/messages')}
                className="mt-4 text-[#EA526F] hover:underline font-semibold"
              >
                Go back to messages
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-5xl mb-3 opacity-50"><MessageCircle className="w-12 h-12 mx-auto" /></div>
            <p className="font-bold">No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedMessages.map((group, groupIdx) => (
              <div key={groupIdx}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-white/50 text-xs font-bold rounded-full">
                    {group.date}
                  </span>
                </div>

                {/* Messages */}
                {group.messages.map((msg) => (
                  <div
                    key={msg.message_id}
                    className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'} mb-2`}
                  >
                    {msg.message_type === 'system' ? (
                      <div className="text-center text-gray-400 dark:text-gray-500 text-xs py-2 w-full italic">
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl shadow-sm ${
                          msg.failed
                            ? 'bg-gray-300/70 dark:bg-white/10 text-gray-700 dark:text-white/80 rounded-br-md border border-dashed border-gray-400 dark:border-white/20'
                            : msg.is_mine
                            ? 'bg-[#EA526F] text-white rounded-br-md'
                            : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 rounded-bl-md border border-gray-100 dark:border-white/5'
                        }`}
                      >
                        {!msg.is_mine && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 font-bold">{msg.sender_name}</p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${msg.is_mine ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'} font-medium`}>
                          {formatTime(msg.sent_at)}
                          {msg.is_mine && msg.read_at && ' ✓✓'}
                        </p>
                        {msg.failed && (
                          <p className="text-xs mt-1 text-gray-600 dark:text-white/60 font-semibold">
                            Not sent • Casaligan Security
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-white/10 shrink-0 safe-area-bottom transition-colors">
        {securityNotice && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-100 dark:bg-yellow-500/10 border border-yellow-300 dark:border-yellow-500/30 text-yellow-800 dark:text-yellow-300 text-xs font-semibold">
            {securityNotice}
          </div>
        )}
        {!canSend ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-2 font-medium">
            This conversation is read-only
          </div>
        ) : isSecurityBlocked ? (
          <div className="text-center text-red-600 dark:text-red-400 text-sm py-2 font-medium">
            Casaligan Security: Chat is temporarily blocked due to repeated policy violations.
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-[#EA526F] text-base placeholder-gray-400 dark:placeholder-white/30 border border-transparent focus:border-transparent transition-all"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="p-3 bg-[#EA526F] text-white rounded-full hover:bg-[#d64460] disabled:bg-gray-300 dark:disabled:bg-white/10 disabled:cursor-not-allowed transition-all shrink-0 shadow-md active:scale-95"
            >
              {sending ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}