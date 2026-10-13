
import React, { useState, useCallback, useEffect } from 'react';
import { User, Phone, Save, Loader2, Mail, Lock, ShieldCheck, Languages, MapPin, Camera, X as CloseIcon, Sparkles, FileText, ImageIcon } from 'lucide-react';
import { UserProfile } from '../../types';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { storage } from '../../services/storage';
import { LocationPicker } from '../UI/LocationPicker';
import Cropper from 'react-easy-crop';
import { GoogleGenAI } from "@google/genai";

export const ProfileSettings: React.FC<{ onModalToggle?: (isOpen: boolean) => void }> = ({ onModalToggle }) => {
  const user = storage.getCurrentUser();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; message: string; type: 'alert' | 'confirm' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert'
  });
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    category: user?.category || 'Paintings',
    preferredLanguage: user?.preferredLanguage || 'English',
    location: user?.location,
    profile_picture: user?.profile_picture || '',
    thumbnail: user?.thumbnail || '',
    description: user?.description || ''
  });

  // Cropping state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'profile' | 'thumbnail'>('profile');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    onModalToggle?.(modalConfig.isOpen || !!imageSrc);
  }, [modalConfig.isOpen, imageSrc, onModalToggle]);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'thumbnail') => {
    if (e.target.files && e.target.files.length > 0) {
      setCropType(type);
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => setImageSrc(reader.result as string));
      reader.readAsDataURL(file);
    }
  };

  const generateAIDescription = async () => {
    if (!formData.name || !formData.category) {
      alert("Hukumn, please provide your name and craft category first.");
      return;
    }

    setGeneratingAI(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Write a short, poetic, and professional profile description for an artisan named ${formData.name} who specializes in ${formData.category} in Udaipur, Rajasthan. The tone should be royal and heritage-focused. Keep it under 100 words.`,
      });

      if (response.text) {
        setFormData({ ...formData, description: response.text.trim() });
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      alert("Failed to generate description. Please try again.");
    } finally {
      setGeneratingAI(false);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg');
    });
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedBlob) {
        const file = new File([croppedBlob], `${cropType}.jpg`, { type: 'image/jpeg' });
        const url = await storage.uploadFile(file);
        if (cropType === 'profile') {
          setFormData({ ...formData, profile_picture: url });
        } else {
          setFormData({ ...formData, thumbnail: url });
        }
        setImageSrc(null);
      }
    } catch (err) {
      console.error("Crop save error:", err);
      alert("Failed to process image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(formData.phone || '')) {
      setModalConfig({
        isOpen: true,
        title: "Invalid Phone",
        message: "Hukumn, please enter a valid 10-digit phone number.",
        type: 'alert'
      });
      return;
    }
    
    setLoading(true);
    try {
      await storage.updateProfile(formData);
      setModalConfig({
        isOpen: true,
        title: "Registry Updated",
        message: "Hukumn, your identity has been secured in the royal registry.",
        type: 'alert'
      });
      // Force reload to apply language changes if needed
      if (formData.preferredLanguage !== user?.preferredLanguage) {
        window.location.reload();
      }
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: "Update Failed",
        message: "Failed to update registry. Please check your connection.",
        type: 'alert'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="font-outfit">
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="glass-mewar p-10 rounded-[40px] border-2 border-gold/10 shadow-2xl overflow-hidden relative bg-white">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-gold/5 rounded-full blur-3xl" />
        
        <div className="flex items-center gap-4 mb-10 relative z-10 font-heritage">
           <div className="p-4 bg-royal-gradient rounded-3xl shadow-lg text-white">
              <User size={32} />
           </div>
           <div>
              <h2 className="text-3xl font-bold text-gray-900 uppercase tracking-tight">Identity Vault</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Manage your official credentials</p>
           </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8 relative z-10">
          {/* Profile Pictures Section */}
          <div className={`grid grid-cols-1 ${user?.role === 'SHOPKEEPER' ? 'md:grid-cols-2' : ''} gap-8 pb-8 border-b border-gold/10`}>
            <div className="flex flex-col items-center gap-4">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profile Portrait</label>
              <div className="relative group">
                <div className="w-32 h-32 rounded-[40px] bg-royal-gradient flex items-center justify-center text-white text-4xl font-bold shadow-2xl overflow-hidden border-4 border-white">
                  {formData.profile_picture ? (
                    <img src={formData.profile_picture} className="w-full h-full object-cover" alt="Profile" />
                  ) : (
                    user?.name[0]
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 p-3 bg-white text-gold rounded-2xl shadow-xl border border-gold/10 cursor-pointer hover:scale-110 transition-all">
                  <Camera size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'profile')} />
                </label>
              </div>
            </div>

            {user?.role === 'SHOPKEEPER' && (
              <div className="flex flex-col items-center gap-4">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gallery Thumbnail</label>
                <div className="relative group">
                  <div className="w-48 h-32 rounded-3xl bg-gray-100 flex items-center justify-center text-gold/20 shadow-xl overflow-hidden border-4 border-white">
                    {formData.thumbnail ? (
                      <img src={formData.thumbnail} className="w-full h-full object-cover" alt="Thumbnail" />
                    ) : (
                      <ImageIcon size={40} />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-3 bg-white text-gold rounded-2xl shadow-xl border border-gold/10 cursor-pointer hover:scale-110 transition-all">
                    <Camera size={20} />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'thumbnail')} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-saffron focus:outline-none" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest ml-1">Phone (10 Digits)</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-saffron focus:outline-none" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative opacity-60">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <input 
                  disabled
                  type="email" 
                  value={formData.email}
                  className="w-full bg-gray-100 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none cursor-not-allowed" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest ml-1">Preferred Language</label>
              <div className="relative">
                <Languages className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <select 
                  value={formData.preferredLanguage}
                  onChange={e => setFormData({...formData, preferredLanguage: e.target.value})}
                  className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-saffron focus:outline-none appearance-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Marwadi">Marwadi (मारवाड़ी)</option>
                </select>
              </div>
            </div>

            {user?.role === 'SHOPKEEPER' && (
              <div className="space-y-2">
                <label className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest ml-1">Craft Category</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                  <input 
                    type="text" 
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-saffron focus:outline-none" 
                  />
                </div>
              </div>
            )}
            
            {user?.role === 'SHOPKEEPER' && (
              <div className="md:col-span-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-heritage font-bold text-gray-400 uppercase tracking-widest ml-1">Heritage Story / Description</label>
                  <button 
                    type="button"
                    onClick={generateAIDescription}
                    disabled={generatingAI}
                    className="flex items-center gap-2 text-[10px] font-bold text-gold uppercase tracking-widest hover:text-saffron transition-colors disabled:opacity-50"
                  >
                    {generatingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate with AI
                  </button>
                </div>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 text-gold w-4 h-4" />
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    rows={4}
                    placeholder="Tell your heritage story..."
                    className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:border-saffron focus:outline-none resize-none" 
                  />
                </div>
              </div>
            )}
            
            {user?.role === 'SHOPKEEPER' && (
              <div className="md:col-span-2 pt-6 border-t border-gold/10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-gold/10 rounded-2xl text-gold">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-heritage font-bold text-gray-900 uppercase tracking-tight text-left">Manage Workshop Location</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 text-left">Update your map pin for visitors</p>
                  </div>
                </div>
                <LocationPicker 
                  initialLocation={formData.location}
                  onLocationSelect={(lat, lng) => setFormData({...formData, location: { lat, lng }})}
                />
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-gold/10 flex flex-col md:flex-row gap-4 items-center justify-between">
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Account Type: {user?.role}</p>
             <button 
                type="submit" 
                disabled={loading}
                className="w-full md:w-auto px-12 py-3 bg-gray-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all disabled:opacity-50 uppercase tracking-widest text-xs"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                {loading ? 'Securing Registry...' : 'Seal Changes'}
              </button>
          </div>
        </form>
      </div>

      {/* Cropper Modal */}
      {imageSrc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300" 
            onClick={() => setImageSrc(null)}
          />
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[40px] shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gold/10 flex justify-between items-center">
              <h3 className="font-heritage font-bold text-xl text-gray-900">Adjust Your Portrait</h3>
              <button onClick={() => setImageSrc(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <CloseIcon size={24} />
              </button>
            </div>
            <div className="relative h-[400px] bg-gray-900 flex-shrink-0">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropType === 'profile' ? 1 : 3/2}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Zoom</label>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-gold"
                />
              </div>
              <button 
                onClick={handleCropSave}
                disabled={uploading}
                className="w-full py-3 bg-royal-gradient text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {uploading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                {uploading ? 'Processing...' : 'Confirm Portrait'}
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};
