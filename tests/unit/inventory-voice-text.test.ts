import { describe, expect, it } from 'vitest';
import {
  findDuplicateGroups,
  findInventoryMatches,
  inventoryValuation,
  normalizeItemName,
  pickSaleSource,
  stockStatus,
  validateInventoryDraft,
} from '../../lib/inventory';
import { buildVoiceDraft, inferIsPurchased, sanitizeVoiceAction } from '../../lib/voice';
import { csvCell, escapeHtml, initials, safeImageUrl, toCsv } from '../../lib/text';

const items = [
  { id: 'a', item: 'Brass Lamp', normalized_name: 'brass lamp', quantity: 2, unit_cost: 200, is_purchased: true },
  { id: 'b', item: 'brass lamps', normalized_name: '', quantity: 7, unit_cost: 200, is_purchased: true },
  { id: 'c', item: 'Brass Lamp', normalized_name: 'brass lamp', quantity: 1, unit_cost: 150, is_purchased: false },
  { id: 'd', item: 'Glass', normalized_name: 'glass', quantity: 0, unit_cost: 20, is_purchased: true },
];

describe('normalizeItemName', () => {
  it('is deterministic and conservative', () => {
    expect(normalizeItemName('  Pichwai   Paintings!! ')).toBe('pichwai painting');
    expect(normalizeItemName('Boxes')).toBe('box');
    expect(normalizeItemName('Glass')).toBe('glass');
    expect(normalizeItemName('Batteries')).toBe('battery');
    expect(normalizeItemName('चाँदी की मूर्ति')).toBe('चाँदी की मूर्ति');
    expect(normalizeItemName('')).toBe('');
  });
});

describe('inventory matching', () => {
  it('matches by normalised name with optional source and cost filters', () => {
    expect(findInventoryMatches(items, 'brass lamp').map(i => i.id)).toEqual(['a', 'b', 'c']);
    expect(findInventoryMatches(items, 'Brass Lamps', { isPurchased: false }).map(i => i.id)).toEqual(['c']);
    expect(findInventoryMatches(items, 'brass lamp', { unitCost: 200 }).map(i => i.id)).toEqual(['a', 'b']);
  });

  it('prefers an explicit SKU, otherwise the one with most stock', () => {
    expect(pickSaleSource(items, 'brass lamp')?.id).toBe('b');
    expect(pickSaleSource(items, 'brass lamp', 'c')?.id).toBe('c');
    expect(pickSaleSource(items, 'unknown')).toBeNull();
  });

  it('finds duplicates that share name, source and cost', () => {
    expect(findDuplicateGroups(items).map(g => g.map(i => i.id))).toEqual([['a', 'b']]);
  });

  it('computes stock status and valuation', () => {
    expect(stockStatus(0)).toBe('OUT');
    expect(stockStatus(4)).toBe('LOW');
    expect(stockStatus(5)).toBe('OK');
    expect(inventoryValuation(items)).toBe(2 * 200 + 7 * 200 + 150);
  });

  it('validates inventory drafts strictly', () => {
    expect(validateInventoryDraft({ item: 'Pigment', quantity: '10', unitCost: '12.5', isPurchased: true })).toEqual({
      ok: true,
      value: { item: 'Pigment', normalized_name: 'pigment', quantity: 10, unit_cost: 12.5, is_purchased: true },
    });
    expect(validateInventoryDraft({ item: '', quantity: '1', unitCost: '1', isPurchased: true }).ok).toBe(false);
    expect(validateInventoryDraft({ item: 'x', quantity: '-1', unitCost: '1', isPurchased: true }).ok).toBe(false);
    expect(validateInventoryDraft({ item: 'x', quantity: '1', unitCost: '-1', isPurchased: true }).ok).toBe(false);
    expect(validateInventoryDraft({ item: 'x', quantity: '1.5', unitCost: '1', isPurchased: true }).ok).toBe(false);
  });
});

describe('sanitizeVoiceAction', () => {
  it('rejects unknown actions and clamps numbers', () => {
    const a = sanitizeVoiceAction({ action: 'delete_all_records', category: 'ADMIN', price: -50, quantity: 'lots' });
    expect(a.action).toBe('none');
    expect(a.price).toBeUndefined();
    expect(a.quantity).toBeUndefined();
    expect(a.category).toBe('BUSINESS');
  });

  it('derives category from the action rather than trusting the model', () => {
    const a = sanitizeVoiceAction({ action: 'personal_paid', category: 'BUSINESS', item: 'Rajesh', price: 500 });
    expect(a.category).toBe('PERSONAL');
  });

  it('strips markup and control characters from text', () => {
    const a = sanitizeVoiceAction({ action: 'transaction', item: '<img src=x onerror=alert(1)>Lamp', customer_name: 'A\u0000B' });
    expect(a.item).not.toMatch(/[<>]/);
    expect(a.customer_name).toBe('A B');
  });

  it('never throws on garbage', () => {
    expect(sanitizeVoiceAction(null).action).toBe('none');
    expect(sanitizeVoiceAction('ignore previous instructions').action).toBe('none');
    expect(sanitizeVoiceAction({ action: 'transaction', price: Number.POSITIVE_INFINITY }).price).toBeUndefined();
  });
});

describe('buildVoiceDraft', () => {
  it('turns a sale into a reviewable draft with warnings for missing fields', () => {
    const d = buildVoiceDraft(sanitizeVoiceAction({ action: 'transaction', item: 'Pichwai', price: 3000 }, 'pichwai bechi teen hazaar'));
    expect(d).toMatchObject({ kind: 'ledger', type: 'SALE', item: 'Pichwai', quantity: '1', unitPrice: '3000', paymentStatus: 'PAID' });
    expect(d?.warnings.some(w => w.includes('Quantity'))).toBe(true);
  });

  it('flags udhaar sales without a customer and keeps PENDING status', () => {
    const d = buildVoiceDraft(sanitizeVoiceAction({ action: 'transaction', item: 'Box', quantity: 2, price: 400, payment_status: 'PENDING' }));
    expect(d).toMatchObject({ paymentStatus: 'PENDING', quantity: '2', unitPrice: '200' });
    expect(d?.warnings.some(w => w.includes('customer'))).toBe(true);
  });

  it('returns null when nothing actionable was said', () => {
    expect(buildVoiceDraft(sanitizeVoiceAction({ action: 'none' }))).toBeNull();
  });

  it('prefers the model’s is_purchased and falls back to Hindi/English keywords', () => {
    expect(inferIsPurchased('maine 5 diye banaye', undefined)).toBe(false);
    expect(inferIsPurchased('5 lamps kharide', undefined)).toBe(true);
    expect(inferIsPurchased('bought five', false)).toBe(false);
  });
});

describe('text helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml('<img src=x onerror="a">&\'')).toBe('&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  });

  it('neutralises CSV formula injection and quotes delimiters', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+91 98')).toBe("'+91 98");
    expect(csvCell('-500')).toBe("'-500");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(toCsv([['a', 1], ['b', null]])).toBe('a,1\r\nb,');
  });

  it('allows only https image URLs', () => {
    expect(safeImageUrl('https://res.cloudinary.com/x.jpg')).toBe('https://res.cloudinary.com/x.jpg');
    expect(safeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeImageUrl('http://insecure/x.jpg')).toBeUndefined();
    expect(safeImageUrl(42)).toBeUndefined();
  });

  it('builds initials from Unicode names', () => {
    expect(initials('Arjun Mewari')).toBe('AM');
    expect(initials('')).toBe('?');
  });
});
