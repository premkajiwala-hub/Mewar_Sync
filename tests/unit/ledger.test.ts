import { describe, expect, it } from 'vitest';
import {
  buildCashFlowSeries,
  categoryForType,
  distinctDateKeys,
  entriesInRange,
  saleMargin,
  stockEffect,
  summarizeBusiness,
  summarizeCash,
  summarizeDues,
  summarizePersonal,
  validateLedgerDraft,
} from '../../lib/ledger';
import type { LedgerEntry } from '../../types';

function entry(partial: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    type: 'SALE',
    category: 'BUSINESS',
    item: 'pichwai',
    quantity: 1,
    unit_price: 100,
    amount: 100,
    created_at: new Date(2026, 9, 13, 12).toISOString(),
    shop_id: 'shop',
    payment_status: 'PAID',
    ...partial,
  };
}

describe('validateLedgerDraft', () => {
  it('computes a business total from quantity × rate with paise precision', () => {
    const r = validateLedgerDraft({ type: 'SALE', item: '  Pichwai   Painting ', quantity: '3', unitPrice: '33.33', paymentStatus: 'PAID' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.amount).toBe(99.99);
    expect(r.value.item).toBe('Pichwai Painting');
    expect(r.value.normalized_name).toBe('pichwai painting');
    expect(r.value.category).toBe('BUSINESS');
  });

  it('derives category from type so mismatched voice output cannot corrupt the ledger', () => {
    const r = validateLedgerDraft({ type: 'PERSONAL_PAID', item: 'Rajesh', quantity: 4, unitPrice: 0, amount: '500', paymentStatus: 'PAID' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.category).toBe('PERSONAL');
    expect(r.value.quantity).toBe(1);
    expect(r.value.unit_price).toBe(500);
    expect(r.value.amount).toBe(500);
  });

  it('rejects negative, zero, fractional-quantity and oversized values', () => {
    expect(validateLedgerDraft({ type: 'SALE', item: 'x', quantity: '1', unitPrice: '-10', paymentStatus: 'PAID' }).ok).toBe(false);
    expect(validateLedgerDraft({ type: 'SALE', item: 'x', quantity: '1', unitPrice: '0', paymentStatus: 'PAID' }).ok).toBe(false);
    expect(validateLedgerDraft({ type: 'SALE', item: 'x', quantity: '1.5', unitPrice: '10', paymentStatus: 'PAID' }).ok).toBe(false);
    expect(validateLedgerDraft({ type: 'SALE', item: 'x', quantity: '1', unitPrice: '10.555', paymentStatus: 'PAID' }).ok).toBe(false);
    expect(validateLedgerDraft({ type: 'SALE', item: 'x', quantity: '2', unitPrice: '999999999', paymentStatus: 'PAID' }).ok).toBe(false);
    expect(validateLedgerDraft({ type: 'PERSONAL_RECEIVED', item: 'x', quantity: 1, unitPrice: 0, amount: '0', paymentStatus: 'PAID' }).ok).toBe(false);
  });

  it('requires a description and a known type', () => {
    const r = validateLedgerDraft({ type: 'SALE', item: '   ', quantity: '1', unitPrice: '10', paymentStatus: 'PAID' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.item).toBeDefined();
    expect(validateLedgerDraft({ type: 'REFUND' as never, item: 'x', quantity: '1', unitPrice: '10', paymentStatus: 'PAID' }).ok).toBe(false);
  });

  it('requires a customer name for a business udhaar entry', () => {
    const r = validateLedgerDraft({ type: 'SALE', item: 'Box', quantity: '1', unitPrice: '10', paymentStatus: 'PENDING' });
    expect(r.ok).toBe(false);
    const ok = validateLedgerDraft({ type: 'SALE', item: 'Box', quantity: '1', unitPrice: '10', paymentStatus: 'PENDING', customerName: 'Manmohan' });
    expect(ok.ok).toBe(true);
  });

  it('strips control characters from text fields', () => {
    const r = validateLedgerDraft({ type: 'SALE', item: 'Box\u0000\nlid', quantity: '1', unitPrice: '10', paymentStatus: 'PAID' });
    expect(r.ok && r.value.item).toBe('Box lid');
  });
});

describe('summaries', () => {
  const entries = [
    entry({ type: 'SALE', amount: 1000 }),
    entry({ type: 'SALE', amount: 250.5 }),
    entry({ type: 'BUSINESS_EXPENSE', amount: 400 }),
    entry({ type: 'OTHER_EXPENSE', amount: 100.25 }),
    entry({ type: 'PERSONAL_RECEIVED', category: 'PERSONAL', amount: 300 }),
    entry({ type: 'PERSONAL_PAID', category: 'PERSONAL', amount: 50 }),
  ];

  it('summarises business revenue and costs', () => {
    expect(summarizeBusiness(entries)).toEqual({ sales: 1250.5, stockExpenses: 400, otherExpenses: 100.25, net: 750.25 });
  });

  it('summarises personal money in and out', () => {
    expect(summarizePersonal(entries)).toEqual({ received: 300, given: 50, net: 250 });
  });

  it('counts only paid entries as cash', () => {
    const withPending = [...entries, entry({ type: 'SALE', amount: 5000, payment_status: 'PENDING' })];
    expect(summarizeCash(withPending)).toEqual({ inflow: 1550.5, outflow: 550.25, net: 1000.25 });
  });

  it('splits udhaar into receivables and payables', () => {
    const pending = [
      entry({ type: 'SALE', amount: 700, payment_status: 'PENDING' }),
      entry({ type: 'PERSONAL_RECEIVED', category: 'PERSONAL', amount: 50, payment_status: 'PENDING' }),
      entry({ type: 'BUSINESS_EXPENSE', amount: 300, payment_status: 'PENDING' }),
      entry({ type: 'PERSONAL_PAID', category: 'PERSONAL', amount: 20, payment_status: 'PENDING' }),
    ];
    expect(summarizeDues(pending)).toEqual({ receivable: 750, payable: 320, receivableCount: 2, payableCount: 2 });
  });
});

describe('stockEffect / categoryForType', () => {
  it('sales remove stock and stock purchases add it', () => {
    expect(stockEffect({ type: 'SALE', quantity: 3 })).toBe(-3);
    expect(stockEffect({ type: 'BUSINESS_EXPENSE', quantity: 3 })).toBe(3);
    expect(stockEffect({ type: 'OTHER_EXPENSE', quantity: 3 })).toBe(0);
    expect(categoryForType('PERSONAL_PAID')).toBe('PERSONAL');
    expect(categoryForType('OTHER_EXPENSE')).toBe('BUSINESS');
  });
});

describe('date grouping', () => {
  it('filters by local date range in either order', () => {
    const a = entry({ created_at: new Date(2026, 9, 1, 23, 30).toISOString() });
    const b = entry({ created_at: new Date(2026, 9, 2, 0, 15).toISOString() });
    const c = entry({ created_at: new Date(2026, 9, 5, 10).toISOString() });
    expect(entriesInRange([a, b, c], '2026-10-02', '2026-10-05')).toEqual([b, c]);
    expect(entriesInRange([a, b, c], '2026-10-05', '2026-10-02')).toEqual([b, c]);
    expect(distinctDateKeys([a, b, c, c])).toEqual(['2026-10-05', '2026-10-02', '2026-10-01']);
  });

  it('builds a weekly cash-flow series that ignores udhaar', () => {
    const now = new Date(2026, 9, 14, 9); // Wednesday
    const series = buildCashFlowSeries([
      entry({ type: 'SALE', amount: 500, created_at: new Date(2026, 9, 12, 10).toISOString() }), // Monday
      entry({ type: 'OTHER_EXPENSE', amount: 200, created_at: new Date(2026, 9, 12, 18).toISOString() }),
      entry({ type: 'SALE', amount: 900, payment_status: 'PENDING', created_at: new Date(2026, 9, 13, 10).toISOString() }),
      entry({ type: 'SALE', amount: 50, created_at: new Date(2026, 9, 5, 10).toISOString() }), // previous week
    ], 'WEEK', now);
    expect(series).toHaveLength(7);
    expect(series[0]).toMatchObject({ inflow: 500, outflow: 200, net: 300 });
    expect(series[1]).toMatchObject({ inflow: 0, outflow: 0, net: 0 });
  });

  it('covers every day of the month without dropping days 29–31', () => {
    const now = new Date(2026, 9, 31, 9);
    const series = buildCashFlowSeries([
      entry({ type: 'SALE', amount: 10, created_at: new Date(2026, 9, 31, 10).toISOString() }),
    ], 'MONTH', now);
    expect(series.at(-1)).toMatchObject({ label: '29–31', inflow: 10 });
  });
});

describe('saleMargin', () => {
  it('computes profit for sales of purchased stock with a known cost', () => {
    const inventory = [{ id: 'inv1', item: 'Brass Lamp', normalized_name: 'brass lamp', unit_cost: 200, is_purchased: true }];
    const m = saleMargin(entry({ type: 'SALE', item: 'Brass Lamps', quantity: 2, amount: 700 }), inventory);
    expect(m).toEqual({ unitCost: 200, cost: 400, profit: 300 });
  });

  it('returns null for self-produced stock or non-sales', () => {
    const inventory = [{ id: 'inv1', item: 'Pichwai', normalized_name: 'pichwai', unit_cost: 200, is_purchased: false }];
    expect(saleMargin(entry({ type: 'SALE', item: 'Pichwai' }), inventory)).toBeNull();
    expect(saleMargin(entry({ type: 'OTHER_EXPENSE', item: 'Pichwai' }), inventory)).toBeNull();
  });
});
