import React from 'react';
import { Loader2, type LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

type Variant = 'primary' | 'accent' | 'gold' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo text-white shadow-[0_1px_2px_rgb(0_0_0/0.12),0_6px_16px_-8px_rgb(36_59_100/0.6)] hover:bg-[#2c4877] hover:shadow-[0_1px_2px_rgb(0_0_0/0.12),0_10px_22px_-10px_rgb(36_59_100/0.7)]',
  accent: 'bg-maroon text-white shadow-[0_1px_2px_rgb(0_0_0/0.12),0_6px_16px_-8px_rgb(118_47_53/0.6)] hover:bg-[#843740]',
  gold: 'bg-gold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.1)] hover:bg-gold-light',
  secondary: 'ms-glass-field border border-black/10 text-ink shadow-[0_1px_2px_rgb(0_0_0/0.05)] hover:border-black/15 hover:bg-white',
  ghost: 'bg-transparent text-ink-soft hover:bg-black/5 hover:text-ink',
  danger: 'bg-danger text-white shadow-[0_1px_2px_rgb(0_0_0/0.12)] hover:bg-[#8c2626]',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 rounded-[10px] px-3.5 text-[13px] gap-1.5',
  md: 'h-11 rounded-xl px-4 text-sm gap-2',
  lg: 'h-12 rounded-xl px-5 text-[15px] gap-2',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading = false, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center font-medium tracking-[-0.01em]',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-out',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : Icon ? <Icon aria-hidden className="size-4 shrink-0" /> : null}
      {children}
      {IconRight && !loading ? <IconRight aria-hidden className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  tone?: 'default' | 'danger' | 'inverse';
  size?: 'sm' | 'md';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, tone = 'default', size = 'md', className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'size-9' : 'size-11',
        tone === 'danger' && 'text-danger hover:bg-danger-soft',
        tone === 'default' && 'text-ink-muted hover:bg-black/5 hover:text-ink',
        tone === 'inverse' && 'text-white/80 hover:bg-white/10 hover:text-white',
        className
      )}
      {...rest}
    >
      <Icon aria-hidden className="size-[18px]" />
    </button>
  );
});
