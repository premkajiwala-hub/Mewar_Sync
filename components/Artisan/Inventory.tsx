
import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem } from '../../types';
import { Package, Plus, Trash2, Edit3, Check, X, IndianRupee, Filter, ShoppingBag, Box, Loader2 } from 'lucide-react';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { storage } from '../../services/storage';

export const Inventory: React.FC<{ onUpdate: () => void; onModalToggle?: (isOpen: boolean) => void }> = ({ onUpdate, onModalToggle }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PURCHASED' | 'PRODUCED'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InventoryItem>>({});
  const [showManualForm, setShowManualForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [manualSku, setManualSku] = useState({
    item: '',
    quantity: 0,
    unit_cost: 0,
    is_purchased: false
  });
  const [isMerging, setIsMerging] = useState(false);
  const [hasDuplicates, setHasDuplicates] = useState(false);

  useEffect(() => {
    onModalToggle?.(showManualForm || !!editingId || !!deleteId);
  }, [showManualForm, editingId, deleteId, onModalToggle]);

  useEffect(() => {
    fetchInventory();
  }, []);

  useEffect(() => {
    // Check for duplicates
    const checkDuplicates = () => {
      const seen = new Set();
      for (const item of items) {
        const key = `${item.normalized_name || item.item.toLowerCase()}_${item.is_purchased}_${item.unit_cost}`;
        if (seen.has(key)) {
          setHasDuplicates(true);
          return;
        }
        seen.add(key);
      }
      setHasDuplicates(false);
    };
    if (items.length > 0) checkDuplicates();
  }, [items]);

  const fetchInventory = async () => {
    const data = await storage.getInventory();
    setItems(data);
  };

  const handleMerge = async () => {
    setIsMerging(true);
    try {
      const count = await storage.mergeInventory();
      if (count && count > 0) {
        alert(`Hukumn, ${count} duplicate entries have been merged successfully!`);
      }
      await fetchInventory();
      onUpdate();
    } catch (err) {
      console.error("Merge failed:", err);
    } finally {
      setIsMerging(false);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditForm(item);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm || isSubmitting) return;
    setIsSubmitting(true);
    
    const oldItem = items.find(i => i.id === editingId);
    if (!oldItem) {
      setIsSubmitting(false);
      return;
    }

    // Optimistic Update
    const finalQty = Math.max(0, editForm.quantity || 0);
    const updatedItem = { ...oldItem, ...editForm, quantity: finalQty } as InventoryItem;
    setItems(prev => prev.map(i => i.id === editingId ? updatedItem : i));
    setEditingId(null);

    try {
      await storage.saveInventory({ ...editForm, quantity: finalQty }, 'set');
      await fetchInventory();
      onUpdate();
    } catch (err) {
      console.error("Save edit failed:", err);
      // Rollback
      await fetchInventory();
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || isSubmitting) return;
    setIsSubmitting(true);
    
    // Optimistic Update
    const idToRemove = deleteId;
    setItems(prev => prev.filter(item => item.id !== idToRemove));
    setDeleteId(null);

    try {
      await storage.deleteInventoryItem(idToRemove);
      onUpdate();
    } catch (err) {
      console.error("Inventory deletion failed:", err);
      // Rollback
      await fetchInventory();
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

    // Optimistic Update
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: InventoryItem = {
      ...manualSku,
      id: tempId,
      normalized_name: manualSku.item.toLowerCase()
    };

    setItems(prev => [optimisticItem, ...prev]);
    setShowManualForm(false);
    setManualSku({ item: '', quantity: 0, unit_cost: 0, is_purchased: false });

    try {
      // Use the explicit flag from manualSku to distinguish between produced and purchased
      await storage.saveInventory({
        ...manualSku,
        is_purchased: manualSku.is_purchased 
      }, 'add');
      
      await fetchInventory();
      onUpdate();
    } catch (err) {
      console.error("Manual submit failed:", err);
      // Rollback
      await fetchInventory();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = useMemo(() => items.filter(i => {
    if (filter === 'ALL') return true;
    if (filter === 'PURCHASED') return i.is_purchased;
    if (filter === 'PRODUCED') return !i.is_purchased;
    return true;
  }), [items, filter]);

  const totalValuation = useMemo(() => items.reduce((acc, curr) => acc + (curr.quantity * (curr.unit_cost || 0)), 0), [items]);

  return (
    <div className="font-outfit">
      <div className="space-y-8 animate-in fade-in duration-700 pb-24">
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-6 flex-1 w-full">
            <div className="flex-1 glass-mewar p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-b-8 border-indigo-600 shadow-xl bg-white">
               <p className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest">Total Stock Value</p>
               <div className="flex items-center gap-2 mt-2">
                 <IndianRupee size={20} className="text-indigo-600 md:w-6 md:h-6" />
                 <span className="text-2xl md:text-4xl font-heritage font-bold text-gray-900">{totalValuation.toLocaleString()}</span>
               </div>
            </div>
            <div className="flex-1 glass-mewar p-6 md:p-8 rounded-[32px] md:rounded-[40px] border-b-8 border-gold shadow-xl bg-white">
               <p className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest">Unique SKUs</p>
               <div className="flex items-center gap-2 mt-2">
                 <Package size={20} className="text-gold md:w-6 md:h-6" />
                 <span className="text-2xl md:text-4xl font-heritage font-bold text-gray-900">{items.length}</span>
               </div>
            </div>
        </div>
        
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex bg-white p-1 rounded-2xl border border-gold/20 shadow-sm self-end">
            <button onClick={() => setFilter('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'ALL' ? 'bg-royal-gradient text-white' : 'text-gray-400'}`}>All</button>
            <button onClick={() => setFilter('PURCHASED')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'PURCHASED' ? 'bg-royal-gradient text-white' : 'text-gray-400'}`}>Purchased</button>
            <button onClick={() => setFilter('PRODUCED')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${filter === 'PRODUCED' ? 'bg-royal-gradient text-white' : 'text-gray-400'}`}>Self Produced</button>
          </div>
          <div className="flex gap-4 self-end">
            {hasDuplicates && (
              <button 
                onClick={handleMerge}
                disabled={isMerging}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-amber-500 text-white rounded-3xl font-bold text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl disabled:opacity-50"
              >
                {isMerging ? 'Merging...' : 'Merge Similar Items'}
              </button>
            )}
            <button 
              onClick={() => setShowManualForm(true)}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-3xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl"
            >
              <Plus size={18} /> Add New SKU
            </button>
          </div>
        </div>
      </div>

      <div className="glass-mewar rounded-[40px] shadow-2xl overflow-hidden border border-gold/10 bg-white">
        <div className="p-10 border-b border-gold/10 flex justify-between items-center bg-indigo-50/20">
           <div>
             <h3 className="text-3xl font-heritage font-bold text-gray-900">Inventory Registry</h3>
             <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-1">Stock Records • {filter} Filtered</p>
           </div>
           <Package size={24} className="text-indigo-600" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gold/5">
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest">Item Description</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Source</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Stock Level</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Unit Cost</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-right">Total Value</th>
                <th className="p-8 text-[10px] font-heritage font-bold uppercase text-gold/60 tracking-widest text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/5">
              {filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="p-24 text-center text-gray-300 italic font-heritage">No stock items match this filter.</td></tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-indigo-50/10 transition-colors group">
                    <td className="p-8">
                      {editingId === item.id ? (
                        <input className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-full text-sm" value={editForm.item || ''} onChange={e => setEditForm({...editForm, item: e.target.value})} />
                      ) : (
                        <div className="flex flex-col">
                          <p className="font-bold text-gray-800 capitalize text-lg line-clamp-1">{item.item}</p>
                          {item.quantity === 0 && <span className="text-[8px] font-bold text-red-600 uppercase tracking-widest">Out of Stock!</span>}
                        </div>
                      )}
                    </td>
                    <td className="p-8 text-center">
                       <span className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest flex items-center justify-center gap-1 border mx-auto w-fit ${item.is_purchased ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                         {item.is_purchased ? <ShoppingBag size={10} /> : <Box size={10} />}
                         {item.is_purchased ? 'Purchased' : 'Self Produced'}
                       </span>
                    </td>
                    <td className="p-8 text-center">
                      {editingId === item.id ? (
                        <input 
                          type="number" 
                          min="0"
                          className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-16 text-center" 
                          value={editForm.quantity || 0} 
                          onChange={e => setEditForm({...editForm, quantity: Math.max(0, parseInt(e.target.value) || 0)})} 
                        />
                      ) : (
                        <span className={`font-heritage font-bold text-xl ${item.quantity === 0 ? 'text-red-600 animate-pulse' : item.quantity < 5 ? 'text-amber-500' : 'text-gray-600'}`}>
                          {item.quantity}
                        </span>
                      )}
                    </td>
                    <td className="p-8 text-center font-heritage">
                      {editingId === item.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-gray-400">₹</span>
                          <input type="number" className="bg-white border border-gold/20 rounded-lg px-3 py-2 w-24 text-center" value={editForm.unit_cost || 0} onChange={e => setEditForm({...editForm, unit_cost: parseInt(e.target.value) || 0})} />
                        </div>
                      ) : (
                        <span>₹{(item.unit_cost || 0).toLocaleString()}</span>
                      )}
                    </td>
                    <td className="p-8 text-right font-heritage font-bold text-2xl text-indigo-600">
                      ₹{(item.quantity * item.unit_cost).toLocaleString()}
                    </td>
                    <td className="p-8">
                      <div className="flex justify-center gap-3">
                        {editingId === item.id ? (
                          <button 
                            onClick={saveEdit} 
                            disabled={isSubmitting}
                            className="p-3 bg-green-500 text-white rounded-xl shadow-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                          >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                          </button>
                        ) : (
                          <>
                            <button onClick={() => startEdit(item)} className="p-3 text-indigo-400 hover:bg-indigo-50 rounded-xl transition-all"><Edit3 size={18} /></button>
                            <button 
                              onClick={(e) => handleDelete(e, item.id)} 
                              className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shadow-sm active:scale-90 z-20 cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 size={20} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
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
          <div className="glass-mewar max-w-lg w-full p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-2xl border-2 border-gold/30 bg-white relative overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300 scrollbar-hide">
              <button onClick={() => setShowManualForm(false)} className="absolute top-8 right-8 text-gray-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
              
              <div className="text-center mb-10 font-heritage">
                <h3 className="text-3xl font-bold text-gray-900 uppercase">New Inventory SKU</h3>
                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-1">Registry Update</p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-6 font-heritage">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Item Description</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g., Red Pigment Box"
                    className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:border-indigo-600"
                    value={manualSku.item}
                    onChange={e => setManualSku({ ...manualSku, item: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Stock Source</label>
                  <div className="flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setManualSku({...manualSku, is_purchased: false})}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-[10px] uppercase tracking-widest transition-all ${!manualSku.is_purchased ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}
                    >
                      Self Produced
                    </button>
                    <button 
                      type="button"
                      onClick={() => setManualSku({...manualSku, is_purchased: true})}
                      className={`flex-1 py-3 rounded-xl border-2 font-bold text-[10px] uppercase tracking-widest transition-all ${manualSku.is_purchased ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white text-gray-400 border-gray-100'}`}
                    >
                      Purchased Item
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Initial Stock</label>
                    <input 
                      required
                      type="number" 
                      min="0"
                      className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:border-indigo-600"
                      value={manualSku.quantity}
                      onChange={e => setManualSku({ ...manualSku, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Unit Cost</label>
                    <input 
                      required
                      type="number" 
                      className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 px-4 text-sm focus:outline-none focus:border-indigo-600"
                      value={manualSku.unit_cost}
                      onChange={e => setManualSku({ ...manualSku, unit_cost: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-4 bg-indigo-600 text-white rounded-3xl font-bold shadow-2xl transition-all uppercase text-xs tracking-widest hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : null}
                  Confirm SKU Entry
                </button>
              </form>
           </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Remove SKU"
        message="Hukumn, are you sure you want to remove this item from the royal inventory registry?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        type="danger"
        isLoading={isSubmitting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      </div>
    </div>
  );
};
