import type {
  ArtisanPost,
  ArtisanProduct,
  ChatMessage,
  ChatSession,
  EntryType,
  InventoryItem,
  LedgerEntry,
  PlacePhoto,
  UserProfile,
  UserRole,
} from '../types';
import { auth, db } from './firebase';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { categoryForType, stockEffect, summarizeBusiness, type ValidLedgerFields } from '../lib/ledger';
import { findDuplicateGroups, findInventoryMatches, normalizeItemName, pickSaleSource, type ValidInventoryFields } from '../lib/inventory';
import { addDays, endOfDateKey, localDateKey, startOfDateKey } from '../lib/dates';
import { MAX_AMOUNT, MAX_QUANTITY, roundMoney } from '../lib/money';
import { validateImageFile } from '../lib/image';

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/** An error whose message is safe and useful to show to the user. */
export class UserFacingError extends Error {}

export class InsufficientStockError extends UserFacingError {
  readonly available: number;
  readonly requested: number;
  constructor(item: string, available: number, requested: number) {
    super(available > 0
      ? `Only ${available} of “${item}” in stock — cannot record ${requested}.`
      : `“${item}” is not in stock. Add it to inventory (or record the stock purchase) first.`);
    this.available = available;
    this.requested = requested;
  }
}

function friendlyError(err: unknown, fallback: string): Error {
  if (err instanceof UserFacingError) return err;
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return new UserFacingError('Incorrect email or password.');
    case 'auth/email-already-in-use':
      return new UserFacingError('An account with this email already exists. Try signing in instead.');
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return new UserFacingError('Choose a stronger password (at least 8 characters, mixing letters and numbers).');
    case 'auth/too-many-requests':
      return new UserFacingError('Too many attempts. Please wait a few minutes and try again.');
    case 'auth/user-disabled':
      return new UserFacingError('This account has been disabled. Please contact support.');
    case 'auth/network-request-failed':
    case 'unavailable':
      return new UserFacingError('You appear to be offline. Check your connection and try again.');
    case 'permission-denied':
      return new UserFacingError('You do not have permission to do that.');
    case 'aborted':
      return new UserFacingError('This record was changed at the same time elsewhere. Please try again.');
    case 'not-found':
      return new UserFacingError('This record no longer exists. Refresh and try again.');
    case 'deadline-exceeded':
      return new UserFacingError('The request timed out. Please try again.');
    default:
      if (import.meta.env.DEV) console.error(err);
      return new UserFacingError(fallback);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function nowIso() {
  return new Date().toISOString();
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Firestore rejects `undefined`; drop such keys. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new UserFacingError('Your session has expired. Please sign in again.');
  return uid;
}

function asLedgerEntry(id: string, data: Record<string, unknown>): LedgerEntry {
  const type = data.type as EntryType;
  return {
    ...(data as unknown as LedgerEntry),
    id,
    // Legacy voice entries could carry a category that contradicts the type.
    category: categoryForType(type),
    quantity: Number(data.quantity) || 1,
    unit_price: Number(data.unit_price) || 0,
    amount: Number(data.amount) || 0,
    item: String(data.item ?? ''),
    payment_status: data.payment_status === 'PENDING' ? 'PENDING' : 'PAID',
  };
}

function asInventoryItem(id: string, data: Record<string, unknown>): InventoryItem {
  return {
    ...(data as unknown as InventoryItem),
    id,
    item: String(data.item ?? ''),
    quantity: Number(data.quantity) || 0,
    unit_cost: Number(data.unit_cost) || 0,
    is_purchased: data.is_purchased === true,
  };
}

/** Normalises a (possibly legacy) entry so it satisfies today's validation rules. */
function normaliseEntryForWrite(e: LedgerEntry, uid: string, status: 'PAID' | 'PENDING', createdAt: string) {
  const item = (e.item || 'Entry').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Entry';
  return clean({
    shop_id: uid,
    type: e.type,
    category: categoryForType(e.type),
    item,
    normalized_name: normalizeItemName(item),
    quantity: Math.min(Math.max(1, Math.round(e.quantity || 1)), MAX_QUANTITY),
    unit_price: Math.min(Math.max(0, roundMoney(e.unit_price || 0)), MAX_AMOUNT),
    amount: Math.min(Math.max(0, roundMoney(e.amount || 0)), MAX_AMOUNT),
    payment_status: status,
    customer_name: (e.customer_name || '').slice(0, 80),
    inventory_id: e.inventory_id && e.inventory_id.length <= 128 ? e.inventory_id : undefined,
    created_at: createdAt,
  });
}

export type LedgerCollection = 'ledger_entries' | 'udhaar_entries';

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'signed_out'; user: null }
  | { status: 'profile_missing'; user: null }
  | { status: 'signed_in'; user: UserProfile };

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'SHOPKEEPER' | 'VISITOR';
  category?: string;
  location?: { lat: number; lng: number };
}

const EDITABLE_PROFILE_FIELDS = ['name', 'phone', 'category', 'shopAddress', 'description', 'preferredLanguage', 'location', 'profile_picture', 'thumbnail'] as const;
type EditableProfile = Partial<Pick<UserProfile, (typeof EDITABLE_PROFILE_FIELDS)[number]>>;

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Service                                                             */
/* ------------------------------------------------------------------ */

class FirebaseStorageService {
  private currentUser: UserProfile | null = null;
  private signupInProgress = false;

  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  /* ----------------------------- Auth ----------------------------- */

  /**
   * Subscribes to auth + profile state. The profile document is watched live
   * so settings changes (e.g. language) apply without a reload.
   */
  onAuthChange(callback: (state: AuthState) => void): Unsubscribe {
    let profileUnsub: Unsubscribe | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const authUnsub = onAuthStateChanged(auth, fbUser => {
      if (retryTimer) clearTimeout(retryTimer);
      profileUnsub?.();
      profileUnsub = null;
      if (!fbUser) {
        this.currentUser = null;
        callback({ status: 'signed_out', user: null });
        return;
      }
      callback({ status: 'loading', user: null });
      const uid = fbUser.uid;
      // Right after sign-up/sign-in Firestore may briefly reject the listener
      // before the new token propagates; an errored listener stops, so retry.
      const subscribe = (attempt: number) => {
        profileUnsub = onSnapshot(
          doc(db, 'profiles', uid),
          { includeMetadataChanges: true },
          snap => {
            // During sign-up, wait until the profile is confirmed by the server
            // (not just cached locally) so a reload cannot lose it.
            if (this.signupInProgress && (snap.metadata.hasPendingWrites || !snap.exists())) return;
            if (snap.exists()) {
              this.currentUser = { ...(snap.data() as UserProfile), id: uid };
              callback({ status: 'signed_in', user: this.currentUser });
            } else if (!this.signupInProgress) {
              this.currentUser = null;
              callback({ status: 'profile_missing', user: null });
            }
          },
          () => {
            if (auth.currentUser?.uid !== uid) return;
            if (attempt < 4) {
              retryTimer = setTimeout(() => subscribe(attempt + 1), 400 * 2 ** attempt);
              return;
            }
            this.currentUser = null;
            callback({ status: 'profile_missing', user: null });
          }
        );
      };
      subscribe(0);
    });
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      profileUnsub?.();
      authUnsub();
    };
  }

  async signUp(input: SignUpInput): Promise<void> {
    this.signupInProgress = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      try {
        const profile = clean({
          id: cred.user.uid,
          role: input.role,
          name: input.name.replace(/\s+/g, ' ').trim().slice(0, 80),
          email: cred.user.email ?? input.email.trim().toLowerCase(),
          phone: input.phone,
          category: input.role === 'SHOPKEEPER' ? (input.category || 'Paintings').slice(0, 60) : undefined,
          preferredLanguage: 'English',
          location: input.location,
        });
        await setDoc(doc(db, 'profiles', cred.user.uid), profile);
      } catch (err) {
        // Roll back the auth account so the email is not left without a profile.
        await cred.user.delete().catch(() => signOut(auth));
        throw err;
      }
    } catch (err) {
      throw friendlyError(err, 'Registration failed. Please try again.');
    } finally {
      this.signupInProgress = false;
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      throw friendlyError(err, 'Sign-in failed. Please try again.');
    }
  }

  /** Always resolves the same way so it cannot be used to discover accounts. */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/network-request-failed' || code === 'auth/too-many-requests') throw friendlyError(err, '');
    }
  }

  async logout(): Promise<void> {
    await signOut(auth);
    this.currentUser = null;
  }

  async updateProfile(updates: EditableProfile): Promise<void> {
    const uid = requireUid();
    const payload: DocumentData = {};
    for (const key of EDITABLE_PROFILE_FIELDS) {
      if (updates[key] !== undefined) payload[key] = updates[key];
    }
    try {
      await updateDoc(doc(db, 'profiles', uid), payload);
    } catch (err) {
      throw friendlyError(err, 'Could not save your profile. Please try again.');
    }
  }

  async getProfile(id: string): Promise<UserProfile | null> {
    try {
      const snap = await getDoc(doc(db, 'profiles', id));
      return snap.exists() ? { ...(snap.data() as UserProfile), id } : null;
    } catch {
      return null;
    }
  }

  /** Public artisan listings. Visitor profiles are private by rule. */
  async getArtisans(): Promise<UserProfile[]> {
    const snap = await getDocs(query(collection(db, 'profiles'), where('role', '==', 'SHOPKEEPER')));
    return snap.docs.map(d => ({ ...(d.data() as UserProfile), id: d.id }));
  }

  async toggleArtisanLike(artisanId: string, like: boolean): Promise<void> {
    const uid = requireUid();
    try {
      await updateDoc(doc(db, 'profiles', artisanId), { likes: like ? arrayUnion(uid) : arrayRemove(uid) });
    } catch (err) {
      throw friendlyError(err, 'Could not update your like.');
    }
  }

  /* ---------------------------- Uploads --------------------------- */

  /** Uploads an image to Cloudinary (image-only endpoint) and returns its https URL. */
  async uploadImage(file: Blob): Promise<string> {
    if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) throw new UserFacingError('Photo uploads are not configured.');
    validateImageFile(file);
    if (file.size > MAX_UPLOAD_BYTES) throw new UserFacingError('Image must be smaller than 5 MB.');
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', CLOUDINARY_PRESET);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(CLOUDINARY_CLOUD)}/image/upload`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { secure_url?: string };
      const url = data.secure_url;
      if (!res.ok || !url || !/^https:\/\/res\.cloudinary\.com\//.test(url)) {
        throw new UserFacingError('The photo could not be uploaded. Please try again.');
      }
      return url;
    } catch (err) {
      if (err instanceof UserFacingError) throw err;
      throw new UserFacingError(controller.signal.aborted ? 'The upload timed out. Please try again.' : 'The photo could not be uploaded. Check your connection.');
    } finally {
      clearTimeout(timer);
    }
  }

  /* ----------------------------- Ledger --------------------------- */

  private async queryEntries(col: LedgerCollection, uid: string, startIso?: string, endIso?: string): Promise<LedgerEntry[]> {
    const base = collection(db, col);
    if (startIso && endIso) {
      try {
        const snap = await getDocs(query(base, where('shop_id', '==', uid), where('created_at', '>=', startIso), where('created_at', '<', endIso)));
        return snap.docs.map(d => asLedgerEntry(d.id, d.data()));
      } catch (err) {
        // Composite index not yet deployed: fall back to a full scan.
        if ((err as { code?: string })?.code !== 'failed-precondition') throw err;
      }
    }
    const snap = await getDocs(query(base, where('shop_id', '==', uid)));
    const all = snap.docs.map(d => asLedgerEntry(d.id, d.data()));
    if (!startIso || !endIso) return all;
    return all.filter(e => e.created_at >= startIso && e.created_at < endIso);
  }

  /** Paid ledger entries (both business and personal) between two local dates, inclusive. */
  async getLedgerRange(startKey: string, endKey: string): Promise<LedgerEntry[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const [from, to] = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];
    try {
      const entries = await this.queryEntries('ledger_entries', uid, startOfDateKey(from).toISOString(), endOfDateKey(to).toISOString());
      return entries.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    } catch (err) {
      throw friendlyError(err, 'Could not load the ledger.');
    }
  }

  async getAllLedger(): Promise<LedgerEntry[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
      const entries = await this.queryEntries('ledger_entries', uid);
      return entries.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    } catch (err) {
      throw friendlyError(err, 'Could not load the ledger.');
    }
  }

  async getUdhaarEntries(): Promise<LedgerEntry[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
      const snap = await getDocs(query(collection(db, 'udhaar_entries'), where('shop_id', '==', uid), where('payment_status', '==', 'PENDING')));
      return snap.docs.map(d => asLedgerEntry(d.id, d.data())).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    } catch (err) {
      throw friendlyError(err, 'Could not load udhaar entries.');
    }
  }

  /** Allocates the id used for an idempotent create (keep it across retries). */
  newEntryId(): string {
    return newId();
  }

  /**
   * Records a ledger (PAID) or udhaar (PENDING) entry and its stock movement
   * in a single transaction. Re-submitting with the same `id` is a no-op, so
   * double taps and network retries cannot create duplicates.
   */
  async createLedgerEntry(fields: ValidLedgerFields, opts: { id: string; isPurchased?: boolean }): Promise<{ created: boolean }> {
    const uid = requireUid();
    const col: LedgerCollection = fields.payment_status === 'PENDING' ? 'udhaar_entries' : 'ledger_entries';
    const entryRef = doc(db, col, opts.id);

    try {
      let invRef: DocumentReference | null = null;
      let newInvRef: DocumentReference | null = null;
      if (fields.type === 'SALE' || fields.type === 'BUSINESS_EXPENSE') {
        const items = await this.getInventory();
        if (fields.type === 'SALE') {
          const source = pickSaleSource(items, fields.item, fields.inventory_id);
          if (!source) throw new InsufficientStockError(fields.item, 0, fields.quantity);
          invRef = doc(db, 'inventory', source.id);
        } else {
          const isPurchased = opts.isPurchased ?? true;
          const chosen = fields.inventory_id ? items.find(i => i.id === fields.inventory_id) : undefined;
          const match = chosen ?? findInventoryMatches(items, fields.item, { isPurchased, unitCost: fields.unit_price })[0];
          if (match) invRef = doc(db, 'inventory', match.id);
          else newInvRef = doc(collection(db, 'inventory'));
        }
      }

      return await runTransaction(db, async tx => {
        const existing = await tx.get(entryRef);
        if (existing.exists()) return { created: false };

        const timestamp = nowIso();
        let inventoryId: string | undefined;
        if (invRef) {
          const invSnap = await tx.get(invRef);
          if (!invSnap.exists()) throw new UserFacingError('The selected stock item no longer exists. Refresh and try again.');
          const current = Number(invSnap.data().quantity) || 0;
          const next = current + stockEffect(fields);
          if (next < 0) throw new InsufficientStockError(String(invSnap.data().item || fields.item), current, fields.quantity);
          tx.update(invRef, { quantity: next, last_updated: timestamp });
          inventoryId = invRef.id;
        } else if (newInvRef) {
          tx.set(newInvRef, {
            shop_id: uid,
            item: fields.item,
            normalized_name: fields.normalized_name,
            quantity: fields.quantity,
            unit_cost: fields.unit_price,
            is_purchased: opts.isPurchased ?? true,
            last_updated: timestamp,
          });
          inventoryId = newInvRef.id;
        }

        tx.set(entryRef, clean({
          shop_id: uid,
          type: fields.type,
          category: fields.category,
          item: fields.item,
          normalized_name: fields.normalized_name,
          quantity: fields.quantity,
          unit_price: fields.unit_price,
          amount: fields.amount,
          payment_status: fields.payment_status,
          customer_name: fields.customer_name,
          inventory_id: inventoryId,
          created_at: timestamp,
        }));
        return { created: true };
      });
    } catch (err) {
      throw friendlyError(err, 'Could not save the entry. Nothing was recorded — please try again.');
    }
  }

  /**
   * Edits an entry and reconciles stock: the old movement is reversed and the
   * new one applied, atomically, refusing changes that would make stock negative.
   */
  async updateLedgerEntry(col: LedgerCollection, id: string, fields: ValidLedgerFields): Promise<void> {
    requireUid();
    const entryRef = doc(db, col, id);
    try {
      const items = await this.getInventory();
      const before = await getDoc(entryRef);
      if (!before.exists()) throw new UserFacingError('This entry no longer exists.');
      const old = asLedgerEntry(before.id, before.data());
      if (old.type !== fields.type) throw new UserFacingError('The entry type cannot be changed. Delete it and record a new one instead.');

      const affectsStock = fields.type === 'SALE' || fields.type === 'BUSINESS_EXPENSE';
      const oldTarget = affectsStock
        ? (old.inventory_id && items.find(i => i.id === old.inventory_id)) || pickSaleSource(items, old.item, null)
        : null;
      const sameItem = normalizeItemName(old.item) === fields.normalized_name;
      let newTarget = null as InventoryItem | null;
      if (affectsStock) {
        newTarget = sameItem ? oldTarget : pickSaleSource(items, fields.item, fields.inventory_id);
        // A legacy entry whose stock item no longer exists can still have its
        // price or customer corrected, as long as no stock would move.
        const stockWouldMove = !sameItem || old.quantity !== fields.quantity;
        if (!newTarget && stockWouldMove && fields.type === 'SALE') throw new InsufficientStockError(fields.item, 0, fields.quantity);
        if (!newTarget && stockWouldMove && fields.type === 'BUSINESS_EXPENSE') {
          throw new UserFacingError(`“${fields.item}” is not in inventory. Add it in Inventory first, then edit this entry.`);
        }
      }

      await runTransaction(db, async tx => {
        const snap = await tx.get(entryRef);
        if (!snap.exists()) throw new UserFacingError('This entry no longer exists.');
        const current = asLedgerEntry(snap.id, snap.data());

        const oldRef = oldTarget ? doc(db, 'inventory', oldTarget.id) : null;
        const newRef = newTarget ? doc(db, 'inventory', newTarget.id) : null;
        const oldInv = oldRef ? await tx.get(oldRef) : null;
        const newInv = newRef && newRef.path !== oldRef?.path ? await tx.get(newRef) : oldInv;
        const timestamp = nowIso();

        if (affectsStock && newRef && newInv?.exists()) {
          if (oldRef && oldInv?.exists() && oldRef.path === newRef.path) {
            const qty = Number(oldInv.data().quantity) || 0;
            const next = qty - stockEffect(current) + stockEffect(fields);
            if (next < 0) throw new InsufficientStockError(fields.item, qty - stockEffect(current), fields.quantity);
            tx.update(newRef, { quantity: next, last_updated: timestamp });
          } else {
            if (oldRef && oldInv?.exists()) {
              const qty = Number(oldInv.data().quantity) || 0;
              const reverted = qty - stockEffect(current);
              if (reverted < 0) throw new UserFacingError(`Some of “${current.item}” has already been sold, so this purchase cannot be moved.`);
              tx.update(oldRef, { quantity: reverted, last_updated: timestamp });
            }
            const qty = Number(newInv.data().quantity) || 0;
            const next = qty + stockEffect(fields);
            if (next < 0) throw new InsufficientStockError(fields.item, qty, fields.quantity);
            tx.update(newRef, { quantity: next, last_updated: timestamp });
          }
        }

        tx.update(entryRef, clean({
          category: fields.category,
          item: fields.item,
          normalized_name: fields.normalized_name,
          quantity: fields.quantity,
          unit_price: fields.unit_price,
          amount: fields.amount,
          customer_name: fields.customer_name,
          inventory_id: newRef?.id,
          updated_at: timestamp,
        }));
      });
    } catch (err) {
      throw friendlyError(err, 'Could not update the entry. No changes were saved.');
    }
  }

  /**
   * Deletes an entry. With `revertStock`, the stock movement it caused is
   * undone in the same transaction (a deleted sale puts items back).
   */
  async deleteLedgerEntry(col: LedgerCollection, id: string, opts: { revertStock: boolean }): Promise<void> {
    requireUid();
    const entryRef = doc(db, col, id);
    try {
      const items = opts.revertStock ? await this.getInventory() : [];
      await runTransaction(db, async tx => {
        const snap = await tx.get(entryRef);
        if (!snap.exists()) return;
        const entry = asLedgerEntry(snap.id, snap.data());
        const effect = stockEffect(entry);
        if (opts.revertStock && effect !== 0) {
          const target = (entry.inventory_id && items.find(i => i.id === entry.inventory_id)) || pickSaleSource(items, entry.item, null);
          if (target) {
            const ref = doc(db, 'inventory', target.id);
            const inv = await tx.get(ref);
            if (inv.exists()) {
              const qty = Number(inv.data().quantity) || 0;
              const next = qty - effect;
              if (next < 0) {
                throw new UserFacingError(`Only ${qty} of “${entry.item}” remain in stock, so this purchase cannot be fully reversed. Delete it without adjusting stock, or correct inventory first.`);
              }
              tx.update(ref, { quantity: next, last_updated: nowIso() });
            }
          }
        }
        tx.delete(entryRef);
      });
    } catch (err) {
      throw friendlyError(err, 'Could not delete the entry.');
    }
  }

  /**
   * Settles an udhaar entry: it moves into the paid ledger, dated today.
   * Uses the same document id in both collections so a retry cannot settle
   * it twice.
   */
  async settleUdhaar(id: string): Promise<void> {
    const uid = requireUid();
    const udhaarRef = doc(db, 'udhaar_entries', id);
    const ledgerRef = doc(db, 'ledger_entries', id);
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(udhaarRef);
        const already = await tx.get(ledgerRef);
        if (!snap.exists()) return;
        if (!already.exists()) {
          const entry = asLedgerEntry(snap.id, snap.data());
          tx.set(ledgerRef, normaliseEntryForWrite(entry, uid, 'PAID', nowIso()));
        }
        tx.delete(udhaarRef);
      });
    } catch (err) {
      throw friendlyError(err, 'Could not settle this entry. Please try again.');
    }
  }

  /* ---------------------------- Inventory ------------------------- */

  async getInventory(): Promise<InventoryItem[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
      const snap = await getDocs(query(collection(db, 'inventory'), where('shop_id', '==', uid)));
      return snap.docs.map(d => asInventoryItem(d.id, d.data())).sort((a, b) => a.item.localeCompare(b.item));
    } catch (err) {
      throw friendlyError(err, 'Could not load inventory.');
    }
  }

  /** Adds stock: merges into an identical SKU (same name, source and cost) or creates one. */
  async addInventoryItem(fields: ValidInventoryFields): Promise<void> {
    const uid = requireUid();
    try {
      const items = await this.getInventory();
      const match = findInventoryMatches(items, fields.item, { isPurchased: fields.is_purchased, unitCost: fields.unit_cost })[0];
      if (match) {
        const ref = doc(db, 'inventory', match.id);
        await runTransaction(db, async tx => {
          const snap = await tx.get(ref);
          if (!snap.exists()) throw new UserFacingError('This stock item was removed. Refresh and try again.');
          const qty = Number(snap.data().quantity) || 0;
          if (qty + fields.quantity > MAX_QUANTITY) throw new UserFacingError('Stock quantity would exceed the maximum allowed.');
          tx.update(ref, { quantity: qty + fields.quantity, last_updated: nowIso() });
        });
      } else {
        await setDoc(doc(collection(db, 'inventory')), { shop_id: uid, ...fields, last_updated: nowIso() });
      }
    } catch (err) {
      throw friendlyError(err, 'Could not add the stock item.');
    }
  }

  async updateInventoryItem(id: string, fields: ValidInventoryFields): Promise<void> {
    requireUid();
    try {
      await updateDoc(doc(db, 'inventory', id), { ...fields, last_updated: nowIso() });
    } catch (err) {
      throw friendlyError(err, 'Could not update the stock item.');
    }
  }

  /** Removes a SKU. Ledger history is kept; it references the item by name. */
  async deleteInventoryItem(id: string): Promise<void> {
    requireUid();
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (err) {
      throw friendlyError(err, 'Could not remove the stock item.');
    }
  }

  /** Merges duplicate SKUs atomically (per group). Returns the number of records merged away. */
  async mergeInventory(): Promise<number> {
    requireUid();
    try {
      const groups = findDuplicateGroups(await this.getInventory());
      let merged = 0;
      for (const group of groups) {
        const [base, ...rest] = group;
        const refs = group.map(i => doc(db, 'inventory', i.id));
        await runTransaction(db, async tx => {
          const snaps = await Promise.all(refs.map(r => tx.get(r)));
          const total = snaps.reduce((sum, s) => sum + (s.exists() ? Number(s.data().quantity) || 0 : 0), 0);
          tx.update(refs[0], { quantity: Math.min(total, MAX_QUANTITY), normalized_name: normalizeItemName(base.item), last_updated: nowIso() });
          for (let i = 1; i < refs.length; i++) if (snaps[i].exists()) tx.delete(refs[i]);
        });
        merged += rest.length;
      }
      return merged;
    } catch (err) {
      throw friendlyError(err, 'Could not merge duplicate items.');
    }
  }

  /* ---------------------------- Products -------------------------- */

  async getProducts(): Promise<ArtisanProduct[]> {
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map(d => ({ ...(d.data() as ArtisanProduct), id: d.id, reviews: (d.data().reviews as ArtisanProduct['reviews']) || [] }));
  }

  async getProductsByShop(shopId: string): Promise<ArtisanProduct[]> {
    const snap = await getDocs(query(collection(db, 'products'), where('shop_id', '==', shopId)));
    return snap.docs.map(d => ({ ...(d.data() as ArtisanProduct), id: d.id, reviews: (d.data().reviews as ArtisanProduct['reviews']) || [] }));
  }

  async createProduct(p: { title: string; description: string; price: number; style: string; image_url: string }): Promise<void> {
    const uid = requireUid();
    try {
      await setDoc(doc(collection(db, 'products')), {
        title: p.title,
        description: p.description,
        price: p.price,
        style: p.style,
        image_url: p.image_url,
        shop_id: uid,
        is_verified: false,
        reviews: [],
        likes: [],
      });
    } catch (err) {
      throw friendlyError(err, 'Could not publish this piece.');
    }
  }

  async updateProduct(id: string, p: { title: string; description: string; price: number; style: string }): Promise<void> {
    requireUid();
    try {
      await updateDoc(doc(db, 'products', id), { title: p.title, description: p.description, price: p.price, style: p.style });
    } catch (err) {
      throw friendlyError(err, 'Could not save changes to this piece.');
    }
  }

  async deleteProduct(id: string): Promise<void> {
    requireUid();
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      throw friendlyError(err, 'Could not remove this piece.');
    }
  }

  async toggleProductLike(productId: string, like: boolean): Promise<void> {
    const uid = requireUid();
    try {
      await updateDoc(doc(db, 'products', productId), { likes: like ? arrayUnion(uid) : arrayRemove(uid) });
    } catch (err) {
      throw friendlyError(err, 'Could not update your like.');
    }
  }

  /* ------------------------ Places & posts ------------------------ */

  async getArtisanPosts(): Promise<ArtisanPost[]> {
    const snap = await getDocs(collection(db, 'artisan_posts'));
    return snap.docs.map(d => ({ ...(d.data() as ArtisanPost), id: d.id }));
  }

  async getPlacePhotos(placeId: string): Promise<PlacePhoto[]> {
    const snap = await getDocs(query(collection(db, 'place_photos'), where('place_id', '==', placeId)));
    return snap.docs
      .map(d => ({ ...(d.data() as PlacePhoto), id: d.id }))
      .sort((a, b) => Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at));
  }

  async addPlacePhoto(placeId: string, imageUrl: string): Promise<void> {
    const uid = requireUid();
    const existing = await this.getPlacePhotos(placeId);
    if (existing.length >= 10) throw new UserFacingError('This site already has the maximum of 10 photos.');
    try {
      await setDoc(doc(collection(db, 'place_photos')), { place_id: placeId, image_url: imageUrl, uploaded_at: nowIso(), user_id: uid });
    } catch (err) {
      throw friendlyError(err, 'Could not save the photo.');
    }
  }

  async deletePlacePhoto(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'place_photos', id));
    } catch (err) {
      throw friendlyError(err, 'Could not delete the photo.');
    }
  }

  /* --------------------------- Audit log -------------------------- */

  /** Best-effort, append-only audit of AI suggestions. Never blocks the user. */
  async logAIInteraction(type: 'VOICE_LEDGER' | 'SCANNER_PRODUCT', input: string, result: Record<string, unknown>): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await setDoc(doc(collection(db, 'ai_logs')), {
        user_id: uid,
        interaction_type: type,
        input_context: input.slice(0, 600),
        output_result: JSON.parse(JSON.stringify(result ?? {})),
        timestamp: nowIso(),
      });
    } catch {
      /* audit logging must never break the main flow */
    }
  }

  /* ------------------------ Daily summaries ----------------------- */

  /**
   * Writes daily closing summaries (sales/expenses/net) for the last 7 days
   * that are not yet closed. Document ids are `${uid}_${date}`, so running
   * this from several tabs or devices cannot create duplicates.
   */
  async closeDailySummaries(today: string = localDateKey()): Promise<number> {
    const uid = auth.currentUser?.uid;
    if (!uid || this.currentUser?.role !== 'SHOPKEEPER') return 0;
    const from = addDays(today, -7);
    const yesterday = addDays(today, -1);
    const entries = await this.getLedgerRange(from, yesterday);
    let written = 0;
    for (let key = from; key <= yesterday; key = addDays(key, 1)) {
      const day = entries.filter(e => localDateKey(e.created_at) === key && e.category === 'BUSINESS');
      if (day.length === 0) continue;
      const ref = doc(db, 'summaries', `${uid}_${key}`);
      const existing = await getDoc(ref);
      if (existing.exists()) continue;
      const s = summarizeBusiness(day);
      await setDoc(ref, {
        shop_id: uid,
        date: key,
        total_sales: s.sales,
        total_expenses: roundMoney(s.stockExpenses + s.otherExpenses),
        net_profit: s.net,
        closing_time: nowIso(),
      });
      written++;
    }
    return written;
  }

  /* ---------------------------- Messenger ------------------------- */

  onChatSessions(userId: string, role: UserRole, callback: (sessions: ChatSession[]) => void, onError?: (err: Error) => void): Unsubscribe {
    const field = role === 'SHOPKEEPER' ? 'artisan_id' : 'visitor_id';
    return onSnapshot(
      query(collection(db, 'chat_sessions'), where(field, '==', userId)),
      snap => {
        const sessions = snap.docs.map(d => ({ ...(d.data() as ChatSession), id: d.id }));
        callback(sessions.sort((a, b) => Date.parse(b.last_timestamp) - Date.parse(a.last_timestamp)));
      },
      err => onError?.(friendlyError(err, 'Could not load conversations.'))
    );
  }

  onChatMessages(sessionId: string, callback: (messages: ChatMessage[]) => void, onError?: (err: Error) => void): Unsubscribe {
    return onSnapshot(
      query(collection(db, 'chat_messages'), where('session_id', '==', sessionId)),
      snap => {
        const messages = snap.docs.map(d => ({ ...(d.data() as ChatMessage), id: d.id }));
        callback(messages.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)));
      },
      err => onError?.(friendlyError(err, 'Could not load messages.'))
    );
  }

  /** Finds the visitor↔artisan conversation or starts one (visitors only). */
  async findOrCreateChatSession(artisan: UserProfile, visitor: UserProfile, productId?: string): Promise<ChatSession> {
    try {
      const existing = await getDocs(query(collection(db, 'chat_sessions'), where('visitor_id', '==', visitor.id), where('artisan_id', '==', artisan.id)));
      if (!existing.empty) {
        const d = existing.docs[0];
        return { ...(d.data() as ChatSession), id: d.id };
      }
      const ref = doc(db, 'chat_sessions', `${artisan.id}__${visitor.id}`);
      const session = clean({
        artisan_id: artisan.id,
        visitor_id: visitor.id,
        artisan_name: artisan.name,
        visitor_name: visitor.name,
        last_timestamp: nowIso(),
        unread_count_artisan: 0,
        unread_count_visitor: 0,
        product_id: productId,
      });
      await setDoc(ref, session);
      return { ...(session as unknown as ChatSession), id: ref.id };
    } catch (err) {
      throw friendlyError(err, 'Could not start the conversation.');
    }
  }

  async sendMessage(session: ChatSession, text: string): Promise<void> {
    const uid = requireUid();
    const body = text.replace(/\r\n/g, '\n').trim().slice(0, 2000);
    if (!body) return;
    const timestamp = nowIso();
    const isArtisan = session.artisan_id === uid;
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'chat_messages')), { session_id: session.id, sender_id: uid, text: body, timestamp, is_read: false });
      batch.update(doc(db, 'chat_sessions', session.id), {
        last_message: body.slice(0, 200),
        last_timestamp: timestamp,
        [isArtisan ? 'unread_count_visitor' : 'unread_count_artisan']: increment(1),
      });
      await batch.commit();
    } catch (err) {
      throw friendlyError(err, 'Message not sent. Please try again.');
    }
  }

  async editMessage(messageId: string, text: string): Promise<void> {
    const body = text.trim().slice(0, 2000);
    if (!body) throw new UserFacingError('A message cannot be empty.');
    try {
      await updateDoc(doc(db, 'chat_messages', messageId), { text: body, is_edited: true });
    } catch (err) {
      throw friendlyError(err, 'Could not edit the message.');
    }
  }

  async markChatAsRead(session: ChatSession, role: UserRole): Promise<void> {
    const isArtisan = role === 'SHOPKEEPER';
    const unread = isArtisan ? session.unread_count_artisan : session.unread_count_visitor;
    const lastRead = isArtisan ? session.artisan_last_read : session.visitor_last_read;
    if (!unread && lastRead && lastRead >= session.last_timestamp) return;
    try {
      await updateDoc(doc(db, 'chat_sessions', session.id), isArtisan
        ? { unread_count_artisan: 0, artisan_last_read: nowIso() }
        : { unread_count_visitor: 0, visitor_last_read: nowIso() });
    } catch {
      /* read receipts are best-effort */
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      const msgs = await getDocs(query(collection(db, 'chat_messages'), where('session_id', '==', sessionId)));
      for (let i = 0; i < msgs.docs.length; i += 400) {
        const batch = writeBatch(db);
        msgs.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'chat_sessions', sessionId));
    } catch (err) {
      throw friendlyError(err, 'Could not delete the conversation.');
    }
  }
}

export const storage = new FirebaseStorageService();
