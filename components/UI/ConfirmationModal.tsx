
import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'confirm' | 'alert' | 'danger';
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  type = 'confirm',
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onCancel}
      />
      <div className="glass-mewar w-[95%] md:max-w-sm rounded-[24px] md:rounded-[28px] shadow-2xl border-2 border-gold/30 bg-white relative flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        <button 
          onClick={onCancel} 
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors z-10"
        >
          <X size={18} />
        </button>
        
        <div className="flex-1 overflow-y-auto p-5 md:p-6 scrollbar-hide">
          <div className="text-center mb-4 font-heritage">
            <div className="flex justify-center mb-3">
              <div className={`p-2.5 rounded-full ${
                type === 'danger' ? 'bg-red-50 text-red-500' : 
                type === 'alert' ? 'bg-amber-50 text-amber-500' : 
                'bg-indigo-50 text-indigo-500'
              }`}>
                {type === 'danger' ? <AlertTriangle size={20} /> : 
                 type === 'alert' ? <Info size={20} /> : 
                 <CheckCircle2 size={20} />}
              </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">{title}</h3>
            <p className="text-[8px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">Registry Confirmation</p>
          </div>

          <div className="mb-3 text-center">
            <p className="text-gray-600 text-[11px] leading-relaxed font-medium">
              {message}
            </p>
          </div>
        </div>

        <div className="p-5 md:p-6 pt-0 flex gap-2 font-heritage shrink-0">
          {type !== 'alert' && (
            <button 
              onClick={onCancel}
              className="flex-1 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-[8px] font-bold uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              {cancelLabel}
            </button>
          )}
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 rounded-xl text-[8px] font-bold uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${
              type === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' : 
              'bg-royal-gradient text-white hover:opacity-90'
            }`}
          >
            {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
