
import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Info, Sparkles, Camera, RotateCcw, AlertCircle } from 'lucide-react';
import { useGemini } from '../../hooks/useGemini';

export const AuthenticityScanner: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const { verifyAuthenticity, loading } = useGemini();

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setImage(reader.result as string);
        const result = await verifyAuthenticity(base64);
        if (result) {
          setReport(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const reset = () => {
    setImage(null);
    setReport(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-12 pb-32 font-outfit">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-heritage font-bold text-gray-900 uppercase tracking-tight">Authenticity Guard</h1>
        <p className="text-gray-500 italic max-w-xl mx-auto">Gemini Pro Vision forensic analysis. Protecting Udaipur's artistic soul from machine duplication.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        <div className="space-y-6">
           {!image ? (
            <label className="aspect-[4/5] rounded-[40px] border-4 border-dashed border-gold/20 flex flex-col items-center justify-center p-12 text-center cursor-pointer bg-white/40 hover:bg-gold/5 transition-all group overflow-hidden shadow-inner">
              <div className="p-8 bg-gold/10 rounded-full text-gold group-hover:scale-110 transition-transform shadow-lg shadow-gold/5">
                <Camera size={56} />
              </div>
              <p className="text-lg font-heritage font-bold text-gray-900 mt-8 uppercase tracking-tighter">Point at Brushstrokes</p>
              <p className="text-xs text-gray-400 mt-2 uppercase tracking-widest font-bold">Start Forensic Analysis</p>
              <input type="file" capture="environment" className="hidden" onChange={handleScan} />
            </label>
           ) : (
            <div className="space-y-6 animate-in zoom-in duration-500">
              <div className="aspect-[4/5] rounded-[40px] border-4 border-white shadow-2xl overflow-hidden relative">
                <img src={image} className="w-full h-full object-cover" alt="Scanning art" />
                {loading && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                    <Loader2 className="animate-spin mb-4" size={48} />
                    <p className="font-heritage font-bold text-xl uppercase tracking-widest">Scanning Pigments...</p>
                  </div>
                )}
              </div>
              <button 
                onClick={reset} 
                className="w-full py-4 bg-white border border-gold/20 rounded-2xl text-[10px] font-bold text-gold uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-gold/5 transition-all shadow-sm"
              >
                <RotateCcw size={14} /> Scan another piece
              </button>
            </div>
           )}
        </div>

        <div className="space-y-6">
          {loading ? (
            <div className="glass-mewar p-12 rounded-[40px] flex flex-col items-center justify-center min-h-[500px] border-2 border-gold/10 bg-white/60 shadow-xl">
              <div className="relative mb-8">
                 <Loader2 className="animate-spin text-gold opacity-10" size={120} />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="text-gold animate-pulse" size={48} />
                 </div>
              </div>
              <div className="text-center space-y-2">
                 <p className="font-heritage text-2xl text-gray-900 font-bold uppercase tracking-tight">AI Forensics Active</p>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Comparing stroke jitter and pigment depth</p>
              </div>
            </div>
          ) : report ? (
            <div className="glass-mewar p-10 rounded-[40px] border-b-[16px] shadow-2xl animate-in slide-in-from-right duration-500 bg-white flex flex-col gap-8 transition-all hover:translate-y-[-4px]" style={{ borderColor: report.isHandmade ? '#10b981' : '#f59e0b' }}>
              <div className="flex items-center gap-6">
                <div className={`p-5 rounded-3xl text-white shadow-xl ${report.isHandmade ? 'bg-green-500 shadow-green-100' : 'bg-amber-500 shadow-amber-100'}`}>
                   {report.isHandmade ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
                </div>
                <div>
                  <h3 className={`text-3xl font-heritage font-bold uppercase tracking-tight ${report.isHandmade ? 'text-green-600' : 'text-amber-600'}`}>
                    {report.isHandmade ? "Authentic Art" : "Possible Machine Print"}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Sparkles size={12} className="text-gold" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Forensic Confidence: {report.confidence}%</p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-8 bg-gray-50 rounded-[32px] border border-gold/10 shadow-inner">
                   <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5"><Info size={12} /> AI Detailed Reasoning</p>
                   <p className="text-gray-700 italic font-medium leading-relaxed">
                     "{report.reasoning}"
                   </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 ml-1">Visual Indicators Spotted</p>
                  {report.indicators?.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-gold/5 rounded-2xl shadow-sm">
                      <div className="w-2 h-2 bg-gold rounded-full shrink-0" />
                      <span className="text-sm font-bold text-gray-600 uppercase tracking-tighter">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gold/5 p-10 rounded-[40px] border border-gold/10 h-full flex flex-col justify-center">
              <h3 className="text-2xl font-heritage font-bold mb-6 text-gray-900 uppercase">Verification Protocol</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center font-bold text-xs shrink-0">1</div>
                   <p className="text-sm text-gray-600 leading-relaxed font-medium">Point your camera at the piece, focusing on the fine line-work and shading gradients.</p>
                </div>
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center font-bold text-xs shrink-0">2</div>
                   <p className="text-sm text-gray-600 leading-relaxed font-medium">Gemini Pro searches for machine halftones (tiny dots) or hand-painted ink bleed patterns.</p>
                </div>
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center font-bold text-xs shrink-0">3</div>
                   <p className="text-sm text-gray-600 leading-relaxed font-medium">Receive a confidence report based on thousands of Udaipur heritage reference images.</p>
                </div>
                <div className="mt-8 p-6 bg-white/60 rounded-3xl border border-dashed border-gold/20 flex items-start gap-3">
                  <AlertCircle size={20} className="text-gold shrink-0 mt-1" />
                  <p className="text-[10px] text-gray-400 italic leading-relaxed">This tool is a high-precision AI assistant. For museum-grade valuation, please consult the City Palace Cultural Heritage board.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
