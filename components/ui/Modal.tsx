import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { Button, IconButton } from './Button';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Stack of open dialogs; only the top-most one handles Escape/Tab. */
const modalStack: symbol[] = [];

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Disable closing (e.g. while a save is in progress). */
  dismissible?: boolean;
  /** Element to focus first; defaults to the first focusable control. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Show the decorative band at the top of the dialog. */
  ornament?: boolean;
}

/**
 * Accessible dialog: focus is trapped and restored, Escape closes, the page
 * behind is inert to scrolling, and the title/description are announced.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, initialFocus, className, ornament = true }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const token = Symbol('modal');
    modalStack.push(token);
    document.body.style.overflow = 'hidden';

    const focusFirst = () => {
      const target = initialFocus?.current ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current;
      target?.focus();
    };
    const t = window.setTimeout(focusFirst, 0);

    const onKey = (e: KeyboardEvent) => {
      if (!panelRef.current || modalStack[modalStack.length - 1] !== token) return;
      if (e.key === 'Escape' && dismissRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null);
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey, true);
      const idx = modalStack.indexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);
      if (modalStack.length === 0) document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-end justify-center sm:items-center sm:p-6">
      <div
        aria-hidden
        className="absolute inset-0 animate-fade-in bg-black/25 backdrop-blur-[6px]"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'ms-glass-strong relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] outline-none sm:rounded-[22px]',
          'animate-rise-in sm:animate-scale-in',
          widths[size],
          className
        )}
      >
        {ornament && <div aria-hidden className="ms-hairline mx-8 shrink-0" />}
        <div className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[19px] font-semibold leading-tight">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          {dismissible && <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1 bg-black/[0.04]" />}
        </div>
        <div className="ms-scroll-thin flex-1 overflow-y-auto px-5 pb-5 pt-3 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-black/[0.06] px-5 py-4 sm:flex-row sm:justify-end sm:px-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default', loading, onConfirm, onCancel, children }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissible={!loading}
      initialFocus={tone === 'danger' ? cancelRef : undefined}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex gap-3">
        {tone === 'danger' && (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle className="size-5" />
          </span>
        )}
        <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
          <div>{message}</div>
          {children}
        </div>
      </div>
    </Modal>
  );
}
