import type { EntryCategory, EntryType, InventoryItem, LedgerEntry, PaymentStatus } from '../types.ts';
import { MAX_AMOUNT, MAX_QUANTITY, roundMoney } from './money.ts';
import { localDateKey, startOfDateKey } from './dates.ts';
import { normalizeItemName } from './inventory.ts';

/*
 * Accounting model (unchanged from the original app, now made explicit):
 *  - Every record is a cash-basis movement. SALE and PERSONAL_RECEIVED bring
 *    money in; BUSINESS_EXPENSE, OTHER_EXPENSE and PERSONAL_PAID send it out.
 *  - PAID records live in `ledger_entries`. PENDING records (udhaar) live in
 *    `udhaar_entries` until they are settled, at which point they move into
 *    the ledger dated on the settlement day.
 *  - A pending inflow is money owed *to* the artisan (receivable); a pending
 *    outflow is money the artisan still owes (payable).
 *  - SALE removes stock; BUSINESS_EXPENSE (stock purchase) adds stock.
 */

export const ENTRY_TYPES: EntryType[] = ['SALE', 'BUSINESS_EXPENSE', 'OTHER_EXPENSE', 'PERSONAL_RECEIVED', 'PERSONAL_PAID'];
export const BUSINESS_TYPES: EntryType[] = ['SALE', 'BUSINESS_EXPENSE', 'OTHER_EXPENSE'];
export const PERSONAL_TYPES: EntryType[] = ['PERSONAL_RECEIVED', 'PERSONAL_PAID'];

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  SALE: 'Sale',
  BUSINESS_EXPENSE: 'Stock purchase',
  OTHER_EXPENSE: 'Other expense',
  PERSONAL_RECEIVED: 'Received',
  PERSONAL_PAID: 'Given',
};

export const MAX_ITEM_LENGTH = 120;
export const MAX_NAME_LENGTH = 80;

export function isEntryType(value: unknown): value is EntryType {
  return typeof value === 'string' && (ENTRY_TYPES as string[]).includes(value);
}

export function isInflow(type: EntryType): boolean {
  return type === 'SALE' || type === 'PERSONAL_RECEIVED';
}

export function categoryForType(type: EntryType): EntryCategory {
  return BUSINESS_TYPES.includes(type) ? 'BUSINESS' : 'PERSONAL';
}

/** Signed stock movement caused by an entry (negative = stock leaves). */
export function stockEffect(entry: { type: EntryType; quantity: number }): number {
  if (entry.type === 'SALE') return -entry.quantity;
  if (entry.type === 'BUSINESS_EXPENSE') return entry.quantity;
  return 0;
}

export type DuesDirection = 'RECEIVABLE' | 'PAYABLE';

export function duesDirection(type: EntryType): DuesDirection {
  return isInflow(type) ? 'RECEIVABLE' : 'PAYABLE';
}

export interface LedgerDraft {
  type: EntryType;
  item: string;
  quantity: string | number;
  unitPrice: string | number;
  /** Only used for personal entries, where the amount is entered directly. */
  amount?: string | number;
  paymentStatus: PaymentStatus;
  customerName?: string;
  inventoryId?: string | null;
}

export interface ValidLedgerFields {
  type: EntryType;
  category: EntryCategory;
  item: string;
  normalized_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
  payment_status: PaymentStatus;
  customer_name: string;
  inventory_id?: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function toNumber(value: string | number | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const text = value.replace(/[,\s₹]/g, '');
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) return Number.NaN;
  return Number(text);
}

/**
 * Validates and normalises a ledger draft coming from a form, the voice
 * assistant, or an edit. This is the single gate every write goes through on
 * the client; Firestore security rules re-check the same constraints.
 */
export function validateLedgerDraft(draft: LedgerDraft): ValidationResult<ValidLedgerFields> {
  const errors: Record<string, string> = {};

  if (!isEntryType(draft.type)) errors.type = 'Choose an entry type.';
  const type = draft.type;
  const category = isEntryType(type) ? categoryForType(type) : 'BUSINESS';

  const rawItem = typeof draft.item === 'string' ? draft.item.trim() : '';
  const item = cleanText(draft.item, MAX_ITEM_LENGTH);
  if (!item) errors.item = category === 'PERSONAL' ? 'Enter the person’s name.' : 'Describe the item or expense.';
  else if (rawItem.length > MAX_ITEM_LENGTH) errors.item = `Keep this under ${MAX_ITEM_LENGTH} characters.`;

  const rawCustomer = typeof draft.customerName === 'string' ? draft.customerName.trim() : '';
  const customerName = cleanText(draft.customerName ?? '', MAX_NAME_LENGTH);
  if (rawCustomer.length > MAX_NAME_LENGTH) errors.customerName = `Keep the name under ${MAX_NAME_LENGTH} characters.`;

  if (draft.paymentStatus !== 'PAID' && draft.paymentStatus !== 'PENDING') {
    errors.paymentStatus = 'Choose a payment status.';
  }

  let quantity = 1;
  let unitPrice = 0;
  let amount = 0;

  if (category === 'BUSINESS') {
    const q = toNumber(draft.quantity);
    if (!Number.isFinite(q)) errors.quantity = 'Enter a quantity.';
    else if (!Number.isInteger(q)) errors.quantity = 'Quantity must be a whole number.';
    else if (q < 1) errors.quantity = 'Quantity must be at least 1.';
    else if (q > MAX_QUANTITY) errors.quantity = 'Quantity is too large.';
    else quantity = q;

    const u = toNumber(draft.unitPrice);
    if (!Number.isFinite(u)) errors.unitPrice = 'Enter a rate.';
    else if (u < 0) errors.unitPrice = 'Rate cannot be negative.';
    else if (roundMoney(u) !== u && Math.abs(roundMoney(u) - u) > 1e-9) errors.unitPrice = 'Use at most 2 decimal places.';
    else if (u > MAX_AMOUNT) errors.unitPrice = 'Rate is too large.';
    else unitPrice = roundMoney(u);

    amount = roundMoney(quantity * unitPrice);
    if (!errors.quantity && !errors.unitPrice) {
      if (amount <= 0) errors.unitPrice = 'Total must be greater than zero.';
      else if (amount > MAX_AMOUNT) errors.unitPrice = 'Total is too large.';
    }
  } else {
    const a = toNumber(draft.amount ?? draft.unitPrice);
    if (!Number.isFinite(a)) errors.amount = 'Enter an amount.';
    else if (a <= 0) errors.amount = 'Amount must be greater than zero.';
    else if (Math.abs(roundMoney(a) - a) > 1e-9) errors.amount = 'Use at most 2 decimal places.';
    else if (a > MAX_AMOUNT) errors.amount = 'Amount is too large.';
    else amount = roundMoney(a);
    quantity = 1;
    unitPrice = amount;
  }

  if (draft.paymentStatus === 'PENDING' && category === 'BUSINESS' && !customerName) {
    errors.customerName = type === 'SALE' ? 'Who owes this amount? Enter the customer name.' : 'Whom do you owe? Enter the supplier name.';
  }

  const inventoryId = typeof draft.inventoryId === 'string' && draft.inventoryId.length > 0 && draft.inventoryId.length <= 128
    ? draft.inventoryId
    : undefined;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const value: ValidLedgerFields = {
    type,
    category,
    item,
    normalized_name: normalizeItemName(item),
    quantity,
    unit_price: unitPrice,
    amount,
    payment_status: draft.paymentStatus,
    customer_name: customerName,
  };
  if (inventoryId && (type === 'SALE' || type === 'BUSINESS_EXPENSE')) value.inventory_id = inventoryId;
  return { ok: true, value };
}

export interface BusinessSummary {
  sales: number;
  stockExpenses: number;
  otherExpenses: number;
  net: number;
}

export function summarizeBusiness(entries: Pick<LedgerEntry, 'type' | 'amount'>[]): BusinessSummary {
  let sales = 0;
  let stockExpenses = 0;
  let otherExpenses = 0;
  for (const e of entries) {
    const amount = Number(e.amount) || 0;
    if (e.type === 'SALE') sales += amount;
    else if (e.type === 'BUSINESS_EXPENSE') stockExpenses += amount;
    else if (e.type === 'OTHER_EXPENSE') otherExpenses += amount;
  }
  sales = roundMoney(sales);
  stockExpenses = roundMoney(stockExpenses);
  otherExpenses = roundMoney(otherExpenses);
  return { sales, stockExpenses, otherExpenses, net: roundMoney(sales - stockExpenses - otherExpenses) };
}

export interface PersonalSummary {
  received: number;
  given: number;
  net: number;
}

export function summarizePersonal(entries: Pick<LedgerEntry, 'type' | 'amount'>[]): PersonalSummary {
  let received = 0;
  let given = 0;
  for (const e of entries) {
    const amount = Number(e.amount) || 0;
    if (e.type === 'PERSONAL_RECEIVED') received += amount;
    else if (e.type === 'PERSONAL_PAID') given += amount;
  }
  received = roundMoney(received);
  given = roundMoney(given);
  return { received, given, net: roundMoney(received - given) };
}

export interface CashSummary {
  inflow: number;
  outflow: number;
  net: number;
}

/** Cash actually moved: only PAID entries count. */
export function summarizeCash(entries: Pick<LedgerEntry, 'type' | 'amount' | 'payment_status'>[]): CashSummary {
  let inflow = 0;
  let outflow = 0;
  for (const e of entries) {
    if (e.payment_status === 'PENDING') continue;
    const amount = Number(e.amount) || 0;
    if (isInflow(e.type)) inflow += amount;
    else outflow += amount;
  }
  inflow = roundMoney(inflow);
  outflow = roundMoney(outflow);
  return { inflow, outflow, net: roundMoney(inflow - outflow) };
}

export interface DuesSummary {
  receivable: number;
  payable: number;
  receivableCount: number;
  payableCount: number;
}

export function summarizeDues(pending: Pick<LedgerEntry, 'type' | 'amount' | 'payment_status'>[]): DuesSummary {
  const out: DuesSummary = { receivable: 0, payable: 0, receivableCount: 0, payableCount: 0 };
  for (const e of pending) {
    if (e.payment_status !== 'PENDING') continue;
    const amount = Number(e.amount) || 0;
    if (duesDirection(e.type) === 'RECEIVABLE') {
      out.receivable += amount;
      out.receivableCount += 1;
    } else {
      out.payable += amount;
      out.payableCount += 1;
    }
  }
  out.receivable = roundMoney(out.receivable);
  out.payable = roundMoney(out.payable);
  return out;
}

export function entriesOnDate<T extends Pick<LedgerEntry, 'created_at'>>(entries: T[], dateKey: string): T[] {
  return entries.filter(e => localDateKey(e.created_at) === dateKey);
}

export function entriesInRange<T extends Pick<LedgerEntry, 'created_at'>>(entries: T[], startKey: string, endKey: string): T[] {
  const [from, to] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];
  return entries.filter(e => {
    const key = localDateKey(e.created_at);
    return key !== '' && key >= from && key <= to;
  });
}

export function sortNewestFirst<T extends Pick<LedgerEntry, 'created_at'>>(entries: T[]): T[] {
  return [...entries].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export type ChartRange = 'WEEK' | 'MONTH' | 'YEAR';

export interface ChartPoint {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

/**
 * Cash-flow series for the dashboard chart. Pending (udhaar) records are
 * excluded because no cash has moved yet.
 */
export function buildCashFlowSeries(
  entries: Pick<LedgerEntry, 'type' | 'amount' | 'payment_status' | 'created_at'>[],
  range: ChartRange,
  now: Date = new Date()
): ChartPoint[] {
  const buckets: { label: string; start: Date; end: Date }[] = [];
  if (range === 'WEEK') {
    const today = startOfDateKey(localDateKey(now));
    const dow = today.getDay();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (dow === 0 ? 6 : dow - 1));
    for (let i = 0; i < 7; i++) {
      const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const end = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i + 1);
      buckets.push({ label: start.toLocaleDateString('en-IN', { weekday: 'short' }), start, end });
    }
  } else if (range === 'MONTH') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let startDay = 1; startDay <= daysInMonth; startDay += 7) {
      const endDay = Math.min(startDay + 6, daysInMonth);
      buckets.push({
        label: `${startDay}–${endDay}`,
        start: new Date(y, m, startDay),
        end: new Date(y, m, endDay + 1),
      });
    }
  } else {
    const y = now.getFullYear();
    for (let i = 0; i < 12; i++) {
      const start = new Date(y, i, 1);
      buckets.push({ label: start.toLocaleDateString('en-IN', { month: 'short' }), start, end: new Date(y, i + 1, 1) });
    }
  }

  const points: ChartPoint[] = buckets.map(b => ({ label: b.label, inflow: 0, outflow: 0, net: 0 }));
  for (const e of entries) {
    if (e.payment_status === 'PENDING') continue;
    const t = Date.parse(e.created_at);
    if (Number.isNaN(t)) continue;
    const idx = buckets.findIndex(b => t >= b.start.getTime() && t < b.end.getTime());
    if (idx === -1) continue;
    const amount = Number(e.amount) || 0;
    if (isInflow(e.type)) points[idx].inflow += amount;
    else points[idx].outflow += amount;
  }
  for (const p of points) {
    p.inflow = roundMoney(p.inflow);
    p.outflow = roundMoney(p.outflow);
    p.net = roundMoney(p.inflow - p.outflow);
  }
  return points;
}

export interface SaleMargin {
  unitCost: number;
  cost: number;
  profit: number;
}

/** Margin on a sale of a purchased item, when its cost is known. */
export function saleMargin(
  entry: Pick<LedgerEntry, 'type' | 'item' | 'quantity' | 'amount' | 'inventory_id' | 'normalized_name'>,
  inventory: Pick<InventoryItem, 'id' | 'item' | 'normalized_name' | 'unit_cost' | 'is_purchased'>[]
): SaleMargin | null {
  if (entry.type !== 'SALE') return null;
  const key = entry.normalized_name || normalizeItemName(entry.item);
  const match = (entry.inventory_id && inventory.find(i => i.id === entry.inventory_id))
    || inventory.find(i => i.is_purchased && (i.normalized_name || normalizeItemName(i.item)) === key);
  if (!match || !match.is_purchased || !(match.unit_cost > 0)) return null;
  const cost = roundMoney(match.unit_cost * entry.quantity);
  return { unitCost: match.unit_cost, cost, profit: roundMoney(entry.amount - cost) };
}

/** Distinct local business days that have entries, newest first. */
export function distinctDateKeys(entries: Pick<LedgerEntry, 'created_at'>[]): string[] {
  const keys = new Set<string>();
  for (const e of entries) {
    const key = localDateKey(e.created_at);
    if (key) keys.add(key);
  }
  return [...keys].sort().reverse();
}
