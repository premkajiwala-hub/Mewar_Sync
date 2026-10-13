
import React, { useEffect, useState } from 'react';
import { IndianRupee, Calendar, Download, FileText, Printer, Search, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { storage } from '../../services/storage';
import { LedgerEntry } from '../../types';

export const LedgerReports: React.FC = () => {
  const getLocalYYYYMMDD = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState<string>(getLocalYYYYMMDD());
  const [endDate, setEndDate] = useState<string>(getLocalYYYYMMDD());
  const [loading, setLoading] = useState(true);
  const user = storage.getCurrentUser();

  useEffect(() => {
    fetchDates();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchLedgerForRange(startDate, endDate);
    }
  }, [startDate, endDate]);

  const fetchDates = async () => {
    const dates = await storage.getAvailableDates();
    setAvailableDates(dates);
  };

  const filteredDates = availableDates.filter(date => 
    date.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const fetchLedgerForRange = async (start: string, end: string) => {
    setLoading(true);
    try {
      const [business, personal] = await Promise.all([
        storage.getLedger('BUSINESS', start, end),
        storage.getLedger('PERSONAL', start, end)
      ]);
      // Combine all ledger entries and sort by time
      const combined = [...business, ...personal]
        .sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      setEntries(combined);
    } catch (error) {
      console.error("Failed to fetch ledger reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportLedger = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalIn = entries
      .filter(e => ['SALE', 'PERSONAL_RECEIVED'].includes(e.type))
      .reduce((sum, e) => sum + e.amount, 0);
    
    const totalOut = entries
      .filter(e => ['BUSINESS_EXPENSE', 'PERSONAL_PAID', 'OTHER_EXPENSE'].includes(e.type))
      .reduce((sum, e) => sum + e.amount, 0);

    const content = `
      <html>
        <head>
          <title>Ledger Report - ${startDate} to ${endDate}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Outfit:wght@300;400;600&display=swap');
            body { font-family: 'Outfit', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; }
            .header { text-align: center; border-bottom: 3px double #D4AF37; padding-bottom: 20px; margin-bottom: 30px; }
            .shop-name { font-family: 'Cinzel', serif; font-size: 28px; color: #D4AF37; margin: 0; }
            .report-title { text-transform: uppercase; letter-spacing: 3px; font-size: 14px; font-weight: 600; margin-top: 10px; }
            .meta { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f9f9f9; padding: 12px; border: 1px solid #eee; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
            td { padding: 12px; border: 1px solid #eee; font-size: 13px; }
            .amount { font-family: monospace; font-weight: 600; text-align: right; }
            .in { color: #10b981; }
            .out { color: #ef4444; }
            .summary-box { margin-top: 40px; display: flex; justify-content: flex-end; }
            .summary-table { width: 300px; }
            .summary-table td { border: none; padding: 8px 0; }
            .total-row { border-top: 2px solid #D4AF37 !important; font-weight: 800; font-size: 16px; }
            .footer { margin-top: 60px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="shop-name">${user?.name || 'Mewar Artisan'}</h1>
            <div class="report-title">Bahi-Khata Ledger Report</div>
          </div>
          
          <div class="meta">
            <div>Period: ${startDate} to ${endDate}</div>
            <div>Shop ID: ${user?.id.slice(-6).toUpperCase()}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Particulars</th>
                <th>Type</th>
                <th style="text-align: right;">In (Jama)</th>
                <th style="text-align: right;">Out (Udhaar/Kharch)</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(e => {
                const isIn = ['SALE', 'PERSONAL_RECEIVED'].includes(e.type);
                const dateTime = new Date(e.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                return `
                  <tr>
                    <td>${dateTime}</td>
                    <td>
                      <strong>${e.item}</strong>
                      ${e.customer_name ? `<br/><small style="color: #666;">Customer: ${e.customer_name}</small>` : ''}
                    </td>
                    <td><small>${e.type.replace('_', ' ')}</small></td>
                    <td class="amount in">${isIn ? `₹${e.amount.toLocaleString()}` : '-'}</td>
                    <td class="amount out">${!isIn ? `₹${e.amount.toLocaleString()}` : '-'}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="summary-box">
            <table class="summary-table">
              <tr>
                <td>Total Jama (In):</td>
                <td class="amount in">₹${totalIn.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Total Kharch (Out):</td>
                <td class="amount out">₹${totalOut.toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <td>Net Balance:</td>
                <td class="amount ${totalIn - totalOut >= 0 ? 'in' : 'out'}">₹${(totalIn - totalOut).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            <p>This is a computer-generated document from Mewar-Sync Heritage Artisan Ecosystem.</p>
            <p>Digital Signature Verified | ${new Date().toLocaleString()}</p>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-white p-8 rounded-[40px] border border-gold/10 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-heritage font-bold text-gray-900">Ledger Reports</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Generate professional accounting statements</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">From</span>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={14} />
              <input 
                type="date"
                className="bg-white border border-gold/10 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-gold shadow-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">To</span>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={14} />
              <input 
                type="date"
                className="bg-white border border-gold/10 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold focus:outline-none focus:border-gold shadow-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <button 
            onClick={exportLedger}
            disabled={entries.length === 0}
            className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={18} />
            Print Report
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Date Selector Sidebar */}
        <div className="w-full md:w-72 space-y-4">
          <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">Search History</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={16} />
              <input 
                type="text"
                placeholder="Search date..."
                className="w-full bg-white border border-gold/10 rounded-2xl py-3 pl-12 pr-4 text-xs font-bold focus:outline-none focus:border-gold shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">Available Dates</h3>
          <div className="bg-white rounded-[32px] border border-gold/10 shadow-sm overflow-hidden p-2">
            <div className="max-h-[500px] overflow-y-auto space-y-1 pr-2 custom-scrollbar">
              {filteredDates.length > 0 ? (
                filteredDates.map(date => (
                  <button
                    key={date}
                    onClick={() => {
                      setStartDate(date);
                      setEndDate(date);
                    }}
                    className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all ${
                      startDate === date && endDate === date
                        ? 'bg-royal-gradient text-white shadow-lg' 
                        : 'text-gray-500 hover:bg-gold/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Calendar size={14} />
                      <span className="text-xs font-bold">
                        {(() => {
                          const [y, m, d] = date.split('-').map(Number);
                          return new Date(y, m - 1, d).toLocaleDateString('en-IN', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          });
                        })()}
                      </span>
                    </div>
                    <ChevronRight size={14} className={startDate === date && endDate === date ? 'opacity-100' : 'opacity-0'} />
                  </button>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400 text-xs italic">No matching dates</div>
              )}
            </div>
          </div>
        </div>

        {/* Ledger Preview */}
        <div className="flex-1 bg-white rounded-[40px] border border-gold/10 shadow-xl overflow-hidden flex flex-col">
          <div className="p-8 border-b border-gold/10 flex justify-between items-center bg-gray-50/50">
            <div>
              <h4 className="font-heritage font-bold text-gray-900">Statement for {startDate} to {endDate}</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{entries.length} Transactions Recorded</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">Net Position</p>
                  <p className={`text-lg font-heritage font-bold ${
                    entries.reduce((sum, e) => sum + (['SALE', 'PERSONAL_RECEIVED'].includes(e.type) ? e.amount : -e.amount), 0) >= 0 
                    ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ₹{entries.reduce((sum, e) => sum + (['SALE', 'PERSONAL_RECEIVED'].includes(e.type) ? e.amount : -e.amount), 0).toLocaleString()}
                  </p>
               </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white border-b border-gold/10">
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date & Time</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Particulars</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={4} className="px-8 py-6"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                    </tr>
                  ))
                ) : entries.length > 0 ? (
                  entries.map((entry) => {
                    const isIn = ['SALE', 'PERSONAL_RECEIVED'].includes(entry.type);
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-8 py-6">
                          <span className="text-xs font-mono text-gray-400">
                            {new Date(entry.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div>
                            <p className="font-bold text-gray-900">{entry.item}</p>
                            {entry.customer_name && (
                              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">Customer: {entry.customer_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{entry.type.replace('_', ' ')}</span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className={`flex items-center justify-end gap-2 font-heritage font-bold text-lg ${isIn ? 'text-green-600' : 'text-red-600'}`}>
                            {isIn ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                            ₹{entry.amount.toLocaleString()}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                        <FileText size={32} />
                      </div>
                      <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No entries for this period</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
