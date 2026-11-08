import type { InventoryItem } from '../types.ts';
import { MAX_AMOUNT, MAX_QUANTITY, roundMoney } from './money.ts';

export const LOW_STOCK_THRESHOLD = 5;

/**
 * Deterministic item-name normalisation used for matching stock to ledger
 * entries. This replaces the previous AI-based rename, which could silently
 * rewrite what the artisan typed (e.g. "Large Pichwai" -> "painting") and made
 * every save depend on an external AI call.
 */
export function normalizeItemName(name: string): string {
  if (typeof name !== 'string') return '';
  const words = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s-]/gu, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length === 0) return '';
  words[words.length - 1] = singularize(words[words.length - 1]);
  return words.join(' ').slice(0, 120);
}

function singularize(word: string): string {
  if (!/^[a-z]+$/.test(word) || word.length <= 3) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(sses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('s') && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

export type StockStatus = 'OUT' | 'LOW' | 'OK';

export function stockStatus(quantity: number, threshold: number = LOW_STOCK_THRESHOLD): StockStatus {
  if (!(quantity > 0)) return 'OUT';
  if (quantity < threshold) return 'LOW';
  return 'OK';
}

export function itemKey(item: Pick<InventoryItem, 'item' | 'normalized_name'>): string {
  return item.normalized_name || normalizeItemName(item.item);
}

export function findInventoryMatches<T extends Pick<InventoryItem, 'item' | 'normalized_name' | 'is_purchased' | 'unit_cost'>>(
  items: T[],
  name: string,
  opts: { isPurchased?: boolean; unitCost?: number } = {}
): T[] {
  const key = normalizeItemName(name);
  if (!key) return [];
  return items.filter(i => {
    if (itemKey(i) !== key) return false;
    if (opts.isPurchased !== undefined && i.is_purchased !== opts.isPurchased) return false;
    if (opts.unitCost !== undefined && roundMoney(i.unit_cost) !== roundMoney(opts.unitCost)) return false;
    return true;
  });
}

/**
 * Chooses which stock item a sale draws from: the explicitly selected SKU if
 * it still exists, otherwise the matching SKU with the most stock.
 */
export function pickSaleSource<T extends Pick<InventoryItem, 'id' | 'item' | 'normalized_name' | 'is_purchased' | 'unit_cost' | 'quantity'>>(
  items: T[],
  name: string,
  preferredId?: string | null
): T | null {
  if (preferredId) {
    const preferred = items.find(i => i.id === preferredId);
    if (preferred) return preferred;
  }
  const matches = findInventoryMatches(items, name);
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.quantity - a.quantity)[0];
}

/** Items that differ only by naming but share source and unit cost. */
export function findDuplicateGroups<T extends Pick<InventoryItem, 'id' | 'item' | 'normalized_name' | 'is_purchased' | 'unit_cost'>>(items: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${itemKey(item)}|${item.is_purchased ? 'P' : 'S'}|${roundMoney(item.unit_cost || 0)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.values()].filter(g => g.length > 1);
}

export function inventoryValuation(items: Pick<InventoryItem, 'quantity' | 'unit_cost'>[]): number {
  return roundMoney(items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unit_cost) || 0), 0));
}

export interface InventoryDraft {
  item: string;
  quantity: string | number;
  unitCost: string | number;
  isPurchased: boolean;
}

export interface ValidInventoryFields {
  item: string;
  normalized_name: string;
  quantity: number;
  unit_cost: number;
  is_purchased: boolean;
}

export function validateInventoryDraft(
  draft: InventoryDraft
): { ok: true; value: ValidInventoryFields } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const item = typeof draft.item === 'string' ? draft.item.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
  if (!item) errors.item = 'Enter an item name.';
  else if (item.length > 120) errors.item = 'Keep the name under 120 characters.';

  const qText = String(draft.quantity ?? '').trim();
  let quantity = 0;
  if (qText === '') errors.quantity = 'Enter the stock quantity.';
  else if (!/^\d+$/.test(qText)) errors.quantity = /^-/.test(qText) ? 'Stock cannot be negative.' : 'Stock must be a whole number.';
  else if (Number(qText) > MAX_QUANTITY) errors.quantity = 'Quantity is too large.';
  else quantity = Number(qText);

  const cText = String(draft.unitCost ?? '').replace(/[,\s₹]/g, '');
  let unitCost = 0;
  if (cText === '') errors.unitCost = 'Enter the unit cost (0 if unknown).';
  else if (!/^\d+(\.\d{1,2})?$/.test(cText)) errors.unitCost = /^-/.test(cText) ? 'Cost cannot be negative.' : 'Enter a valid amount with at most 2 decimals.';
  else if (Number(cText) > MAX_AMOUNT) errors.unitCost = 'Cost is too large.';
  else unitCost = roundMoney(Number(cText));

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { item, normalized_name: normalizeItemName(item), quantity, unit_cost: unitCost, is_purchased: !!draft.isPurchased },
  };
}
