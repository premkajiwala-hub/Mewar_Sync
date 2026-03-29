
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Menu, X, Landmark, Store, Settings, LogOut, History, Compass, User, Languages, CheckCircle2, IndianRupee, Save, AlertCircle, Edit3, Image as ImageIcon, BookOpen, Package, ShoppingBag, UserCircle, AlertTriangle, PlusCircle, Info, Heart, BarChart3, FileText, Camera, Loader2, Mail, Sparkles, Play } from 'lucide-react';
import { UserRole, UserProfile, VoiceAction, ArtisanProduct, InventoryItem } from './types';
import { ArtisanDashboard } from './components/Artisan/Dashboard';
import { ScanToList } from './components/Artisan/ScanToList';
import { MyGallery } from './components/Artisan/MyGallery';
import { RoyalLedger } from './components/Artisan/RoyalLedger';
import { Inventory } from './components/Artisan/Inventory';
import { UdhaarTracker } from './components/Artisan/UdhaarTracker';
import { LedgerReports } from './components/Artisan/LedgerReports';
import { Marketplace } from './components/Visitor/Marketplace';
import { AuthPortal } from './components/Auth/AuthPortal';
import { MewarAssistant } from './components/Voice/MewarAssistant';
import { AuthenticityScanner } from './components/Tourist/AuthenticityScanner';
import { ProfileSettings } from './components/Artisan/ProfileSettings';
import { TranslatorBridge } from './components/Communication/TranslatorBridge';
import { ArtisanGallery } from './components/Visitor/ArtisanGallery';
import { Header } from './components/UI/Header';
import { Messenger } from './components/Communication/Messenger';
import { ConfirmationModal } from './components/UI/ConfirmationModal';
import { AIChatbot } from './components/Communication/AIChatbot';
import { ProductDetail } from './components/Visitor/ProductDetail';
import { AnalyticsDashboard } from './components/Admin/AnalyticsDashboard';
import { LocationPhotoManager } from './components/Admin/LocationPhotoManager';
import { storage } from './services/storage';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(storage.getCurrentUser());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [pendingAction, setPendingAction] = useState<VoiceAction | null>(null);
  const [stockError, setStockError] = useState<{ available: number; requested: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); 
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ArtisanProduct | null>(null);
  const [lastGallaClose, setLastGallaClose] = useState<string | null>(storage.getLastGallaClose());
  const [showMessenger, setShowMessenger] = useState(false);
  const [messengerTargetArtisan, setMessengerTargetArtisan] = useState<UserProfile | undefined>(undefined);
  const [newInquiriesCount, setNewInquiriesCount] = useState(0);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const translations: Record<string, Record<string, string>> = {
    'English': {
      'DASHBOARD': 'Dashboard',
      'LEDGER': 'Royal Ledger',
      'INVENTORY': 'Inventory',
      'UDHAAR': 'Udhaar Tracker',
      'REPORTS': 'Ledger Reports',
      'GALLERY': 'My Gallery',
      'SCANNER': 'Scan to List',
      'SETTINGS': 'Profile Settings',
      'LOGOUT': 'Logout',
      'MARKETPLACE': 'Marketplace',
      'HERITAGE_FEED': 'Heritage Feed',
      'SCAN_AUTHENTICITY': 'Authenticity Scan',
      'ARTISAN_GALLERY': 'Artisan Gallery'
    },
    'Hindi': {
      'DASHBOARD': 'डैशबोर्ड',
      'LEDGER': 'बही खाता',
      'INVENTORY': 'स्टॉक',
      'UDHAAR': 'उधार खाता',
      'REPORTS': 'बही रिपोर्ट',
      'GALLERY': 'मेरी गैलरी',
      'SCANNER': 'स्कैन लिस्ट',
      'SETTINGS': 'प्रोफ़ाइल सेटिंग्स',
      'LOGOUT': 'लॉगआउट',
      'MARKETPLACE': 'बाज़ार',
      'HERITAGE_FEED': 'विरासत फ़ीड',
      'SCAN_AUTHENTICITY': 'प्रामाणिकता स्कैन',
      'ARTISAN_GALLERY': 'कलाकार गैलरी'
    },
    'Marwadi': {
      'DASHBOARD': 'डैशबोर्ड',
      'LEDGER': 'बही खातो',
      'INVENTORY': 'माल-सामान',
      'UDHAAR': 'उधारो खातो',
      'REPORTS': 'बही री रिपोर्ट',
      'GALLERY': 'मारी गैलरी',
      'SCANNER': 'स्कैन लिस्ट',
      'SETTINGS': 'प्रोफ़ाइल सेटिंग्स',
      'LOGOUT': 'लॉगआउट',
      'MARKETPLACE': 'बज़ार',
      'HERITAGE_FEED': 'विरासत फ़ीड',
      'SCAN_AUTHENTICITY': 'प्रामाणिकता स्कैन',
      'ARTISAN_GALLERY': 'कलाकार गैलरी'
    }
  };

  const t = (key: string) => {
    const lang = currentUser?.preferredLanguage || 'English';
    return translations[lang]?.[key] || key;
  };

  useEffect(() => {
    const unsubscribe = storage.onAuthChange((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const checkMidnight = setInterval(async () => {
      const lastClose = storage.getLastGallaClose();
      const today = new Date().toDateString();
      if (lastClose) {
        const lastCloseDate = new Date(lastClose).toDateString();
        if (today !== lastCloseDate) {
          console.log("Midnight reset triggered");
          await storage.closeGalla();
          setLastGallaClose(storage.getLastGallaClose());
          setRefreshKey(prev => prev + 1);
        }
      } else {
        // Initial close if never closed
        await storage.closeGalla();
        setLastGallaClose(storage.getLastGallaClose());
      }
    }, 60000); // Check every minute
    return () => clearInterval(checkMidnight);
  }, []);

  useEffect(() => {
    setStockError(null);
  }, [pendingAction?.item, pendingAction?.quantity]);

  useEffect(() => {
    const fetchInv = async () => {
      const data = await storage.getInventory();
      setInventory(data);
    };
    const fetchInquiriesCount = async () => {
      if (currentUser?.role === 'SHOPKEEPER') {
        const sessions = await storage.getChatSessions(currentUser.id, currentUser.role);
        setNewInquiriesCount(sessions.reduce((sum, s) => sum + s.unread_count_artisan, 0));
      } else if (currentUser?.role === 'VISITOR') {
        const sessions = await storage.getChatSessions(currentUser.id, currentUser.role);
        setNewInquiriesCount(sessions.reduce((sum, s) => sum + s.unread_count_visitor, 0));
      }
    };
    if (currentUser) {
      fetchInv();
      fetchInquiriesCount();
    }
  }, [refreshKey, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'VISITOR' && activeTab === 'DASHBOARD') {
      setActiveTab('HERITAGE_FEED');
    }
  }, [currentUser]);

  const handleVoiceAction = (action: VoiceAction) => {
    if (action.action === 'navigate') {
      const targets: Record<string, string> = {
        'dashboard': 'DASHBOARD',
        'ledger': 'LEDGER',
        'inventory': 'INVENTORY',
        'gallery': 'GALLERY',
        'udhaar': 'UDHAAR',
        'reports': 'REPORTS'
      };
      if (targets[action.target || '']) setActiveTab(targets[action.target!]);
    } else if (['transaction', 'expense', 'other_expense', 'inventory', 'personal_received', 'personal_paid'].includes(action.action)) {
      // Set fallbacks for missing AI data
      const q = (action.quantity && action.quantity > 0) ? action.quantity : 1;
      const p = action.price || 0;
      
      if (action.category === 'BUSINESS') {
        action.quantity = q;
        if (action.price !== undefined) {
          action.unitPrice = action.price / q;
        } else if (action.unitPrice !== undefined) {
          action.price = action.unitPrice * q;
        } else {
          action.price = 0;
          action.unitPrice = 0;
        }
      } else {
        action.quantity = 1;
        action.price = p;
        action.unitPrice = p;
      }
      
      if (!action.item) action.item = action.category === 'BUSINESS' ? 'Bahi Entry' : 'Personal Entry';
      
      // Keyword detection for inventory source
      if (action.action === 'inventory' || action.action === 'expense') {
        const transcript = action.transcript?.toLowerCase() || '';
        if (transcript.includes('bought')) {
          action.is_purchased = true;
        } else if (transcript.includes('made') || transcript.includes('crafted') || transcript.includes('created')) {
          action.is_purchased = false;
        } else {
          // Default to Purchased if no production keywords are found
          action.is_purchased = true;
        }
      }
      
      setPendingAction(action);
    }
  };

  const confirmAction = async () => {
    if (!pendingAction || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const typeMap: any = {
        'transaction': 'SALE',
        'expense': 'BUSINESS_EXPENSE',
        'other_expense': 'OTHER_EXPENSE',
        'personal_received': 'PERSONAL_RECEIVED',
        'personal_paid': 'PERSONAL_PAID'
      };

      const entryType = typeMap[pendingAction.action];

      if (entryType === 'SALE' && pendingAction.category === 'BUSINESS' && pendingAction.item) {
        const invItem = await storage.findInventoryItemByName(pendingAction.item);
        const requestedQty = pendingAction.quantity || 1;
        
        if (!invItem || invItem.quantity < requestedQty) {
          setStockError({ 
            available: invItem?.quantity || 0, 
            requested: requestedQty 
          });
          setIsSubmitting(false);
          return;
        }
      }

      if (pendingAction.action !== 'inventory') {
        const entryData = {
          type: entryType,
          category: pendingAction.category,
          item: pendingAction.item || (pendingAction.category === 'PERSONAL' ? 'Unknown Person' : 'Misc Entry'),
          quantity: pendingAction.category === 'BUSINESS' ? (pendingAction.quantity || 1) : 1,
          unit_price: pendingAction.category === 'BUSINESS' ? (pendingAction.unitPrice || 0) : (pendingAction.price || 0),
          amount: pendingAction.price || 0,
          payment_status: pendingAction.payment_status || 'PAID',
          customer_name: pendingAction.customer_name || ''
        };

        if (entryData.payment_status === 'PENDING') {
          await storage.saveUdhaar(entryData);
        } else {
          await storage.saveLedger(entryData);
        }

        if (pendingAction.category === 'BUSINESS' && pendingAction.item) {
          if (entryType === 'SALE') {
            await storage.saveInventory({ item: pendingAction.item, quantity: pendingAction.quantity }, 'remove');
          } else if (entryType === 'BUSINESS_EXPENSE') {
            await storage.saveInventory({ 
              item: pendingAction.item, 
              quantity: pendingAction.quantity,
              unit_cost: pendingAction.unitPrice || 0,
              is_purchased: pendingAction.is_purchased
            }, 'add');
          }
        }
      } else {
        await storage.saveInventory({
          item: pendingAction.item || 'New Stock',
          quantity: pendingAction.quantity || 0,
          unit_cost: pendingAction.unitPrice || 0,
          is_purchased: pendingAction.is_purchased
        }, pendingAction.inventory_adjustment || 'add');
      }
      
      setPendingAction(null);
      setStockError(null);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Voice action confirmation failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePendingField = (field: keyof VoiceAction, value: any) => {
    if (!pendingAction) return;
    const next = { ...pendingAction, [field]: value };
    
    if (pendingAction.category === 'BUSINESS') {
      if (field === 'unitPrice' || field === 'quantity') {
        const q = field === 'quantity' ? (value || 0) : (next.quantity || 1);
        const u = field === 'unitPrice' ? (value || 0) : (next.unitPrice || 0);
        next.price = q * u;
      } else if (field === 'price') {
        const q = next.quantity || 1;
        const p = value || 0;
        next.unitPrice = q > 0 ? p / q : p;
      }
    } else {
      if (field === 'price') {
        next.price = value || 0;
        next.unitPrice = value || 0;
      }
    }
    setPendingAction(next);
  };

  const handleLogout = async () => {
    await storage.logout();
    setCurrentUser(null);
  };

  const getInventoryMatch = (itemName: string) => {
    if (!itemName) return null;
    return inventory.find(i => i.item.toLowerCase().includes(itemName.toLowerCase()));
  };

  const navItems = React.useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'SHOPKEEPER') {
      return [
        { id: 'DASHBOARD', label: t('DASHBOARD'), icon: LayoutDashboard },
        { id: 'GALLERY', label: t('GALLERY'), icon: ImageIcon },
        { id: 'LEDGER', label: t('LEDGER'), icon: BookOpen },
        { id: 'INVENTORY', label: t('INVENTORY'), icon: Package },
        { id: 'UDHAAR', label: t('UDHAAR'), icon: History },
        { id: 'REPORTS', label: t('REPORTS'), icon: FileText },
        { id: 'SELL', label: t('SCANNER'), icon: Store },
        { id: 'SETTINGS', label: t('SETTINGS'), icon: User }
      ];
    } else if (currentUser.role === 'ADMIN') {
      return [
        { id: 'DASHBOARD', label: t('DASHBOARD'), icon: LayoutDashboard },
        { id: 'ANALYTICS', label: 'Analytics', icon: BarChart3 },
        { id: 'LOCATION_PHOTOS', label: 'Location Photos', icon: Camera },
        { id: 'SETTINGS', label: t('SETTINGS'), icon: User }
      ];
    } else {
      return [
        { id: 'HERITAGE_FEED', label: t('HERITAGE_FEED'), icon: Heart },
        { id: 'ARTISAN_GALLERY', label: t('ARTISAN_GALLERY'), icon: ShoppingBag },
        { id: 'TRANSLATOR', label: t('TRANSLATOR'), icon: Languages },
        { id: 'VERIFY', label: t('SCAN_AUTHENTICITY'), icon: Landmark },
        { id: 'SETTINGS', label: t('SETTINGS'), icon: User }
      ];
    }
  }, [currentUser?.role, currentUser?.preferredLanguage]);

  if (!currentUser) {
    return <AuthPortal onAuthSuccess={setCurrentUser} />;
  }

  const renderContent = () => {
    if (currentUser.role === 'SHOPKEEPER') {
      switch (activeTab) {
        case 'DASHBOARD': return <ArtisanDashboard key={refreshKey} />;
        case 'SELL': return <ScanToList onProductAdded={() => setRefreshKey(k => k + 1)} onModalToggle={setIsAnyModalOpen} />;
        case 'GALLERY': return <MyGallery key={refreshKey} onModalToggle={setIsAnyModalOpen} />;
        case 'LEDGER': return <RoyalLedger key={refreshKey} onUpdate={() => setRefreshKey(k => k + 1)} onModalToggle={setIsAnyModalOpen} />;
        case 'INVENTORY': return <Inventory key={refreshKey} onUpdate={() => setRefreshKey(k => k + 1)} onModalToggle={setIsAnyModalOpen} />;
        case 'UDHAAR': return <UdhaarTracker key={refreshKey} onModalToggle={setIsAnyModalOpen} />;
        case 'REPORTS': return <LedgerReports key={refreshKey} />;
        case 'SETTINGS': return <ProfileSettings onModalToggle={setIsAnyModalOpen} />;
        default: return <ArtisanDashboard key={refreshKey} />;
      }
    } else if (currentUser.role === 'ADMIN') {
      switch (activeTab) {
        case 'DASHBOARD': return <ArtisanDashboard key={refreshKey} />;
        case 'ANALYTICS': return <AnalyticsDashboard />;
        case 'LOCATION_PHOTOS': return <LocationPhotoManager />;
        case 'SETTINGS': return <ProfileSettings onModalToggle={setIsAnyModalOpen} />;
        default: return <ArtisanDashboard key={refreshKey} />;
      }
    } else {
      switch (activeTab) {
        case 'HERITAGE_FEED': return (
          <Marketplace 
            onViewArtisanProfile={(artisanId) => {
              // We'll use a session storage or similar to tell ArtisanGallery to open this profile
              sessionStorage.setItem('open_artisan_id', artisanId);
              setActiveTab('ARTISAN_GALLERY');
            }} 
            onSelectProduct={setSelectedProduct}
          />
        );
        case 'ARTISAN_GALLERY': return (
          <ArtisanGallery 
            onOpenMessenger={(artisan) => {
              setMessengerTargetArtisan(artisan);
              setShowMessenger(true);
            }} 
          />
        );
        case 'TRANSLATOR': return <TranslatorBridge />;
        case 'VERIFY': return <AuthenticityScanner />;
        case 'SETTINGS': return <ProfileSettings />;
        default: return <Marketplace />;
      }
    }
  };

  const matchedInv = pendingAction ? getInventoryMatch(pendingAction.item || '') : null;

  return (
    <div className="h-screen w-full max-w-full flex overflow-hidden overflow-x-hidden bg-gray-50 font-outfit relative">
      {/* Voice Assistant - Only for Shopkeepers */}
      {currentUser.role === 'SHOPKEEPER' && !isSidebarOpen && !pendingAction && !showMessenger && !selectedProduct && !isAnyModalOpen && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[101] scale-90 sm:scale-100">
          <MewarAssistant onAction={handleVoiceAction} />
        </div>
      )}
      
      {pendingAction && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" 
            onClick={() => setPendingAction(null)}
          />
          <div className="glass-mewar w-[92%] md:max-w-md rounded-[24px] md:rounded-[28px] shadow-2xl border-2 border-gold/30 relative bg-white flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
              <button onClick={() => setPendingAction(null)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-all p-1.5 rounded-full hover:bg-red-50 z-30"><X size={20} /></button>
              
              <div className="flex-1 overflow-y-auto p-5 md:p-6 scrollbar-hide">
                <div className="text-center mb-4 md:mb-5 font-heritage pt-1">
                  <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center mx-auto mb-3 border-4 shadow-inner ${
                    stockError ? 'bg-amber-50 text-amber-600 border-amber-200' :
                    (pendingAction.action === 'transaction' || pendingAction.action === 'personal_received') ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                     {stockError ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                  </div>
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 uppercase tracking-tight">
                    {stockError ? 'Insufficient Stock' : 
                     pendingAction.action.replace('_', ' ')}
                  </h3>
                </div>

                <div className="space-y-3 bg-gray-50/80 p-5 md:p-6 rounded-[24px] md:rounded-[32px] border border-gold/10 mb-4 font-heritage shadow-inner">
                 <div className="flex flex-col gap-1 pb-3 border-b border-gold/10">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60">{pendingAction.category === 'PERSONAL' ? 'Recipient / Name' : 'Item Description'}</span>
                    <input className="text-lg font-bold text-gray-900 bg-white border border-gold/5 rounded-xl px-4 py-2 shadow-sm focus:border-gold outline-none transition-all" value={pendingAction.item || ''} onChange={e => updatePendingField('item', e.target.value)} />
                    
                    {(pendingAction.action === 'inventory' || pendingAction.action === 'expense') && (
                      <div className="flex gap-2 mt-1.5">
                        <button 
                          type="button"
                          onClick={() => updatePendingField('is_purchased', !pendingAction.is_purchased)}
                          className={`px-2.5 py-1 rounded-full text-[7px] font-bold uppercase tracking-widest flex items-center gap-1 border transition-all ${pendingAction.is_purchased ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm' : 'bg-green-50 text-green-600 border-green-100 shadow-sm'}`}
                        >
                          {pendingAction.is_purchased ? <ShoppingBag size={9} /> : <Package size={9} />}
                          {pendingAction.is_purchased ? 'Purchased' : 'Self Produced'}
                        </button>
                      </div>
                    )}

                    {matchedInv && pendingAction.category === 'BUSINESS' && (
                      <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1 px-1 pt-1.5">
                        <Info size={9} /> Linked Inventory: {matchedInv.item} (In Stock: {matchedInv.quantity})
                      </p>
                    )}
                 </div>
                 
                 {pendingAction.category === 'BUSINESS' ? (
                   <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 sm:gap-6 py-3 border-b border-gold/10">
                     <div className="space-y-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gold/40">Quantity</span>
                        <input type="number" min="1" className="text-xl sm:text-2xl font-bold text-gray-900 bg-transparent w-full focus:text-gold outline-none" value={pendingAction.quantity} onChange={e => updatePendingField('quantity', Math.max(1, parseInt(e.target.value) || 0))} />
                     </div>
                     <div className="space-y-0.5 text-left sm:text-right border-t sm:border-t-0 sm:border-l border-gold/5 pt-3 sm:pt-0 sm:pl-6">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gold/40">Unit Rate</span>
                        <div className="flex items-center sm:justify-end gap-1">
                          <IndianRupee size={14} className="text-gray-400" />
                          <input type="number" min="0" className="text-lg sm:text-xl font-bold text-gray-700 bg-transparent text-left sm:text-right w-full focus:text-gold outline-none" value={Math.round(pendingAction.unitPrice || 0)} onChange={e => updatePendingField('unitPrice', Math.max(0, parseInt(e.target.value) || 0))} />
                        </div>
                     </div>
                   </div>
                 ) : null}

                 <div className="pt-3 flex justify-between items-center">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60">Registry Value</span>
                    <div className="flex items-center gap-1">
                      <IndianRupee size={20} className={(pendingAction.action === 'transaction' || pendingAction.action === 'personal_received') ? 'text-green-600' : 'text-red-600'} />
                      <input type="number" min="0" className={`text-3xl font-bold bg-transparent w-full text-right outline-none ${(pendingAction.action === 'transaction' || pendingAction.action === 'personal_received') ? 'text-green-600' : 'text-red-600'}`} value={pendingAction.price || 0} onChange={e => updatePendingField('price', Math.max(0, parseInt(e.target.value) || 0))} />
                    </div>
                 </div>

                 <div className="pt-3 border-t border-gold/10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60">Payment Status</span>
                      <select 
                        className="bg-white border border-gold/10 rounded-xl px-3 py-1.5 text-[10px] font-bold focus:outline-none"
                        value={pendingAction.payment_status || 'PAID'}
                        onChange={e => updatePendingField('payment_status', e.target.value)}
                      >
                        <option value="PAID">PAID (NAGAD)</option>
                        <option value="PENDING">PENDING (UDHAAR)</option>
                      </select>
                    </div>
                    {pendingAction.payment_status === 'PENDING' && (
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60">Customer Name</span>
                        <input 
                          className="text-xs font-bold text-gray-900 bg-white border border-gold/5 rounded-xl px-3 py-1.5 shadow-sm focus:border-gold outline-none" 
                          placeholder="Enter customer name..."
                          value={pendingAction.customer_name || ''} 
                          onChange={e => updatePendingField('customer_name', e.target.value)} 
                        />
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="p-5 md:p-6 pt-0 shrink-0">
              {!stockError ? (
                <button 
                  onClick={confirmAction} 
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-royal-gradient text-white rounded-[20px] font-bold shadow-2xl hover:scale-[1.02] active:scale-95 transition-all text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSubmitting ? 'Sealing...' : 'Seal in Royal Registry'}
                </button>
              ) : (
                <div className="space-y-3">
                   <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-[10px] text-center font-bold">
                     Only {stockError.available} units of {pendingAction.item} remaining.
                   </div>
                   <button onClick={() => setPendingAction(null)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all">Adjust Boli</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className={`fixed inset-y-0 left-0 z-[100] md:relative md:inset-auto md:flex md:flex-col w-72 bg-white border-r border-gold/10 p-6 transform transition-transform duration-300 h-full flex-shrink-0 overflow-y-auto shadow-2xl md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-royal-gradient rounded-lg shadow-lg">
              <Landmark size={20} className="text-white" />
            </div>
            <h1 className="font-heritage font-bold text-xl tracking-tighter text-gray-900 uppercase">MEWAR-SYNC</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-gray-900 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="space-y-2 flex-grow font-heritage">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-royal-gradient text-white shadow-xl shadow-saffron/20' : 'text-gray-400 hover:bg-gold/5'}`}>
              <item.icon size={16} />
              <span className="font-bold text-[11px] uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-gold/5 space-y-4">
          <div className="flex items-center gap-2 px-4 py-2 text-[8px] font-bold uppercase tracking-widest text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Storage: Firebase (Cloud Sync)
          </div>
          
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3.5 text-red-500 font-heritage font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 rounded-xl transition-colors border border-red-100 md:border-none">
            <LogOut size={14} /> Leave Mewar
          </button>
        </div>
      </nav>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90] md:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="flex-1 h-full overflow-hidden flex flex-col relative">
        {(currentUser.role === 'SHOPKEEPER' || currentUser.role === 'VISITOR') && (
          <Header 
            onInquiryClick={() => setShowMessenger(true)} 
            inquiryCount={newInquiriesCount}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
        )}
        
        <main className={`flex-1 h-full overflow-y-auto w-full relative ${
          (currentUser.role === 'VISITOR' && activeTab === 'HERITAGE_FEED') 
            ? 'p-0 max-w-none' 
            : 'px-4 sm:px-6 py-6 md:px-12 max-w-7xl mx-auto'
        }`}>
          {(currentUser.role === 'SHOPKEEPER' || activeTab !== 'HERITAGE_FEED') && (
            <div className="mb-8 md:mb-12">
              <h2 className="text-[9px] md:text-[10px] font-bold text-saffron uppercase tracking-[0.5em] mb-2 md:mb-3">Udaipur Digital Guild</h2>
              <h1 className="text-xl md:text-3xl font-heritage font-bold text-gray-900 tracking-tighter capitalize leading-tight">{activeTab.toLowerCase().replace('_', ' ')}</h1>
            </div>
          )}
          {renderContent()}
        </main>
      </div>
      
      {/* AI Chatbot - Available for all logged in users */}
      <AIChatbot role={currentUser.role} />

      {selectedProduct && (
        <ProductDetail 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}

      {showMessenger && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" 
            onClick={() => {
              setShowMessenger(false);
              setMessengerTargetArtisan(undefined);
            }}
          />
          <div className="bg-white w-[92%] max-w-lg h-[80vh] max-h-[85vh] rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col border-4 border-gold/20 animate-in zoom-in-95 duration-300">
            <Messenger 
              currentUser={currentUser}
              targetArtisan={messengerTargetArtisan}
              onClose={() => {
                setShowMessenger(false);
                setMessengerTargetArtisan(undefined);
                setRefreshKey(k => k + 1);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
