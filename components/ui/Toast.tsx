import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cx } from '../../lib/cx';

type Tone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems(list => list.filter(t => t.id !== id)), []);

  const push = useCallback((tone: Tone, title: string, description?: string) => {
    const id = nextId.current++;
    setItems(list => [...list.slice(-3), { id, tone, title, description }]);
    window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4500);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    success: (t, d) => push('success', t, d),
    error: (t, d) => push('error', t, d),
    info: (t, d) => push('info', t, d),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[2000] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
          <div role="status" aria-live="polite" className="sr-only">
            {items.filter(i => i.tone !== 'error').map(i => `${i.title}. ${i.description ?? ''}`).join(' ')}
          </div>
          <div role="alert" aria-live="assertive" className="sr-only">
            {items.filter(i => i.tone === 'error').map(i => `${i.title}. ${i.description ?? ''}`).join(' ')}
          </div>
          {items.map(t => {
            const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info;
            return (
              <div
                key={t.id}
                className={cx(
                  'ms-glass-strong pointer-events-auto flex w-full max-w-sm animate-rise-in items-start gap-3 rounded-xl px-4 py-3',
                  t.tone === 'success' && 'border-success/30',
                  t.tone === 'error' && 'border-danger/30',
                  t.tone === 'info' && 'border-indigo/20'
                )}
              >
                <Icon aria-hidden className={cx('mt-0.5 size-5 shrink-0', t.tone === 'success' && 'text-success', t.tone === 'error' && 'text-danger', t.tone === 'info' && 'text-indigo')} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  {t.description && <p className="mt-0.5 text-sm text-ink-muted">{t.description}</p>}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} className="-mr-1 rounded p-1 text-ink-faint hover:text-ink" aria-label="Dismiss notification">
                  <X aria-hidden className="size-4" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
