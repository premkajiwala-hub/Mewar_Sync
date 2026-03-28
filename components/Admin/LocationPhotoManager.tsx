import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Trash2, Plus, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle, X, Search, RefreshCw } from 'lucide-react';
import { storage } from '../../services/storage';
import { PlacePhoto, MapLocation, UserProfile } from '../../types';
import { LOCATIONS } from '../../src/constants';
import { ConfirmationModal } from '../UI/ConfirmationModal';

export const LocationPhotoManager: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(storage.getCurrentUser());
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(LOCATIONS[0].id);
  const [searchTerm, setSearchTerm] = useState('');
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    // Sync user state
    const interval = setInterval(() => {
      const user = storage.getCurrentUser();
      if (user?.id !== currentUser?.id) {
        setCurrentUser(user);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    fetchPhotos();
  }, [selectedPlaceId]);

  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const data = await storage.getPlacePhotos(selectedPlaceId);
      setPhotos(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    return LOCATIONS.filter(loc => 
      loc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newPreviews: { file: File; url: string }[] = [];
    let hasError = false;

    files.forEach((file: File) => {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setError("Only JPG, JPEG, PNG, and WEBP files are allowed.");
        hasError = true;
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB per image.");
        hasError = true;
        return;
      }

      const url = URL.createObjectURL(file);
      newPreviews.push({ file, url });
    });

    if (hasError) return;

    setError(null);
    if (replacingId) {
      // If replacing, only take the first file
      setPreviews([newPreviews[0]]);
    } else {
      setPreviews(prev => [...prev, ...newPreviews].slice(0, 10 - photos.length));
    }
  };

  const removePreview = (index: number) => {
    setPreviews(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const handleUpload = async () => {
    if (previews.length === 0) return;
    
    setUploading(true);
    setError(null);
    try {
      if (replacingId) {
        // Replace logic
        const secureUrl = await storage.uploadFile(previews[0].file);
        await storage.deletePlacePhoto(replacingId);
        await storage.savePlacePhoto({
          place_id: selectedPlaceId,
          image_url: secureUrl,
          uploaded_at: new Date().toISOString()
        });
        setReplacingId(null);
      } else {
        // Multiple upload logic
        for (const preview of previews) {
          const secureUrl = await storage.uploadFile(preview.file);
          await storage.savePlacePhoto({
            place_id: selectedPlaceId,
            image_url: secureUrl,
            uploaded_at: new Date().toISOString()
          });
        }
      }

      setSuccess(replacingId ? "Photo replaced successfully!" : "Photos uploaded successfully!");
      setPreviews([]);
      fetchPhotos();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to process photos.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await storage.deletePlacePhoto(deleteConfirmId);
      fetchPhotos();
      setSuccess("Photo deleted.");
      setDeleteConfirmId(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      let message = "Failed to delete photo.";
      try {
        const errInfo = JSON.parse(err.message);
        if (errInfo.error.includes("insufficient permissions")) {
          message = "You don't have permission to delete this photo. Only the uploader or an admin can remove it.";
        }
      } catch (e) {
        // Not a JSON error
      }
      setError(message);
      setDeleteConfirmId(null);
    }
  };

  const startReplace = (id: string) => {
    setReplacingId(id);
    setPreviews([]);
    setError(null);
  };

  const cancelReplace = () => {
    setReplacingId(null);
    setPreviews([]);
  };

  const selectedPlace = LOCATIONS.find(l => l.id === selectedPlaceId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-heritage font-bold text-gray-900">Add Location Photos</h2>
          <p className="text-gray-500 italic">Contribute to the visual heritage of Udaipur.</p>
        </div>
        
        <div className="w-full md:w-80 space-y-2">
          <label className="block text-[10px] font-bold text-gold uppercase tracking-widest mb-1">Search & Select Location</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={16} />
            <input 
              type="text"
              placeholder="Search location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gold/20 rounded-xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-gold/50 outline-none transition-all mb-2"
            />
          </div>
          <select 
            value={selectedPlaceId}
            onChange={(e) => {
              setSelectedPlaceId(e.target.value);
              setReplacingId(null);
              setPreviews([]);
            }}
            className="w-full bg-white border border-gold/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gold/50 outline-none transition-all"
          >
            {filteredLocations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
            {filteredLocations.length === 0 && <option disabled>No locations found</option>}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-6 py-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-mewar p-8 rounded-[32px] border-2 border-gold/10 shadow-xl sticky top-8">
            <h3 className="text-xl font-heritage font-bold mb-6 flex items-center gap-2">
              {replacingId ? <RefreshCw className="text-gold" /> : <Plus className="text-gold" />}
              {replacingId ? 'Replace Photo' : 'Add New Photos'}
            </h3>
            
            <div className="space-y-6">
              <div 
                className={`relative min-h-[200px] rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 ${
                  previews.length > 0 ? 'border-gold/50 bg-gold/5' : 'border-gray-200 hover:border-gold/30'
                }`}
              >
                {previews.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {previews.map((preview, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-gold/20">
                        <img src={preview.url} className="w-full h-full object-cover" alt="Preview" />
                        <button 
                          onClick={() => removePreview(idx)}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {!replacingId && previews.length < (10 - photos.length) && (
                      <label className="aspect-square rounded-lg border-2 border-dashed border-gold/30 flex items-center justify-center cursor-pointer hover:bg-gold/10 transition-all">
                        <Plus size={20} className="text-gold" />
                        <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" multiple />
                      </label>
                    )}
                  </div>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer group py-8">
                    <Camera size={40} className="text-gray-300 group-hover:text-gold transition-colors mb-2" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gold transition-colors">
                      {replacingId ? 'Select Replacement' : 'Click to Upload'}
                    </p>
                    <p className="text-[9px] text-gray-300 mt-1">JPG, PNG, WEBP (Max 5MB)</p>
                    <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" multiple={!replacingId} />
                  </label>
                )}
              </div>

              <div className="bg-gold/5 p-4 rounded-2xl border border-gold/10">
                <p className="text-[10px] text-gold font-bold uppercase tracking-widest mb-1">Selected Location</p>
                <p className="text-sm font-heritage font-bold text-gray-900">{selectedPlace?.name}</p>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-[10px] text-gray-500">{photos.length}/10 Photos Uploaded</p>
                  {replacingId && (
                    <button onClick={cancelReplace} className="text-[10px] font-bold text-red-500 uppercase hover:underline">Cancel Replace</button>
                  )}
                </div>
              </div>

              <button
                onClick={handleUpload}
                disabled={previews.length === 0 || uploading || (!replacingId && photos.length >= 10)}
                className="w-full py-4 bg-royal-gradient text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? <Loader2 className="animate-spin" size={18} /> : (replacingId ? <RefreshCw size={18} /> : <Plus size={18} />)}
                {uploading ? 'Processing...' : (replacingId ? 'Replace Now' : 'Add to Gallery')}
              </button>
            </div>
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-heritage font-bold flex items-center gap-2">
              <ImageIcon className="text-gold" /> Current Gallery
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{photos.length} Photos</span>
          </div>

          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 text-gold/40">
              <Loader2 className="animate-spin" size={40} />
              <p className="text-[10px] font-bold uppercase tracking-widest">Syncing Gallery...</p>
            </div>
          ) : photos.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200">
              <ImageIcon size={48} className="text-gray-200" />
              <p className="text-sm text-gray-400 italic">No photos uploaded for this location yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {photos.map((photo) => (
                <div key={photo.id} className={`group relative aspect-video rounded-3xl overflow-hidden shadow-md border-2 transition-all ${replacingId === photo.id ? 'border-gold ring-4 ring-gold/20' : 'border-gold/10'}`}>
                  <img src={photo.image_url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Location" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 lg:group-hover:opacity-100 transition-opacity flex items-end justify-between p-6">
                    <div className="space-y-1">
                      <p className="text-[10px] text-white font-bold uppercase tracking-widest">
                        {new Date(photo.uploaded_at).toLocaleDateString()}
                      </p>
                      {(currentUser?.role === 'ADMIN' || currentUser?.id === photo.user_id) && (
                        <button 
                          onClick={() => startReplace(photo.id)}
                          className="text-[9px] font-bold text-gold uppercase hover:underline flex items-center gap-1"
                        >
                          <RefreshCw size={10} /> Replace Photo
                        </button>
                      )}
                    </div>
                    {(currentUser?.role === 'ADMIN' || currentUser?.id === photo.user_id || !photo.user_id) && (
                      <button 
                        onClick={() => setDeleteConfirmId(photo.id)}
                        className="bg-red-500 text-white p-2 rounded-xl hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {/* Mobile-friendly overlay for non-hover devices */}
                  <div className="absolute top-2 right-2 flex gap-2 lg:hidden">
                    {(currentUser?.role === 'ADMIN' || currentUser?.id === photo.user_id || !photo.user_id) && (
                      <button 
                        onClick={() => setDeleteConfirmId(photo.id)}
                        className="bg-red-500/80 backdrop-blur-sm text-white p-1.5 rounded-lg shadow-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {replacingId === photo.id && (
                    <div className="absolute inset-0 bg-gold/20 backdrop-blur-[2px] flex items-center justify-center">
                      <div className="bg-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2">
                        <RefreshCw size={14} className="text-gold animate-spin" />
                        <span className="text-[10px] font-bold text-gray-900 uppercase">Replacing...</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal 
        isOpen={!!deleteConfirmId}
        title="Delete Photo"
        message="Are you sure you want to remove this photo from the heritage gallery? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
        type="danger"
      />
    </div>
  );
};

