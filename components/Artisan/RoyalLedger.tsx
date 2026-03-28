
import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storage';
import { LedgerEntry, EntryCategory, EntryType, InventoryItem, PaymentStatus } from '../../types';
import { History, Save, Trash2, IndianRupee, Edit3, Check, Users, ShoppingBag, Filter, Plus, X, Landmark, Wallet, AlertCircle, TrendingUp, TrendingDown, Info, Loader2 } from 'lucide-react';
import { ConfirmationModal } from '../UI/ConfirmationModal';

interface RoyalLedgerProps {
  onUpdate: () => void;
  onModalToggle?: (isOpen: boolean) => void;
}

export const RoyalLedger: React.FC<RoyalLedgerProps> = ({ onUpdate, onModalToggle }) => {
  const getLocalYYYYMMDD = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(getLocalYYYYMMDD());
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<EntryCategory>('BUSINESS');
  const [businessFilter, setBusinessFilter] = useState<'ALL' | 'SALE' | 'BUSINESS_EXPENSE' | 'OTHER_EXPENSE'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<LedgerEntry>>({});
  const [showManualForm, setShowManualForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localStockError, setLocalStockError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });
  
  const [manualEntry, setManualEntry] = useState({
    item: '',
    quantity: 1,
    unit_price: 0,
    amount: 0,
    type: 'SALE' as EntryType,
    payment_status: 'PAID' as PaymentStatus,
    customer_name: '',
    is_purchased: false
  });

  useEffect(() => {
    onModalToggle?.(showManualForm || !!editingId || !!deleteId || modalConfig.isOpen);
  }, [showManualForm, editingId, deleteId, modalConfig.isOpen, onModalToggle]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchLedger(),
        fetchAllLedgerData(),
        fetchInventory(),
        fetchAvailableDates()
      ]);
    };
    loadData();
  }, [selectedDate]); // Only re-fetch on date change. activeCategory and businessFilter can be handled by local filtering if possible, but for now let's just reduce the triggers.

  // Actually, fetchLedger depends on activeCategory, so we need that.
  // But we can fetch ALL ledger data once and filter locally.
  
  useEffect(() => {
    fetchLedger();
  }, [activeCategory, businessFilter, selectedDate]);

  // Reset error when manual entry fields change to ensure real-time feedback
  useEffect(() => {
    setLocalStockError(null);
  }, [manualEntry.item, manualEntry.quantity, manualEntry.type]);

  const fetchAvailableDates = async () => {
    const dates = await storage.getAvailableDates();
    setAvailableDates(dates);
  };

  const fetchLedger = async () => {
    const data = await storage.getLedger(activeCategory, selectedDate);
    setEntries(data);
  };

  const fetchInventory = async () => {
    const data = await storage.getInventory();
    setInventory(data);
  };

  const fetchAllLedgerData = async () => {
    const [biz, pers] = await Promise.all([
      storage.getLedger('BUSINESS', selectedDate),
      storage.getLedger('PERSONAL', selectedDate)
    ]);
    setAllEntries([...biz, ...pers]);
  };

  const startEdit = (entry: LedgerEntry) => {
    setEditingId(entry.id);
    setEditForm(entry);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm || isSubmitting) return;
    setIsSubmitting(true);
    
    const oldEntry = entries.find(e => e.id === editingId);
    if (!oldEntry) {
      setIsSubmitting(false);
      return;
    }

    // Optimistic Update
    const q = activeCategory === 'BUSINESS' ? Math.max(0, editForm.quantity || 1) : 1;
    const u = activeCategory === 'BUSINESS' ? Math.max(0, editForm.unit_price || 0) : Math.max(0, editForm.amount || 0);
    const amount = editForm.amount !== undefined ? Math.max(0, editForm.amount) : (activeCategory === 'BUSINESS' ? (q * u) : u);
    
    const updatedEntry = { ...oldEntry, ...editForm, quantity: q, unit_price: u, amount } as LedgerEntry;
    
    setEntries(prev => prev.map(e => e.id === editingId ? updatedEntry : e));
    setAllEntries(prev => prev.map(e => e.id === editingId ? updatedEntry : e));
    setEditingId(null);

    try {
      if (activeCategory === 'BUSINESS' && editForm.type === 'SALE' && editForm.item) {
        const invItem = await storage.findInventoryItemByName(editForm.item);
        
        // Calculate the difference in quantity
        const oldQty = oldEntry.quantity || 0;
        const newQty = editForm.quantity || 1;
        const diff = newQty - oldQty;

        if (diff > 0 && (!invItem || invItem.quantity < diff)) {
          setModalConfig({
            isOpen: true,
            title: "Insufficient Stock",
            message: `Hukumn, ${editForm.item} only has ${invItem?.quantity || 0} units in inventory. Cannot increase sale quantity by ${diff}.`,
            type: 'alert'
          });
          // Rollback optimistic update
          await fetchLedger();
          await fetchAllLedgerData();
          setIsSubmitting(false);
          return;
        }

        // Update inventory if quantity changed
        if (diff !== 0) {
          await storage.saveInventory(
            { item: editForm.item, quantity: Math.abs(diff) }, 
            diff > 0 ? 'remove' : 'add'
          );
        }
      }

      await storage.updateLedgerEntry(editingId, { ...editForm, quantity: q, unit_price: u, amount });
      await fetchLedger();
      await fetchAllLedgerData();
      await fetchInventory();
      onUpdate();
    } catch (err) {
      console.error("Save edit failed:", err);
      // Rollback on error
      await fetchLedger();
      await fetchAllLedgerData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || isSubmitting) return;
    setIsSubmitting(true);
    
    // Optimistic Update
    const idToRemove = deleteId;
    setEntries(prev => prev.filter(entry => entry.id !== idToRemove));
    setAllEntries(prev => prev.filter(entry => entry.id !== idToRemove));
    setDeleteId(null);

    try {
      console.log("Attempting to delete entry:", idToRemove);
      await storage.deleteLedgerEntry(idToRemove);
      onUpdate();
    } catch (err) {
      console.error("Delete failed:", err);
      // Rollback on error
      await fetchLedger();
      await fetchAllLedgerData();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteId(id);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setLocalStockError(null);

    const finalAmount = activeCategory === 'BUSINESS' ? (manualEntry.quantity * manualEntry.unit_price) : manualEntry.amount;
    
    const entryData = {
      category: activeCategory,
      item: manualEntry.item,
      quantity: activeCategory === 'BUSINESS' ? manualEntry.quantity : 1,
      unit_price: activeCategory === 'BUSINESS' ? manualEntry.unit_price : (manualEntry.amount / 1),
      amount: finalAmount,
      type: manualEntry.type,
      payment_status: manualEntry.payment_status,
      customer_name: manualEntry.customer_name,
      is_purchased: manualEntry.is_purchased
    };

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticEntry: LedgerEntry = {
      ...entryData,
      id: tempId,
      created_at: new Date().toISOString(),
      shop_id: storage.getCurrentUser()?.id || ''
    };

    setEntries(prev => [optimisticEntry, ...prev]);
    setAllEntries(prev => [optimisticEntry, ...prev]);
    setShowManualForm(false);
    setManualEntry({ 
      item: '', 
      quantity: 1, 
      unit_price: 0, 
      amount: 0, 
      type: activeCategory === 'BUSINESS' ? 'SALE' : 'PERSONAL_RECEIVED',
      payment_status: 'PAID',
      customer_name: '',
      is_purchased: false
    });

    try {
      if (activeCategory === 'BUSINESS' && manualEntry.type === 'SALE') {
        const invItem = await storage.findInventoryItemByName(manualEntry.item, manualEntry.is_purchased);
        if (!invItem || invItem.quantity < manualEntry.quantity) {
          setLocalStockError(`Insufficient Stock! Only ${invItem?.quantity || 0} available for ${manualEntry.item} (${manualEntry.is_purchased ? 'Purchased' : 'Self Produced'}).`);
          // Rollback
          await fetchLedger();
          await fetchAllLedgerData();
          setIsSubmitting(false);
          setShowManualForm(true);
          return;
        }
      }

      if (entryData.payment_status === 'PENDING') {
        await storage.saveUdhaar(entryData);
      } else {
        await storage.saveLedger(entryData);
      }

      if (activeCategory === 'BUSINESS') {
        if (manualEntry.type === 'SALE') {
          await storage.saveInventory({ item: manualEntry.item, quantity: manualEntry.quantity, is_purchased: manualEntry.is_purchased }, 'remove');
        } else if (manualEntry.type === 'BUSINESS_EXPENSE') {
          await storage.saveInventory({ 
            item: manualEntry.item, 
            quantity: manualEntry.quantity,
            unit_cost: manualEntry.unit_price,
            is_purchased: manualEntry.is_purchased
          }, 'add');
        }
      }

      await fetchLedger();
      await fetchAllLedgerData();
      await fetchInventory();
      onUpdate();
    } catch (err) {
      console.error("Manual submit failed:", err);
      // Rollback
      await fetchLedger();
      await fetchAllLedgerData();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logic for detailed profit/loss on sales of purchased items
  const getProfitLoss = (entry: LedgerEntry) => {
    if (entry.type !== 'SALE') return null;
    const invItem = inventory.find(i => i.item.toLowerCase() === entry.item.toLowerCase());
    if (!invItem || !invItem.is_purchased) return null;

    const cost = invItem.unit_cost * entry.quantity;
    const profit = entry.amount - cost;
    return {
      costPerUnit: invItem.unit_cost,
      totalCost: cost,
      profit: profit,
      isProfit: profit >= 0
    };
  };

  const calculateBusinessSummary = () => {
    const sales = entries.filter(e => e.type === 'SALE').reduce((a, c) => a + c.amount, 0);
    const stockExpenses = entries.filter(e => e.type === 'BUSINESS_EXPENSE').reduce((a, c) => a + c.amount, 0);
    const otherExpenses = entries.filter(e => e.type === 'OTHER_EXPENSE').reduce((a, c) => a + c.amount, 0);
    
    // Total profit logic (Revenue - Expenses)
    const totalProfit = sales - (stockExpenses + otherExpenses);
    return { sales, stockExpenses, otherExpenses, totalProfit };
  };

  const calculatePersonalSummary = () => {
    const received = entries.filter(e => e.type === 'PERSONAL_RECEIVED').reduce((a, c) => a + c.amount, 0);
    const paid = entries.filter(e => e.type === 'PERSONAL_PAID').reduce((a, c) => a + c.amount, 0);
    return { received, paid };
  };

  const calculateFinalRokda = () => {
    // For "Final Rokda" of a specific day, we might want the cumulative balance up to that day.
    // However, the user request implies a daily reset and storage.
    // Let's show the cumulative balance up to the selected date.
    
    // To do this properly, we'd need to fetch ALL entries up to selectedDate.
    // For now, let's keep it simple and show the balance for the selected day's transactions if they want "reseted" ledger.
    // But "Rokda" usually means cash on hand.
    
    const totalIn = allEntries
      .filter(l => l.type === 'SALE' || l.type === 'PERSONAL_RECEIVED')
      .reduce((a, c) => a + (c.amount || 0), 0);
    const totalOut = allEntries
      .filter(l => l.type === 'BUSINESS_EXPENSE' || l.type === 'PERSONAL_PAID' || l.type === 'OTHER_EXPENSE')
      .reduce((a, c) => a + (c.amount || 0), 0);
    return totalIn - totalOut;
  };

  const businessSummary = React.useMemo(() => calculateBusinessSummary(), [entries]);
  const personalSummary = React.useMemo(() => calculatePersonalSummary(), [entries]);
  const finalRokda = React.useMemo(() => calculateFinalRokda(), [allEntries]);

  const displayedEntries = React.useMemo(() => entries.filter(entry => {
    if (activeCategory === 'PERSONAL') return true;
    if (businessFilter === 'ALL') return true;
    return entry.type === businessFilter;
  }), [entries, activeCategory, businessFilter]);

  // Reference cost helper - Optimized to return all matches
  const getInventoryReferences = (itemName: string) => {
    if (!itemName || itemName.length < 2) return [];
    const search = itemName.toLowerCase();
    return inventory.filter(i => {
      return i.item.toLowerCase().includes(search) || 
             (i.normalized_name && i.normalized_name.includes(search));
    });
  };

  return (
    <div className="font-outfit">
      <div className="space-y-8 animate-in fade-in duration-700 pb-24">
      <div className="glass-mewar p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] border-b-8 border-saffron shadow-2xl bg-white relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12 group-hover:rotate-45 transition-transform duration-1000">
            <Wallet size={160} />
         </div>
         <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <Landmark size={12} className="text-saffron" /> Unified Financial Standing
              </p>
              <h4 className="text-xl sm:text-2xl md:text-3xl font-heritage font-bold text-gray-900 uppercase">Final Rokda Available</h4>
            </div>
            <div className={`flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-3xl border-2 ${finalRokda >= 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
               <IndianRupee size={24} className="opacity-50 sm:w-8 sm:h-8" />
               <span className="text-3xl sm:text-4xl md:text-5xl font-heritage font-bold">{Math.abs(finalRokda).toLocaleString()}</span>
               <span className="text-[10px] font-bold uppercase tracking-widest ml-2 opacity-60">{finalRokda >= 0 ? 'Surplus' : 'Deficit'}</span>
            </div>
         </div>
      </div>

      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 mb-2 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button 
          onClick={() => { setActiveCategory('BUSINESS'); setBusinessFilter('ALL'); setManualEntry(prev => ({ ...prev, type: 'SALE' })); }}
          className={`flex-1 min-w-[160px] snap-center py-4 rounded-3xl font-heritage font-bold flex items-center justify-center gap-3 transition-all border-2 ${
            activeCategory === 'BUSINESS' ? 'bg-royal-gradient border-gold text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400'
          }`}
        >
          <ShoppingBag size={20} /> Business Bahi
        </button>
        <button 
          onClick={() => { setActiveCategory('PERSONAL'); setManualEntry(prev => ({ ...prev, type: 'PERSONAL_RECEIVED' })); }}
          className={`flex-1 min-w-[160px] snap-center py-4 rounded-3xl font-heritage font-bold flex items-center justify-center gap-3 transition-all border-2 ${
            activeCategory === 'PERSONAL' ? 'bg-amber-500 border-amber-500 text-white shadow-xl' : 'bg-white border-gray-100 text-gray-400'
          }`}
        >
          <Users size={20} /> Personal Udhari
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-grow md:flex-grow-0">
              <input 
                type="date" 
                className="w-full bg-white border border-gold/10 rounded-2xl py-3 px-5 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-gold shadow-sm"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            {availableDates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">Quick History:</span>
                <select 
                  className="bg-white border border-gold/10 rounded-2xl py-3 px-4 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-gold shadow-sm"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                >
                  <option value={getLocalYYYYMMDD()}>Today</option>
                  {availableDates.filter(d => d !== getLocalYYYYMMDD()).map(date => (
                    <option key={date} value={date}>
                      {(() => {
                        const [y, m, d] = date.split('-').map(Number);
                        return new Date(y, m - 1, d).toLocaleDateString('en-IN', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        });
                      })()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeCategory === 'BUSINESS' ? (
            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-gold/10 shadow-sm overflow-x-auto no-scrollbar">
               <div className="px-3 py-1 flex items-center gap-2 border-r border-gold/10 mr-1 shrink-0">
                 <Filter size={14} className="text-gold" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Filter</span>
               </div>
               <button onClick={() => setBusinessFilter('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${businessFilter === 'ALL' ? 'bg-royal-gradient text-white shadow-md' : 'text-gray-400 hover:bg-gold/5'}`}>All</button>
               <button onClick={() => setBusinessFilter('SALE')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${businessFilter === 'SALE' ? 'bg-green-500 text-white shadow-md' : 'text-gray-400 hover:bg-green-50'}`}>Sales</button>
               <button onClick={() => setBusinessFilter('BUSINESS_EXPENSE')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${businessFilter === 'BUSINESS_EXPENSE' ? 'bg-red-500 text-white shadow-md' : 'text-gray-400 hover:bg-red-50'}`}>Stock</button>
               <button onClick={() => setBusinessFilter('OTHER_EXPENSE')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 ${businessFilter === 'OTHER_EXPENSE' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-400 hover:bg-amber-50'}`}>Other Exp</button>
            </div>
          ) : (
            <div className="flex items-center gap-6 px-8 py-4 bg-amber-50 rounded-2xl border border-amber-100">
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Total Received</p>
                <p className="text-2xl font-heritage font-bold text-green-600">₹{personalSummary.received.toLocaleString()}</p>
              </div>
              <div className="w-px h-10 bg-amber-200" />
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Total Given</p>
                <p className="text-2xl font-heritage font-bold text-red-600">₹{personalSummary.paid.toLocaleString()}</p>
              </div>
            </div>
          )}

          <button 
            onClick={() => { setLocalStockError(null); setShowManualForm(true); }}
            className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl"
          >
            <Plus size={18} /> New Entry
          </button>
      </div>

      <div className="glass-mewar rounded-[40px] shadow-2xl overflow-hidden border border-gold/10 bg-white">
        <div className="p-6 sm:p-10 border-b border-gold/10 flex justify-between items-center bg-gray-50/50">
           <div>
             <h3 className="text-xl sm:text-2xl md:text-3xl font-heritage font-bold text-gray-900">
               {activeCategory === 'BUSINESS' ? 'Business Registry' : 'Personal Audit'}
             </h3>
             <p className="text-[10px] font-bold text-gold uppercase tracking-widest mt-1">Official Bahi-Khata Ledger</p>
           </div>
           <History size={24} className="text-gold" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gold/5">
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest">Date</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest">Description</th>
                {activeCategory === 'BUSINESS' && (
                  <>
                    <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Qty</th>
                    <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Rate</th>
                  </>
                )}
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-right">Amount</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/5">
              {displayedEntries.length === 0 ? (
                <tr><td colSpan={6} className="p-24 text-center text-gray-300 italic font-heritage">No entries found.</td></tr>
              ) : (
                <>
                  {displayedEntries.map((entry) => {
                    const pl = getProfitLoss(entry);
                    return (
                      <tr key={entry.id} className="hover:bg-gold/5 transition-colors group">
                        <td className="p-8 text-xs text-gray-400 font-bold">{new Date(entry.created_at).toLocaleDateString()}</td>
                        <td className="p-8">
                          {editingId === entry.id ? (
                            <div className="space-y-1">
                              <input className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-full text-sm font-bold" value={editForm.item || ''} onChange={e => setEditForm({...editForm, item: e.target.value})} />
                              <input className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-full text-xs" placeholder="Customer Name" value={editForm.customer_name || ''} onChange={e => setEditForm({...editForm, customer_name: e.target.value})} />
                              {getInventoryReferences(editForm.item || '').length > 0 && (
                                <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 mt-1">
                                  <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest mb-1">Stock Matches:</p>
                                  {getInventoryReferences(editForm.item || '').map((ref, idx) => (
                                    <p key={idx} className="text-[9px] font-bold text-gray-600 flex justify-between">
                                      <span>{ref.item} ({ref.is_purchased ? 'P' : 'S'}):</span>
                                      <span>{ref.quantity}u @ ₹{ref.unit_cost}</span>
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <p className="font-bold text-gray-800 capitalize text-lg line-clamp-1">
                                {entry.item}
                              </p>
                              {entry.customer_name && (
                                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Customer: {entry.customer_name}</p>
                              )}
                              <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${
                                  entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED' ? 'text-green-500' : 
                                  entry.type === 'OTHER_EXPENSE' ? 'text-amber-600' : 'text-red-400'
                                }`}>
                                  {entry.type.replace('_', ' ')}
                                </span>
                                {pl && (
                                  <span className={`text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 ${pl.isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                    {pl.isProfit ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                    {pl.isProfit ? 'Profit' : 'Loss'}: ₹{Math.abs(pl.profit).toLocaleString()}
                                    <span className="text-[7px] text-gray-300 normal-case ml-1">(Cost: ₹{pl.costPerUnit}/u)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        {activeCategory === 'BUSINESS' && (
                          <>
                            <td className="p-8 text-center">
                              {editingId === entry.id ? (
                                <input 
                                  type="number" 
                                  min="1"
                                  className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-16 text-center text-sm" 
                                  value={editForm.quantity || 1} 
                                  onChange={e => {
                                    const q = Math.max(1, parseInt(e.target.value) || 0);
                                    const u = editForm.unit_price || 0;
                                    setEditForm({...editForm, quantity: q, amount: q * u});
                                  }} 
                                />
                              ) : (
                                <span className="font-heritage font-bold text-gray-600 text-xl">{entry.quantity}</span>
                              )}
                            </td>
                            <td className="p-8 text-center font-heritage">
                              {editingId === entry.id ? (
                                <input 
                                  type="number" 
                                  className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-24 text-center text-sm" 
                                  value={editForm.unit_price || 0} 
                                  onChange={e => {
                                    const u = parseInt(e.target.value) || 0;
                                    const q = editForm.quantity || 1;
                                    setEditForm({...editForm, unit_price: u, amount: q * u});
                                  }} 
                                />
                              ) : (
                                <>₹{(entry.unit_price || 0).toLocaleString()}</>
                              )}
                            </td>
                          </>
                        )}
                        <td className={`p-8 text-right font-heritage font-bold text-2xl shrink-0 ${
                          entry.type.includes('SALE') || entry.type.includes('RECEIVED') ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {editingId === entry.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <span>{entry.type.includes('SALE') || entry.type.includes('RECEIVED') ? '+' : '-'} ₹</span>
                              <input 
                                type="number" 
                                className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-32 text-right text-sm" 
                                value={editForm.amount || 0} 
                                onChange={e => {
                                  const newAmount = parseInt(e.target.value) || 0;
                                  const q = editForm.quantity || 1;
                                  setEditForm({
                                    ...editForm, 
                                    amount: newAmount,
                                    unit_price: activeCategory === 'BUSINESS' ? (newAmount / q) : newAmount
                                  });
                                }} 
                              />
                            </div>
                          ) : (
                            <>{entry.type.includes('SALE') || entry.type.includes('RECEIVED') ? '+' : '-'} ₹{entry.amount.toLocaleString()}</>
                          )}
                        </td>
                        <td className="p-8">
                          <div className="flex justify-center gap-3">
                            {editingId === entry.id ? (
                              <button 
                                onClick={saveEdit} 
                                disabled={isSubmitting}
                                className="p-3 bg-green-500 text-white rounded-xl shadow-lg hover:scale-110 active:scale-90 transition-all disabled:opacity-50"
                              >
                                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                              </button>
                            ) : (
                              <>
                                <button onClick={() => startEdit(entry)} className="p-3 text-gold hover:bg-gold/10 rounded-xl transition-all"><Edit3 size={18} /></button>
                                <button 
                                  onClick={(e) => handleDelete(e, entry.id)} 
                                  className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm active:scale-90 z-20 cursor-pointer"
                                  title="Delete Entry"
                                >
                                  <Trash2 size={20} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {activeCategory === 'BUSINESS' && (
                    <tr className="bg-gray-900 text-white font-heritage">
                       <td colSpan={4} className="p-8 font-bold uppercase tracking-widest text-xs">Royal Summary (Revenue Analysis)</td>
                       <td className="p-8 text-right font-bold">
                          <div className="space-y-1">
                             <div className="flex justify-between text-[10px] text-green-400"><span>Total Sales:</span> <span>₹{businessSummary.sales.toLocaleString()}</span></div>
                             <div className="flex justify-between text-[10px] text-red-400"><span>Stock Cost:</span> <span>₹{businessSummary.stockExpenses.toLocaleString()}</span></div>
                             <div className="flex justify-between text-[10px] text-amber-400"><span>Other Exp:</span> <span>₹{businessSummary.otherExpenses.toLocaleString()}</span></div>
                             <div className={`flex justify-between text-lg border-t border-white/20 pt-2 ${businessSummary.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                               <span>{businessSummary.totalProfit >= 0 ? 'NET PROFIT:' : 'NET LOSS:'}</span>
                               <span>₹{Math.abs(businessSummary.totalProfit).toLocaleString()}</span>
                             </div>
                          </div>
                       </td>
                       <td></td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showManualForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setShowManualForm(false)}
          />
          <div className="glass-mewar max-w-md w-full p-6 md:p-8 rounded-[32px] shadow-2xl border-2 border-gold/30 bg-white relative overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300 scrollbar-hide">
              <button onClick={() => setShowManualForm(false)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
              
              <div className="text-center mb-6 font-heritage">
                <h3 className="text-2xl font-bold text-gray-900 uppercase">Manual Entry</h3>
                <p className="text-[9px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Registry Update</p>
              </div>

              {localStockError && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-amber-800 text-[10px] font-bold">
                    <AlertCircle size={14} /> {localStockError}
                </div>
              )}

              <form onSubmit={handleManualSubmit} className="space-y-4 font-heritage">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Entry Type</label>
                  <select 
                    className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                    value={manualEntry.type}
                    onChange={e => { setLocalStockError(null); setManualEntry({ ...manualEntry, type: e.target.value as EntryType }); }}
                  >
                    {activeCategory === 'BUSINESS' ? (
                      <>
                        <option value="SALE">Business Sale (Income)</option>
                        <option value="BUSINESS_EXPENSE">Stock/Supply Purchase (Expense)</option>
                        <option value="OTHER_EXPENSE">Other (Wage, Rent, Bill)</option>
                      </>
                    ) : (
                      <>
                        <option value="PERSONAL_RECEIVED">Received from Person (Credit)</option>
                        <option value="PERSONAL_PAID">Paid to Person (Debit)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Description</label>
                  <div className="relative">
                    <input 
                      required
                      type="text" 
                      placeholder={manualEntry.type === 'OTHER_EXPENSE' ? "e.g., 10 Labour Wages" : "e.g., Pichwai Painting"}
                      className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                      value={manualEntry.item}
                      onChange={e => {
                        setLocalStockError(null);
                        setManualEntry({ ...manualEntry, item: e.target.value });
                      }}
                    />
                    {getInventoryReferences(manualEntry.item).length > 0 && (
                      <div className="absolute top-full left-0 w-full z-50 mt-1 bg-white border border-gold/20 rounded-xl shadow-2xl p-3 max-h-32 overflow-y-auto">
                        <p className="text-[8px] font-bold text-gold uppercase tracking-widest mb-1.5">Stock Suggestions:</p>
                        <div className="space-y-1.5">
                          {getInventoryReferences(manualEntry.item).map((ref, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setManualEntry({
                                  ...manualEntry,
                                  item: ref.item,
                                  is_purchased: ref.is_purchased,
                                  unit_price: manualEntry.type === 'SALE' ? (manualEntry.unit_price || ref.unit_cost * 1.5) : ref.unit_cost
                                });
                              }}
                              className="w-full text-left p-1.5 hover:bg-gold/5 rounded-lg border border-transparent hover:border-gold/10 transition-all"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-800">{ref.item}</span>
                                <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded-full ${ref.is_purchased ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                                  {ref.is_purchased ? 'PURCHASED' : 'SELF'}
                                </span>
                              </div>
                              <div className="flex justify-between text-[8px] text-gray-500 mt-0.5">
                                <span>Stock: <span className="font-bold text-gray-900">{ref.quantity} units</span></span>
                                <span>Cost: <span className="font-bold text-gray-900">₹{ref.unit_cost}</span></span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {activeCategory === 'BUSINESS' && manualEntry.type === 'BUSINESS_EXPENSE' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Stock Source</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setManualEntry({ ...manualEntry, is_purchased: false })}
                        className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold transition-all ${!manualEntry.is_purchased ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}
                      >
                        Self Produced
                      </button>
                      <button
                        type="button"
                        onClick={() => setManualEntry({ ...manualEntry, is_purchased: true })}
                        className={`flex-1 py-2 px-3 rounded-lg text-[10px] font-bold transition-all ${manualEntry.is_purchased ? 'bg-gray-900 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200'}`}
                      >
                        Purchased
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Customer (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Manmohan"
                      className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                      value={manualEntry.customer_name}
                      onChange={e => setManualEntry({ ...manualEntry, customer_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Payment Status</label>
                    <select 
                      className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                      value={manualEntry.payment_status}
                      onChange={e => setManualEntry({ ...manualEntry, payment_status: e.target.value as PaymentStatus })}
                    >
                      <option value="PAID">Paid (Jama)</option>
                      <option value="PENDING">Udhaar (Baaki)</option>
                    </select>
                  </div>
                </div>

                {activeCategory === 'BUSINESS' ? (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Quantity</label>
                      <input 
                        required
                        type="number" 
                        min="1"
                        className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                        value={manualEntry.quantity}
                        onChange={e => {
                          setLocalStockError(null);
                          setManualEntry({ ...manualEntry, quantity: Math.max(1, parseInt(e.target.value) || 1) });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Unit Price / Cost</label>
                      <input 
                        required
                        type="number" 
                        className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                        value={manualEntry.unit_price}
                        onChange={e => setManualEntry({ ...manualEntry, unit_price: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Amount</label>
                    <input 
                      required
                      type="number" 
                      className="w-full bg-gray-50 border border-gold/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-gold"
                      value={manualEntry.amount}
                      onChange={e => setManualEntry({ ...manualEntry, amount: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={!!localStockError || isSubmitting}
                  className={`w-full py-3 text-white rounded-2xl font-bold shadow-xl transition-all uppercase text-[10px] tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 ${
                    activeCategory === 'BUSINESS' ? 'bg-royal-gradient shadow-saffron/30' : 'bg-amber-600 shadow-amber-200'
                  }`}
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
                  Confirm Registry Entry
                </button>
              </form>

           </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete Entry"
        message="Hukumn, are you sure you want to permanently delete this entry from the bahi-khata?"
        confirmLabel="Delete"
        cancelLabel="Keep"
        type="danger"
        isLoading={isSubmitting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        isLoading={isSubmitting}
        confirmLabel="Dhanyawad"
        onConfirm={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
      </div>
    </div>
  );
};
