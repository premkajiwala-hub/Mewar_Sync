import type { EntryType, PaymentStatus, VoiceAction } from '../types.ts';
import { MAX_AMOUNT, MAX_QUANTITY, roundMoney } from './money.ts';
import { categoryForType } from './ledger.ts';

/*
 * Voice and AI output is untrusted input. Everything the speech recogniser or
 * the language model produces passes through `sanitizeVoiceAction` (on the
 * server and again on the client) and is then shown to the artisan as an
 * editable draft. Nothing is written to the ledger until they confirm it.
 */

export const LEDGER_VOICE_ACTIONS = ['transaction', 'expense', 'other_expense', 'personal_received', 'personal_paid', 'inventory', 'none'] as const;
export type LedgerVoiceAction = (typeof LEDGER_VOICE_ACTIONS)[number];

export const MAX_TRANSCRIPT_LENGTH = 500;

const ACTION_TO_TYPE: Partial<Record<LedgerVoiceAction, EntryType>> = {
  transaction: 'SALE',
  expense: 'BUSINESS_EXPENSE',
  other_expense: 'OTHER_EXPENSE',
  personal_received: 'PERSONAL_RECEIVED',
  personal_paid: 'PERSONAL_PAID',
};

export function actionToEntryType(action: string): EntryType | null {
  return ACTION_TO_TYPE[action as LedgerVoiceAction] ?? null;
}

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanNumber(value: unknown, max: number): number | undefined {
  const n = typeof value === 'string' ? Number(value.replace(/[,\s₹]/g, '')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return undefined;
  return Math.min(n, max);
}

/** Coerces arbitrary model output into a safe, bounded VoiceAction. Never throws. */
export function sanitizeVoiceAction(raw: unknown, transcript?: string): VoiceAction {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const action = (LEDGER_VOICE_ACTIONS as readonly string[]).includes(src.action as string)
    ? (src.action as LedgerVoiceAction)
    : 'none';

  const entryType = actionToEntryType(action);
  const category = entryType
    ? categoryForType(entryType)
    : src.category === 'PERSONAL' ? 'PERSONAL' : 'BUSINESS';

  const quantityRaw = cleanNumber(src.quantity, MAX_QUANTITY);
  const quantity = quantityRaw !== undefined && quantityRaw >= 1 ? Math.round(quantityRaw) : undefined;
  const priceRaw = cleanNumber(src.price, MAX_AMOUNT);
  const unitRaw = cleanNumber(src.unitPrice, MAX_AMOUNT);

  const out: VoiceAction = {
    action,
    category,
    item: cleanString(src.item, 120) || undefined,
    quantity,
    price: priceRaw !== undefined ? roundMoney(priceRaw) : undefined,
    unitPrice: unitRaw !== undefined ? roundMoney(unitRaw) : undefined,
    payment_status: src.payment_status === 'PENDING' ? 'PENDING' : 'PAID',
    customer_name: cleanString(src.customer_name, 80) || undefined,
    is_purchased: typeof src.is_purchased === 'boolean' ? src.is_purchased : undefined,
  };
  if (transcript !== undefined) out.transcript = cleanString(transcript, MAX_TRANSCRIPT_LENGTH);
  return out;
}

const PURCHASE_WORDS = ['bought', 'purchased', 'purchase', 'kharid', 'kharee', 'khareed', 'kharida', 'kharide', 'kharidi', 'खरीद', 'खरीदा', 'खरीदे', 'खरीदी', 'stock aaya', 'maal aaya'];
const MADE_WORDS = ['made', 'crafted', 'created', 'produced', 'banaya', 'banayi', 'banaye', 'taiyar', 'taiyaar', 'बनाया', 'बनाई', 'बनाए', 'तैयार'];

/**
 * Whether stock was bought (vs. made in-house). The model's answer wins when
 * present; keyword detection (English + Hindi/Hinglish) is only a fallback.
 */
export function inferIsPurchased(transcript: string | undefined, aiValue: boolean | undefined): boolean {
  if (typeof aiValue === 'boolean') return aiValue;
  const text = (transcript || '').toLowerCase();
  if (MADE_WORDS.some(w => text.includes(w))) return false;
  if (PURCHASE_WORDS.some(w => text.includes(w))) return true;
  return true;
}

export interface VoiceDraft {
  kind: 'ledger' | 'stock';
  type: EntryType;
  item: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  paymentStatus: PaymentStatus;
  customerName: string;
  isPurchased: boolean;
  transcript: string;
  /** Fields the model could not determine — the artisan must check them. */
  warnings: string[];
}

function moneyToInput(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '';
  return String(roundMoney(n));
}

/**
 * Builds the editable confirmation draft from a sanitised action. Returns null
 * when the transcript did not describe a ledger or stock operation.
 */
export function buildVoiceDraft(action: VoiceAction): VoiceDraft | null {
  const transcript = action.transcript || '';
  const warnings: string[] = [];

  if (action.action === 'inventory') {
    const quantity = action.quantity;
    if (!action.item) warnings.push('Item name was not recognised.');
    if (!quantity) warnings.push('Quantity was not recognised.');
    const unit = action.unitPrice ?? (action.price !== undefined && quantity ? action.price / quantity : undefined);
    return {
      kind: 'stock',
      type: 'BUSINESS_EXPENSE',
      item: action.item || '',
      quantity: quantity ? String(quantity) : '',
      unitPrice: moneyToInput(unit),
      amount: '',
      paymentStatus: 'PAID',
      customerName: '',
      isPurchased: inferIsPurchased(transcript, action.is_purchased),
      transcript,
      warnings,
    };
  }

  const type = actionToEntryType(action.action);
  if (!type) return null;
  const category = categoryForType(type);

  if (!action.item) warnings.push(category === 'PERSONAL' ? 'Person’s name was not recognised.' : 'Item was not recognised.');

  let quantity = '';
  let unitPrice = '';
  let amount = '';
  if (category === 'BUSINESS') {
    const q = action.quantity ?? 1;
    if (!action.quantity) warnings.push('Quantity was not stated — assumed 1.');
    let unit = action.unitPrice;
    if (action.price !== undefined) unit = action.price / q;
    if (unit === undefined) warnings.push('Amount was not recognised.');
    quantity = String(q);
    unitPrice = moneyToInput(unit);
    if (unit !== undefined && action.price !== undefined && Math.abs(roundMoney(unit) * q - action.price) > 0.009) {
      warnings.push('Total does not divide evenly by quantity — please check the rate.');
    }
  } else {
    const value = action.price ?? action.unitPrice;
    if (value === undefined) warnings.push('Amount was not recognised.');
    amount = moneyToInput(value);
    quantity = '1';
  }

  if (action.payment_status === 'PENDING' && !action.customer_name && category === 'BUSINESS') {
    warnings.push('Udhaar entry: add the customer’s name.');
  }

  return {
    kind: 'ledger',
    type,
    item: action.item || '',
    quantity,
    unitPrice,
    amount,
    paymentStatus: action.payment_status === 'PENDING' ? 'PENDING' : 'PAID',
    customerName: action.customer_name || '',
    isPurchased: type === 'BUSINESS_EXPENSE' ? inferIsPurchased(transcript, action.is_purchased) : false,
    transcript,
    warnings,
  };
}
