import React, { useEffect, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import type { UserRole } from '../../types';
import { geminiService, type ChatHistoryTurn } from '../../services/gemini';
import { errorMessage } from '../../services/api';
import { cx } from '../../lib/cx';
import { IconButton } from '../ui/Button';
import { Emblem } from '../ui/Ornaments';

interface Message extends ChatHistoryTurn {
  id: number;
}

const SUGGESTIONS: Record<string, string[]> = {
  SHOPKEEPER: ['How do I record a sale?', 'How does udhaar work?', 'How do I list a new piece?', 'How do I print a monthly statement?'],
  VISITOR: ['How do I find artisans near me?', 'What does the authenticity check do?', 'How do I message an artisan?', 'Which heritage sites should I visit?'],
  ADMIN: ['How do I add photos for a heritage site?'],
};

export function AIChatbot({ role, raised = false }: { role: UserRole; raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = async (text: string) => {
    const q = text.trim().slice(0, 800);
    if (!q || loading) return;
    const history = messages.map(({ sender, text: t }) => ({ sender, text: t }));
    setMessages(m => [...m, { id: nextId.current++, sender: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const reply = await geminiService.chat(q, history);
      setMessages(m => [...m, { id: nextId.current++, sender: 'bot', text: reply }]);
    } catch (err) {
      setMessages(m => [...m, { id: nextId.current++, sender: 'bot', text: `Sorry — ${errorMessage(err, 'I could not answer just now.').replace(/\.$/, '')}. Please try again.` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close help assistant' : 'Open help assistant'}
        className={cx(
          'ms-glass-strong fixed right-5 z-[690] flex size-12 items-center justify-center rounded-full text-indigo transition-transform duration-200 hover:scale-105 active:scale-95 sm:right-7',
          raised ? 'bottom-24' : 'bottom-5'
        )}
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        {open ? <X aria-hidden className="size-5" /> : <Sparkles aria-hidden className="size-5" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Help assistant"
          className={cx(
            'ms-glass-strong fixed inset-x-3 z-[690] flex max-h-[min(72dvh,600px)] animate-rise-in flex-col overflow-hidden rounded-2xl sm:inset-x-auto sm:right-6 sm:w-[400px]',
            raised ? 'bottom-40' : 'bottom-20'
          )}
        >
          <div className="flex items-center gap-3 border-b border-black/[0.06] px-4 py-3">
            <Emblem className="size-8 text-gold" />
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold">Assistant</h2>
              <p className="text-xs text-ink-muted">AI-generated answers</p>
            </div>
            <IconButton icon={X} label="Close" size="sm" onClick={() => setOpen(false)} />
          </div>

          <div ref={scrollRef} className="ms-scroll-thin flex-1 space-y-3 overflow-y-auto bg-parchment-soft/40 p-4" aria-live="polite">
            <div className="max-w-[88%] rounded-lg rounded-bl-sm bg-surface px-3.5 py-2.5 text-[15px] shadow-card">
              Khamma Ghani! How can I help?
            </div>
            {messages.map(m => (
              <div key={m.id} className={cx('flex', m.sender === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cx('max-w-[88%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-[15px] shadow-card', m.sender === 'user' ? 'rounded-br-sm bg-indigo text-ivory' : 'rounded-bl-sm bg-surface text-ink')}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex" role="status" aria-label="Assistant is typing">
                <div className="ms-wave flex h-9 items-center gap-1 rounded-lg bg-surface px-3 text-gold-deep shadow-card" aria-hidden>
                  <span /><span /><span />
                </div>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(SUGGESTIONS[role] ?? SUGGESTIONS.VISITOR).map(s => (
                  <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full border border-gold/40 bg-surface px-3 py-1.5 text-left text-sm text-ink-soft hover:border-gold hover:bg-gold-soft">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={e => { e.preventDefault(); void ask(input); }} className="flex gap-2 border-t border-line-soft p-3">
            <label htmlFor="chatbot-input" className="sr-only">Ask a question</label>
            <input
              id="chatbot-input"
              ref={inputRef}
              value={input}
              maxLength={800}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask how to…"
              className="h-11 flex-1 rounded-md border border-line bg-surface px-3 text-[15px] focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send question" className="flex size-11 items-center justify-center rounded-xl bg-indigo text-white transition-colors hover:bg-[#2c4877] disabled:opacity-40">
              <Send aria-hidden className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
