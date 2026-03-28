
import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { IndianRupee, TrendingUp, History, ShieldCheck, AlertTriangle, CheckCircle2, Package, AlertCircle, BarChart3, Clock, Power, Calendar as CalendarIcon, Mail, User as UserIcon, MessageSquare } from 'lucide-react';
import { storage } from '../../services/storage';
import { LedgerEntry, InventoryItem, ContactMessage } from '../../types';
import { ConfirmationModal } from '../UI/ConfirmationModal';

export const ArtisanDashboard: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fullLedger, setFullLedger] = useState<LedgerEntry[]>([]);
  const [inquiries, setInquiries] = useState<ContactMessage[]>([]);
  const [time, setTime] = useState(new Date());
  const [viewRange, setViewRange] = useState<'WEEK' | 'MONTH' | 'YEAR'>('WEEK');
  const [lastGallaClose, setLastGallaClose] = useState<string | null>(storage.getLastGallaClose());
  const user = storage.getCurrentUser();

  useEffect(() => {
    const timer = setInterval(async () => {
      const now = new Date();
      setTime(now);
      
      // Automatic Close Galla at Midnight (00:00)
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
        // Close for the day that just ended (yesterday)
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        await storage.closeGalla(yesterday.toDateString());
        setLastGallaClose(new Date().toISOString());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [businessLed, personalLed, inv, udhaarLed, msgs] = await Promise.all([
        storage.getLedger('BUSINESS'),
        storage.getLedger('PERSONAL'),
        storage.getInventory(),
        storage.getUdhaarEntries(),
        user ? storage.getContactMessages(user.id) : Promise.resolve([])
      ]);
      setFullLedger([...businessLed, ...personalLed, ...udhaarLed]);
      setInventory(inv);
      setInquiries(msgs);

      // Check if we need to auto-close previous days on mount
      const lastClose = storage.getLastGallaClose();
      if (lastClose) {
        const lastCloseDate = new Date(lastClose).toDateString();
        const todayDate = new Date().toDateString();
        if (lastCloseDate !== todayDate) {
          // If the last close was not today, close for yesterday
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          await storage.closeGalla(yesterday.toDateString());
          setLastGallaClose(new Date().toISOString());
        }
      }
    };
    fetchData();
  }, [user]);

  // Financial summary - Filtered by today's date for "Today's Standing"
  const gallaEntries = useMemo(() => {
    const today = new Date().toDateString();
    return fullLedger.filter(l => new Date(l.created_at).toDateString() === today);
  }, [fullLedger]);

  const totalDailySales = gallaEntries
    .filter(l => l.type === 'SALE' || l.type === 'PERSONAL_RECEIVED')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const totalDailyExpenses = gallaEntries
    .filter(l => l.type === 'BUSINESS_EXPENSE' || l.type === 'PERSONAL_PAID' || l.type === 'OTHER_EXPENSE')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Total Dues should only count PENDING entries
  const totalDues = fullLedger
    .filter(l => l.payment_status === 'PENDING')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // Galla Standing refers to Cash in Hand for the day
  // Cash Income = Paid Sales + Paid Personal Received
  const cashIncome = gallaEntries
    .filter(l => (l.type === 'SALE' || l.type === 'PERSONAL_RECEIVED') && l.payment_status === 'PAID')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);
  
  // Cash Expenses = Paid Expenses
  const cashExpenses = gallaEntries
    .filter(l => (l.type === 'BUSINESS_EXPENSE' || l.type === 'PERSONAL_PAID' || l.type === 'OTHER_EXPENSE') && l.payment_status === 'PAID')
    .reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const verdict = cashIncome - cashExpenses;
  const isProfit = verdict >= 0;

  // Chart Data: Net Position based on viewRange
  const chartData = useMemo(() => {
    const now = new Date();
    const data: any[] = [];
    
    if (viewRange === 'WEEK') {
      // Current Week (Monday to Sunday)
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        data.push({ name: label, net: 0, date: d });
      }

      fullLedger.forEach(entry => {
        const entryDate = new Date(entry.created_at);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        if (entryDate >= startOfWeek && entryDate < endOfWeek) {
          const dayIndex = data.findIndex(d => d.date.toDateString() === entryDate.toDateString());
          if (dayIndex !== -1) {
            const isIncome = entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED';
            data[dayIndex].net += isIncome ? entry.amount : -entry.amount;
          }
        }
      });
    } else if (viewRange === 'MONTH') {
      // Current Month grouped by Weeks
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
      // Initialize 5 weeks (standard for a month view)
      for (let i = 1; i <= 5; i++) {
        data.push({ name: `Week ${i}`, net: 0 });
      }

      fullLedger.forEach(entry => {
        const entryDate = new Date(entry.created_at);
        if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
          const dayOfMonth = entryDate.getDate();
          const weekIndex = Math.min(4, Math.floor((dayOfMonth - 1) / 7));
          const isIncome = entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED';
          data[weekIndex].net += isIncome ? entry.amount : -entry.amount;
        }
      });
    } else {
      // Current Year (Jan to Dec)
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), i, 1);
        const label = d.toLocaleDateString('en-IN', { month: 'short' });
        data.push({ name: label, net: 0, month: i });
      }

      fullLedger.forEach(entry => {
        const entryDate = new Date(entry.created_at);
        if (entryDate.getFullYear() === now.getFullYear()) {
          const monthIndex = entryDate.getMonth();
          const isIncome = entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED';
          data[monthIndex].net += isIncome ? entry.amount : -entry.amount;
        }
      });
    }

    return data;
  }, [fullLedger, viewRange]);

  const sortedLedger = useMemo(() => {
    return [...fullLedger].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [fullLedger]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Header with Clock & Galla Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-gold/10 shadow-sm">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 text-gray-500">
            <CalendarIcon size={20} className="text-gold" />
            <span className="text-sm font-bold uppercase tracking-widest">
              {time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="flex items-center gap-3 text-gray-900 border-l border-gold/10 pl-8">
            <Clock size={20} className="text-saffron" />
            <span className="text-xl font-mono font-bold tracking-tighter">
              {time.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Header */}
      <div className="p-6 bg-white rounded-[32px] border border-gold/10 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
         <div className="absolute -top-12 -left-12 w-48 h-48 bg-gold/5 rounded-full blur-3xl" />
         <div className="flex items-center gap-8 relative z-10">
            <div className="w-20 h-20 rounded-3xl bg-royal-gradient flex items-center justify-center text-white font-bold text-3xl shadow-2xl">
               {user?.name?.[0]}
            </div>
            <div>
               <h2 className="text-2xl font-heritage font-bold text-gray-900">{user?.name}</h2>
               <div className="flex flex-wrap gap-3 mt-2">
                 <span className="text-[10px] text-saffron font-bold uppercase tracking-widest bg-saffron/5 px-3 py-1 rounded-full border border-saffron/10">{user?.shopAddress || 'Udaipur, Rajasthan'}</span>
                 <span className="text-[10px] text-gold font-bold uppercase tracking-widest bg-gold/5 px-3 py-1 rounded-full border border-gold/10">{user?.category || 'Heritage Artisan'}</span>
               </div>
            </div>
         </div>
         <div className="flex items-center gap-6 relative z-10">
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Administrative Status</p>
              <div className="flex items-center gap-2 text-xs font-bold text-green-600 uppercase">
                <ShieldCheck size={14} /> Verified Artisan
              </div>
            </div>
         </div>
      </div>

      {/* Main Stats */}
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-6 no-scrollbar">
        <div className={`min-w-[280px] sm:min-w-0 snap-center glass-mewar p-6 rounded-[32px] border-b-8 shadow-xl relative overflow-hidden group transition-all hover:translate-y-[-4px] bg-white ${
          isProfit ? 'border-green-500' : 'border-red-500'
        }`}>
          <div className="relative z-10">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} className={isProfit ? 'text-green-500' : 'text-red-500'} /> 
              Today's Galla Standing
            </p>
            <div className={`flex items-center gap-1 mt-4 ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
              <IndianRupee className="w-10 h-10" />
              <span className="text-4xl sm:text-5xl md:text-6xl font-heritage font-bold">{Math.abs(verdict).toLocaleString()}</span>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <p className={`text-[14px] font-heritage font-bold uppercase tracking-[0.2em] flex items-center gap-2 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                {isProfit ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
                Position: {isProfit ? 'Surplus' : 'Deficit'}
              </p>
              <div className="h-px bg-gray-100 my-2" />
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <span className="text-gray-400">Total Sales Today</span>
                <span className="text-gray-900">₹{totalDailySales.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-[280px] sm:min-w-0 snap-center glass-mewar p-6 rounded-[32px] border-b-8 border-red-600 shadow-xl transition-all hover:translate-y-[-4px] bg-white">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <AlertCircle size={14} className="text-red-600" /> Total Dues (Udhaar)
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <IndianRupee className="w-8 h-8 text-red-600" />
              <span className="text-4xl sm:text-5xl md:text-6xl font-heritage font-bold text-red-600">
                {totalDues.toLocaleString()}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-6">Money owed by customers</p>
        </div>

        <div className="min-w-[280px] sm:min-w-0 snap-center glass-mewar p-6 rounded-[32px] border-b-8 border-indigo-600 shadow-xl transition-all hover:translate-y-[-4px] bg-white">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Package size={14} className="text-indigo-600" /> Stock Health
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-4xl sm:text-5xl md:text-6xl font-heritage font-bold text-indigo-600">
                {inventory.length}
              </span>
              <span className="text-gray-300 text-2xl font-heritage ml-2 uppercase">SKUs</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Low Stock Items</p>
              <p className="text-2xl font-heritage font-bold text-amber-500">{inventory.filter(i => i.quantity < 5).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Visualization Chart */}
      <div className="bg-white p-6 rounded-[32px] border border-gold/10 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h3 className="text-xl font-heritage font-bold text-gray-900 uppercase tracking-tight">Financial Position</h3>
            <p className="text-xs text-gray-400 italic">Net Cash Flow analysis for the selected period</p>
          </div>
          
          <div className="flex bg-gray-100 p-1.5 rounded-2xl">
            {(['WEEK', 'MONTH', 'YEAR'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setViewRange(range)}
                className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                  viewRange === range 
                    ? 'bg-white text-royal-gradient shadow-sm' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#9ca3af' }}
                tickFormatter={(value) => `₹${value}`}
              />
              <Tooltip 
                contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
                cursor={{ fill: '#f9fafb' }}
                formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Net Position']}
              />
              <Bar dataKey="net" radius={[6, 6, 0, 0]} barSize={viewRange === 'WEEK' ? 50 : viewRange === 'MONTH' ? 80 : 40}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.net >= 0 ? '#10b981' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Log */}
      <div className="grid grid-cols-1 gap-8">
        <div className="glass-mewar p-6 rounded-[32px] shadow-xl flex flex-col bg-white">
          <h3 className="text-lg font-heritage font-bold mb-6 flex items-center gap-3">
            <History size={24} className="text-gold" /> Registry Archive
          </h3>
          <div className="space-y-4">
            {sortedLedger.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between p-6 bg-white rounded-3xl border border-gold/10 hover:border-gold/30 transition-all hover:shadow-md">
                <div className="flex items-center gap-5">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold border ${
                    (entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED') ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                    {entry.item?.[0] || '?'}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 line-clamp-1">{entry.item}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{entry.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-lg font-heritage ${(entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED') ? 'text-green-600' : 'text-red-600'}`}>
                    {(entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED') ? '+' : '-'} ₹{entry.amount.toLocaleString()}
                  </p>
                  <p className="text-[8px] text-gray-400 font-bold uppercase tracking-[0.2em]">{new Date(entry.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
