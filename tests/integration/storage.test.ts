/**
 * Exercises the real client data layer (services/storage.ts) against the
 * Firebase Auth + Firestore emulators with the production security rules.
 * Run with `npm run test:integration`.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { setLogLevel } from 'firebase/firestore';
import { InsufficientStockError, storage } from '../../services/storage';
import { auth } from '../../services/firebase';
import { validateLedgerDraft, type LedgerDraft } from '../../lib/ledger';
import { validateInventoryDraft } from '../../lib/inventory';
import { addDays, localDateKey } from '../../lib/dates';

const run = Date.now().toString(36);
const today = localDateKey();

function fields(draft: LedgerDraft) {
  const r = validateLedgerDraft(draft);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
}

async function signUpArtisan(tag: string) {
  await storage.logout().catch(() => {});
  await storage.signUp({
    email: `${tag}-${run}@example.com`,
    password: 'Str0ng-pass!',
    name: `Artisan ${tag}`,
    phone: '9876543210',
    role: 'SHOPKEEPER',
    category: 'Pichwai',
    location: { lat: 24.58, lng: 73.68 },
  });
  // storage.currentUser is populated by the auth listener in the app; tests read auth directly.
  return auth.currentUser!.uid;
}

async function stockOf(name: string) {
  const items = await storage.getInventory();
  return items.find(i => i.item === name)?.quantity;
}

beforeAll(async () => {
  setLogLevel('silent');
  await signUpArtisan('a');
});

describe('ledger + inventory transactions', () => {
  it('records a sale atomically and is idempotent for retries', async () => {
    const inv = validateInventoryDraft({ item: 'Brass Lamp', quantity: '5', unitCost: '200', isPurchased: true });
    if (!inv.ok) throw new Error('bad draft');
    await storage.addInventoryItem(inv.value);
    expect(await stockOf('Brass Lamp')).toBe(5);

    const id = storage.newEntryId();
    const sale = fields({ type: 'SALE', item: 'Brass Lamp', quantity: '2', unitPrice: '350', paymentStatus: 'PAID' });
    expect(await storage.createLedgerEntry(sale, { id })).toEqual({ created: true });
    expect(await storage.createLedgerEntry(sale, { id })).toEqual({ created: false });
    expect(await stockOf('Brass Lamp')).toBe(3);

    const entries = await storage.getLedgerRange(today, today);
    const saved = entries.filter(e => e.id === id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ amount: 700, quantity: 2, payment_status: 'PAID', category: 'BUSINESS' });
    expect(saved[0].inventory_id).toBeTruthy();
  });

  it('refuses to oversell and leaves no partial writes', async () => {
    const before = (await storage.getLedgerRange(today, today)).length;
    const id = storage.newEntryId();
    await expect(storage.createLedgerEntry(fields({ type: 'SALE', item: 'Brass Lamp', quantity: '10', unitPrice: '350', paymentStatus: 'PAID' }), { id }))
      .rejects.toBeInstanceOf(InsufficientStockError);
    await expect(storage.createLedgerEntry(fields({ type: 'SALE', item: 'Unknown Statue', quantity: '1', unitPrice: '350', paymentStatus: 'PAID' }), { id: storage.newEntryId() }))
      .rejects.toBeInstanceOf(InsufficientStockError);
    expect((await storage.getLedgerRange(today, today)).length).toBe(before);
    expect(await stockOf('Brass Lamp')).toBe(3);
  });

  it('serialises concurrent sales so stock can never go negative', async () => {
    const results = await Promise.allSettled([
      storage.createLedgerEntry(fields({ type: 'SALE', item: 'Brass Lamp', quantity: '2', unitPrice: '300', paymentStatus: 'PAID' }), { id: storage.newEntryId() }),
      storage.createLedgerEntry(fields({ type: 'SALE', item: 'Brass Lamp', quantity: '2', unitPrice: '300', paymentStatus: 'PAID' }), { id: storage.newEntryId() }),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(await stockOf('Brass Lamp')).toBe(1);
  });

  it('reconciles stock when a sale is edited or deleted', async () => {
    const id = storage.newEntryId();
    const inv = validateInventoryDraft({ item: 'Pigment Box', quantity: '10', unitCost: '50', isPurchased: true });
    if (!inv.ok) throw new Error('bad draft');
    await storage.addInventoryItem(inv.value);
    await storage.createLedgerEntry(fields({ type: 'SALE', item: 'Pigment Box', quantity: '2', unitPrice: '80', paymentStatus: 'PAID' }), { id });
    expect(await stockOf('Pigment Box')).toBe(8);

    await storage.updateLedgerEntry('ledger_entries', id, fields({ type: 'SALE', item: 'Pigment Box', quantity: '5', unitPrice: '80', paymentStatus: 'PAID' }));
    expect(await stockOf('Pigment Box')).toBe(5);
    const edited = (await storage.getLedgerRange(today, today)).find(e => e.id === id)!;
    expect(edited).toMatchObject({ quantity: 5, amount: 400 });

    await expect(storage.updateLedgerEntry('ledger_entries', id, fields({ type: 'SALE', item: 'Pigment Box', quantity: '50', unitPrice: '80', paymentStatus: 'PAID' })))
      .rejects.toBeInstanceOf(InsufficientStockError);
    expect(await stockOf('Pigment Box')).toBe(5);

    await expect(storage.updateLedgerEntry('ledger_entries', id, fields({ type: 'OTHER_EXPENSE', item: 'Pigment Box', quantity: '5', unitPrice: '80', paymentStatus: 'PAID' })))
      .rejects.toThrow(/type cannot be changed/);

    await storage.deleteLedgerEntry('ledger_entries', id, { revertStock: true });
    expect(await stockOf('Pigment Box')).toBe(10);
    expect((await storage.getLedgerRange(today, today)).some(e => e.id === id)).toBe(false);
  });

  it('adds stock for purchases, creating the SKU when new', async () => {
    await storage.createLedgerEntry(fields({ type: 'BUSINESS_EXPENSE', item: 'Gold Leaf', quantity: '20', unitPrice: '15.5', paymentStatus: 'PAID' }), { id: storage.newEntryId(), isPurchased: true });
    const item = (await storage.getInventory()).find(i => i.item === 'Gold Leaf');
    expect(item).toMatchObject({ quantity: 20, unit_cost: 15.5, is_purchased: true });
  });

  it('moves udhaar into the paid ledger exactly once on settlement', async () => {
    const id = storage.newEntryId();
    await storage.createLedgerEntry(fields({ type: 'SALE', item: 'Pigment Box', quantity: '1', unitPrice: '90', paymentStatus: 'PENDING', customerName: 'Manmohan' }), { id });
    expect((await storage.getUdhaarEntries()).map(e => e.id)).toContain(id);
    expect(await stockOf('Pigment Box')).toBe(9);

    await Promise.allSettled([storage.settleUdhaar(id), storage.settleUdhaar(id)]);
    expect((await storage.getUdhaarEntries()).map(e => e.id)).not.toContain(id);
    const settled = (await storage.getLedgerRange(today, today)).filter(e => e.id === id);
    expect(settled).toHaveLength(1);
    expect(settled[0]).toMatchObject({ payment_status: 'PAID', amount: 90, customer_name: 'Manmohan' });
    expect(await stockOf('Pigment Box')).toBe(9);
  });

  it('merges duplicate SKUs and writes idempotent daily summaries', async () => {
    const a = validateInventoryDraft({ item: 'Clay Pot', quantity: '2', unitCost: '30', isPurchased: false });
    const b = validateInventoryDraft({ item: 'Clay Pots', quantity: '3', unitCost: '30', isPurchased: false });
    if (!a.ok || !b.ok) throw new Error('bad draft');
    await storage.addInventoryItem(a.value);
    await storage.addInventoryItem(b.value);
    const pots = (await storage.getInventory()).filter(i => i.normalized_name === 'clay pot');
    expect(pots.reduce((s, i) => s + i.quantity, 0)).toBe(5);

    await storage.mergeInventory();
    const merged = (await storage.getInventory()).filter(i => i.normalized_name === 'clay pot');
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(5);

    // Summaries only run for artisans whose profile is loaded in the app.
    (storage as unknown as { currentUser: { role: string } }).currentUser = { role: 'SHOPKEEPER' };
    const tomorrow = addDays(today, 1);
    expect(await storage.closeDailySummaries(tomorrow)).toBe(1);
    expect(await storage.closeDailySummaries(tomorrow)).toBe(0);
  });
});

describe('tenant isolation through the client API', () => {
  it('a second artisan sees none of the first artisan’s data', async () => {
    await signUpArtisan('b');
    expect(await storage.getLedgerRange(addDays(today, -30), today)).toEqual([]);
    expect(await storage.getInventory()).toEqual([]);
    expect(await storage.getUdhaarEntries()).toEqual([]);
  });

  it('cannot be tricked into writing another artisan’s stock', async () => {
    await expect(storage.createLedgerEntry(fields({ type: 'SALE', item: 'Brass Lamp', quantity: '1', unitPrice: '10', paymentStatus: 'PAID' }), { id: storage.newEntryId() }))
      .rejects.toBeInstanceOf(InsufficientStockError);
  });
});
