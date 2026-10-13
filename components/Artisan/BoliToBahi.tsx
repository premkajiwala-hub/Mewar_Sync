
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Save, Loader2, CheckCircle2, History, IndianRupee, X, AlertCircle, Edit3 } from 'lucide-react';
import { useGemini } from '../../hooks/useGemini';
import { VoiceAction, LedgerEntry } from '../../types';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { storage } from '../../services/storage';

export const BoliToBahi: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedData, setParsedData] = useState<VoiceAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<LedgerEntry[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const { processVoiceLedger, loading } = useGemini();
  
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const data = await storage.getLedger();
    setHistory(data);
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowErrorModal(true);
      return;
    }

    transcriptRef.current = '';
    setTranscript('');
    setParsedData(null);

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'hi-IN';
    recognitionRef.current.interimResults = true;
    
    recognitionRef.current.onstart = () => setIsRecording(true);
    recognitionRef.current.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      transcriptRef.current = currentTranscript;
      setTranscript(currentTranscript);
    };

    recognitionRef.current.onend = async () => {
      setIsRecording(false);
      if (transcriptRef.current.trim()) {
        const data = await processVoiceLedger(transcriptRef.current);
        if (data) setParsedData(data);
      }
    };

    recognitionRef.current.onerror = () => setIsRecording(false);
    recognitionRef.current.start();
  };

  const handleSave = async () => {
    if (!parsedData || isSubmitting) return;
    setIsSubmitting(true);
    
    const entryData = {
      type: (parsedData.action === 'expense' ? 'BUSINESS_EXPENSE' : 
             parsedData.action === 'other_expense' ? 'OTHER_EXPENSE' :
             parsedData.action === 'personal_received' ? 'PERSONAL_RECEIVED' :
             parsedData.action === 'personal_paid' ? 'PERSONAL_PAID' : 'SALE') as any,
      category: parsedData.category || 'BUSINESS',
      item: parsedData.item || 'Heritage Sale',
      quantity: parsedData.quantity || 1,
      unit_price: (parsedData.price || 0) / (parsedData.quantity || 1),
      amount: parsedData.price || 0,
      payment_status: parsedData.payment_status || 'PAID',
      customer_name: parsedData.customer_name || '',
      created_at: new Date().toISOString(),
      id: `temp-${Date.now()}`
    };

    // Optimistic Update
    setHistory(prev => [entryData as LedgerEntry, ...prev]);
    setParsedData(null);
    setTranscript('');

    try {
      if (entryData.payment_status === 'PENDING') {
        await storage.saveUdhaar(entryData);
      } else {
        await storage.saveLedger(entryData);
      }

      if (parsedData.action === 'transaction' || parsedData.action === 'expense') {
        await storage.saveInventory(
          { 
            item: entryData.item, 
            quantity: entryData.quantity,
            is_purchased: parsedData.is_purchased ?? (parsedData.action === 'expense'),
            unit_cost: entryData.unit_price
          },
          parsedData.action === 'transaction' ? 'remove' : 'add'
        );
      }

      await fetchHistory();
    } catch (err) {
      console.error("Voice save failed:", err);
      // Rollback
      await fetchHistory();
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: keyof VoiceAction, value: any) => {
    if (parsedData) setParsedData({ ...parsedData, [field]: value });
  };

  return (
    <div className="font-outfit">
      <div className="space-y-8 animate-in fade-in duration-700">
      <div className="p-10 glass-mewar rounded-[40px] shadow-2xl border-2 border-gold/10 relative overflow-hidden">
        <h2 className="text-4xl font-heritage font-bold mb-2 text-gray-900 text-center">Boli-to-Bahi</h2>
        <p className="text-gray-500 italic text-sm mb-12 text-center">Udaipur's Voice-Activated Ledger</p>
        
        <div className="flex flex-col items-center gap-10">
          <button
            onClick={isRecording ? () => recognitionRef.current?.stop() : startRecording}
            className={`relative z-10 w-40 h-40 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 ${
              isRecording ? 'bg-red-500 scale-110 shadow-red-200 ring-8 ring-red-50' : 'bg-royal-gradient hover:scale-105'
            }`}
          >
            {isRecording ? (
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-8 bg-white rounded-full animate-bounce" />
                <div className="w-2 h-12 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-8 bg-white rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            ) : (
              <Mic className="text-white w-16 h-16" />
            )}
          </button>
          
          <div className="w-full max-w-xl text-center">
            {transcript && (
              <div className="p-8 bg-white/90 rounded-3xl border border-gold/10 shadow-inner mb-6">
                <p className="text-xl font-medium italic text-gray-800 leading-relaxed">"{transcript}"</p>
              </div>
            )}
            
            {loading && (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="animate-spin text-saffron w-12 h-12" />
                <p className="text-saffron font-bold text-[10px] uppercase tracking-widest animate-pulse">Auditing your entry...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {parsedData && parsedData.action === 'transaction' && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" 
            onClick={() => setParsedData(null)}
          />
          <div className="glass-mewar max-w-md w-full p-6 md:p-8 rounded-[32px] shadow-2xl border-2 border-gold/30 relative overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-300 scrollbar-hide">
              <button onClick={() => setParsedData(null)} className="absolute top-6 right-6 text-gray-400 hover:text-red-500"><X size={20} /></button>
              
              <div className="text-center mb-6">
                <CheckCircle2 size={36} className="text-green-600 mx-auto mb-3" />
                <h3 className="text-2xl font-heritage font-bold">Review Registry</h3>
              </div>

              <div className="space-y-4 bg-white/50 p-6 rounded-2xl border border-gold/20 mb-6 shadow-inner">
                 <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gold/60 flex items-center gap-1"><Edit3 size={10} /> Item Name</span>
                    <input 
                      className="text-xl font-bold bg-white/80 border border-gold/10 rounded-xl px-4 py-2 focus:outline-none focus:border-saffron"
                      value={parsedData.item || ''}
                      onChange={(e) => updateField('item', e.target.value)}
                    />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gold/40 flex items-center gap-1"><Edit3 size={10} /> Qty</span>
                      <input 
                        type="number"
                        className="text-3xl font-heritage font-bold bg-transparent w-full"
                        value={parsedData.quantity || 1}
                        onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)}
                      />
                   </div>
                   <div className="space-y-1 text-right">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gold/40 flex items-center gap-1 justify-end"><Edit3 size={10} /> Total Value</span>
                      <div className="flex items-center justify-end gap-1">
                        <IndianRupee size={16} className="text-green-600" />
                        <input 
                          type="number"
                          className="text-3xl font-heritage font-bold bg-transparent text-right w-full text-green-600"
                          value={parsedData.price || 0}
                          onChange={(e) => updateField('price', parseInt(e.target.value) || 0)}
                        />
                      </div>
                   </div>
                 </div>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={handleSave} 
                  disabled={isSubmitting}
                  className="w-full py-3 bg-royal-gradient text-white rounded-xl font-bold shadow-xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Seal in Registry
                </button>
                <button onClick={() => setParsedData(null)} disabled={isSubmitting} className="text-[9px] font-bold text-gray-400 uppercase tracking-widest py-1 disabled:opacity-50">Discard</button>
              </div>
           </div>
        </div>
      )}

      {/* Historical table remains the same */}
      <div className="glass-mewar rounded-[40px] shadow-xl overflow-hidden border border-gold/10">
        <div className="p-10 bg-white border-b border-gold/10 flex justify-between items-center">
           <h3 className="text-2xl font-heritage font-bold">Historical Registry</h3>
           <History size={24} className="text-gold" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-marble/50">
              <tr>
                <th className="p-8 text-[10px] font-bold uppercase text-gold/60">Tithi (Date)</th>
                <th className="p-8 text-[10px] font-bold uppercase text-gold/60">Vivaran (Item)</th>
                <th className="p-8 text-[10px] font-bold uppercase text-gold/60 text-center">Ansh (Qty)</th>
                <th className="p-8 text-[10px] font-bold uppercase text-gold/60 text-right">Jama (Total)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold/5">
              {history.length === 0 ? (
                <tr><td colSpan={4} className="p-24 text-center text-gray-300 italic font-heritage">No entries found.</td></tr>
              ) : (
                history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gold/5 transition-colors">
                    <td className="p-8 text-xs text-gray-400 font-bold">{new Date(entry.created_at).toLocaleDateString()}</td>
                    <td className="p-8 font-bold text-gray-800 capitalize text-xl">{entry.item}</td>
                    <td className="p-8 text-center font-heritage font-bold text-gray-600 text-2xl">{entry.quantity}</td>
                    <td className="p-8 text-right font-heritage font-bold text-green-600 text-3xl">₹{entry.amount.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showErrorModal}
        title="Voice Support Missing"
        message="Hukumn, your browser does not support voice recognition. Please use Google Chrome for the best experience in the royal court."
        confirmLabel="Dhanyawad"
        type="alert"
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
      />
      </div>
    </div>
  );
};
