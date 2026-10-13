
export type UserRole = 'SHOPKEEPER' | 'VISITOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  role: UserRole;
  name: string;
  email: string;
  password?: string;
  phone?: string;
  category?: string;
  shopAddress?: string;
  description?: string;
  thumbnail?: string;
  preferredLanguage?: string;
  location?: {
    lat: number;
    lng: number;
  };
  profile_picture?: string;
  likes?: string[]; // Array of user IDs who liked this artisan/shop
}

export type EntryType = 'SALE' | 'BUSINESS_EXPENSE' | 'PERSONAL_RECEIVED' | 'PERSONAL_PAID' | 'OTHER_EXPENSE';
export type EntryCategory = 'BUSINESS' | 'PERSONAL';
export type PaymentStatus = 'PAID' | 'PENDING';

export interface LedgerEntry {
  id: string;
  type: EntryType;
  category: EntryCategory;
  item: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
  shop_id: string;
  payment_status?: PaymentStatus;
  customer_name?: string;
  normalized_name?: string;
}

export interface InventoryItem {
  id: string;
  item: string;
  quantity: number;
  unit_cost: number;
  is_purchased: boolean;
  shop_id: string;
  last_updated: string;
  normalized_name?: string;
}

export interface ArtisanProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  style: string;
  image_url: string;
  shop_id: string;
  is_verified: boolean;
  reviews: Review[];
  likes?: string[]; // Array of user IDs who liked
}

export interface Review {
  id: string;
  visitor_name: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ArtisanPost {
  id: string;
  artisan_id: string;
  artisan_name: string;
  content: string;
  image_url?: string;
  location: {
    lat: number;
    lng: number;
  };
  timestamp: string;
}

export interface MapLocation {
  id: string;
  name: string;
  type: 'HERITAGE' | 'MARKET';
  lat: number;
  lng: number;
  description: string;
  image_url?: string;
  mewari_bol?: {
    phrase: string;
    meaning: string;
  }[];
  entry_fee_indian?: number;
  entry_fee_indian_child?: number;
  entry_fee_foreigner?: number;
  entry_fee_foreigner_child?: number;
  activity_costs?: {
    name: string;
    cost: number;
    note?: string;
  }[];
  must_do?: string;
  timings?: {
    open: string; // HH:MM format
    close: string; // HH:MM format
    note?: string;
  };
  camera_fee?: number;
  video_fee?: number;
  shopping_guide?: {
    best_buys: string[];
    bargaining_tips: string[];
    local_specialty: string;
  };
}

export interface Order {
  id: string;
  product_id: string;
  shop_id: string;
  visitor_id: string;
  amount: number;
  status: 'PENDING' | 'PAID';
  date: string;
}

export interface DailySummary {
  id: string;
  shop_id: string;
  date: string;
  total_sales: number;
  total_expenses: number;
  net_profit: number;
  closing_time: string;
}

export interface PlacePhoto {
  id: string;
  place_id: string;
  image_url: string;
  uploaded_at: string;
  user_id?: string;
}

export interface ContactMessage {
  id: string;
  artisan_id: string;
  visitor_name: string;
  visitor_email: string;
  message: string;
  timestamp: string;
  status: 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_id: string;
  text: string;
  timestamp: string;
  is_read: boolean;
  media_url?: string;
  media_type?: 'IMAGE' | 'FILE';
  media_name?: string;
  is_edited?: boolean;
}

export interface ChatSession {
  id: string;
  artisan_id: string;
  visitor_id: string;
  visitor_name: string;
  artisan_name: string;
  last_message?: string;
  last_timestamp: string;
  unread_count_artisan: number;
  unread_count_visitor: number;
  product_id?: string;
}

export interface VoiceAction {
  action: 'transaction' | 'expense' | 'other_expense' | 'personal_received' | 'personal_paid' | 'inventory' | 'navigate' | 'search' | 'none';
  category: EntryCategory;
  item?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  target?: string;
  query?: string;
  inventory_adjustment?: 'add' | 'remove';
  payment_status?: PaymentStatus;
  customer_name?: string;
  transcript?: string;
  is_purchased?: boolean;
}
