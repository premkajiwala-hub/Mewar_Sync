
import { LedgerEntry, ArtisanProduct, UserProfile, InventoryItem, EntryCategory, DailySummary, ArtisanPost, PlacePhoto, Review, ContactMessage, ChatMessage, ChatSession, UserRole } from '../types';
import { db, auth } from './firebase';
import { GeminiService } from './gemini';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

class FirebaseStorageService {
  private currentUser: UserProfile | null = null;
  public readonly isOffline = false;
  private gemini = new GeminiService();

  constructor() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
        if (profileDoc.exists()) {
          this.currentUser = { ...profileDoc.data() as UserProfile, id: user.uid };
        }
      } else {
        this.currentUser = null;
      }
    });
  }

  onAuthChange(callback: (user: UserProfile | null) => void) {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
        if (profileDoc.exists()) {
          const profile = { ...profileDoc.data() as UserProfile, id: user.uid };
          this.currentUser = profile;
          callback(profile);
        } else {
          this.currentUser = null;
          callback(null);
        }
      } else {
        this.currentUser = null;
        callback(null);
      }
    });
  }

  private cleanObject(obj: any) {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned;
  }

  private mapError(error: any): string {
    if (error.code) {
      switch (error.code) {
        case 'auth/invalid-email':
          return "The email address is badly formatted. Please check and try again.";
        case 'auth/user-disabled':
          return "This Mewar-Sync account has been disabled. Contact support.";
        case 'auth/user-not-found':
          return "No Mewar-Sync profile found with this email.";
        case 'auth/wrong-password':
          return "Incorrect password for this Mewar-Sync profile.";
        case 'auth/email-already-in-use':
          return "This email is already registered in Mewar-Sync.";
        case 'auth/weak-password':
          return "Password is too weak. Please use at least 6 characters.";
        case 'auth/invalid-credential':
          return "Invalid credentials. Please verify your email and password.";
        case 'auth/operation-not-allowed':
          return "Authentication operation not allowed at this time.";
        case 'auth/too-many-requests':
          return "Too many failed attempts. Please try again later for security.";
        case 'auth/network-request-failed':
          return "Network error. Please check your internet connection.";
        default:
          return error.message || "A Mewar-Sync system error occurred. Please try again.";
      }
    }
    return error.message || "A system error occurred.";
  }

  async signUp(profile: Omit<UserProfile, 'id'>) {
    const { email, password } = profile;
    if (!password) throw new Error("Password is required for Mewar-Sync registration");
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const { password: _, ...profileData } = profile;
      const newProfile: UserProfile = { ...this.cleanObject(profileData), id: user.uid };
      
      await setDoc(doc(db, 'profiles', user.uid), newProfile);
      this.currentUser = newProfile;
      return newProfile;
    } catch (err: any) {
      throw new Error(this.mapError(err));
    }
  }

  async signIn(email: string, password?: string) {
    if (!password) throw new Error("Password is required for Mewar-Sync access");
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
      if (!profileDoc.exists()) throw new Error("Mewar-Sync profile not found");
      
      const profile = { ...profileDoc.data() as UserProfile, id: user.uid };
      this.currentUser = profile;
      return profile;
    } catch (err: any) {
      throw new Error(this.mapError(err));
    }
  }

  async getProfile(id: string): Promise<UserProfile | null> {
    const profileDoc = await getDoc(doc(db, 'profiles', id));
    return profileDoc.exists() ? { ...profileDoc.data() as UserProfile, id } : null;
  }

  async getProfiles(): Promise<UserProfile[]> {
    const snapshot = await getDocs(collection(db, 'profiles'));
    return snapshot.docs.map(doc => ({ ...doc.data() as UserProfile, id: doc.id }));
  }

  async updateProfile(updates: Partial<UserProfile>) {
    if (!auth.currentUser) return;
    const cleanedUpdates = this.cleanObject(updates);
    await updateDoc(doc(db, 'profiles', auth.currentUser.uid), cleanedUpdates);
    if (this.currentUser) {
      this.currentUser = { ...this.currentUser, ...cleanedUpdates };
    }
  }

  async logout() {
    await signOut(auth);
    this.currentUser = null;
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "place_photos");

    // Use auto resource type to handle images, videos, and raw files (PDFs, etc)
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/dv3iwgyca/auto/upload",
      {
        method: "POST",
        body: formData
      }
    );

    const data = await response.json();

    if (!data.secure_url) {
      console.error('Cloudinary Error:', data);
      throw new Error("Mewar-Sync media archive failed. Please try again.");
    }

    return data.secure_url;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async saveLedger(entry: Partial<LedgerEntry>) {
    if (!auth.currentUser) throw new Error("Mewar-Sync session expired. Please sign in again.");

    const normalized = await this.gemini.normalizeItemName(entry.item!);
    const ledgerRef = collection(db, 'ledger_entries');
    const newEntry = {
      shop_id: auth.currentUser.uid,
      type: entry.type!,
      category: entry.category!,
      item: normalized || entry.item!,
      quantity: entry.quantity!,
      unit_price: entry.unit_price!,
      amount: entry.amount!,
      payment_status: entry.payment_status || 'PAID',
      customer_name: entry.customer_name || '',
      created_at: new Date().toISOString(),
      normalized_name: normalized
    };

    const docRef = await addDoc(ledgerRef, newEntry);
    return { ...newEntry, id: docRef.id } as LedgerEntry;
  }

  async saveUdhaar(entry: Partial<LedgerEntry>) {
    if (!auth.currentUser) throw new Error("Mewar-Sync session expired. Please sign in again.");

    const normalized = await this.gemini.normalizeItemName(entry.item!);
    const udhaarRef = collection(db, 'udhaar_entries');
    const newEntry = {
      shop_id: auth.currentUser.uid,
      type: entry.type!,
      category: entry.category!,
      item: normalized || entry.item!,
      quantity: entry.quantity!,
      unit_price: entry.unit_price!,
      amount: entry.amount!,
      payment_status: 'PENDING',
      customer_name: entry.customer_name || '',
      created_at: new Date().toISOString(),
      normalized_name: normalized
    };

    const docRef = await addDoc(udhaarRef, newEntry);
    return { ...newEntry, id: docRef.id } as LedgerEntry;
  }

  async updateUdhaarEntry(id: string, updates: Partial<LedgerEntry>) {
    const docRef = doc(db, 'udhaar_entries', id);
    if (updates.item) {
      const normalized = await this.gemini.normalizeItemName(updates.item);
      updates.normalized_name = normalized;
      updates.item = normalized || updates.item;
    }
    await updateDoc(docRef, updates);
    const updated = await getDoc(docRef);
    return { ...updated.data(), id: updated.id } as LedgerEntry;
  }

  async updateLedgerEntry(id: string, updates: Partial<LedgerEntry>) {
    const docRef = doc(db, 'ledger_entries', id);
    if (updates.item) {
      const normalized = await this.gemini.normalizeItemName(updates.item);
      updates.normalized_name = normalized;
      updates.item = normalized || updates.item;
    }
    await updateDoc(docRef, updates);
    const updated = await getDoc(docRef);
    return { ...updated.data(), id: updated.id } as LedgerEntry;
  }

  async deleteLedgerEntry(id: string) {
    await deleteDoc(doc(db, 'ledger_entries', id));
  }

  async deleteUdhaarEntry(id: string) {
    await deleteDoc(doc(db, 'udhaar_entries', id));
  }

  async getLedger(category: EntryCategory = 'BUSINESS', date?: string, endDate?: string) {
    if (!auth.currentUser) return [];
    
    let q = query(
      collection(db, 'ledger_entries'),
      where('shop_id', '==', auth.currentUser.uid),
      where('category', '==', category)
    );

    const snapshot = await getDocs(q);
    let entries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LedgerEntry));
    
    // Sort in memory to avoid needing composite index
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (date && date !== 'ALL') {
      // date and endDate are expected to be YYYY-MM-DD strings
      const startStr = date.includes('T') ? date.split('T')[0] : date;
      const endStr = endDate ? (endDate.includes('T') ? endDate.split('T')[0] : endDate) : startStr;

      entries = entries.filter(l => {
        const d = new Date(l.created_at);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${year}-${month}-${day}`;
        return localDateStr >= startStr && localDateStr <= endStr;
      });
    }

    return entries;
  }

  async getUdhaarEntries() {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'udhaar_entries'),
      where('shop_id', '==', auth.currentUser.uid),
      where('payment_status', '==', 'PENDING')
    );
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LedgerEntry));
    return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getSummaries() {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'summaries'),
      where('shop_id', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    const summaries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as DailySummary));
    return summaries.sort((a, b) => new Date(b.closing_time).getTime() - new Date(a.closing_time).getTime());
  }

  async getAvailableDates() {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'ledger_entries'),
      where('shop_id', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => doc.data() as LedgerEntry);
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    const dates = entries.map(e => {
      const d = new Date(e.created_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
    return Array.from(new Set(dates));
  }

  async getInventory() {
    if (!auth.currentUser) return [];
    const q = query(
      collection(db, 'inventory'),
      where('shop_id', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InventoryItem));
  }

  async findInventoryItemByName(name: string, is_purchased?: boolean, unit_cost?: number) {
    if (!auth.currentUser) return null;
    
    const normalized = await this.gemini.normalizeItemName(name);
    const inventoryRef = collection(db, 'inventory');
    
    // We'll fetch all items for this shop to handle the complex matching logic
    // (exact name OR normalized name) AND (unit_cost match if provided)
    let q = query(
      inventoryRef,
      where('shop_id', '==', auth.currentUser.uid)
    );
    
    if (is_purchased !== undefined) {
      q = query(q, where('is_purchased', '==', is_purchased));
    }
    
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as InventoryItem));
    
    // Filter by name/normalized name
    const matches = items.filter(i => 
      i.item.toLowerCase() === name.toLowerCase() || 
      (i.normalized_name && i.normalized_name === normalized) ||
      (normalized && i.item.toLowerCase() === normalized.toLowerCase())
    );
    
    if (matches.length === 0) return null;
    
    // If unit_cost is provided, prioritize matching it
    if (unit_cost !== undefined) {
      const costMatch = matches.find(i => i.unit_cost === unit_cost);
      if (costMatch) return costMatch;
      
      // If no cost match, we return null to create a new entry as per user's request
      // "if the unit cost is same then it should be treated as same product"
      return null;
    }
    
    // If no unit_cost provided (e.g. for SALE), return the one with most stock
    return matches.sort((a, b) => b.quantity - a.quantity)[0];
  }

  async saveInventory(item: Partial<InventoryItem>, mode: 'add' | 'remove' | 'set' = 'set') {
    if (!auth.currentUser) throw new Error("Mewar-Sync session expired. Please sign in again.");

    const normalized = await this.gemini.normalizeItemName(item.item!);
    let existing: InventoryItem | null = null;
    
    if (item.id) {
      const docSnap = await getDoc(doc(db, 'inventory', item.id));
      if (docSnap.exists()) {
        existing = { ...docSnap.data(), id: docSnap.id } as InventoryItem;
      }
    }
    
    if (!existing) {
      // When adding, we search by name, is_purchased, AND unit_cost to see if we can merge
      existing = await this.findInventoryItemByName(item.item!, item.is_purchased, item.unit_cost);
    }
    
    const inventoryRef = collection(db, 'inventory');

    if (existing) {
      let newQty = item.quantity ?? 0;
      if (mode === 'add') newQty = (existing.quantity || 0) + newQty;
      if (mode === 'remove') newQty = (existing.quantity || 0) - newQty;
      
      // Final safety check: stock cannot be negative
      newQty = Math.max(0, newQty);
      
      await updateDoc(doc(db, 'inventory', existing.id), {
        item: normalized || (item.item ?? existing.item),
        quantity: newQty,
        unit_cost: item.unit_cost ?? existing.unit_cost,
        is_purchased: item.is_purchased !== undefined ? item.is_purchased : existing.is_purchased,
        last_updated: new Date().toISOString(),
        normalized_name: normalized || existing.normalized_name
      });
      return existing.id;
    } else {
      const docRef = await addDoc(inventoryRef, {
        shop_id: auth.currentUser.uid,
        item: normalized || item.item!,
        quantity: item.quantity || 0,
        unit_cost: item.unit_cost || 0,
        is_purchased: item.is_purchased ?? false,
        last_updated: new Date().toISOString(),
        normalized_name: normalized
      });
      return docRef.id;
    }
  }

  async deleteInventoryItem(id: string) {
    await deleteDoc(doc(db, 'inventory', id));
  }

  async mergeInventory() {
    if (!auth.currentUser) return;
    
    const items = await this.getInventory();
    const groups: { [key: string]: InventoryItem[] } = {};
    
    // Group items by normalized name, source, and unit cost
    for (const item of items) {
      let normalized = item.normalized_name;
      if (!normalized) {
        normalized = await this.gemini.normalizeItemName(item.item);
        await updateDoc(doc(db, 'inventory', item.id), { normalized_name: normalized });
      }
      
      const key = `${normalized}_${item.is_purchased}_${item.unit_cost}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    
    let mergedCount = 0;
    for (const key in groups) {
      const group = groups[key];
      if (group.length > 1) {
        const baseItem = group[0];
        let totalQty = group.reduce((sum, i) => sum + i.quantity, 0);
        
        // Update the first item with the combined quantity
        await updateDoc(doc(db, 'inventory', baseItem.id), { 
          quantity: totalQty,
          last_updated: new Date().toISOString()
        });
        
        // Delete the other duplicate items
        for (let i = 1; i < group.length; i++) {
          await deleteDoc(doc(db, 'inventory', group[i].id));
          mergedCount++;
        }
      }
    }
    return mergedCount;
  }

  async saveProduct(product: Partial<ArtisanProduct>) {
    if (!auth.currentUser) throw new Error("Mewar-Sync session expired. Please sign in again.");

    const productsRef = collection(db, 'products');
    if (product.id) {
      await updateDoc(doc(db, 'products', product.id), product);
    } else {
      await addDoc(productsRef, {
        ...product,
        shop_id: auth.currentUser.uid,
        is_verified: true,
        reviews: []
      });
    }
  }

  async deleteProduct(id: string) {
    await deleteDoc(doc(db, 'products', id));
  }

  async getProducts() {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ArtisanProduct));
  }

  async likeProduct(productId: string, userId: string) {
    const docRef = doc(db, 'products', productId);
    const productDoc = await getDoc(docRef);
    if (!productDoc.exists()) return;
    
    const data = productDoc.data() as ArtisanProduct;
    const likes = data.likes || [];
    const newLikes = likes.includes(userId) 
      ? likes.filter(id => id !== userId) 
      : [...likes, userId];
    
    await updateDoc(docRef, { likes: newLikes });
  }

  async likeArtisan(artisanId: string, userId: string) {
    const docRef = doc(db, 'profiles', artisanId);
    const profileDoc = await getDoc(docRef);
    if (!profileDoc.exists()) return;
    
    const data = profileDoc.data() as UserProfile;
    const likes = data.likes || [];
    const newLikes = likes.includes(userId) 
      ? likes.filter(id => id !== userId) 
      : [...likes, userId];
    
    await updateDoc(docRef, { likes: newLikes });
  }

  async addProductReview(productId: string, review: Omit<Review, 'id'>) {
    const docRef = doc(db, 'products', productId);
    const productDoc = await getDoc(docRef);
    if (!productDoc.exists()) return;
    
    const data = productDoc.data() as ArtisanProduct;
    const reviews = data.reviews || [];
    const newReview = { ...review, id: Math.random().toString(36).substr(2, 9) };
    
    await updateDoc(docRef, { reviews: [...reviews, newReview] });
  }

  async getArtisanDetails(shopId: string) {
    return this.getProfile(shopId);
  }

  async getArtisanPosts(): Promise<ArtisanPost[]> {
    const snapshot = await getDocs(collection(db, 'artisan_posts'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ArtisanPost));
  }

  async saveArtisanPost(post: Omit<ArtisanPost, 'id'>) {
    if (!auth.currentUser) throw new Error("Mewar-Sync session expired. Please sign in again.");
    await addDoc(collection(db, 'artisan_posts'), post);
  }

  async logAIInteraction(type: string, input: string, result: any) {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'ai_logs'), {
      user_id: auth.currentUser.uid,
      interaction_type: type,
      input_context: input,
      output_result: result,
      timestamp: new Date().toISOString()
    });
  }

  async closeGalla(targetDate?: string) {
    if (!auth.currentUser) return;
    
    const dateToClose = targetDate || new Date().toDateString();
    
    // Check if summary already exists for this date to avoid duplicates
    const existingSummaries = await this.getSummaries();
    if (existingSummaries.find(s => s.date === dateToClose)) {
      console.log(`Summary for ${dateToClose} already exists.`);
      return localStorage.getItem('last_galla_close_' + auth.currentUser.uid);
    }

    const ledger = await this.getLedger('BUSINESS', dateToClose);
    
    const totalSales = ledger.filter(l => l.type === 'SALE').reduce((sum, l) => sum + l.amount, 0);
    const totalExpenses = ledger.filter(l => l.type === 'BUSINESS_EXPENSE' || l.type === 'OTHER_EXPENSE').reduce((sum, l) => sum + l.amount, 0);
    
    const summary: Omit<DailySummary, 'id'> = {
      shop_id: auth.currentUser.uid,
      date: dateToClose,
      total_sales: totalSales,
      total_expenses: totalExpenses,
      net_profit: totalSales - totalExpenses,
      closing_time: new Date().toISOString()
    };

    await addDoc(collection(db, 'summaries'), summary);
    
    const closeTimestamp = new Date().toISOString();
    localStorage.setItem('last_galla_close_' + auth.currentUser.uid, closeTimestamp);
    return closeTimestamp;
  }

  getLastGallaClose() {
    if (!auth.currentUser) return null;
    return localStorage.getItem('last_galla_close_' + auth.currentUser.uid);
  }

  async getAnalyticsData() {
    // In a real app, this would be aggregated from Firestore
    return [
      { name: 'Pichwai', value: 40 },
      { name: 'Miniature', value: 25 },
      { name: 'Phad', value: 20 },
      { name: 'Other', value: 15 },
    ];
  }

  async getArtisansWithLocation(): Promise<UserProfile[]> {
    const q = query(
      collection(db, 'profiles'),
      where('role', '==', 'SHOPKEEPER')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(doc => ({ ...doc.data(), id: doc.id } as UserProfile))
      .filter(p => p.location && p.location.lat && p.location.lng);
  }

  async getPlacePhotos(placeId: string): Promise<PlacePhoto[]> {
    const q = query(
      collection(db, 'place_photos'),
      where('place_id', '==', placeId)
    );
    const snapshot = await getDocs(q);
    const photos = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as PlacePhoto));
    // Sort in memory to avoid needing composite index
    return photos.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
  }

  async savePlacePhoto(photo: Omit<PlacePhoto, 'id'>) {
    // Check limit
    const existing = await this.getPlacePhotos(photo.place_id);
    if (existing.length >= 10) {
      throw new Error("Mewar-Sync Gallery Limit: Maximum 10 photos allowed per heritage site.");
    }
    try {
      await addDoc(collection(db, 'place_photos'), {
        ...photo,
        user_id: this.currentUser?.id || 'anonymous'
      });
    } catch (error) {
      this.handleFirestoreError(error, 'write' as any, 'place_photos');
    }
  }

  async deletePlacePhoto(id: string) {
    try {
      await deleteDoc(doc(db, 'place_photos', id));
    } catch (error) {
      this.handleFirestoreError(error, 'delete' as any, `place_photos/${id}`);
    }
  }

  private handleFirestoreError(error: any, operationType: any, path: string | null) {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  async sendContactMessage(message: Omit<ContactMessage, 'id'>) {
    await addDoc(collection(db, 'contact_messages'), {
      ...message,
      status: 'NEW',
      timestamp: new Date().toISOString()
    });
  }

  async getContactMessages(artisanId: string): Promise<ContactMessage[]> {
    const q = query(
      collection(db, 'contact_messages'),
      where('artisan_id', '==', artisanId)
    );
    const snapshot = await getDocs(q);
    const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ContactMessage));
    // Sort in memory to avoid needing composite index
    return messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async markMessageAsRead(messageId: string) {
    await updateDoc(doc(db, 'contact_messages', messageId), { status: 'READ' });
  }

  // Chat Methods
  async getChatSessions(userId: string, role: UserRole): Promise<ChatSession[]> {
    const field = role === 'SHOPKEEPER' ? 'artisan_id' : 'visitor_id';
    const q = query(
      collection(db, 'chat_sessions'),
      where(field, '==', userId)
    );
    const snapshot = await getDocs(q);
    const sessions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChatSession));
    return sessions.sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime());
  }

  onChatMessages(sessionId: string, callback: (messages: ChatMessage[]) => void) {
    const q = query(
      collection(db, 'chat_messages'),
      where('session_id', '==', sessionId)
    );
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChatMessage));
      callback(messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    });
  }

  async sendMessage(sessionId: string, senderId: string, text: string, media?: { url: string, type: 'IMAGE' | 'FILE', name?: string }) {
    const messageData: any = {
      session_id: sessionId,
      sender_id: senderId,
      text,
      timestamp: new Date().toISOString(),
      is_read: false
    };

    if (media) {
      messageData.media_url = media.url;
      messageData.media_type = media.type;
      messageData.media_name = media.name;
    }

    await addDoc(collection(db, 'chat_messages'), messageData);
    
    const sessionRef = doc(db, 'chat_sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    if (sessionDoc.exists()) {
      const sessionData = sessionDoc.data() as ChatSession;
      const updates: any = {
        last_message: media ? (media.type === 'IMAGE' ? '📷 Photo' : `📁 ${media.name || 'File'}`) : text,
        last_timestamp: messageData.timestamp
      };
      if (this.currentUser?.role === 'SHOPKEEPER') {
        updates.unread_count_visitor = (sessionData.unread_count_visitor || 0) + 1;
      } else {
        updates.unread_count_artisan = (sessionData.unread_count_artisan || 0) + 1;
      }
      await updateDoc(sessionRef, updates);
    }
  }

  async editMessage(messageId: string, newText: string) {
    const messageRef = doc(db, 'chat_messages', messageId);
    await updateDoc(messageRef, {
      text: newText,
      is_edited: true
    });
  }

  async deleteChatSession(sessionId: string) {
    // Delete all messages in the session
    const q = query(
      collection(db, 'chat_messages'),
      where('session_id', '==', sessionId)
    );
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Delete the session itself
    await deleteDoc(doc(db, 'chat_sessions', sessionId));
  }

  async createChatSession(artisanId: string, visitorId: string, visitorName: string, artisanName: string, productId?: string) {
    // Query by one field and filter in memory to avoid composite index requirement
    const q = query(
      collection(db, 'chat_sessions'),
      where('artisan_id', '==', artisanId)
    );
    const snapshot = await getDocs(q);
    const existingSession = snapshot.docs.find(doc => doc.data().visitor_id === visitorId);
    
    if (existingSession) return existingSession.id;

    const sessionData: any = {
      artisan_id: artisanId,
      visitor_id: visitorId,
      visitor_name: visitorName,
      artisan_name: artisanName,
      last_timestamp: new Date().toISOString(),
      unread_count_artisan: 0,
      unread_count_visitor: 0
    };

    if (productId) {
      sessionData.product_id = productId;
    }
    const docRef = await addDoc(collection(db, 'chat_sessions'), sessionData);
    return docRef.id;
  }

  async markChatAsRead(sessionId: string, role: UserRole) {
    const sessionRef = doc(db, 'chat_sessions', sessionId);
    const updates: any = {};
    if (role === 'SHOPKEEPER') {
      updates.unread_count_artisan = 0;
    } else {
      updates.unread_count_visitor = 0;
    }
    await updateDoc(sessionRef, updates);
  }

  onChatSessions(userId: string, role: UserRole, callback: (sessions: ChatSession[]) => void) {
    const field = role === 'SHOPKEEPER' ? 'artisan_id' : 'visitor_id';
    const q = query(
      collection(db, 'chat_sessions'),
      where(field, '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChatSession));
      callback(sessions.sort((a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()));
    });
  }
}

export const storage = new FirebaseStorageService();
