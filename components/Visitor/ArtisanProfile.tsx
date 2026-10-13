
import React, { useState, useEffect } from 'react';
import { UserProfile, ArtisanProduct, ContactMessage } from '../../types';
import { storage } from '../../services/storage';
import { 
  X, Phone, MapPin, Languages, ShieldCheck, 
  Navigation, Mail, Send, Grid, Image as ImageIcon,
  CheckCircle2, Loader2, Info, Sparkles, Heart, Store, IndianRupee, MessageSquare
} from 'lucide-react';
import { ProductDetail } from './ProductDetail';
import { JharokaFrame } from '../UI/JharokaFrame';

interface ArtisanProfileProps {
  artisan: UserProfile;
  onOpenMessenger?: (artisan: UserProfile) => void;
  onClose: () => void;
}

export const ArtisanProfile: React.FC<ArtisanProfileProps> = ({ artisan, onOpenMessenger, onClose }) => {
  const [products, setProducts] = useState<ArtisanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ArtisanProduct | null>(null);
  const [localArtisan, setLocalArtisan] = useState(artisan);
  const user = storage.getCurrentUser();
  const isVisitor = user?.role === 'VISITOR';
  const isOwnProfile = user?.id === artisan.id;
  
  // Contact Form State
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const fetchArtisanData = async () => {
      setLoading(true);
      const allProducts = await storage.getProducts();
      const artisanProducts = allProducts.filter(p => p.shop_id === artisan.id);
      setProducts(artisanProducts);
      setLoading(false);
    };
    fetchArtisanData();
  }, [artisan.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;

    setSending(true);
    try {
      await storage.sendContactMessage({
        artisan_id: artisan.id,
        visitor_name: contactName,
        visitor_email: contactEmail,
        message: contactMessage,
        timestamp: new Date().toISOString(),
        status: 'NEW'
      });
      setSent(true);
      setContactName('');
      setContactEmail('');
      setContactMessage('');
      setTimeout(() => setSent(false), 3000);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleTakeMeThere = () => {
    if (artisan.location) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${artisan.location.lat},${artisan.location.lng}`;
      window.open(url, '_blank');
    }
  };

  const handleLikeArtisan = async () => {
    if (!user) return;
    await storage.likeArtisan(artisan.id, user.id);
    const likes = localArtisan.likes || [];
    const newLikes = likes.includes(user.id) ? likes.filter(id => id !== user.id) : [...likes, user.id];
    setLocalArtisan({ ...localArtisan, likes: newLikes });
  };

  const cleanHeritageText = (text: string) => {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '"$1"');
  };

  return (
    <div className="absolute inset-0 z-[50] bg-white overflow-y-auto no-scrollbar animate-in fade-in duration-300">
      <div className="w-full">
        <div className="bg-white min-h-full relative">
          <div className="p-8 md:p-12">
            {/* Header */}
            <div className="flex justify-between items-start mb-10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-royal-gradient flex items-center justify-center text-white text-3xl font-bold shadow-xl overflow-hidden border-2 border-white">
                  {artisan.profile_picture ? (
                    <img src={artisan.profile_picture} className="w-full h-full object-cover" alt={artisan.name} />
                  ) : (
                    artisan.name[0]
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-4xl font-heritage font-bold text-gray-900">{artisan.name}</h3>
                    <ShieldCheck className="text-emerald-500" size={24} />
                  </div>
                  <p className="text-xs font-bold text-gold uppercase tracking-[0.3em]">{artisan.category || 'Master Artisan Profile'}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="bg-gray-100 text-gray-400 p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Left Column: Info & Story */}
              <div className="space-y-10">
                <JharokaFrame className="aspect-video shadow-2xl">
                  <div className="w-full h-full bg-royal-gradient flex items-center justify-center text-white/20 overflow-hidden">
                    {artisan.thumbnail ? (
                      <img src={artisan.thumbnail} className="w-full h-full object-cover" alt="Heritage Thumbnail" />
                    ) : (
                      <ImageIcon size={80} />
                    )}
                  </div>
                </JharokaFrame>

                <div className="space-y-8">
                  <div className="p-8 bg-gray-50 rounded-[32px] border border-gold/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                      <Sparkles size={64} className="text-gold" />
                    </div>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Info size={14} className="text-gold" /> Heritage Story
                    </h4>
                    <p className="text-xl text-gray-600 italic leading-relaxed border-l-4 border-gold/20 pl-8 py-2">
                      {cleanHeritageText(artisan.description || artisan.shopAddress || `A master of ${artisan.category || 'traditional crafts'} based in the heart of Udaipur, preserving centuries of heritage through every creation.`)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Language</p>
                      <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Languages size={14} className="text-gold" /> {artisan.preferredLanguage || 'Hindi, English'}</p>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Experience</p>
                      <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Sparkles size={14} className="text-gold" /> Master Craftsman</p>
                    </div>
                  </div>
                </div>

                  <div className="flex gap-6">
                    <button 
                      onClick={handleTakeMeThere}
                      className="flex-grow bg-royal-gradient text-white py-6 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-4 hover:scale-[1.02] transition-transform active:scale-95"
                    >
                      <Navigation size={24} /> Visit Workshop
                    </button>
                    <button 
                      onClick={handleLikeArtisan}
                      className={`w-20 h-20 rounded-2xl border-2 flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                        localArtisan.likes?.includes(user?.id || '') ? 'bg-red-50 border-red-200 text-red-500' : 'border-gold/20 text-gold hover:bg-gold/5'
                      }`}
                    >
                      <Heart size={32} fill={localArtisan.likes?.includes(user?.id || '') ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {isOwnProfile && (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-gold/10 pb-4">
                        <h4 className="text-xs font-bold text-gold uppercase tracking-[0.3em] flex items-center gap-3">
                          <MessageSquare size={20} /> Visitor Messenger
                        </h4>
                      </div>
                      <div className="bg-gold/5 rounded-[32px] border border-gold/10 p-8">
                        <p className="text-sm text-gray-600 italic mb-6">Hukumn, you can manage all your visitor conversations using the messenger icon in your top header. Below is a quick view of your digital registry.</p>
                        <button 
                          onClick={() => onOpenMessenger?.(artisan)}
                          className="w-full py-4 bg-white border border-gold/20 text-gold rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-gold/5 transition-all flex items-center justify-center gap-2"
                        >
                          <MessageSquare size={16} /> Open Messenger
                        </button>
                      </div>
                    </div>
                  )}

                {/* Messenger Section */}
                {isVisitor && (
                  <div className="p-10 glass-mewar rounded-[48px] border border-gold/10 shadow-2xl bg-white/50 text-center space-y-6">
                    <div className="w-20 h-20 bg-gold/5 rounded-full flex items-center justify-center mx-auto text-gold">
                      <MessageSquare size={40} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-heritage font-bold text-gray-900">Have an inquiry?</h4>
                      <p className="text-sm text-gray-400 italic mt-2">Ask the artisan directly by texting them in our secure messenger.</p>
                    </div>
                    <button 
                      onClick={() => onOpenMessenger?.(artisan)}
                      className="w-full py-6 bg-royal-gradient text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-4 hover:shadow-2xl active:scale-[0.98] transition-all"
                    >
                      <Send size={20} /> Start Royal Chat
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column: Gallery */}
              <div className="space-y-10">
                <div className="flex items-center justify-between border-b border-gold/10 pb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                    <Store size={20} className="text-gold" /> Available Masterpieces
                  </h4>
                  <span className="bg-gold/10 text-gold text-[10px] font-bold px-4 py-1.5 rounded-full border border-gold/10">
                    {products.length} Items
                  </span>
                </div>

                {loading ? (
                  <div className="py-32 flex flex-col items-center justify-center gap-6 text-gold/40">
                    <Loader2 className="animate-spin" size={48} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Curating Gallery...</p>
                  </div>
                ) : products.length === 0 ? (
                  <div className="py-32 text-center bg-gray-50 rounded-[48px] border-4 border-dashed border-gold/5">
                    <ImageIcon size={64} className="mx-auto text-gray-200 mb-6" />
                    <p className="text-lg text-gray-400 font-heritage italic">No products listed in the digital registry yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {products.map(product => (
                      <div 
                        key={product.id} 
                        onClick={() => setSelectedProduct(product)}
                        className="group bg-white p-4 rounded-[32px] border border-gold/5 shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer"
                      >
                        <div className="aspect-square rounded-2xl overflow-hidden mb-4 relative">
                          <img 
                            src={product.image_url} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                            alt={product.title}
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                            <span className="text-white text-[10px] font-bold uppercase tracking-widest">View Details</span>
                          </div>
                        </div>
                        <h5 className="font-heritage font-bold text-xl text-gray-900 truncate mb-1">{product.title}</h5>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-gold uppercase tracking-widest">{product.style}</span>
                          {!isVisitor && (
                            <div className="flex items-center gap-1 text-gray-900">
                              <IndianRupee size={14} />
                              <span className="font-bold">{product.price.toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedProduct && (
        <ProductDetail 
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
};
