import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-mewar-sync';
let env: RulesTestEnvironment;

const NOW = '2026-10-13T10:00:00.000Z';

const profiles = {
  artisanA: { id: 'artisanA', role: 'SHOPKEEPER', name: 'Arjun', email: 'a@example.com', phone: '9999999999', category: 'Pichwai' },
  artisanB: { id: 'artisanB', role: 'SHOPKEEPER', name: 'Bhanu', email: 'b@example.com', phone: '8888888888' },
  visitorV: { id: 'visitorV', role: 'VISITOR', name: 'Vera', email: 'v@example.com', phone: '7777777777' },
  visitorW: { id: 'visitorW', role: 'VISITOR', name: 'Wes', email: 'w@example.com', phone: '6666666666' },
  admin: { id: 'admin', role: 'ADMIN', name: 'Admin', email: 'admin@example.com' },
};

function ledgerEntry(overrides: Record<string, unknown> = {}) {
  return {
    shop_id: 'artisanA',
    type: 'SALE',
    category: 'BUSINESS',
    item: 'Brass Lamp',
    quantity: 2,
    unit_price: 250,
    amount: 500,
    payment_status: 'PAID',
    customer_name: '',
    created_at: NOW,
    normalized_name: 'brass lamp',
    ...overrides,
  };
}

function db(uid: keyof typeof profiles | null, email?: string) {
  if (!uid) return env.unauthenticatedContext().firestore();
  return env.authenticatedContext(uid, { email: email ?? profiles[uid].email }).firestore();
}

beforeAll(async () => {
  setLogLevel('silent');
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085').split(':');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'), host, port: Number(port) },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore();
    for (const [id, p] of Object.entries(profiles)) await setDoc(doc(d, 'profiles', id), p);
    await setDoc(doc(d, 'ledger_entries', 'entryA'), ledgerEntry());
    await setDoc(doc(d, 'udhaar_entries', 'udhaarA'), ledgerEntry({ payment_status: 'PENDING', customer_name: 'Manmohan' }));
    await setDoc(doc(d, 'inventory', 'invA'), { shop_id: 'artisanA', item: 'Brass Lamp', quantity: 5, unit_cost: 200, is_purchased: true, last_updated: NOW, normalized_name: 'brass lamp' });
    await setDoc(doc(d, 'products', 'prodA'), { title: 'Pichwai', description: 'x', price: 5000, style: 'Pichwai', image_url: 'https://res.cloudinary.com/demo/a.jpg', shop_id: 'artisanA', is_verified: false, reviews: [], likes: [] });
    await setDoc(doc(d, 'chat_sessions', 'sessVA'), { artisan_id: 'artisanA', visitor_id: 'visitorV', artisan_name: 'Arjun', visitor_name: 'Vera', last_timestamp: NOW, unread_count_artisan: 0, unread_count_visitor: 0 });
    await setDoc(doc(d, 'chat_messages', 'msg1'), { session_id: 'sessVA', sender_id: 'visitorV', text: 'Hello', timestamp: NOW, is_read: false });
  });
});

describe('profiles', () => {
  it('lets a new user create their own SHOPKEEPER or VISITOR profile', async () => {
    const newUser = env.authenticatedContext('newbie', { email: 'new@example.com' }).firestore();
    await assertSucceeds(setDoc(doc(newUser, 'profiles', 'newbie'), { id: 'newbie', role: 'VISITOR', name: 'New', email: 'new@example.com', phone: '1234567890' }));
  });

  it('blocks self-assigned ADMIN, foreign uids, spoofed email and extra fields', async () => {
    const newUser = env.authenticatedContext('newbie', { email: 'new@example.com' }).firestore();
    const base = { id: 'newbie', name: 'New', email: 'new@example.com', phone: '1234567890' };
    await assertFails(setDoc(doc(newUser, 'profiles', 'newbie'), { ...base, role: 'ADMIN' }));
    await assertFails(setDoc(doc(newUser, 'profiles', 'someoneElse'), { ...base, id: 'someoneElse', role: 'VISITOR' }));
    await assertFails(setDoc(doc(newUser, 'profiles', 'newbie'), { ...base, role: 'VISITOR', email: 'ceo@example.com' }));
    await assertFails(setDoc(doc(newUser, 'profiles', 'newbie'), { ...base, role: 'VISITOR', likes: ['x'] }));
    await assertFails(setDoc(doc(newUser, 'profiles', 'newbie'), { ...base, role: 'VISITOR', phone: '12345' }));
  });

  it('prevents privilege escalation through profile updates', async () => {
    await assertFails(updateDoc(doc(db('visitorV'), 'profiles', 'visitorV'), { role: 'ADMIN' }));
    await assertFails(updateDoc(doc(db('artisanA'), 'profiles', 'artisanA'), { email: 'other@example.com' }));
    await assertFails(updateDoc(doc(db('artisanA'), 'profiles', 'artisanB'), { name: 'Hacked' }));
    await assertSucceeds(updateDoc(doc(db('artisanA'), 'profiles', 'artisanA'), { name: 'Arjun Mewari', description: 'Pichwai painter' }));
    await assertFails(updateDoc(doc(db('artisanA'), 'profiles', 'artisanA'), { profile_picture: 'javascript:alert(1)' }));
  });

  it('exposes artisan profiles but keeps visitor profiles private', async () => {
    await assertSucceeds(getDoc(doc(db('visitorV'), 'profiles', 'artisanA')));
    await assertFails(getDoc(doc(db('visitorV'), 'profiles', 'visitorW')));
    await assertFails(getDoc(doc(db('artisanA'), 'profiles', 'visitorV')));
    await assertSucceeds(getDoc(doc(db('admin'), 'profiles', 'visitorV')));
    await assertSucceeds(getDocs(query(collection(db('visitorV'), 'profiles'), where('role', '==', 'SHOPKEEPER'))));
    await assertFails(getDocs(collection(db('visitorV'), 'profiles')));
    await assertFails(getDoc(doc(db(null), 'profiles', 'artisanA')));
  });

  it('allows liking an artisan only with your own uid', async () => {
    await assertSucceeds(updateDoc(doc(db('visitorV'), 'profiles', 'artisanA'), { likes: arrayUnion('visitorV') }));
    await assertFails(updateDoc(doc(db('visitorV'), 'profiles', 'artisanA'), { likes: arrayUnion('visitorW') }));
    await assertSucceeds(updateDoc(doc(db('visitorV'), 'profiles', 'artisanA'), { likes: arrayRemove('visitorV') }));
    await assertFails(updateDoc(doc(db('visitorV'), 'profiles', 'artisanA'), { likes: arrayUnion('visitorV'), name: 'x' }));
    await assertFails(updateDoc(doc(db('visitorV'), 'profiles', 'visitorW'), { likes: arrayUnion('visitorV') }));
  });
});

describe('ledger and udhaar (tenant isolation + validation)', () => {
  it('lets an artisan create and read their own entries', async () => {
    await assertSucceeds(setDoc(doc(db('artisanA'), 'ledger_entries', 'new1'), ledgerEntry()));
    await assertSucceeds(getDoc(doc(db('artisanA'), 'ledger_entries', 'entryA')));
    await assertSucceeds(getDocs(query(collection(db('artisanA'), 'ledger_entries'), where('shop_id', '==', 'artisanA'))));
  });

  it('blocks reading, listing or changing another artisan’s records (BOLA)', async () => {
    await assertFails(getDoc(doc(db('artisanB'), 'ledger_entries', 'entryA')));
    await assertFails(getDocs(query(collection(db('artisanB'), 'ledger_entries'), where('shop_id', '==', 'artisanA'))));
    await assertFails(getDocs(collection(db('artisanB'), 'ledger_entries')));
    await assertFails(updateDoc(doc(db('artisanB'), 'ledger_entries', 'entryA'), { amount: 1 }));
    await assertFails(deleteDoc(doc(db('artisanB'), 'ledger_entries', 'entryA')));
    await assertFails(getDoc(doc(db('artisanB'), 'udhaar_entries', 'udhaarA')));
    await assertFails(getDoc(doc(db(null), 'ledger_entries', 'entryA')));
  });

  it('prevents writing records into another artisan’s account (mass assignment)', async () => {
    await assertFails(setDoc(doc(db('artisanB'), 'ledger_entries', 'evil'), ledgerEntry({ shop_id: 'artisanA' })));
    await assertFails(updateDoc(doc(db('artisanA'), 'ledger_entries', 'entryA'), { shop_id: 'artisanB' }));
    await assertFails(updateDoc(doc(db('artisanA'), 'ledger_entries', 'entryA'), { type: 'OTHER_EXPENSE' }));
    await assertFails(updateDoc(doc(db('artisanA'), 'ledger_entries', 'entryA'), { created_at: '2020-01-01T00:00:00.000Z' }));
  });

  it('validates amounts, enums, categories and fields', async () => {
    const d = db('artisanA');
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n1'), ledgerEntry({ amount: -5 })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n2'), ledgerEntry({ amount: 2e9 })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n3'), ledgerEntry({ type: 'REFUND' })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n4'), ledgerEntry({ type: 'PERSONAL_PAID' })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n5'), ledgerEntry({ payment_status: 'PENDING' })));
    await assertFails(setDoc(doc(d, 'udhaar_entries', 'n6'), ledgerEntry({ payment_status: 'PAID' })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n7'), ledgerEntry({ is_admin: true })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n8'), ledgerEntry({ item: '' })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n9'), ledgerEntry({ created_at: 'yesterday' })));
    await assertFails(setDoc(doc(d, 'ledger_entries', 'n10'), ledgerEntry({ quantity: 0 })));
    await assertSucceeds(setDoc(doc(d, 'ledger_entries', 'n11'), ledgerEntry({ type: 'PERSONAL_PAID', category: 'PERSONAL', quantity: 1, unit_price: 99.5, amount: 99.5 })));
  });

  it('only lets artisans keep a ledger', async () => {
    await assertFails(setDoc(doc(db('visitorV'), 'ledger_entries', 'v1'), ledgerEntry({ shop_id: 'visitorV' })));
  });

  it('lets a client check a fresh id (idempotency) without exposing other records', async () => {
    await assertSucceeds(getDoc(doc(db('artisanA'), 'ledger_entries', 'does-not-exist')));
    await assertFails(getDoc(doc(db('artisanB'), 'ledger_entries', 'entryA')));
    await assertFails(getDoc(doc(db(null), 'ledger_entries', 'does-not-exist')));
  });

  it('allows legitimate edits of editable fields', async () => {
    await assertSucceeds(updateDoc(doc(db('artisanA'), 'ledger_entries', 'entryA'), { quantity: 3, unit_price: 250, amount: 750, updated_at: NOW }));
    await assertFails(updateDoc(doc(db('artisanA'), 'ledger_entries', 'entryA'), { quantity: 3, unit_price: 250, amount: -750 }));
  });
});

describe('inventory', () => {
  it('isolates stock between artisans and validates quantities', async () => {
    await assertFails(getDoc(doc(db('artisanB'), 'inventory', 'invA')));
    await assertFails(updateDoc(doc(db('artisanB'), 'inventory', 'invA'), { quantity: 0 }));
    await assertFails(updateDoc(doc(db('artisanA'), 'inventory', 'invA'), { quantity: -1, last_updated: NOW }));
    await assertFails(updateDoc(doc(db('artisanA'), 'inventory', 'invA'), { shop_id: 'artisanB' }));
    await assertSucceeds(updateDoc(doc(db('artisanA'), 'inventory', 'invA'), { quantity: 3, last_updated: NOW }));
    await assertFails(setDoc(doc(db('artisanA'), 'inventory', 'x'), { shop_id: 'artisanA', item: 'X', quantity: 1, unit_cost: -2, is_purchased: true, last_updated: NOW }));
  });
});

describe('products', () => {
  const product = { title: 'Lamp', description: 'Brass', price: 1200, style: 'Koftgari', image_url: 'https://res.cloudinary.com/demo/l.jpg', shop_id: 'artisanA', is_verified: false, reviews: [] };

  it('lets artisans list their own pieces but never self-verify', async () => {
    await assertSucceeds(setDoc(doc(db('artisanA'), 'products', 'p1'), product));
    await assertFails(setDoc(doc(db('artisanA'), 'products', 'p2'), { ...product, is_verified: true }));
    await assertFails(setDoc(doc(db('artisanB'), 'products', 'p3'), product));
    await assertFails(setDoc(doc(db('visitorV'), 'products', 'p4'), { ...product, shop_id: 'visitorV' }));
    await assertFails(updateDoc(doc(db('artisanA'), 'products', 'prodA'), { is_verified: true }));
    await assertFails(setDoc(doc(db('artisanA'), 'products', 'p5'), { ...product, image_url: 'http://evil.example/x.jpg' }));
  });

  it('protects products from other users except for likes', async () => {
    await assertFails(updateDoc(doc(db('artisanB'), 'products', 'prodA'), { price: 1 }));
    await assertFails(deleteDoc(doc(db('visitorV'), 'products', 'prodA')));
    await assertSucceeds(updateDoc(doc(db('visitorV'), 'products', 'prodA'), { likes: arrayUnion('visitorV') }));
    await assertFails(updateDoc(doc(db('visitorV'), 'products', 'prodA'), { likes: arrayUnion('visitorW') }));
    await assertFails(updateDoc(doc(db('visitorV'), 'products', 'prodA'), { reviews: [{ comment: 'spam' }] }));
  });

  it('lets admins verify and moderate', async () => {
    await assertSucceeds(updateDoc(doc(db('admin'), 'products', 'prodA'), { is_verified: true }));
    await assertSucceeds(deleteDoc(doc(db('admin'), 'products', 'prodA')));
  });
});

describe('messenger', () => {
  it('lets visitors start chats with real artisans using their real names', async () => {
    const base = { artisan_id: 'artisanB', visitor_id: 'visitorV', artisan_name: 'Bhanu', visitor_name: 'Vera', last_timestamp: NOW, unread_count_artisan: 0, unread_count_visitor: 0 };
    await assertSucceeds(setDoc(doc(db('visitorV'), 'chat_sessions', 's1'), base));
    await assertFails(setDoc(doc(db('visitorV'), 'chat_sessions', 's2'), { ...base, artisan_name: 'Official Support' }));
    await assertFails(setDoc(doc(db('visitorV'), 'chat_sessions', 's3'), { ...base, visitor_id: 'visitorW', visitor_name: 'Wes' }));
    await assertFails(setDoc(doc(db('visitorV'), 'chat_sessions', 's4'), { ...base, artisan_id: 'visitorW', artisan_name: 'Wes' }));
    await assertFails(setDoc(doc(db('visitorV'), 'chat_sessions', 's5'), { ...base, unread_count_artisan: 99 }));
  });

  it('keeps conversations private to their two participants', async () => {
    await assertSucceeds(getDoc(doc(db('visitorV'), 'chat_sessions', 'sessVA')));
    await assertSucceeds(getDoc(doc(db('artisanA'), 'chat_sessions', 'sessVA')));
    await assertFails(getDoc(doc(db('visitorW'), 'chat_sessions', 'sessVA')));
    await assertFails(getDoc(doc(db('artisanB'), 'chat_sessions', 'sessVA')));
    await assertSucceeds(getDocs(query(collection(db('artisanA'), 'chat_sessions'), where('artisan_id', '==', 'artisanA'))));
    await assertFails(getDocs(query(collection(db('visitorW'), 'chat_sessions'), where('artisan_id', '==', 'artisanA'))));
  });

  it('restricts message reads, sends and edits', async () => {
    await assertSucceeds(getDocs(query(collection(db('artisanA'), 'chat_messages'), where('session_id', '==', 'sessVA'))));
    await assertFails(getDocs(query(collection(db('visitorW'), 'chat_messages'), where('session_id', '==', 'sessVA'))));
    await assertFails(getDoc(doc(db('visitorW'), 'chat_messages', 'msg1')));

    await assertSucceeds(setDoc(doc(db('artisanA'), 'chat_messages', 'm2'), { session_id: 'sessVA', sender_id: 'artisanA', text: 'Namaste', timestamp: NOW, is_read: false }));
    await assertFails(setDoc(doc(db('artisanA'), 'chat_messages', 'm3'), { session_id: 'sessVA', sender_id: 'visitorV', text: 'Spoofed', timestamp: NOW, is_read: false }));
    await assertFails(setDoc(doc(db('visitorW'), 'chat_messages', 'm4'), { session_id: 'sessVA', sender_id: 'visitorW', text: 'Intrude', timestamp: NOW, is_read: false }));

    await assertFails(updateDoc(doc(db('artisanA'), 'chat_messages', 'msg1'), { text: 'Edited by someone else', is_edited: true }));
    await assertSucceeds(updateDoc(doc(db('visitorV'), 'chat_messages', 'msg1'), { text: 'Hello again', is_edited: true }));
  });

  it('lets each side mark only their own side as read', async () => {
    await assertSucceeds(updateDoc(doc(db('artisanA'), 'chat_sessions', 'sessVA'), { unread_count_artisan: 0, artisan_last_read: NOW }));
    await assertFails(updateDoc(doc(db('artisanA'), 'chat_sessions', 'sessVA'), { visitor_last_read: NOW }));
    await assertFails(updateDoc(doc(db('artisanA'), 'chat_sessions', 'sessVA'), { artisan_id: 'artisanB' }));
  });
});

describe('other collections', () => {
  it('summaries use deterministic ids and stay private', async () => {
    const summary = { shop_id: 'artisanA', date: '2026-10-12', total_sales: 500, total_expenses: 100, net_profit: 400, closing_time: NOW };
    await assertSucceeds(setDoc(doc(db('artisanA'), 'summaries', 'artisanA_2026-10-12'), summary));
    await assertFails(setDoc(doc(db('artisanA'), 'summaries', 'random-id'), summary));
    await assertFails(getDoc(doc(db('artisanB'), 'summaries', 'artisanA_2026-10-12')));
  });

  it('place photos are curated by admins only', async () => {
    const photo = { place_id: 'h1', image_url: 'https://res.cloudinary.com/demo/p.jpg', uploaded_at: NOW };
    await assertFails(setDoc(doc(db('visitorV'), 'place_photos', 'p1'), { ...photo, user_id: 'visitorV' }));
    await assertSucceeds(setDoc(doc(db('admin'), 'place_photos', 'p2'), { ...photo, user_id: 'admin' }));
    await assertFails(deleteDoc(doc(db('visitorV'), 'place_photos', 'p2')));
    await assertSucceeds(getDocs(query(collection(db('visitorV'), 'place_photos'), where('place_id', '==', 'h1'))));
  });

  it('AI logs are append-only and private', async () => {
    const log = { user_id: 'artisanA', interaction_type: 'VOICE_LEDGER', input_context: 'sold 2 lamps', output_result: { action: 'transaction' }, timestamp: NOW };
    await assertSucceeds(setDoc(doc(db('artisanA'), 'ai_logs', 'l1'), log));
    await assertFails(setDoc(doc(db('artisanB'), 'ai_logs', 'l2'), log));
    await assertFails(getDoc(doc(db('artisanB'), 'ai_logs', 'l1')));
    await assertFails(updateDoc(doc(db('artisanA'), 'ai_logs', 'l1'), { input_context: 'changed' }));
  });

  it('denies unknown collections by default', async () => {
    await assertFails(setDoc(doc(db('admin'), 'secrets', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(db('admin'), 'secrets', 'x')));
  });
});
