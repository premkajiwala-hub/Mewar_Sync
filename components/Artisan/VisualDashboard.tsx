
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LedgerEntry } from '../../types';
import { Calendar, Filter } from 'lucide-react';

interface VisualDashboardProps {
  entries: LedgerEntry[];
}

type TimeRange = 'WEEK' | 'MONTH' | 'YEAR';

export const VisualDashboard: React.FC<VisualDashboardProps> = ({ entries }) => {
  const [range, setRange] = useState<TimeRange>('WEEK');

  const chartData = useMemo(() => {
    const now = new Date();
    const data: any[] = [];

    if (range === 'WEEK') {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        data.push({ name: label, revenue: 0, expense: 0, date: d });
      }

      entries.forEach(entry => {
        const entryDate = new Date(entry.created_at);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        if (entryDate >= startOfWeek && entryDate < endOfWeek) {
          const dayIndex = data.findIndex(d => d.date.toDateString() === entryDate.toDateString());
          if (dayIndex !== -1) {
            if (entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED') {
              data[dayIndex].revenue += entry.amount;
            } else {
              data[dayIndex].expense += entry.amount;
            }
          }
        }
      });
    } else if (range === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      for (let i = 1; i <= 5; i++) {
        data.push({ name: `Week ${i}`, revenue: 0, expense: 0 });
      }

      entries.forEach(entry => {
        const entryDate = new Date(entry.created_at);
        if (entryDate >= startOfMonth && entryDate <= endOfMonth) {
          const dayOfMonth = entryDate.getDate();
          const weekIndex = Math.min(4, Math.floor((dayOfMonth - 1) / 7));
          if (entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED') {
            data[weekIndex].revenue += entry.amount;
          } else {
            data[weekIndex].expense += entry.amount;
          }
        }
      });
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), i, 1);
        const label = d.toLocaleDateString('en-IN', { month: 'short' });
        data.push({ name: label, revenue: 0, expense: 0 });
      }

      entries.forEach(entry => {
        const entryDate = new Date(entry.created_at);
        if (entryDate.getFullYear() === now.getFullYear()) {
          const monthIndex = entryDate.getMonth();
          if (entry.type === 'SALE' || entry.type === 'PERSONAL_RECEIVED') {
            data[monthIndex].revenue += entry.amount;
          } else {
            data[monthIndex].expense += entry.amount;
          }
        }
      });
    }

    return data;
  }, [entries, range]);

  return (
    <div className="bg-white p-8 rounded-[40px] border border-gold/10 shadow-xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-heritage font-bold text-gray-900 uppercase tracking-tight">Financial Overview</h3>
          <p className="text-xs text-gray-400 italic">Revenue vs Expenses analysis</p>
        </div>

        <div className="flex bg-gray-50 p-1 rounded-2xl border border-gray-100">
          {(['WEEK', 'MONTH', 'YEAR'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                range === r ? 'bg-white text-saffron shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 600, fill: '#9ca3af' }}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
              cursor={{ fill: '#f9fafb' }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }} />
            <Bar dataKey="revenue" name="Revenue" fill="#FF9933" radius={[4, 4, 0, 0]} barSize={30} />
            <Bar dataKey="expense" name="Expenses" fill="#1a1a1a" radius={[4, 4, 0, 0]} barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
