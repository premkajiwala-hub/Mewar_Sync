
import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, Info, Sparkles, Camera, RotateCcw, AlertCircle, History } from 'lucide-react';
import { useGemini } from '../../hooks/useGemini';

export const AuthenticityScanner: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const { verifyAuthenticity, loading, error } = useGemini();

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
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 pb-32 font-outfit">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-heritage font-bold text-gray-900 uppercase tracking-tight">
          Authenticity Guard
        </h1>
        <p className="text-gray-500 italic max-w-2xl mx-auto text-sm md:text-base">
          Udaipur Digital Guild forensic analysis. Protecting the artistic soul of Mewar from machine duplication.
        </p>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Camera/Preview Area */}
        <div className="w-full lg:col-span-5 space-y-6">
          <div className="relative group">
            {!image ? (
              <label className="aspect-[4/5] w-full rounded-[40px] border-4 border-dashed border-gold/30 flex flex-col items-center justify-center p-8 text-center cursor-pointer bg-white/60 hover:bg-gold/5 transition-all overflow-hidden shadow-inner group">
                <div className="p-6 bg-gold/10 rounded-full text-gold group-hover:scale-110 transition-transform shadow-lg shadow-gold/5">
                  <Camera size={48} />
                </div>
                <div className="mt-6 space-y-2">
                  <p className="text-xl font-heritage font-bold text-gray-900 uppercase tracking-tighter">Point at Brushstrokes</p>
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Start Forensic Analysis</p>
                </div>
                <input type="file" capture="environment" className="hidden" onChange={handleScan} />
              </label>
            ) : (
              <div className="space-y-4 animate-in zoom-in duration-500">
                <div className="aspect-[4/5] w-full rounded-[40px] border-4 border-white shadow-2xl overflow-hidden relative">
                  <img src={image} className="w-full h-full object-cover" alt="Scanning art" referrerPolicy="no-referrer" />
                  {loading && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
                      <div className="relative mb-6">
                        <Loader2 className="animate-spin text-gold opacity-20" size={80} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Sparkles className="text-gold animate-pulse" size={32} />
                        </div>
                      </div>
                      <p className="font-heritage font-bold text-xl uppercase tracking-widest">AI Forensics Active</p>
                      <p className="text-[10px] text-gold/80 uppercase tracking-[0.2em] mt-2">Analyzing pigment depth & stroke jitter</p>
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={reset} 
                  className="w-full py-4 bg-white border-2 border-gold/20 rounded-2xl text-[10px] font-bold text-gold uppercase tracking-[0.3em] flex items-center justify-center gap-2 hover:bg-gold/5 transition-all shadow-sm"
                >
                  <RotateCcw size={14} /> Scan another piece
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 animate-in slide-in-from-top duration-300">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-tight">Scan Interrupted</p>
                <p className="text-xs opacity-80">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Report/Instructions Area */}
        <div className="w-full lg:col-span-7 space-y-6">
          {loading ? (
            <div className="glass-mewar p-8 md:p-12 rounded-[40px] flex flex-col items-center justify-center min-h-[400px] border-2 border-gold/10 bg-white/80 shadow-xl text-center">
              <div className="w-20 h-20 border-4 border-gold/20 border-t-gold rounded-full animate-spin mb-8" />
              <div className="space-y-3">
                <h3 className="font-heritage text-2xl text-gray-900 font-bold uppercase tracking-tight">Verifying Authenticity</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest max-w-xs mx-auto">
                  Gemini Pro Vision is comparing visual patterns against Udaipur heritage reference images.
                </p>
              </div>
            </div>
          ) : report ? (
            <div className="glass-mewar p-6 md:p-10 rounded-[40px] border-b-[16px] shadow-2xl animate-in slide-in-from-right duration-500 bg-white flex flex-col gap-8 transition-all" style={{ borderColor: report.isHandmade ? '#10b981' : '#f59e0b' }}>
              
              {/* Status Header */}
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className={`p-5 rounded-3xl text-white shadow-xl ${report.isHandmade ? 'bg-green-500 shadow-green-100' : 'bg-amber-500 shadow-amber-100'}`}>
                   {report.isHandmade ? <ShieldCheck size={40} /> : <ShieldAlert size={40} />}
                </div>
                <div>
                  <h3 className={`text-3xl font-heritage font-bold uppercase tracking-tight ${report.isHandmade ? 'text-green-600' : 'text-amber-600'}`}>
                    {report.isHandmade ? "Authentic Art" : "Possible Machine Print"}
                  </h3>
                  <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                    <Sparkles size={12} className="text-gold" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Forensic Confidence: {report.confidence}%</p>
                  </div>
                </div>
              </div>

              {/* Heritage Story Section */}
              <div className="space-y-6">
                <div className="p-6 md:p-8 bg-gray-50 rounded-[32px] border border-gold/10 shadow-inner relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-5">
                      <History size={120} className="text-gold" />
                   </div>
                   <p className="text-[10px] text-gold font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                     <Sparkles size={14} /> Heritage Story & AI Reasoning
                   </p>
                   <p className="text-gray-700 italic font-medium leading-relaxed relative z-10 text-sm md:text-base">
                     "{report.reasoning}"
                   </p>
                </div>
                
                {/* Visual Indicators */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <p className="col-span-full text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1 ml-1">Visual Indicators Spotted</p>
                  {report.indicators?.map((item: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-4 p-4 bg-white border border-gold/5 rounded-2xl shadow-sm hover:border-gold/20 transition-colors">
                      <div className="w-2 h-2 bg-gold rounded-full shrink-0" />
                      <span className="text-xs font-bold text-gray-600 uppercase tracking-tighter">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button 
                onClick={reset}
                className="w-full py-5 bg-gradient-to-r from-gold to-amber-500 text-white rounded-[24px] font-heritage font-bold text-lg uppercase tracking-widest shadow-xl shadow-gold/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3"
              >
                <Camera size={20} /> Scan Product Authenticity
              </button>
            </div>
          ) : (
            /* Initial Protocol View */
            <div className="bg-gold/5 p-8 md:p-10 rounded-[40px] border border-gold/10 h-full flex flex-col justify-center space-y-8">
              <div className="space-y-2">
                <h3 className="text-2xl font-heritage font-bold text-gray-900 uppercase">Verification Protocol</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Udaipur Digital Guild Standards</p>
              </div>

              <div className="space-y-6">
                {[
                  { step: 1, text: "Point your camera at the piece, focusing on the fine line-work and shading gradients." },
                  { step: 2, text: "Gemini Pro searches for machine halftones (tiny dots) or hand-painted ink bleed patterns." },
                  { step: 3, text: "Receive a confidence report based on thousands of Udaipur heritage reference images." }
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-2xl bg-gold/10 text-gold flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                      {item.step}
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed font-medium pt-2">{item.text}</p>
                  </div>
                ))}
                
                <div className="mt-8 p-6 bg-white/60 rounded-3xl border border-dashed border-gold/20 flex items-start gap-3">
                  <AlertCircle size={20} className="text-gold shrink-0 mt-1" />
                  <p className="text-[10px] text-gray-400 italic leading-relaxed">
                    This tool is a high-precision AI assistant. For museum-grade valuation, please consult the City Palace Cultural Heritage board.
                  </p>
                </div>
              </div>

              {/* Main Scan Trigger */}
              <label className="w-full py-5 bg-gradient-to-r from-gold to-amber-500 text-white rounded-[24px] font-heritage font-bold text-lg uppercase tracking-widest shadow-xl shadow-gold/20 hover:scale-[1.02] transition-transform flex items-center justify-center gap-3 cursor-pointer">
                <Camera size={20} /> Scan Product Authenticity
                <input type="file" capture="environment" className="hidden" onChange={handleScan} />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
