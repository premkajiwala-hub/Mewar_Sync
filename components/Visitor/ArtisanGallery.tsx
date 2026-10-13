
import React, { useState, useEffect } from 'react';
import { storage } from '../../services/storage';
import { ArtisanProduct, UserProfile } from '../../types';
import { Loader2, Heart, MessageSquare, Phone, User, Sparkles, Search, Filter, X, IndianRupee, Send } from 'lucide-react';
import { JharokaFrame } from '../UI/JharokaFrame';
import { ProductDetail } from './ProductDetail';
import { ArtisanProfile } from './ArtisanProfile';

interface ArtisanGalleryProps {
  onOpenMessenger?: (artisan: UserProfile) => void;
}

export const ArtisanGallery: React.FC<ArtisanGalleryProps> = ({ onOpenMessenger }) => {
  const [products, setProducts] = useState<ArtisanProduct[]>([]);
  const [artisans, setArtisans] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ArtisanProduct | null>(null);
  const [selectedArtisan, setSelectedArtisan] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const user = storage.getCurrentUser();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && artisans.length > 0) {
      const openId = sessionStorage.getItem('open_artisan_id');
      if (openId) {
        const artisan = artisans.find(a => a.id === openId);
        if (artisan) {
          setSelectedArtisan(artisan);
        }
        sessionStorage.removeItem('open_artisan_id');
      }
    }
  }, [loading, artisans]);

  const fetchData = async () => {
    setLoading(true);
    const [productsData, artisansData] = await Promise.all([
      storage.getProducts(),
      storage.getProfiles()
    ]);
    setProducts(productsData);
    setArtisans(artisansData.filter(p => p.role === 'SHOPKEEPER'));
    setLoading(false);
  };

  const handleLike = async (productId: string) => {
    if (!user) return;
    await storage.likeProduct(productId, user.id);
    // Optimistic update or refetch
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const likes = p.likes || [];
        const newLikes = likes.includes(user.id) ? likes.filter(id => id !== user.id) : [...likes, user.id];
        return { ...p, likes: newLikes };
      }
      return p;
    }));
  };

  const filteredArtisans = artisans.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-gold w-12 h-12 mb-4" />
        <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Opening the Royal Gallery...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between bg-white/50 backdrop-blur-md p-6 rounded-[32px] border border-gold/10 shadow-sm">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={18} />
          <input 
            type="text"
            placeholder="Search master artisans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-gold focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Artisan Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {filteredArtisans.map(artisan => (
          <div 
            key={artisan.id} 
            onClick={() => setSelectedArtisan(artisan)}
            className="glass-mewar p-6 rounded-[32px] group hover:shadow-2xl transition-all duration-500 border border-gold/10 bg-white/40 flex flex-col items-center text-center cursor-pointer"
          >
            <div className="w-24 h-24 rounded-full bg-royal-gradient flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4 group-hover:scale-110 transition-transform overflow-hidden border-2 border-white">
              {artisan.profile_picture ? (
                <img src={artisan.profile_picture} className="w-full h-full object-cover" alt={artisan.name} />
              ) : (
                artisan.name[0]
              )}
            </div>
            <h3 className="font-heritage font-bold text-xl text-gray-900 mb-1">{artisan.name}</h3>
            <p className="text-[10px] font-bold text-gold uppercase tracking-widest mb-4">{artisan.category || 'Master Artisan'}</p>
            <p className="text-xs text-gray-500 italic mb-6 line-clamp-2">"{artisan.description || artisan.shopAddress || 'Traditional workshop in Udaipur'}"</p>
            <button className="mt-auto w-full py-3 bg-white border border-gold/20 rounded-xl text-[10px] font-bold text-gold uppercase tracking-widest hover:bg-gold hover:text-white transition-all">
              View Gallery
            </button>
          </div>
        ))}
      </div>

      {/* Artisan Profile View */}
      {selectedArtisan && (
        <ArtisanProfile 
          artisan={selectedArtisan} 
          onOpenMessenger={onOpenMessenger}
          onClose={() => setSelectedArtisan(null)} 
        />
      )}
    </div>
  );
};
