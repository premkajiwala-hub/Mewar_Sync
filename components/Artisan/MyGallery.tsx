
import React, { useState, useEffect } from 'react';
import { ArtisanProduct } from '../../types';
import { Loader2, Package, Sparkles, Eye, Trash2, X, IndianRupee, Save, Edit3 } from 'lucide-react';
import { JharokaFrame } from '../UI/JharokaFrame';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { storage } from '../../services/storage';

export const MyGallery: React.FC<{ onModalToggle?: (isOpen: boolean) => void }> = ({ onModalToggle }) => {
  const [products, setProducts] = useState<ArtisanProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ArtisanProduct | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = storage.getCurrentUser();

  useEffect(() => {
    onModalToggle?.(!!selectedProduct || !!deleteId);
  }, [selectedProduct, deleteId, onModalToggle]);

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const allProducts = await storage.getProducts();
      const myProducts = allProducts.filter(p => p.shop_id === user?.id);
      setProducts(myProducts);
    } catch (err) {
      console.error("Fetch gallery failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId || isSubmitting) return;
    setIsSubmitting(true);
    
    // Optimistic Update
    const idToRemove = deleteId;
    setProducts(prev => prev.filter(p => p.id !== idToRemove));
    setDeleteId(null);
    setSelectedProduct(null);

    try {
      await storage.deleteProduct(idToRemove);
      await fetchGallery();
    } catch (err) {
      console.error("Delete product failed:", err);
      // Rollback
      await fetchGallery();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const handleUpdate = async () => {
    if (!selectedProduct || isSubmitting) return;
    setIsSubmitting(true);

    // Optimistic Update
    const updatedProduct = { ...selectedProduct };
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    setIsEditing(false);

    try {
      await storage.saveProduct(updatedProduct);
      await fetchGallery();
    } catch (err) {
      console.error("Update product failed:", err);
      // Rollback
      await fetchGallery();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-gold w-12 h-12 mb-4" />
        <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Opening the Jharoka...</p>
      </div>
    );
  }

  return (
    <div className="font-outfit">
      <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heritage font-bold text-gray-900">Digital Archive</h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Your Curated Collection</p>
        </div>
        <div className="bg-gold/5 px-4 py-2 rounded-full border border-gold/10">
          <span className="text-[10px] font-bold text-gold uppercase tracking-widest">{products.length} Items Listed</span>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="py-32 glass-mewar rounded-[40px] border-2 border-dashed border-gold/20 flex flex-col items-center justify-center text-center">
          <Package size={64} className="text-gold/20 mb-6" />
          <h3 className="text-xl font-heritage font-bold text-gray-400">Empty Sanctuary</h3>
          <p className="text-gray-400 mt-2 max-w-xs mx-auto text-sm italic">Scan your handicrafts to build your digital heritage gallery.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map(product => (
            <div key={product.id} className="glass-mewar p-6 rounded-[32px] group hover:shadow-2xl transition-all duration-500 border border-gold/10 bg-white/40 shadow-sm">
              <JharokaFrame className="mb-6 rounded-2xl shadow-lg">
                <img src={product.image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
              </JharokaFrame>
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 overflow-hidden">
                    <h3 className="font-heritage font-bold text-xl text-gray-900 truncate">{product.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Sparkles size={12} className="text-gold" />
                      <span className="text-[10px] font-bold text-gold uppercase tracking-widest">{product.style} Style</span>
                    </div>
                  </div>
                  <p className="text-xl font-bold text-saffron shrink-0 ml-2">₹{product.price.toLocaleString()}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setSelectedProduct(product)}
                    className="flex-1 py-3 bg-royal-gradient text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-saffron/10 flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-transform"
                  >
                    <Eye size={14} /> View Details
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id)}
                    className="p-3 border border-red-100 text-red-400 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-12">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" 
            onClick={() => {setSelectedProduct(null); setIsEditing(false);}} 
          />
          <div className="bg-white max-w-5xl w-full max-h-[90vh] rounded-[40px] shadow-2xl relative overflow-hidden flex flex-col md:flex-row border-4 border-gold/10 animate-in zoom-in-95 duration-300">
              <button 
                onClick={() => {setSelectedProduct(null); setIsEditing(false);}} 
                className="absolute top-6 right-6 text-gray-400 hover:text-red-500 transition-colors z-40 bg-white/80 rounded-full p-2 shadow-sm"
              >
                <X size={28} />
              </button>
              
              <div className="w-full md:w-1/2 flex-shrink-0 bg-gray-50 border-b md:border-b-0 md:border-r border-gold/10 overflow-hidden flex items-center justify-center">
                 <img 
                    src={selectedProduct.image_url} 
                    className="w-full h-full object-contain md:object-cover max-h-[50vh] md:max-h-full" 
                    alt={selectedProduct.title} 
                 />
              </div>
              
              <div className="w-full md:w-1/2 p-8 md:p-16 flex flex-col overflow-y-auto">
                 <div className="mb-10">
                    <span className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] bg-gold/5 px-5 py-2 rounded-full border border-gold/10">
                       {selectedProduct.style} Style
                    </span>
                    {isEditing ? (
                      <div className="mt-6 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Archive Title</p>
                        <input 
                          className="text-2xl md:text-3xl font-heritage font-bold text-gray-900 border-b-2 border-gold/20 w-full focus:outline-none focus:border-gold py-3 bg-gold/5 px-4 rounded-t-xl"
                          value={selectedProduct.title}
                          onChange={(e) => setSelectedProduct({...selectedProduct, title: e.target.value})}
                        />
                      </div>
                    ) : (
                      <h2 className="text-3xl md:text-5xl font-heritage font-bold text-gray-900 mt-6 leading-tight">{selectedProduct.title}</h2>
                    )}
                 </div>

                 <div className="flex-grow space-y-10">
                    <div className="space-y-4">
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Sparkles size={16} className="text-gold" /> Heritage Story
                       </p>
                       {isEditing ? (
                         <textarea 
                           className="text-sm text-gray-600 leading-relaxed italic w-full h-48 border-2 border-gold/10 rounded-2xl p-6 focus:outline-none focus:border-gold resize-none bg-gold/5"
                           value={selectedProduct.description}
                           onChange={(e) => setSelectedProduct({...selectedProduct, description: e.target.value})}
                         />
                       ) : (
                         <p className="text-base md:text-lg text-gray-600 leading-relaxed italic border-l-4 border-gold/20 pl-8 py-2">
                            {selectedProduct.description}
                         </p>
                       )}
                    </div>

                    <div className="p-10 bg-gray-50 rounded-[40px] border border-gold/10 space-y-6">
                       <div>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Registry Valuation</p>
                          <div className="flex items-center gap-2">
                             <IndianRupee size={32} className="text-saffron opacity-50" />
                             {isEditing ? (
                               <input 
                                 type="number"
                                 className="text-4xl font-bold text-gray-900 bg-white border-2 border-gold/20 rounded-2xl px-5 w-full focus:outline-none focus:border-gold"
                                 value={selectedProduct.price}
                                 onChange={(e) => setSelectedProduct({...selectedProduct, price: parseInt(e.target.value) || 0})}
                               />
                             ) : (
                               <span className="text-5xl font-bold text-gray-900">{selectedProduct.price.toLocaleString()}</span>
                             )}
                          </div>
                       </div>
                       
                       <div className="flex gap-4 pt-6">
                         <button 
                           onClick={() => isEditing ? handleUpdate() : setIsEditing(true)}
                           disabled={isSubmitting}
                           className="flex-1 py-3 bg-royal-gradient text-white rounded-[24px] font-bold text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-2xl shadow-saffron/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                         >
                           {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : (isEditing ? <Save size={20} /> : <Edit3 size={20} />)}
                           {isSubmitting ? 'Sealing...' : (isEditing ? 'Seal Registry' : 'Edit Entry')}
                         </button>
                         <button 
                           onClick={() => handleDelete(selectedProduct.id)}
                           disabled={isSubmitting}
                           className="p-5 border-2 border-red-100 text-red-400 rounded-[24px] hover:bg-red-50 transition-all active:scale-90 disabled:opacity-50"
                           title="Remove piece"
                         >
                            <Trash2 size={24} />
                         </button>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Remove Piece"
        message="Are you sure you want to remove this piece from the royal gallery?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        type="danger"
        isLoading={isSubmitting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      </div>
    </div>
  );
};
