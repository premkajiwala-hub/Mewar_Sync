
import React, { useState } from 'react';
import { ArtisanProduct, UserProfile, Review } from '../../types';
import { X, Heart, Sparkles, IndianRupee, MessageSquare, Send, Phone, Mail, ShieldCheck, Loader2, ShieldAlert, Info, RotateCcw } from 'lucide-react';
import { storage } from '../../services/storage';
import { useGemini } from '../../hooks/useGemini';

interface ProductDetailProps {
  product: ArtisanProduct;
  onClose: () => void;
  onLike?: (productId: string) => void;
  onViewProfile?: (artisan: UserProfile) => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({ product, onClose, onLike, onViewProfile }) => {
  const [artisan, setArtisan] = useState<UserProfile | null>(null);
  const [loadingArtisan, setLoadingArtisan] = useState(false);
  const [localProduct, setLocalProduct] = useState(product);
  const [scanReport, setScanReport] = useState<any>(null);
  const { verifyAuthenticity, loading: scanning } = useGemini();
  const user = storage.getCurrentUser();
  const isVisitor = user?.role === 'VISITOR';

  React.useEffect(() => {
    const fetchArtisan = async () => {
      setLoadingArtisan(true);
      const data = await storage.getProfile(product.shop_id);
      setArtisan(data);
      setLoadingArtisan(false);
    };
    fetchArtisan();
  }, [product.shop_id]);

  const handleLike = async () => {
    if (!user) return;
    await storage.likeProduct(product.id, user.id);
    const likes = localProduct.likes || [];
    const newLikes = likes.includes(user.id) ? likes.filter(id => id !== user.id) : [...likes, user.id];
    setLocalProduct({ ...localProduct, likes: newLikes });
    if (onLike) onLike(product.id);
  };

  const handleAuthenticityScan = async () => {
    if (scanning) return;
    
    try {
      // Convert image URL to base64 for scanning
      // Since it's picsum or external, we might need a proxy or just fetch it
      const response = await fetch(localProduct.image_url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await verifyAuthenticity(base64);
        if (result) {
          setScanReport(result);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Scan failed:", error);
      alert("Hukumn, the forensic scan encountered an error. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 md:p-8">
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300" 
        onClick={onClose}
      />
      <div className="bg-white max-w-6xl w-full max-h-[95vh] rounded-[32px] md:rounded-[48px] shadow-2xl relative overflow-hidden flex flex-col md:flex-row border-4 border-gold/20 animate-in zoom-in-95 duration-300">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 md:top-8 md:right-8 text-gray-400 hover:text-red-500 transition-all z-50 bg-white/90 backdrop-blur-md rounded-full p-2 md:p-3 shadow-xl hover:rotate-90"
        >
          <X size={20} className="md:w-6 md:h-6" />
        </button>
        
        {/* Left: Image Section */}
        <div className="w-full md:w-3/5 h-[40vh] md:h-full flex-shrink-0 bg-stone-900 flex items-center justify-center relative group overflow-hidden">
          {/* Background Blur for better presentation */}
          <div 
            className="absolute inset-0 opacity-30 blur-3xl scale-150"
            style={{ 
              backgroundImage: `url(${localProduct.image_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          
          <img 
            src={localProduct.image_url} 
            className="relative z-10 w-full h-full object-contain transition-all duration-1000 group-hover:scale-110 shadow-2xl" 
            style={{ imageRendering: 'auto' }}
            alt={localProduct.title} 
            referrerPolicy="no-referrer"
          />

          {/* Scanning Overlay */}
          {scanning && (
            <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
              <div className="relative mb-6">
                <Loader2 className="animate-spin text-gold opacity-20" size={120} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ShieldCheck className="text-gold animate-pulse" size={48} />
                </div>
                {/* Scanning Line Animation */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gold/50 shadow-[0_0_15px_rgba(212,175,55,0.8)] animate-scan-line" />
              </div>
              <p className="font-heritage font-bold text-2xl uppercase tracking-[0.2em] text-gold">AI Forensics Active</p>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">Analyzing Pigment Depth & Stroke Jitter</p>
            </div>
          )}

          {/* Scan Result Overlay */}
          {scanReport && !scanning && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-8 animate-in zoom-in duration-300">
              <div className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border-b-[12px]" style={{ borderColor: scanReport.isHandmade ? '#10b981' : '#f59e0b' }}>
                <div className="flex items-center gap-6 mb-8">
                  <div className={`p-4 rounded-2xl text-white ${scanReport.isHandmade ? 'bg-green-500' : 'bg-amber-500'}`}>
                    {scanReport.isHandmade ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
                  </div>
                  <div>
                    <h3 className={`text-2xl font-heritage font-bold uppercase tracking-tight ${scanReport.isHandmade ? 'text-green-600' : 'text-amber-600'}`}>
                      {scanReport.isHandmade ? "Verified Authentic" : "Machine Print Detected"}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confidence: {scanReport.confidence}%</p>
                  </div>
                </div>
                
                <p className="text-gray-600 italic leading-relaxed mb-8 text-sm">
                  "{scanReport.reasoning}"
                </p>

                <button 
                  onClick={() => setScanReport(null)}
                  className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Close Report
                </button>
              </div>
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Authenticity Badge */}
          {localProduct.is_verified && !scanning && !scanReport && (
            <div className="absolute top-12 left-12 bg-white/95 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-emerald-500/20 flex items-center gap-3 shadow-2xl z-20 animate-in slide-in-from-left duration-700">
              <ShieldCheck size={24} className="text-emerald-600" />
              <span className="text-xs font-bold text-gray-900 uppercase tracking-[0.2em]">VERIFIED CERTIFIED</span>
            </div>
          )}
        </div>
        
        {/* Right: Info & Interaction Section */}
        <div className="w-full md:w-2/5 flex flex-col bg-white overflow-hidden">
          <div className="p-8 md:p-12 flex flex-col h-full overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="mb-6 md:mb-10">
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <span className="text-[8px] md:text-[10px] font-bold text-gold uppercase tracking-[0.2em] bg-gold/5 px-3 md:px-5 py-1.5 md:py-2 rounded-full border border-gold/10">
                  {localProduct.style} Style
                </span>
                <button 
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full transition-all shadow-sm ${
                    localProduct.likes?.includes(user?.id || '') ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-50 text-gray-400 border border-gray-100'
                  }`}
                >
                  <Heart size={14} className="md:w-4 md:h-4" fill={localProduct.likes?.includes(user?.id || '') ? 'currentColor' : 'none'} />
                  <span className="text-[8px] md:text-[10px] font-bold tracking-widest">{localProduct.likes?.length || 0}</span>
                </button>
              </div>
              <h2 className="text-2xl md:text-4xl font-heritage font-bold text-gray-900 leading-[1.1] tracking-tight">{localProduct.title}</h2>
              
              {!isVisitor && (
                <div className="flex items-center gap-2 mt-4 md:mt-6 text-saffron">
                  <IndianRupee size={20} className="md:w-7 md:h-7" />
                  <span className="text-2xl md:text-4xl font-bold tracking-tighter">{localProduct.price.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Authenticity Scan Button - MOST IMPORTANT */}
            <button 
              onClick={handleAuthenticityScan}
              disabled={scanning}
              className="w-full mb-10 py-5 bg-royal-gradient text-white rounded-3xl font-bold text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4 border border-white/20 disabled:opacity-50"
            >
              <ShieldCheck size={24} />
              {scanning ? 'Forensics in Progress...' : 'Scan Product Authenticity'}
            </button>

            {/* Description */}
            <div className="mb-12">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles size={14} className="text-gold" /> Heritage Story
              </h4>
              <p className="text-gray-600 leading-relaxed italic border-l-4 border-gold/20 pl-8 py-2 text-lg">
                {localProduct.description}
              </p>
            </div>

            {/* Artisan Info */}
            <div className="p-8 bg-gray-50 rounded-[40px] border border-gold/5 mb-12 shadow-inner">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">Crafted By</h4>
              {loadingArtisan ? (
                <div className="flex items-center gap-3 text-gold/40 py-4">
                  <Loader2 className="animate-spin" size={20} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Fetching artisan...</span>
                </div>
              ) : artisan ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-royal-gradient flex items-center justify-center text-white font-bold shadow-xl text-2xl">
                      {artisan.name[0]}
                    </div>
                    <div>
                      <p className="font-heritage font-bold text-gray-900 text-xl">{artisan.name}</p>
                      <p className="text-[10px] text-gold font-bold uppercase tracking-widest mt-1">{artisan.category}</p>
                    </div>
                  </div>
                  
                  {/* Contact Info */}
                  <div className="pt-6 border-t border-gold/10 grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gold/5">
                        <Phone size={16} className="text-gold" />
                      </div>
                      <span className="text-sm font-bold tracking-tight">{artisan.phone || 'Contact Private'}</span>
                    </div>
                    <div className="flex items-center gap-4 text-gray-600">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gold/5">
                        <Mail size={16} className="text-gold" />
                      </div>
                      <span className="text-sm font-bold tracking-tight">{artisan.email}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">Artisan details unavailable</p>
              )}
            </div>

            {/* Comments Section (Read Only) */}
            <div className="flex-grow flex flex-col">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <MessageSquare size={16} className="text-gold" /> Visitor Appreciation ({localProduct.reviews?.length || 0})
              </h4>
              
              <div className="flex-grow space-y-4 max-h-80 overflow-y-auto no-scrollbar pr-2">
                {localProduct.reviews?.map((review, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">{review.visitor_name}</p>
                      <p className="text-[8px] text-gray-400 font-bold uppercase">{new Date(review.date).toLocaleDateString()}</p>
                    </div>
                    <p className="text-sm text-gray-600 italic leading-relaxed">"{review.comment}"</p>
                  </div>
                ))}
                {(!localProduct.reviews || localProduct.reviews.length === 0) && (
                  <div className="text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-xs text-gray-400 italic">No appreciation messages yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
