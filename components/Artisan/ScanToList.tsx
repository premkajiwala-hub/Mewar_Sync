
import React, { useState, useEffect } from 'react';
import { Camera, Sparkles, Loader2, Package, IndianRupee, RotateCcw, AlertTriangle, CheckCircle } from 'lucide-react';
import { JharokaFrame } from '../UI/JharokaFrame';
import { useGemini } from '../../hooks/useGemini';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { storage } from '../../services/storage';

interface ScanToListProps {
  onProductAdded?: () => void;
}

export const ScanToList: React.FC<ScanToListProps & { onModalToggle?: (isOpen: boolean) => void }> = ({ onProductAdded, onModalToggle }) => {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });
  const { analyzeProductImage, loading, error } = useGemini();
  const user = storage.getCurrentUser();

  useEffect(() => {
    onModalToggle?.(modalConfig.isOpen);
  }, [modalConfig.isOpen, onModalToggle]);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setImage(reader.result as string);
        try {
          const result = await analyzeProductImage(base64);
          if (result) {
            setAnalysis(result);
            // Log interaction to storage
            await storage.logAIInteraction('SCANNER_PRODUCT', 'Image Analysis', result);
          } else {
            throw new Error("No analysis returned");
          }
        } catch (err) {
          console.warn("Analysis failed, using heritage fallback.");
          setAnalysis({
            title: "Heritage Masterpiece",
            story: "A masterful creation from the heart of Udaipur, preserving the artistic legacy of Mewar through intricate detail.",
            price: 2500,
            style: "Mewari"
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleList = async () => {
    if (!analysis || !image || !user || !imageFile) return;
    
    try {
      const secureUrl = await storage.uploadFile(imageFile);
      await storage.saveProduct({
        title: analysis.title || `${analysis.style} Masterpiece`,
        description: analysis.story,
        price: analysis.price,
        style: analysis.style,
        image_url: secureUrl,
        shop_id: user.id
      });
      
      setModalConfig({
        isOpen: true,
        title: "Success",
        message: "Hukumn, your art has been archived in the Royal Gallery!",
        type: 'alert'
      });
      if (onProductAdded) onProductAdded();
      setAnalysis(null);
      setImage(null);
      setImageFile(null);
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: "Error",
        message: "Failed to archive piece. Please check your connection.",
        type: 'alert'
      });
    }
  };

  return (
    <div className="p-10 glass-mewar rounded-[40px] shadow-2xl border-2 border-gold/10 relative overflow-hidden bg-white/40 min-h-[600px]">
      <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12">
        <Sparkles size={240} />
      </div>
      
      <div className="mb-12 text-center relative z-10">
        <h2 className="text-4xl font-heritage font-bold text-gray-900 mb-2 uppercase tracking-tight">Scan-to-List</h2>
        <p className="text-gray-500 italic text-sm">Vision AI curator for your handmade collection</p>
      </div>
      
      {error && (
        <div className="mb-8 p-5 bg-amber-50 border border-amber-100 rounded-[24px] flex items-center gap-4 text-amber-700 text-xs font-bold animate-in slide-in-from-top">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <p className="uppercase tracking-widest">AI Hub Busy</p>
            <p className="font-medium normal-case mt-0.5 opacity-80">Using local heritage archive knowledge for this entry.</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row gap-12 relative z-10">
        <div className="w-full md:w-5/12">
          {!image ? (
            <label className="flex flex-col items-center justify-center aspect-[4/5] border-2 border-dashed border-gold/30 rounded-[40px] cursor-pointer hover:bg-gold/5 transition-all group overflow-hidden bg-white/40 shadow-inner">
              <div className="p-8 rounded-full bg-gold/10 text-gold group-hover:scale-110 transition-transform shadow-lg shadow-gold/5">
                <Camera size={48} />
              </div>
              <span className="mt-8 text-xs font-bold text-gray-500 uppercase tracking-widest">Capture Art</span>
              <p className="text-[10px] text-gray-400 mt-2 italic px-8 text-center leading-relaxed">Let Gemini Vision analyze your craft's soul</p>
              <input type="file" capture="environment" className="hidden" onChange={handleCapture} />
            </label>
          ) : (
            <div className="animate-in zoom-in duration-500">
              <JharokaFrame className="rounded-[40px] shadow-2xl border-4 border-white">
                <img src={image} className="w-full h-full object-cover" alt="Captured art" />
              </JharokaFrame>
              <button 
                onClick={() => {setImage(null); setImageFile(null); setAnalysis(null);}}
                className="mt-6 w-full py-4 border border-gold/20 rounded-2xl text-[10px] font-bold text-gold uppercase tracking-widest hover:bg-gold/5 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} /> Retake Photo
              </button>
            </div>
          )}
        </div>

        <div className="w-full md:w-7/12">
          {loading ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center space-y-8 glass-mewar rounded-[40px] border border-gold/5 bg-white/80 shadow-2xl">
              <div className="relative">
                <Loader2 size={80} className="animate-spin text-gold opacity-10" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <Sparkles className="text-gold animate-pulse" size={32} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-gold font-bold text-[10px] uppercase tracking-[0.4em] animate-pulse">Whispering to Royal Archives...</p>
                <p className="text-[9px] text-gray-400 italic font-medium px-12">Building a heritage story for your masterpiece</p>
              </div>
            </div>
          ) : analysis ? (
            <div className="space-y-6 animate-in slide-in-from-right duration-500 bg-white p-10 rounded-[40px] border border-gold/10 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div className="px-4 py-1.5 bg-royal-gradient text-white rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-saffron/20">
                  {analysis.style || 'Mewari'} Style
                </div>
                <div className="flex items-center gap-1.5 text-gold">
                  <CheckCircle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Verified</span>
                </div>
              </div>
              
              <div className="space-y-5">
                <div className="group">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Archive Title</label>
                   <input 
                    className="text-2xl md:text-3xl font-heritage font-bold text-gray-900 bg-gray-50 border border-gold/5 rounded-2xl px-6 py-4 w-full focus:outline-none focus:ring-2 focus:ring-gold/20 transition-all"
                    value={analysis.title}
                    onChange={(e) => setAnalysis({...analysis, title: e.target.value})}
                  />
                </div>
                
                <div className="p-8 bg-amber-50/40 rounded-[32px] border border-gold/10 shadow-inner">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-4">Heritage Narrative</p>
                  <textarea 
                    className="w-full bg-transparent text-gray-700 italic text-sm md:text-base leading-relaxed font-medium resize-none focus:outline-none min-h-[140px]"
                    value={analysis.story}
                    onChange={(e) => setAnalysis({...analysis, story: e.target.value})}
                  />
                  <div className="flex items-center gap-2 mt-4 opacity-50">
                    <Sparkles size={12} className="text-gold" />
                    <p className="text-[9px] text-gold font-bold uppercase tracking-widest">Enhanced by Vision AI</p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 rounded-[32px] border border-gold/10 flex items-center justify-between shadow-sm">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-1 ml-1">Registry Value</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-3xl font-heritage font-bold text-gray-400">₹</span>
                    <input 
                      type="number"
                      className="text-4xl font-heritage font-bold text-gray-900 bg-transparent w-full focus:outline-none"
                      value={analysis.price}
                      onChange={(e) => setAnalysis({...analysis, price: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-[9px] font-bold rounded-full uppercase tracking-tighter">Premium Tier</span>
                </div>
              </div>
              
              <button
                onClick={handleList}
                className="w-full py-4 bg-royal-gradient text-white rounded-3xl font-bold flex items-center justify-center gap-3 shadow-2xl shadow-saffron/30 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-[0.2em]"
              >
                <Package size={20} /> Archive in Collection
              </button>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center glass-mewar rounded-[40px] border border-gold/5 p-16 bg-white/20">
              <div className="w-24 h-24 bg-gold/5 rounded-full flex items-center justify-center mb-8 border border-gold/10 shadow-inner">
                <Sparkles size={40} className="text-gold opacity-20" />
              </div>
              <h4 className="text-2xl font-heritage font-bold text-gray-400 uppercase tracking-tight">Curation Engine Ready</h4>
              <p className="text-gray-400 mt-4 text-sm italic max-w-xs mx-auto leading-relaxed">Capture your masterpiece to let Gemini build its story and evaluate its market standing.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmLabel="Dhanyawad"
        onConfirm={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onCancel={() => setModalConfig({ ...modalConfig, isOpen: false })}
      />
    </div>
  );
};
