
import React, { useState, useEffect } from 'react';
import { Clock, Calendar as CalendarIcon, MessageSquare, Menu } from 'lucide-react';

interface HeaderProps {
  onInquiryClick?: () => void;
  inquiryCount?: number;
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onInquiryClick, inquiryCount = 0, onMenuClick }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="bg-white border-b border-gold/10 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-3 md:gap-5">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="flex items-center gap-2 text-gray-500">
          <CalendarIcon size={12} className="text-gold md:size-[14px]" />
          <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest">{formatDate(time)}</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-gray-900 border-l border-gold/10 pl-3 md:pl-5">
          <Clock size={12} className="text-saffron md:size-[14px]" />
          <span className="text-[10px] md:text-xs font-mono font-bold tracking-tighter">{formatTime(time)}</span>
        </div>
      </div>

      {onInquiryClick && (
        <button 
          onClick={onInquiryClick}
          className="relative p-2.5 bg-gold/5 text-gold rounded-xl border border-gold/10 hover:bg-gold hover:text-white transition-all shadow-sm group"
        >
          <MessageSquare size={18} />
          {inquiryCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse">
              {inquiryCount}
            </span>
          )}
          <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Messenger
          </span>
        </button>
      )}
    </header>
  );
};
