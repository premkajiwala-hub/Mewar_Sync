
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, User, Clock, MessageSquare, 
  ChevronLeft, Loader2, Sparkles, Check, CheckCheck,
  Trash2, Edit2, AlertTriangle
} from 'lucide-react';
import { storage } from '../../services/storage';
import { UserProfile, ChatMessage, ChatSession, UserRole } from '../../types';

interface MessengerProps {
  currentUser: UserProfile;
  initialSessionId?: string;
  targetArtisan?: UserProfile;
  onClose: () => void;
}

export const Messenger: React.FC<MessengerProps> = ({ 
  currentUser, 
  initialSessionId, 
  targetArtisan,
  onClose 
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'LIST' | 'CHAT'>(initialSessionId || targetArtisan ? 'CHAT' : 'LIST');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = storage.onChatSessions(currentUser.id, currentUser.role, (data) => {
      // Deduplicate sessions by partner ID, keeping the most recent one
      const uniqueSessions: ChatSession[] = [];
      const seenPartners = new Set<string>();
      
      data.forEach(session => {
        const partnerId = currentUser.role === 'SHOPKEEPER' ? session.visitor_id : session.artisan_id;
        if (!seenPartners.has(partnerId)) {
          seenPartners.add(partnerId);
          uniqueSessions.push(session);
        }
      });
      
      setSessions(uniqueSessions);
      setLoading(false);
      
      if (initialSessionId) {
        const session = uniqueSessions.find(s => s.id === initialSessionId);
        if (session) setActiveSession(session);
      }
    });
    return () => unsubscribe();
  }, [currentUser.id, currentUser.role, initialSessionId]);

  useEffect(() => {
    if (activeSession) {
      const unsubscribe = storage.onChatMessages(activeSession.id, (data) => {
        setMessages(data);
        storage.markChatAsRead(activeSession.id, currentUser.role);
      });
      return () => unsubscribe();
    }
  }, [activeSession?.id, currentUser.role]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartChat = async () => {
    if (!targetArtisan) return;
    setLoading(true);
    const sessionId = await storage.createChatSession(
      targetArtisan.id,
      currentUser.id,
      currentUser.name,
      targetArtisan.name
    );
    const allSessions = await storage.getChatSessions(currentUser.id, currentUser.role);
    const session = allSessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSession(session);
      setView('CHAT');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (targetArtisan && view === 'CHAT' && !activeSession) {
      handleStartChat();
    }
  }, [targetArtisan, view]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeSession) return;

    const text = newMessage.trim();
    setNewMessage('');
    await storage.sendMessage(activeSession.id, currentUser.id, text);
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editValue.trim()) return;
    await storage.editMessage(messageId, editValue.trim());
    setEditingMessageId(null);
    setEditValue('');
  };

  const handleDeleteChat = async (sessionId: string) => {
    await storage.deleteChatSession(sessionId);
    if (activeSession?.id === sessionId) {
      setActiveSession(null);
      setView('LIST');
    }
    setDeleteConfirmId(null);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const renderList = () => (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 border-b border-gold/10 flex items-center justify-between bg-royal-gradient text-white">
        <div>
          <h3 className="text-2xl font-heritage font-bold">Mewar Messenger</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Your Digital Inquiries</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-gold/40">
            <Loader2 className="animate-spin" size={40} />
            <p className="text-[10px] font-bold uppercase tracking-widest">Opening Scrolls...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-gold/5 rounded-full flex items-center justify-center mb-6 text-gold/20">
              <MessageSquare size={40} />
            </div>
            <h4 className="text-xl font-heritage font-bold text-gray-900">No active chats</h4>
            <p className="text-sm text-gray-400 italic mt-2">Start a conversation with an artisan to see it here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gold/5">
            {sessions.map(session => {
              const isArtisan = currentUser.role === 'SHOPKEEPER';
              const unreadCount = isArtisan ? session.unread_count_artisan : session.unread_count_visitor;
              const otherName = isArtisan ? session.visitor_name : session.artisan_name;

              return (
                <div 
                  key={session.id}
                  onClick={() => {
                    setActiveSession(session);
                    setView('CHAT');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setActiveSession(session);
                      setView('CHAT');
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="w-full p-6 flex items-center gap-4 hover:bg-gold/5 transition-all text-left group cursor-pointer outline-none"
                >
                  <div className="w-14 h-14 rounded-2xl bg-royal-gradient flex items-center justify-center text-white text-xl font-bold shadow-md group-hover:scale-105 transition-transform">
                    {otherName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-gray-900 truncate">{otherName}</h4>
                      <span className="text-[10px] text-gray-400 font-bold">{formatTime(session.last_timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate italic">
                      {session.last_message || 'No messages yet'}
                    </p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmId(session.id);
                    }}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                  {unreadCount > 0 && (
                    <div className="w-6 h-6 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                      {unreadCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderChat = () => {
    const isArtisan = currentUser.role === 'SHOPKEEPER';
    const otherName = activeSession 
      ? (isArtisan ? activeSession.visitor_name : activeSession.artisan_name)
      : (targetArtisan?.name || 'Artisan');

    return (
      <div className="flex flex-col h-full bg-[#F8F9FA]">
        <div className="p-6 border-b border-gold/10 flex items-center gap-4 bg-white shadow-sm sticky top-0 z-10">
          <button 
            onClick={() => {
              if (initialSessionId || targetArtisan) onClose();
              else setView('LIST');
            }} 
            className="p-2 text-gray-400 hover:text-gold transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-royal-gradient flex items-center justify-center text-white font-bold shadow-md">
            {otherName[0]}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900">{otherName}</h4>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Now</span>
            </div>
          </div>
          {activeSession && (
            <button 
              onClick={() => setDeleteConfirmId(activeSession.id)}
              className="p-2 text-gray-300 hover:text-red-500 transition-colors"
              title="Delete Chat"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button onClick={onClose} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {loading && messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="animate-spin text-gold/40" size={32} />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40">
              <Sparkles size={40} className="text-gold mb-4" />
              <p className="text-sm font-heritage italic">Begin your royal conversation...</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUser.id;
              const isEditing = editingMessageId === msg.id;

              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300 group/msg`}>
                  <div className={`max-w-[80%] space-y-1`}>
                    <div className={`relative px-5 py-3 rounded-[24px] text-sm shadow-sm ${
                      isMe 
                        ? 'bg-royal-gradient text-white rounded-tr-none' 
                        : 'bg-white text-gray-700 border border-gold/5 rounded-tl-none'
                    }`}>
                      {isEditing ? (
                        <div className="space-y-2 min-w-[200px]">
                          <textarea 
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white outline-none"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setEditingMessageId(null)}
                              className="text-[10px] uppercase font-bold opacity-70"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => handleEditMessage(msg.id)}
                              className="text-[10px] uppercase font-bold"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.text && <p>{msg.text}</p>}
                          {isMe && (
                            <button 
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditValue(msg.text);
                              }}
                              className="absolute -left-8 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-gold opacity-0 group-hover/msg:opacity-100 transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 px-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">
                        {formatTime(msg.timestamp)}
                        {msg.is_edited && ' • Edited'}
                      </span>
                      {isMe && (
                        <span className="text-gold">
                          {msg.is_read ? <CheckCheck size={12} /> : <Check size={12} />}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="p-6 bg-white border-t border-gold/10">
          <div className="relative flex items-center gap-3">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-50 border border-gold/10 rounded-2xl py-4 px-6 text-sm focus:border-gold focus:ring-4 focus:ring-gold/5 outline-none transition-all"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="w-12 h-12 bg-royal-gradient text-white rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {view === 'LIST' ? renderList() : renderChat()}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh] relative animate-in zoom-in-95 duration-200 scrollbar-hide">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-heritage font-bold text-gray-900 mb-2">Delete Conversation?</h3>
              <p className="text-sm text-gray-500 italic">This action is permanent and cannot be undone. All scrolls will be lost.</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 p-5 text-sm font-bold text-gray-400 hover:bg-gray-50 transition-colors uppercase tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteChat(deleteConfirmId)}
                className="flex-1 p-5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors border-l border-gray-100 uppercase tracking-widest"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
