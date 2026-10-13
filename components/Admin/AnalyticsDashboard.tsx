
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Users, CheckCircle, ShieldAlert } from 'lucide-react';
import { storage } from '../../services/storage';

/**
 * AnalyticsDashboard: Real-time SQL charts for heritage management
 */
export const AnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    storage.getAnalyticsData().then(setData);
  }, []);

  const COLORS = ['#FF9933', '#D4AF37', '#1a1a1a', '#F5F5F5'];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Artisans', value: '1,248', icon: Users, color: 'text-blue-600' },
          { label: 'Verified Products', value: '4,892', icon: CheckCircle, color: 'text-green-600' },
          { label: 'Sales Growth', value: '+24%', icon: TrendingUp, color: 'text-saffron' },
          { label: 'Verification Pending', value: '42', icon: ShieldAlert, color: 'text-red-600' },
        ].map((stat, i) => (
          <div key={i} className="glass-mewar p-6 rounded-3xl shadow-lg border-b-4 border-gold/20">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-heritage font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className={stat.color} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-mewar p-8 rounded-3xl shadow-xl h-[400px]">
          <h3 className="text-xl font-heritage font-bold mb-6">Global Style Demand</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(212, 175, 55, 0.1)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#666' }} />
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                cursor={{ fill: 'rgba(212, 175, 55, 0.05)' }}
              />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-mewar p-8 rounded-3xl shadow-xl">
          <h3 className="text-xl font-heritage font-bold mb-6">Pending Verifications</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-white/40 rounded-2xl border border-gold/10 hover:bg-white/60 transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center font-heritage font-bold text-gold">
                    AM
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Arjun Mewari</p>
                    <p className="text-xs text-gray-500">Master Pichwai Artist • ID: #4492</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-royal-gradient text-white text-xs font-bold rounded-full">
                  Verify ID
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
