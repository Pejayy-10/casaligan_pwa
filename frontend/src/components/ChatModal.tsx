import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../services/api';

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
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: number;
  hireId?: number;
  jobId?: number;
  otherParticipantName: string;
  title?: string;
}

const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  conversationId: initialConversationId,
  hireId,
  jobId,
  otherParticipantName,
  title,
}) => {
  const [conversationId, setConversationId] = useState<number | null>(initialConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [canSend, setCanSend] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
        hire_id: hireId || null,
        job_id: jobId || null,
      });
      setConversationId(response.data.conversation_id);
      setCanSend(response.data.status === 'active');
      return response.data.conversation_id;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(errorMessage);
      return null;
    }
  }, [conversationId, hireId, jobId]);

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
    if (!isOpen) return;
    
    const init = async () => {
      setLoading(true);
      const convId = await initializeConversation();
      if (convId) {
        await loadMessages(convId);
      }
      setLoading(false);
    };
    
    init();
  }, [isOpen, initializeConversation, loadMessages]);

  // Polling for new messages
  useEffect(() => {
    if (!isOpen || !conversationId) return;
    
    pollingRef.current = setInterval(() => {
      loadMessages(conversationId, lastMessageTimeRef.current || undefined);
    }, 3000);
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isOpen, conversationId, loadMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
      
      setMessages(prev => [...prev, response.data]);
      lastMessageTimeRef.current = response.data.sent_at;
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(messageContent); // Restore message on error
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Chat Modal - Fixed height container */}
      <div className="relative bg-white rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden" style={{ height: 'min(85vh, 600px)' }}>
        {/* Header - Fixed at top */}
        <div className="bg-gradient-to-r from-[#4B244A] to-[#6B3468] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-bold">
              {otherParticipantName[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="text-white font-semibold">{otherParticipantName}</h3>
              {title && <p className="text-white/70 text-xs">{title}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Messages Area - Scrollable, takes remaining space */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-[#EA526F] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="text-4xl mb-2">💬</div>
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMessages.map((group, groupIdx) => (
                <div key={groupIdx}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-gray-200 text-gray-500 text-xs rounded-full">
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
                        <div className="text-center text-gray-400 text-xs py-2 w-full">
                          {msg.content}
                        </div>
                      ) : (
                        <div
                          className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                            msg.is_mine
                              ? 'bg-[#EA526F] text-white rounded-br-md'
                              : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                          }`}
                        >
                          {!msg.is_mine && (
                            <p className="text-xs text-gray-500 mb-1">{msg.sender_name}</p>
                          )}
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.is_mine ? 'text-white/70' : 'text-gray-400'}`}>
                            {formatTime(msg.sent_at)}
                            {msg.is_mine && msg.read_at && ' ✓✓'}
                          </p>
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
        
        {/* Input Area - Fixed at bottom */}
        <div className="p-3 bg-white border-t border-gray-200 flex-shrink-0">
          {!canSend ? (
            <div className="text-center text-gray-500 text-sm py-2">
              This conversation is read-only
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
                className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-[#EA526F]"
                disabled={sending}
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="p-2 bg-[#EA526F] text-white rounded-full hover:bg-[#d64460] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
};

export default ChatModal;
