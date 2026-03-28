
import React, { useState, useEffect } from 'react';
import { Mail, User, Calendar, MessageSquare, CheckCircle2, Clock, Trash2, Reply, Sparkles, Loader2 } from 'lucide-react';
import { storage } from '../../services/storage';
import { UserProfile, ContactMessage } from '../../types';

export const Inquiries: React.FC = () => {
  const [inquiries, setInquiries] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const user = storage.getCurrentUser();

  useEffect(() => {
    const fetchInquiries = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await storage.getContactMessages(user.id);
        setInquiries(data);
      } catch (error) {
        console.error("Error fetching inquiries:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInquiries();
  }, [user?.id]);

  const getStatusColor = (status: ContactMessage['status']) => {
    switch (status) {
      case 'NEW': return 'bg-orange-50 text-orange-600 border-orange-200';
      case 'READ': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'REPLIED': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case 'ARCHIVED': return 'bg-gray-50 text-gray-600 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-heritage font-bold text-gray-900">Visitor Inquiries</h2>
          <p className="text-gray-400 italic mt-2">Connecting you with heritage lovers from around the world.</p>
        </div>
        
        <div className="flex gap-4">
          <div className="bg-white px-6 py-3 rounded-2xl border border-gold/10 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">New</p>
              <p className="text-xl font-bold text-gray-900">{inquiries.filter(i => i.status === 'NEW').length}</p>
            </div>
          </div>
          <div className="bg-white px-6 py-3 rounded-2xl border border-gold/10 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Replied</p>
              <p className="text-xl font-bold text-gray-900">{inquiries.filter(i => i.status === 'REPLIED').length}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4 text-gold/40">
          <Loader2 className="animate-spin" size={48} />
          <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Loading Inquiries...</p>
        </div>
      ) : inquiries.length === 0 ? (
        <div className="py-24 text-center bg-white rounded-[40px] border-2 border-dashed border-gold/10">
          <div className="w-20 h-20 bg-gold/5 rounded-full flex items-center justify-center mx-auto mb-6 text-gold/30">
            <Mail size={40} />
          </div>
          <h3 className="text-2xl font-heritage font-bold text-gray-900">No inquiries yet</h3>
          <p className="text-gray-400 italic mt-2">When visitors ask about your masterpieces, they will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {inquiries.map(inquiry => (
            <div 
              key={inquiry.id} 
              className="bg-white rounded-[32px] border border-gold/10 shadow-sm hover:shadow-md transition-all overflow-hidden group"
            >
              <div className="p-8 flex flex-col md:flex-row gap-8">
                <div className="flex-grow space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-royal-gradient flex items-center justify-center text-white text-xl font-bold shadow-lg">
                        {inquiry.visitor_name[0]}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-gray-900">{inquiry.visitor_name}</h4>
                        <p className="text-sm text-gray-400">{inquiry.visitor_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border uppercase tracking-widest ${getStatusColor(inquiry.status)}`}>
                        {inquiry.status}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Calendar size={14} /> {formatDate(inquiry.timestamp)}
                      </span>
                    </div>
                  </div>

                  {/* @ts-ignore */}
                  {inquiry.product_name && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/5 rounded-xl border border-gold/10">
                      <Sparkles size={14} className="text-gold" />
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Product: {inquiry.product_name}</span>
                    </div>
                  )}

                  <div className="relative">
                    <MessageSquare size={20} className="absolute -left-2 -top-2 text-gold/20" />
                    <p className="text-lg text-gray-600 italic leading-relaxed pl-6">
                      "{inquiry.message}"
                    </p>
                  </div>
                </div>

                <div className="flex md:flex-col gap-3 justify-end">
                  <button className="flex-grow md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-royal-gradient text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-transform">
                    <Reply size={18} /> Reply
                  </button>
                  <button className="p-4 bg-gray-50 text-gray-400 rounded-2xl border border-gray-100 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
