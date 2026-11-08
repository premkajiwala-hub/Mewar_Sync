import React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatINR } from '../../lib/money';
import { initials, safeImageUrl } from '../../lib/text';
import { ArchMotif } from './Ornaments';

export function Card({ className, children, as: Tag = 'section', interactive = false, ...rest }: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'aside'; interactive?: boolean }) {
  return (
    <Tag className={cx('ms-glass rounded-xl', interactive && 'ms-lift', className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, action, icon: Icon, className, level = 2 }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: LucideIcon; className?: string; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-5', className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-ink-muted">
            <Icon className="size-[15px]" />
          </span>
        )}
        <div className="min-w-0">
          <H className="text-[17px] font-semibold leading-snug">{title}</H>
          {description && <p className="text-[13px] text-ink-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'maroon' | 'sage' | 'terracotta';

const BADGE: Record<BadgeTone, string> = {
  neutral: 'bg-black/[0.05] text-ink-soft',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-indigo-soft text-indigo',
  gold: 'bg-gold-soft text-gold-deep',
  maroon: 'bg-maroon-soft text-maroon',
  sage: 'bg-sage-soft text-sage-deep',
  terracotta: 'bg-terracotta-soft text-terracotta-deep',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className }: { tone?: BadgeTone; icon?: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium', BADGE[tone], className)}>
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cx('inline-flex items-center gap-2 text-sm text-ink-muted', className)}>
      <Loader2 aria-hidden className="size-4 animate-spin text-indigo" />
      <span>{label}…</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-lg bg-black/[0.05]', className)} />;
}

export function LoadingBlock({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3 p-5" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className={cx('h-10', i % 2 ? 'w-4/5' : 'w-full')} />)}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon?: LucideIcon; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="relative mb-4 flex size-16 items-center justify-center">
        <ArchMotif className="absolute inset-0 size-16 text-gold/40" />
        {Icon && <Icon aria-hidden className="relative mt-2 size-6 text-ink-muted" />}
      </div>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="m-5 flex flex-col items-start gap-3 rounded-xl bg-danger-soft p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-lg bg-white px-3 py-1.5 font-medium text-danger shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-colors hover:bg-white/80">
          Try again
        </button>
      )}
    </div>
  );
}

/** Page title with an optional one-line description and actions. */
export function PageHeader({ title, description, actions }: { eyebrow?: string; title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-[15px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Money with an explicit direction word for screen readers (not colour alone). */
export function Money({ value, direction, className, showSign = false }: { value: number; direction?: 'in' | 'out'; className?: string; showSign?: boolean }) {
  const sign = showSign && direction ? (direction === 'in' ? '+' : '−') : '';
  return (
    <span className={cx('ms-num whitespace-nowrap', direction === 'in' && 'text-success', direction === 'out' && 'text-maroon', className)}>
      <span aria-hidden>{sign}</span>
      {formatINR(Math.abs(value))}
      {direction && <span className="sr-only">{direction === 'in' ? ' received' : ' paid out'}</span>}
    </span>
  );
}

export function Avatar({ name, src, size = 40, className }: { name?: string; src?: string; size?: number; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  const url = failed ? undefined : safeImageUrl(src);
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#2f4c7d] to-indigo text-white shadow-[0_0_0_1px_rgb(0_0_0/0.06)]', className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span aria-hidden className="font-semibold">{initials(name)}</span>}
    </span>
  );
}

export function StatTile({ label, value, sub, icon: Icon, tone = 'indigo', className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon; tone?: 'indigo' | 'maroon' | 'gold' | 'sage' | 'terracotta'; className?: string }) {
  const tones = {
    indigo: 'text-indigo',
    maroon: 'text-maroon',
    gold: 'text-gold-deep',
    sage: 'text-sage-deep',
    terracotta: 'text-terracotta-deep',
  };
  return (
    <Card as="div" className={cx('p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        {Icon && <Icon aria-hidden className={cx('size-4', tones[tone])} />}
      </div>
      <div className="ms-num mt-1.5 text-[24px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </Card>
  );
}
