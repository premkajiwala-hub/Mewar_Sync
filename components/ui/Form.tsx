import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cx } from '../../lib/cx';

interface FieldContext {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldCtx = React.createContext<FieldContext | null>(null);

export interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  children: React.ReactNode;
}

/** Label + control + hint + error, wired together for assistive technology. */
export function Field({ label, hint, error, required, className, hideLabel, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldCtx.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={cx('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className={cx('text-[13px] font-medium text-ink-soft', hideLabel && 'sr-only')}>
          {label}
          {required && <span className="ml-0.5 text-maroon" aria-hidden>*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs text-ink-muted">{hint}</p>
        )}
        {error && (
          <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
            <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
            {error}
          </p>
        )}
      </div>
    </FieldCtx.Provider>
  );
}

function useField() {
  return React.useContext(FieldCtx);
}

const controlBase =
  'ms-glass-field w-full rounded-xl border px-3.5 text-[15px] text-ink placeholder:text-ink-faint transition-[border-color,box-shadow,background-color] duration-200 ' +
  'focus:border-indigo/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo/10 disabled:cursor-not-allowed disabled:bg-parchment-soft disabled:text-ink-muted';

function controlClass(invalid: boolean, extra?: string) {
  return cx(controlBase, invalid ? 'border-danger/70 focus:border-danger focus:ring-danger/10' : 'border-black/10 hover:border-black/20', extra);
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { leading?: React.ReactNode; trailing?: React.ReactNode }>(
  function Input({ className, leading, trailing, ...rest }, ref) {
    const f = useField();
    const input = (
      <input
        ref={ref}
        id={rest.id ?? f?.id}
        aria-invalid={f?.invalid || undefined}
        aria-describedby={f?.describedBy}
        className={controlClass(!!f?.invalid, cx('h-11', leading ? 'pl-9' : undefined, trailing ? 'pr-10' : undefined, className))}
        {...rest}
      />
    );
    if (!leading && !trailing) return input;
    return (
      <div className="relative">
        {leading && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">{leading}</span>}
        {input}
        {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
      </div>
    );
  }
);

/** Rupee amount input (keeps the raw string so validation can reject bad input). */
export const MoneyInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(function MoneyInput(props, ref) {
  return <Input ref={ref} type="text" inputMode="decimal" autoComplete="off" leading={<span aria-hidden className="text-sm">₹</span>} {...props} className={cx('ms-num', props.className)} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  const f = useField();
  return (
    <textarea
      ref={ref}
      id={rest.id ?? f?.id}
      aria-invalid={f?.invalid || undefined}
      aria-describedby={f?.describedBy}
      className={controlClass(!!f?.invalid, cx('min-h-24 py-2.5 leading-relaxed', className))}
      {...rest}
    />
  );
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  const f = useField();
  return (
    <select
      ref={ref}
      id={rest.id ?? f?.id}
      aria-invalid={f?.invalid || undefined}
      aria-describedby={f?.describedBy}
      className={controlClass(!!f?.invalid, cx('h-11 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9', className))}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b665c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

/** A radio group rendered as a segmented control (arrow keys move selection). */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex rounded-xl bg-black/[0.05] p-1', className)}>
      {options.map((opt, i) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cx(
              'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] font-medium transition-[background-color,color,box-shadow] duration-200',
              size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
              active ? 'bg-white text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_2px_8px_-2px_rgb(0_0_0/0.1)]' : 'text-ink-muted hover:text-ink'
            )}
          >
            {Icon && <Icon aria-hidden className="size-4" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, description }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; description?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line accent-indigo"
        aria-describedby={description ? `${id}-d` : undefined}
      />
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">{label}</label>
        {description && <p id={`${id}-d`} className="text-xs text-ink-muted">{description}</p>}
      </div>
    </div>
  );
}

/** Summarises form errors at the top of a form for screen-reader users. */
export function FormErrorSummary({ errors }: { errors: Record<string, string> }) {
  const list = Object.values(errors);
  if (list.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
      <p className="font-semibold">Please fix {list.length === 1 ? 'this' : `these ${list.length}`} before saving:</p>
      <ul className="mt-1 list-disc pl-5">
        {list.map(msg => <li key={msg}>{msg}</li>)}
      </ul>
    </div>
  );
}
