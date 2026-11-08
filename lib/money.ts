/**
 * Money and quantity helpers shared by the client and the API server.
 *
 * Amounts are stored as plain rupee numbers (the existing data model) and are
 * always rounded to paise precision before being persisted so that repeated
 * edits never accumulate floating point drift.
 */

/** ₹100 crore — well above any realistic single artisan transaction. */
export const MAX_AMOUNT = 1_000_000_000;
/** Upper bound for a single line item quantity. */
export const MAX_QUANTITY = 1_000_000;

export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Parses a user-entered rupee amount. Rejects (instead of silently "fixing")
 * empty, negative, non-numeric, oversized, or over-precise values.
 */
export function parseMoneyInput(
  raw: string | number | null | undefined,
  opts: { allowZero?: boolean; max?: number } = {}
): ParseResult {
  const max = opts.max ?? MAX_AMOUNT;
  if (raw === null || raw === undefined) return { ok: false, error: 'Enter an amount.' };
  const text = typeof raw === 'number' ? String(raw) : raw.replace(/[,\s₹]/g, '');
  if (text === '') return { ok: false, error: 'Enter an amount.' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    if (/^-/.test(text)) return { ok: false, error: 'Amount cannot be negative.' };
    if (/^\d+\.\d{3,}$/.test(text)) return { ok: false, error: 'Use at most 2 decimal places.' };
    return { ok: false, error: 'Enter a valid number, e.g. 1250 or 99.50.' };
  }
  const value = Number(text);
  if (!opts.allowZero && value === 0) return { ok: false, error: 'Amount must be greater than zero.' };
  if (value > max) return { ok: false, error: `Amount cannot exceed ${formatINR(max)}.` };
  return { ok: true, value: roundMoney(value) };
}

/** Parses a whole-number quantity entered by the user. */
export function parseQuantityInput(
  raw: string | number | null | undefined,
  opts: { min?: number; max?: number } = {}
): ParseResult {
  const min = opts.min ?? 1;
  const max = opts.max ?? MAX_QUANTITY;
  if (raw === null || raw === undefined) return { ok: false, error: 'Enter a quantity.' };
  const text = typeof raw === 'number' ? String(raw) : raw.trim();
  if (text === '') return { ok: false, error: 'Enter a quantity.' };
  if (!/^\d+$/.test(text)) {
    if (/^-/.test(text)) return { ok: false, error: 'Quantity cannot be negative.' };
    return { ok: false, error: 'Quantity must be a whole number.' };
  }
  const value = Number(text);
  if (value < min) return { ok: false, error: min === 0 ? 'Quantity cannot be negative.' : `Quantity must be at least ${min}.` };
  if (value > max) return { ok: false, error: `Quantity cannot exceed ${max.toLocaleString('en-IN')}.` };
  return { ok: true, value };
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(value: number): string {
  return inrFormatter.format(Number.isFinite(value) ? value : 0);
}

const compactFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Short axis labels such as ₹1.2L for charts. */
export function formatINRCompact(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}₹${compactFormatter.format(Math.abs(value))}`;
}

export function formatQuantity(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-IN') : '0';
}
