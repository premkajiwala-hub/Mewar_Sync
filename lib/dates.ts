/**
 * Local-calendar date helpers. Ledger entries store `created_at` as an ISO
 * (UTC) timestamp, but artisans think in local business days, so every
 * day-based grouping goes through `localDateKey`.
 */

export function localDateKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Start of the local day for a YYYY-MM-DD key. */
export function startOfDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Exclusive end (start of the following local day) for a YYYY-MM-DD key. */
export function endOfDateKey(key: string): Date {
  const start = startOfDateKey(key);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);
}

export function addDays(key: string, days: number): string {
  const start = startOfDateKey(key);
  return localDateKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + days));
}

export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }): string {
  if (!isValidDateKey(key)) return key;
  return startOfDateKey(key).toLocaleDateString('en-IN', opts);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
