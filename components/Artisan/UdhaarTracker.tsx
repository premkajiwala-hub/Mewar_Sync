
import React, { useEffect, useState } from 'react';
import { IndianRupee, User, Calendar, CheckCircle, Clock, Search, Filter, AlertCircle } from 'lucide-react';
import { storage } from '../../services/storage';
import { LedgerEntry } from '../../types';
import { ConfirmationModal } from '../UI/ConfirmationModal';

export const UdhaarTracker: React.FC<{ onModalToggle?: (isOpen: boolean) => void }> = ({ onModalToggle }) => {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; entryId: string | null }>({
    isOpen: false,
    entryId: null
  });

  useEffect(() => {
    onModalToggle?.(modalConfig.isOpen);
  }, [modalConfig.isOpen, onModalToggle]);

  useEffect(() => {
    fetchUdhaar();
  }, []);

  const fetchUdhaar = async () => {
    setLoading(true);
    const data = await storage.getUdhaarEntries();
    setEntries(data);
    setLoading(false);
  };

  const handleMarkAsPaid = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry || isSubmitting) return;
    setIsSubmitting(true);

    // Optimistic Update
    setEntries(prev => prev.filter(e => e.id !== id));
    setModalConfig({ isOpen: false, entryId: null });

    try {
      // 1. Create a NEW entry in the ledger collection
      await storage.saveLedger({
        type: entry.type || 'SALE',
        category: entry.category || 'BUSINESS',
        item: entry.item,
        quantity: entry.quantity,
        unit_price: entry.unit_price,
        amount: entry.amount,
        payment_status: 'PAID',
        customer_name: entry.customer_name
      });

      // 2. Delete the document from the udhaar collection
      await storage.deleteUdhaarEntry(id);
      await fetchUdhaar();
    } catch (error) {
      console.error("Failed to settle udhaar:", error);
      // Rollback
      await fetchUdhaar();
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEntries = entries.filter(e => 
    (e.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.item || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalDues = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-white p-8 rounded-[40px] border border-gold/10 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-heritage font-bold text-gray-900">Udhaar Khata</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Track pending payments from customers</p>
        </div>
        <div className="bg-red-50 px-8 py-4 rounded-3xl border border-red-100 flex items-center gap-4">
          <div className="p-3 bg-red-500 rounded-2xl text-white">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Total Outstanding</p>
            <p className="text-2xl font-heritage font-bold text-red-600">₹{totalDues.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-gold/10 shadow-sm flex items-center gap-4">
        <Search size={20} className="text-gray-400" />
        <input 
          type="text" 
          placeholder="Search by customer name or item..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium"
        />
        <Filter size={20} className="text-gray-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-gray-100 rounded-[32px] animate-pulse" />
          ))
        ) : filteredEntries.length > 0 ? (
          filteredEntries.map(entry => (
            <div key={entry.id} className="bg-white p-8 rounded-[32px] border border-gold/10 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-6">
                <div className="p-4 bg-gray-50 rounded-2xl text-gray-400 group-hover:bg-gold/10 group-hover:text-gold transition-colors">
                  <User size={24} />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-heritage font-bold text-gray-900">₹{entry.amount.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Outstanding</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <h4 className="font-bold text-gray-900 text-lg">{entry.customer_name || 'Anonymous Customer'}</h4>
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <Clock size={14} className="text-saffron" />
                  <span>{entry.item} ({entry.quantity} units)</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  <Calendar size={12} />
                  <span>{new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
              </div>

              <button 
                onClick={() => setModalConfig({ isOpen: true, entryId: entry.id })}
                className="w-full py-4 bg-green-50 text-green-600 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-600 hover:text-white transition-all"
              >
                <CheckCircle size={16} />
                Mark as Paid
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
              <IndianRupee size={40} />
            </div>
            <h3 className="text-xl font-heritage font-bold text-gray-900">No Pending Dues</h3>
            <p className="text-gray-400 text-sm mt-2">All your royal accounts are settled, Hukumn.</p>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        title="Settle Account"
        message="Has the customer paid the full amount for this entry?"
        type="confirm"
        confirmLabel="Yes, Paid"
        isLoading={isSubmitting}
        onConfirm={() => modalConfig.entryId && handleMarkAsPaid(modalConfig.entryId)}
        onCancel={() => setModalConfig({ isOpen: false, entryId: null })}
      />
    </div>
  );
};
