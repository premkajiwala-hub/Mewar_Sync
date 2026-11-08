import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, ChevronLeft, MessageSquare, Pencil, Send, Trash2 } from 'lucide-react';
import type { ChatMessage, ChatSession, UserProfile } from '../../types';
import { storage } from '../../services/storage';
import { errorMessage } from '../../services/api';
import { formatDate, formatTime } from '../../lib/dates';
import { cx } from '../../lib/cx';
import { Modal, ConfirmDialog } from '../ui/Modal';
import { Button, IconButton } from '../ui/Button';
import { Avatar, EmptyState, ErrorState, Spinner } from '../ui/Surface';
import { useToast } from '../ui/Toast';

interface MessengerProps {
  currentUser: UserProfile;
  targetArtisan?: UserProfile;
  onClose: () => void;
}

export const Messenger: React.FC<MessengerProps> = ({ currentUser, targetArtisan, onClose }) => {
  const toast = useToast();
  const isArtisan = currentUser.role === 'SHOPKEEPER';
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [starting, setStarting] = useState(!!targetArtisan);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => storage.onChatSessions(currentUser.id, currentUser.role, list => {
    setSessions(list);
    setSessionsLoaded(true);
  }, err => setError(err.message)), [currentUser.id, currentUser.role]);

  // Opening the messenger for a specific artisan starts (or resumes) that chat.
  useEffect(() => {
    if (!targetArtisan) return;
    let cancelled = false;
    storage.findOrCreateChatSession(targetArtisan, currentUser)
      .then(s => !cancelled && setActiveId(s.id))
      .catch(err => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setStarting(false));
    return () => {
      cancelled = true;
    };
  }, [targetArtisan, currentUser]);

  const active = useMemo(() => sessions.find(s => s.id === activeId) ?? null, [sessions, activeId]);

  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setMessagesLoaded(false);
    return storage.onChatMessages(activeId, list => {
      setMessages(list);
      setMessagesLoaded(true);
    }, err => setError(err.message));
  }, [activeId]);

  useEffect(() => {
    if (active) void storage.markChatAsRead(active, currentUser.role);
  }, [active, messages.length, currentUser.role]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, activeId]);

  const otherName = (s: ChatSession) => (isArtisan ? s.visitor_name : s.artisan_name);
  const otherLastRead = active ? (isArtisan ? active.visitor_last_read : active.artisan_last_read) : undefined;

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!active || !text.trim() || sending) return;
    setSending(true);
    const body = text;
    setText('');
    try {
      await storage.sendMessage(active, body);
    } catch (err) {
      setText(body);
      toast.error('Message not sent', errorMessage(err));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const saveEdit = async (id: string) => {
    try {
      await storage.editMessage(id, editText);
      setEditingId(null);
    } catch (err) {
      toast.error('Could not edit', errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await storage.deleteChatSession(deleteId);
      if (deleteId === activeId) setActiveId(null);
      setDeleteId(null);
      toast.success('Conversation deleted');
    } catch (err) {
      toast.error('Could not delete', errorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const showChat = !!activeId;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      ornament={false}
      title={showChat && active ? otherName(active) : 'Messages'}
      
      className="sm:max-w-2xl"
    >
      <div className="-mx-5 -my-5 flex h-[min(70dvh,620px)] flex-col sm:-mx-6">
        {error && <ErrorState message={error} />}

        {!showChat && (
          <div className="ms-scroll-thin flex-1 overflow-y-auto">
            {(!sessionsLoaded || starting) && <div className="flex justify-center p-10"><Spinner label="Loading conversations" /></div>}
            {sessionsLoaded && !starting && sessions.length === 0 && (
              <EmptyState icon={MessageSquare} title="No conversations yet"  />
            )}
            <ul className="divide-y divide-line-soft">
              {sessions.map(s => {
                const unread = (isArtisan ? s.unread_count_artisan : s.unread_count_visitor) || 0;
                return (
                  <li key={s.id} className="flex items-center gap-2 pr-3">
                    <button type="button" onClick={() => setActiveId(s.id)} className="flex min-w-0 flex-1 items-center gap-3 px-5 py-4 text-left hover:bg-parchment-soft/60 sm:px-6">
                      <Avatar name={otherName(s)} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cx('truncate', unread ? 'font-bold' : 'font-semibold')}>{otherName(s)}</span>
                          <span className="shrink-0 text-xs text-ink-muted">{formatDate(s.last_timestamp)}</span>
                        </span>
                        <span className={cx('mt-0.5 block truncate text-sm', unread ? 'font-medium text-ink' : 'text-ink-muted')}>{s.last_message || 'No messages yet'}</span>
                      </span>
                      {unread > 0 && <span className="ms-num flex h-5 min-w-5 items-center justify-center rounded-full bg-maroon px-1.5 text-[11px] font-bold text-ivory">{unread}<span className="sr-only"> unread</span></span>}
                    </button>
                    <IconButton icon={Trash2} size="sm" tone="danger" label={`Delete conversation with ${otherName(s)}`} onClick={() => setDeleteId(s.id)} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {showChat && (
          <>
            <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2 sm:px-4">
              <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={() => setActiveId(null)}>All conversations</Button>
              <span className="flex-1" />
              {active && <IconButton icon={Trash2} size="sm" tone="danger" label="Delete this conversation" onClick={() => setDeleteId(active.id)} />}
            </div>
            <div className="ms-scroll-thin flex-1 space-y-3 overflow-y-auto bg-parchment-soft/40 px-4 py-4 sm:px-6" aria-live="polite" aria-relevant="additions">
              {!messagesLoaded && <div className="flex justify-center p-8"><Spinner label="Loading messages" /></div>}
              {messagesLoaded && messages.length === 0 && (
                <p className="py-10 text-center text-sm text-ink-muted">Say Khamma Ghani! Ask about a piece, prices or visiting the workshop.</p>
              )}
              {messages.map(m => {
                const mine = m.sender_id === currentUser.id;
                const read = mine && !!otherLastRead && otherLastRead >= m.timestamp;
                return (
                  <div key={m.id} className={cx('group flex', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cx('max-w-[82%] space-y-1', mine && 'items-end')}>
                      {editingId === m.id ? (
                        <form onSubmit={e => { e.preventDefault(); void saveEdit(m.id); }} className="space-y-2 rounded-lg border border-line bg-surface p-2">
                          <label htmlFor={`edit-${m.id}`} className="sr-only">Edit message</label>
                          <textarea id={`edit-${m.id}`} value={editText} onChange={e => setEditText(e.target.value)} rows={2} maxLength={2000} className="w-full rounded border border-line px-2 py-1 text-sm" />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" type="submit" disabled={!editText.trim()}>Save</Button>
                          </div>
                        </form>
                      ) : (
                        <div className={cx('relative whitespace-pre-wrap break-words rounded-lg px-3.5 py-2 text-[15px] shadow-card', mine ? 'rounded-br-sm bg-indigo text-ivory' : 'rounded-bl-sm bg-surface text-ink')}>
                          {m.text}
                        </div>
                      )}
                      <div className={cx('flex items-center gap-1.5 px-1 text-[11px] text-ink-muted', mine ? 'justify-end' : 'justify-start')}>
                        <span>{formatTime(m.timestamp)}</span>
                        {m.is_edited && <span>· edited</span>}
                        {mine && (read ? <CheckCheck aria-label="Read" className="size-3.5 text-indigo" /> : <Check aria-label="Sent" className="size-3.5" />)}
                        {mine && editingId !== m.id && (
                          <button type="button" onClick={() => { setEditingId(m.id); setEditText(m.text); }} className="rounded p-0.5 opacity-70 hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-70" aria-label="Edit message">
                            <Pencil aria-hidden className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex items-end gap-2 border-t border-line-soft bg-surface px-4 py-3 sm:px-6">
              <label htmlFor="chat-input" className="sr-only">Type a message</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                maxLength={2000}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-line bg-surface px-3 py-2.5 text-[15px] focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
              />
              <Button type="submit" icon={Send} disabled={!text.trim() || !active} loading={sending} aria-label="Send message">
                <span className="hidden sm:inline">Send</span>
              </Button>
            </form>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        tone="danger"
        title="Delete this conversation?"
        confirmLabel="Delete"
        loading={deleting}
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        message="All messages will be removed for both of you. This cannot be undone."
      />
    </Modal>
  );
};
