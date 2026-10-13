
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Eye, X, Store, Heart, Mail, Phone, User, Landmark, 
  ShieldCheck, MapPin, Navigation, MessageSquare, 
  ChevronRight, ChevronLeft, Info, Camera, Sparkles, Image as ImageIcon, Languages,
  Play, Pause, Loader2, Ticket, CheckCircle2, IndianRupee, Star, ShoppingBag
} from 'lucide-react';
import { ArtisanProduct, UserProfile, MapLocation, ArtisanPost, PlacePhoto } from '../../types';
import { LOCATIONS } from '../../src/constants';
import { JharokaFrame } from '../UI/JharokaFrame';
import { storage } from '../../services/storage';
import { geminiService } from '../../services/gemini';
import { useGemini } from '../../hooks/useGemini';
import { decode } from '../../utils/audioUtils';

// Fix Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const HeritageIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #3b82f6; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

const MarketIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #eab308; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; display: flex; align-items: center; justify-content: center;"><div style="transform: rotate(45deg); color: white;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30]
});

const ArtisanIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: #d4af37; width: 34px; height: 34px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(212, 175, 55, 0.6);"><div style="color: white;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const UDAIPUR_CENTER: [number, number] = [24.5764, 73.6835];

interface MarketplaceProps {
  onViewArtisanProfile?: (artisanId: string) => void;
  onSelectProduct?: (product: ArtisanProduct) => void;
}

export const Marketplace: React.FC<MarketplaceProps> = ({ onViewArtisanProfile, onSelectProduct }) => {
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [selectedPost, setSelectedPost] = useState<ArtisanPost | null>(null);
  const user = storage.getCurrentUser();
  const isVisitor = user?.role === 'VISITOR';
  const [locationPhotos, setLocationPhotos] = useState<PlacePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [artisanPosts, setArtisanPosts] = useState<ArtisanPost[]>([]);
  const [artisans, setArtisans] = useState<UserProfile[]>([]);
  const [selectedArtisan, setSelectedArtisan] = useState<UserProfile | null>(null);
  const [artisanProducts, setArtisanProducts] = useState<ArtisanProduct[]>([]);
  const [loadingArtisanData, setLoadingArtisanData] = useState(false);
  const [isForeigner, setIsForeigner] = useState(false);
  const [adultCount, setAdultCount] = useState(1);
  const [childCount, setChildCount] = useState(0);
  const [selectedActivityIndex, setSelectedActivityIndex] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'HERITAGE' | 'MARKET' | 'ARTISAN'>('ALL');
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);
  
  // Heritage Guide Integration States
  const { getAudioGuide, getHeritageActivities, loading: geminiLoading } = useGemini();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [baseFees, setBaseFees] = useState({ 
    indian: 0, 
    indian_child: 0, 
    foreigner: 0, 
    foreigner_child: 0 
  });
  const [cameraFee, setCameraFee] = useState<number | null>(null);
  const [videoFee, setVideoFee] = useState<number | null>(null);
  const [aiTimings, setAiTimings] = useState<{ open: string; close: string; timing_note?: string } | null>(null);
  const [aiDescription, setAiDescription] = useState<string>('');
  const [mustDo, setMustDo] = useState<string>('');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  const getLiveStatus = (timings?: { open: string; close: string }) => {
    if (!timings) return { status: 'Open Now', color: 'text-emerald-600 bg-emerald-50' };
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [openH, openM] = timings.open.split(':').map(Number);
    const [closeH, closeM] = timings.close.split(':').map(Number);
    
    const openTime = openH * 60 + openM;
    const closeTime = closeH * 60 + closeM;
    
    if (currentTime >= openTime && currentTime <= closeTime) {
      return { status: 'Open Now', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    }
    return { status: 'Closed', color: 'text-red-600 bg-red-50 border-red-200' };
  };

  const calculateTotalCost = (loc: MapLocation) => {
    const adultFee = isForeigner ? (baseFees.foreigner || 0) : (baseFees.indian || 0);
    const childFee = isForeigner ? (baseFees.foreigner_child || 0) : (baseFees.indian_child || 0);
    
    const totalEntry = (adultCount * adultFee) + (childCount * childFee);
    
    let totalActivity = 0;
    
    if (selectedActivities.length > 0) {
      totalActivity = activities
        .filter(a => selectedActivities.includes(a.name))
        .reduce((sum, a) => sum + (a.cost || 0), 0) * (adultCount + childCount);
    }
    
    return Math.round(totalEntry + totalActivity);
  };

  useEffect(() => {
    setSelectedActivityIndex(null);
    setSelectedActivities([]);
    setAdultCount(1);
    setChildCount(0);
    setActivePhotoIndex(0);
    setMustDo('');
    setActivities([]);
    setBaseFees({ 
      indian: 0, 
      indian_child: 0, 
      foreigner: 0, 
      foreigner_child: 0 
    });
    setCameraFee(null);
    setVideoFee(null);
    setAiTimings(null);
    setAiDescription('');
    setShowFullDescription(false);
    
    if (audioSource) {
      audioSource.stop();
      setAudioSource(null);
      setIsPlaying(false);
    }
  }, [selectedLocation]);

  // Auto-scrolling logic for Photo Carousel
  useEffect(() => {
    if (selectedLocation && (locationPhotos.length > 1 || (!loadingPhotos && selectedLocation.image_url))) {
      const totalItems = locationPhotos.length > 0 ? locationPhotos.length : 1;
      
      autoScrollTimer.current = setInterval(() => {
        setActivePhotoIndex((prev) => (prev + 1) % totalItems);
      }, 5000);
    }
    return () => {
      if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);
    };
  }, [selectedLocation, locationPhotos, loadingPhotos]);

  // Sync carousel scroll position
  useEffect(() => {
    if (carouselRef.current) {
      const width = carouselRef.current.offsetWidth;
      carouselRef.current.scrollTo({
        left: activePhotoIndex * width,
        behavior: 'smooth'
      });
    }
  }, [activePhotoIndex]);

  // Fetch activities when location changes
  useEffect(() => {
    const fetchActivities = async () => {
      if (!selectedLocation) return;
      
      // 1. Initial state from hardcoded constants
      const hardcodedActivities = selectedLocation.activity_costs || [];
      setActivities(hardcodedActivities);
      
      setBaseFees({ 
        indian: selectedLocation.entry_fee_indian || 0, 
        indian_child: selectedLocation.entry_fee_indian_child || 0,
        foreigner: selectedLocation.entry_fee_foreigner || 0,
        foreigner_child: selectedLocation.entry_fee_foreigner_child || 0
      });
      setCameraFee(selectedLocation.camera_fee || null);
      setVideoFee(selectedLocation.video_fee || null);
      setAiTimings(selectedLocation.timings || null);
      setAiDescription('');
      setMustDo(selectedLocation.must_do || '');

      // 2. Augment with AI data for heritage sites
      if (selectedLocation.type === 'HERITAGE') {
        try {
          const data = await getHeritageActivities(selectedLocation.name);
          if (data) {
            // Only add AI activities that aren't already in our hardcoded list
            const existingNames = new Set(hardcodedActivities.map(a => a.name.toLowerCase()));
            const newActivities = (data.activities || []).filter(
              a => !existingNames.has(a.name.toLowerCase())
            );
            
            if (newActivities.length > 0) {
              setActivities([...hardcodedActivities, ...newActivities]);
            }

            // Fallback for other fields if missing in constants
            if (selectedLocation.entry_fee_indian === undefined) {
              setBaseFees(prev => ({ 
                ...prev,
                indian: data.entry_fee_indian || 0, 
                foreigner: data.entry_fee_foreigner || 0 
              }));
            }
            
            if (selectedLocation.camera_fee === undefined) {
              setCameraFee(data.camera_fee || null);
            }
            
            if (!selectedLocation.timings) {
              setAiTimings(data.timings || null);
            }
            
            setAiDescription(data.description || '');
            if (!selectedLocation.must_do) {
              setMustDo(data.must_do || '');
            }
          }
        } catch (error) {
          console.error('Error fetching AI activities:', error);
        }
      }
    };
    fetchActivities();
  }, [selectedLocation]);

  const playGuide = async (text: string) => {
    if (isPlaying) {
      audioSource?.stop();
      setIsPlaying(false);
      return;
    }

    const base64 = await getAudioGuide(text);
    if (!base64) return;

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const bytes = decode(base64);
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setIsPlaying(false);
    source.start();
    setAudioSource(source);
    setIsPlaying(true);
  };

  const toggleActivity = (name: string) => {
    setSelectedActivities(prev => 
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    );
  };

  useEffect(() => {
    const fetchPosts = async () => {
      const posts = await storage.getArtisanPosts();
      if (posts.length === 0) {
        setArtisanPosts([
        ]);
      } else {
        setArtisanPosts(posts);
      }
    };
    fetchPosts();

    const fetchArtisans = async () => {
      const data = await storage.getArtisansWithLocation();
      setArtisans(data);
    };
    fetchArtisans();
  }, []);

  useEffect(() => {
    if (selectedPost || selectedArtisan) {
      const fetchArtisanData = async () => {
        setLoadingArtisanData(true);
        try {
          const shopId = selectedPost ? selectedPost.artisan_id : selectedArtisan?.id;
          if (!shopId) return;
          
          const allProducts = await storage.getProducts();
          const filtered = allProducts.filter(p => p.shop_id === shopId);
          setArtisanProducts(filtered);
        } catch (error) {
          console.error("Error fetching artisan data:", error);
        } finally {
          setLoadingArtisanData(false);
        }
      };
      fetchArtisanData();
    } else {
      setArtisanProducts([]);
    }
  }, [selectedPost, selectedArtisan]);

  useEffect(() => {
    if (selectedLocation) {
      const fetchPhotos = async () => {
        setLoadingPhotos(true);
        try {
          const photos = await storage.getPlacePhotos(selectedLocation.id);
          setLocationPhotos(photos);
        } catch (error) {
          console.error("Error fetching photos:", error);
          setLocationPhotos([]);
        } finally {
          setLoadingPhotos(false);
        }
      };
      fetchPhotos();
    } else {
      setLocationPhotos([]);
    }
  }, [selectedLocation]);

  // Handle Map Resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cleanHeritageText = (text: string) => {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '"$1"');
  };

  const handleTakeMeThere = (loc: MapLocation | ArtisanPost | UserProfile) => {
    let lat, lng;
    if ('lat' in loc) {
      lat = loc.lat;
      lng = loc.lng;
    } else if ('location' in loc && loc.location) {
      lat = loc.location.lat;
      lng = loc.location.lng;
    } else {
      return;
    }
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="h-full w-full flex flex-col font-outfit relative overflow-hidden">
      {/* Header & Filters */}
      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl border-b border-gold/10 z-10">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div>
            <h2 className="text-xl md:text-3xl font-heritage font-bold text-gray-900">Udaipur Explorer</h2>
            <p className="text-gray-400 italic text-[10px] md:text-sm">Discover the soul of Mewar through its heritage and artisans.</p>
          </div>
          <button 
            onClick={() => setIsMapFullScreen(!isMapFullScreen)}
            className="md:hidden p-2 bg-gold/10 text-gold rounded-lg border border-gold/20"
          >
            {isMapFullScreen ? <X size={20} /> : <MapPin size={20} />}
          </button>
        </div>
        
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
          {[
            { id: 'ALL', label: 'All Pins', icon: MapPin },
            { id: 'HERITAGE', label: 'Heritage', icon: Landmark },
            { id: 'MARKET', label: 'Markets', icon: Store },
            { id: 'ARTISAN', label: 'Artisan Feed', icon: Sparkles },
          ].map(filter => (
            <button 
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as any)}
              className={`flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full border transition-all whitespace-nowrap text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${
                activeFilter === filter.id 
                  ? 'bg-royal-gradient text-white border-transparent shadow-md' 
                  : 'bg-white text-gray-500 border-gold/20 hover:bg-gold/5'
              }`}
            >
              <filter.icon size={12} className="md:size-[14px]" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container */}
      <div className={`relative w-full transition-all duration-300 ${isMapFullScreen ? 'fixed inset-0 z-[2000] h-screen' : 'h-[400px] md:flex-grow md:h-full'}`}>
        {isMapFullScreen && (
          <button 
            onClick={() => setIsMapFullScreen(false)}
            className="absolute top-6 right-6 z-[2001] bg-white/90 backdrop-blur-md text-gray-900 p-3 rounded-full shadow-2xl border border-gold/20"
          >
            <X size={24} />
          </button>
        )}
        <MapContainer 
          center={UDAIPUR_CENTER} 
          zoom={15} 
          className="h-full w-full z-0"
          zoomControl={false}
          ref={(map) => { mapRef.current = map; }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          
          {/* Heritage & Market Pins */}
          {LOCATIONS.filter(l => activeFilter === 'ALL' || activeFilter === l.type).map(loc => (
            <Marker 
              key={loc.id} 
              position={[loc.lat, loc.lng]} 
              icon={loc.type === 'HERITAGE' ? HeritageIcon : MarketIcon}
              eventHandlers={{
                click: () => {
                  setSelectedPost(null);
                  setSelectedLocation(loc);
                }
              }}
            >
              <Popup className="font-outfit">
                <div className="p-1">
                  <h3 className="font-heritage font-bold text-gray-900">{loc.name}</h3>
                  <p className="text-[10px] text-gray-500 mt-1">{loc.type === 'HERITAGE' ? 'Heritage Site' : 'Market Hub'}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Artisan Gold Pins */}
          {(activeFilter === 'ALL' || activeFilter === 'ARTISAN') && artisans.filter(a => !artisanPosts.some(p => p.artisan_id === a.id)).map(artisan => (
            <Marker 
              key={artisan.id} 
              position={[artisan.location!.lat, artisan.location!.lng]} 
              icon={ArtisanIcon}
              eventHandlers={{
                click: () => {
                  setSelectedLocation(null);
                  setSelectedPost(null);
                  setSelectedArtisan(artisan);
                }
              }}
            >
              <Popup className="font-outfit">
                <div className="p-1">
                  <h3 className="font-heritage font-bold text-gold">{artisan.name}</h3>
                  <p className="text-[10px] text-gray-500 mt-1">{artisan.category || 'Heritage Artisan'}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Artisan Post Pins */}
          {(activeFilter === 'ALL' || activeFilter === 'ARTISAN') && (Array.from(
            artisanPosts.reduce((acc, post) => {
              const existing = acc.get(post.artisan_id);
              if (!existing || new Date(post.timestamp) > new Date(existing.timestamp)) {
                acc.set(post.artisan_id, post);
              }
              return acc;
            }, new Map<string, ArtisanPost>()).values()
          ) as ArtisanPost[]).map(post => (
            <Marker 
              key={post.id} 
              position={[post.location.lat, post.location.lng]} 
              icon={ArtisanIcon}
              eventHandlers={{
                click: () => {
                  setSelectedLocation(null);
                  setSelectedPost(post);
                }
              }}
            >
              <Popup className="font-outfit">
                <div className="p-1">
                  <h3 className="font-heritage font-bold text-gold">{post.artisan_name}</h3>
                  <p className="text-[10px] text-gray-500 mt-1">Live Artisan Update</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Sliding Info Card - Location */}
        <div className={`absolute bottom-0 left-0 right-0 z-[100] transition-transform duration-500 ease-in-out transform ${selectedLocation ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="bg-white rounded-t-[40px] shadow-2xl border-t-4 border-gold/20 max-h-[85vh] overflow-y-auto no-scrollbar">
            {selectedLocation && (
              <div className="p-0">
                {/* Cinematic Header */}
                <div className="relative h-[50vh] md:h-[65vh] overflow-hidden bg-black group">
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="absolute top-6 right-6 z-30 bg-black/40 text-white p-3 rounded-full hover:bg-black/60 transition-all shadow-xl backdrop-blur-xl border border-white/10"
                  >
                    <X size={24} />
                  </button>
                  
                  {loadingPhotos ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-gold">
                      <div className="animate-spin"><Camera size={40} /></div>
                      <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Loading Photos...</p>
                    </div>
                  ) : locationPhotos.length === 0 ? (
                    <div className="h-full">
                      {selectedLocation.image_url ? (
                        <img 
                          src={selectedLocation.image_url} 
                          className="w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-105" 
                          alt={selectedLocation.name}
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400 bg-gray-900">
                          <ImageIcon size={48} className="opacity-20" />
                          <p className="text-sm italic">No photos available for this location.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div ref={carouselRef} className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
                      {locationPhotos.map((photo, idx) => (
                        <div key={photo.id} className="flex-shrink-0 w-full h-full snap-center">
                          <img 
                            src={photo.image_url} 
                            className="w-full h-full object-cover object-center transition-transform duration-1000 group-hover:scale-105" 
                            alt={`${selectedLocation.name} view ${idx + 1}`}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Overlay Gradients for Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 pointer-events-none" />
                  
                  {/* Floating Title Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-8 md:p-12">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-8">
                      <div className="space-y-4 max-w-2xl">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border uppercase tracking-[0.2em] backdrop-blur-xl shadow-lg ${
                            selectedLocation.type === 'HERITAGE' 
                              ? 'bg-blue-500/30 text-blue-100 border-blue-400/40' 
                              : 'bg-amber-500/30 text-amber-100 border-amber-400/40'
                          }`}>
                            {selectedLocation.type === 'HERITAGE' ? 'Heritage Site' : 'Market Hub'}
                          </span>
                          <span className={`text-[10px] font-bold px-4 py-1.5 rounded-full border uppercase tracking-[0.2em] flex items-center gap-2 backdrop-blur-xl shadow-lg ${
                            getLiveStatus(selectedLocation.timings).status === 'Open Now' 
                              ? 'bg-emerald-500/30 text-emerald-100 border-emerald-400/40' 
                              : 'bg-red-500/30 text-red-100 border-red-400/40'
                          }`}>
                            <span className={`w-2 h-2 rounded-full animate-pulse ${getLiveStatus(selectedLocation.timings).status === 'Open Now' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            {getLiveStatus(selectedLocation.timings).status}
                          </span>
                        </div>
                        <h3 className="text-6xl md:text-8xl font-heritage font-bold text-white leading-none tracking-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                          {selectedLocation.name}
                        </h3>
                      </div>
                      
                      <button 
                        onClick={() => handleTakeMeThere(selectedLocation)}
                        className="bg-white text-gray-900 px-10 py-5 rounded-2xl font-bold text-sm uppercase tracking-widest shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:bg-gold hover:text-white hover:scale-105 transition-all flex items-center gap-3 group border border-white/20"
                      >
                        <Navigation size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        Take Me There
                      </button>
                    </div>
                  </div>

                  {/* Carousel Indicators */}
                  <div className="absolute bottom-6 left-8 flex gap-2 z-20">
                    {(locationPhotos.length > 0 ? locationPhotos : [1]).map((_, i) => (
                      <button 
                        key={i} 
                        onClick={() => setActivePhotoIndex(i)}
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          activePhotoIndex === i 
                            ? 'w-12 bg-gold shadow-[0_0_10px_rgba(212,175,55,0.8)]' 
                            : 'w-4 bg-white/30 hover:bg-white/50'
                        }`} 
                      />
                    ))}
                  </div>
                </div>

                {/* Content Area */}
                <div className="px-8 pb-16 bg-white relative">
                  {/* Decorative background element */}
                  <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-gray-50 to-white pointer-events-none" />
                  
                  <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10 pt-12">
                    {/* Left Column: Info & Description */}
                    <div className="lg:col-span-7 space-y-12">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[12px] font-bold text-gold uppercase tracking-[0.4em] flex items-center gap-4">
                          <span className="w-12 h-px bg-gold/30" />
                          The Heritage Narrative
                        </h4>
                        {selectedLocation.type === 'HERITAGE' && (
                          <button
                            onClick={() => playGuide(selectedLocation.description)}
                            disabled={geminiLoading}
                            className="flex items-center gap-3 px-6 py-2.5 bg-gold/10 text-gold rounded-full hover:bg-gold/20 transition-all active:scale-95 text-[10px] font-bold uppercase tracking-widest border border-gold/20"
                          >
                            {geminiLoading ? <Loader2 className="animate-spin size-4" /> : (isPlaying ? <Pause size={16} /> : <Play size={16} />)}
                            {isPlaying ? 'Pause Guide' : 'Audio Guide'}
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <div className="absolute -left-8 top-0 bottom-0 w-1.5 bg-gold/10 rounded-full" />
                        <p className="text-2xl md:text-3xl text-gray-800 leading-relaxed font-heritage italic tracking-tight">
                          {aiDescription || selectedLocation.description}
                        </p>
                        
                        {aiDescription && (
                          <div className="mt-6">
                            <button 
                              onClick={() => setShowFullDescription(!showFullDescription)}
                              className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] flex items-center gap-2 hover:gap-3 transition-all group"
                            >
                              {showFullDescription ? 'Conceal History' : 'Unveil Full History'}
                              <ChevronRight size={14} className={`transition-transform duration-300 ${showFullDescription ? '-rotate-90' : 'group-hover:translate-x-1'}`} />
                            </button>
                            
                            {showFullDescription && (
                              <div className="mt-4 p-6 bg-gray-50 rounded-3xl border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-500">
                                <p className="text-sm text-gray-500 leading-relaxed">
                                  {selectedLocation.description}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {mustDo && (
                        <div className="relative p-8 bg-royal-gradient rounded-[40px] overflow-hidden group">
                          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Sparkles size={120} className="text-white" />
                          </div>
                          <div className="relative z-10 space-y-4">
                            <h4 className="text-[11px] font-bold text-gold uppercase tracking-[0.4em] flex items-center gap-2">
                              <Sparkles size={16} /> Curator's Choice
                            </h4>
                            <p className="text-2xl font-heritage font-bold text-white leading-tight">
                              "{mustDo}"
                            </p>
                            <div className="flex items-center gap-6 pt-4 border-t border-white/10">
                              <div className="space-y-1">
                                <p className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Visiting Hours</p>
                                <p className="text-xs font-bold text-white">
                                  {aiTimings?.open || selectedLocation.timings?.open} – {aiTimings?.close || selectedLocation.timings?.close}
                                </p>
                              </div>
                              {(aiTimings?.timing_note || selectedLocation.timings?.note) && (
                                <div className="space-y-1">
                                  <p className="text-[9px] font-bold text-gold/60 uppercase tracking-widest">Note</p>
                                  <p className="text-xs font-bold text-white">{aiTimings?.timing_note || selectedLocation.timings?.note}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {selectedLocation.mewari_bol && (
                        <div className="space-y-6">
                          <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.3em] flex items-center gap-3">
                            <span className="w-8 h-px bg-gray-200" />
                            Mewari Bol (Local Dialect)
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {selectedLocation.mewari_bol.map((bol, i) => (
                              <div key={i} className="group p-5 bg-white rounded-2xl border border-gold/10 hover:border-gold/30 hover:shadow-md transition-all">
                                <p className="text-lg font-bold text-gray-900 group-hover:text-gold transition-colors">"{bol.phrase}"</p>
                                <p className="text-[10px] text-gray-400 uppercase font-bold mt-2 tracking-widest">{bol.meaning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Pricing & Calculator OR Shopping Guide */}
                    <div className="lg:col-span-5 space-y-8">
                      {selectedLocation.type === 'HERITAGE' ? (
                        <>
                          {/* Official Pricing Table */}
                          <div className="bg-white rounded-[32px] border border-gold/20 shadow-xl overflow-hidden">
                            <div className="bg-royal-gradient p-6 text-white">
                              <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-gold mb-1">Official Tariffs</h4>
                              <p className="text-xs opacity-70 italic">Verified rates for the 2026 Season</p>
                            </div>
                            
                            <div className="p-6 space-y-6">
                              <div className="overflow-hidden rounded-2xl border border-gold/10">
                                <table className="w-full text-left">
                                  <thead className="bg-gold/5 text-gold text-[10px] uppercase tracking-[0.2em] font-bold">
                                    <tr>
                                      <th className="px-5 py-4">Visitor Type</th>
                                      <th className="px-5 py-4 text-right">Adult</th>
                                      <th className="px-5 py-4 text-right">Child</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gold/5 text-sm">
                                    <tr className="hover:bg-gold/5 transition-colors">
                                      <td className="px-5 py-4 font-bold text-gray-700">Indian National</td>
                                      <td className="px-5 py-4 text-right font-heritage font-bold text-gray-900">₹{baseFees.indian || 'Free'}</td>
                                      <td className="px-5 py-4 text-right font-heritage font-bold text-gray-900">₹{baseFees.indian_child || 'Free'}</td>
                                    </tr>
                                    <tr className="hover:bg-gold/5 transition-colors">
                                      <td className="px-5 py-4 font-bold text-gray-700">Foreign National</td>
                                      <td className="px-5 py-4 text-right font-heritage font-bold text-gray-900">₹{baseFees.foreigner || 'Free'}</td>
                                      <td className="px-5 py-4 text-right font-heritage font-bold text-gray-900">₹{baseFees.foreigner_child || 'Free'}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                {cameraFee !== null && (
                                  <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <Camera size={14} className="text-orange-500" />
                                      <span className="text-[10px] font-bold text-orange-700 uppercase">Camera</span>
                                    </div>
                                    <span className="text-sm font-bold text-orange-600">₹{cameraFee}</span>
                                  </div>
                                )}
                                {videoFee !== null && (
                                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                      <Play size={14} className="text-red-500" />
                                      <span className="text-[10px] font-bold text-red-700 uppercase">Video</span>
                                    </div>
                                    <span className="text-sm font-bold text-red-600">₹{videoFee}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Interactive Cost Calculator */}
                          <div className="bg-gray-50 rounded-[32px] border border-gray-200 p-8 space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.3em]">Cost Estimator</h4>
                              <div className="flex bg-white p-1 rounded-xl border border-gray-200">
                                <button 
                                  onClick={() => setIsForeigner(false)}
                                  className={`px-4 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all ${!isForeigner ? 'bg-royal-gradient text-white shadow-md' : 'text-gray-400'}`}
                                >
                                  Indian
                                </button>
                                <button 
                                  onClick={() => setIsForeigner(true)}
                                  className={`px-4 py-1.5 text-[9px] font-bold uppercase rounded-lg transition-all ${isForeigner ? 'bg-royal-gradient text-white shadow-md' : 'text-gray-400'}`}
                                >
                                  Foreigner
                                </button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Adults</label>
                                <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm">
                                  <button onClick={() => setAdultCount(Math.max(1, adultCount - 1))} className="text-gold font-bold text-lg hover:scale-125 transition-transform">−</button>
                                  <span className="text-sm font-bold text-gray-900">{adultCount}</span>
                                  <button onClick={() => setAdultCount(adultCount + 1)} className="text-gold font-bold text-lg hover:scale-125 transition-transform">+</button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Children</label>
                                <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-gray-200 shadow-sm">
                                  <button onClick={() => setChildCount(Math.max(0, childCount - 1))} className="text-gold font-bold text-lg hover:scale-125 transition-transform">−</button>
                                  <span className="text-sm font-bold text-gray-900">{childCount}</span>
                                  <button onClick={() => setChildCount(childCount + 1)} className="text-gold font-bold text-lg hover:scale-125 transition-transform">+</button>
                                </div>
                              </div>
                            </div>

                            {activities.length > 0 && (
                              <div className="space-y-3">
                                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                  <Ticket size={14} className="text-gold" /> Experiences & Activities
                                </label>
                                <div className="space-y-2">
                                  {activities.map((activity, idx) => (
                                    <button 
                                      key={idx}
                                      onClick={() => toggleActivity(activity.name)}
                                      className={`w-full p-4 rounded-2xl border text-left transition-all flex justify-between items-center group ${
                                        selectedActivities.includes(activity.name) 
                                          ? 'border-emerald-500 bg-emerald-50 shadow-sm' 
                                          : 'border-gray-200 bg-white hover:border-gold/30'
                                      }`}
                                    >
                                      <div className="flex-1">
                                        <p className={`text-xs font-bold ${selectedActivities.includes(activity.name) ? 'text-emerald-700' : 'text-gray-900'}`}>{activity.name}</p>
                                        {activity.note && <p className="text-[9px] text-gray-400 mt-0.5">{activity.note}</p>}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className={`text-sm font-bold ${selectedActivities.includes(activity.name) ? 'text-emerald-600' : 'text-gray-500'}`}>₹{activity.cost}</span>
                                        <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedActivities.includes(activity.name) ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-gray-200'}`}>
                                          {selectedActivities.includes(activity.name) && <CheckCircle2 size={12} className="text-white" />}
                                        </div>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-6 border-t border-dashed border-gray-300">
                              <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estimated Total</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-heritage font-bold text-gray-900">₹{calculateTotalCost(selectedLocation)}</span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">INR</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] text-gray-400 italic leading-tight">Includes entry fees<br />& selected activities</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Shopping & Bargaining Guide for Markets */}
                          <div className="bg-white rounded-[32px] border border-gold/20 shadow-xl overflow-hidden">
                            <div className="bg-royal-gradient p-6 text-white">
                              <h4 className="text-[11px] font-bold uppercase tracking-[0.4em] text-gold mb-1">Shopping & Bargaining Guide</h4>
                              <p className="text-xs opacity-70 italic">Insider tips for the best market experience</p>
                            </div>
                            
                            <div className="p-6 space-y-8">
                              {selectedLocation.shopping_guide?.local_specialty && (
                                <div className="space-y-3">
                                  <h5 className="text-[10px] font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles size={14} /> Local Specialty
                                  </h5>
                                  <div className="p-4 bg-gold/5 rounded-2xl border border-gold/10">
                                    <p className="text-lg font-heritage font-bold text-gray-900">{selectedLocation.shopping_guide.local_specialty}</p>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-4">
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                  <ShoppingBag size={14} className="text-gold" /> Best Buys
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  {selectedLocation.shopping_guide?.best_buys.map((item, idx) => (
                                    <span key={idx} className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-2">
                                      <CheckCircle2 size={12} className="text-emerald-500" />
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                  <MessageSquare size={14} className="text-gold" /> Bargaining Tips
                                </h5>
                                <div className="space-y-3">
                                  {selectedLocation.shopping_guide?.bargaining_tips.map((tip, idx) => (
                                    <div key={idx} className="flex gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-gold/20 transition-all">
                                      <div className="size-6 rounded-full bg-gold/10 text-gold flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                        {idx + 1}
                                      </div>
                                      <p className="text-xs text-gray-600 leading-relaxed font-medium">{tip}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Market Activity / Experience */}
                          <div className="bg-gray-50 rounded-[32px] border border-gray-200 p-8 space-y-6">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.3em]">Market Experience</h4>
                              <div className="px-3 py-1 bg-white rounded-lg border border-gray-200 text-[9px] font-bold text-gold uppercase tracking-widest">
                                Free Entry
                              </div>
                            </div>
                            <p className="text-sm text-gray-500 italic leading-relaxed">
                              Udaipur's markets are open to all. Immerse yourself in the local culture, witness traditional craftsmanship, and enjoy the vibrant atmosphere of Mewar's commercial heart.
                            </p>
                            <div className="pt-4 border-t border-dashed border-gray-300">
                              <div className="flex items-center gap-4 text-gray-400">
                                <div className="flex items-center gap-2">
                                  <Info size={14} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">No Entry Fee</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Camera size={14} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Photography Allowed</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Sliding Info Card - Artisan Post */}
      <div className={`absolute bottom-0 left-0 right-0 z-[100] transition-transform duration-500 ease-in-out transform ${selectedPost ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="bg-white rounded-t-[40px] shadow-2xl border-t-4 border-gold/20 max-h-[85vh] overflow-hidden">
            {selectedPost && (
              <div className="max-w-6xl mx-auto p-0 flex flex-col lg:flex-row h-[500px]">
                {/* Left Side: Immersive Image */}
                <div className="lg:w-1/2 h-64 lg:h-full relative overflow-hidden group">
                  <img 
                    src={selectedPost.image_url} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                    alt="Artisan update" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-white">
                    <div className="flex items-center gap-2 mb-1.5">
                      <MapPin size={14} className="text-gold" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Near {LOCATIONS.find(l => Math.abs(l.lat - selectedPost.location.lat) < 0.01)?.name || 'Udaipur Center'}</span>
                    </div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-gold/80">Live Artisan Feed</h4>
                  </div>
                  <button 
                    onClick={() => setSelectedPost(null)}
                    className="absolute top-4 right-4 z-20 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors lg:hidden"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Right Side: Editorial Content */}
                <div className="lg:w-1/2 p-8 lg:p-10 flex flex-col relative bg-white overflow-y-auto no-scrollbar">
                  <button 
                    onClick={() => setSelectedPost(null)}
                    className="absolute top-8 right-8 hidden lg:flex bg-gray-100 text-gray-400 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                  >
                    <X size={20} />
                  </button>

                  <div className="max-w-lg mx-auto w-full space-y-6 my-auto">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 flex-shrink-0 rounded-2xl bg-royal-gradient flex items-center justify-center text-white text-3xl font-bold shadow-xl overflow-hidden border-2 border-white/20">
                        {artisans.find(a => a.id === selectedPost.artisan_id)?.profile_picture ? (
                          <img src={artisans.find(a => a.id === selectedPost.artisan_id)?.profile_picture} className="w-full h-full object-cover" alt={selectedPost.artisan_name} />
                        ) : (
                          <span className="font-heritage">{selectedPost.artisan_name[0]}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-3xl font-heritage font-bold text-gray-900 tracking-tighter uppercase leading-none">{selectedPost.artisan_name}</h3>
                        <p className="text-[9px] font-bold text-gold uppercase tracking-[0.3em] mt-1.5">
                          {artisans.find(a => a.id === selectedPost.artisan_id)?.category || 'Master Craftsman'}
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-6 top-0 bottom-0 w-1 bg-royal-gradient opacity-20" />
                      <p className="text-lg text-gray-600 italic leading-relaxed font-heritage uppercase tracking-wide">
                        {cleanHeritageText(selectedPost.content)}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button 
                        onClick={() => handleTakeMeThere(selectedPost)}
                        className="flex-grow bg-royal-gradient text-white py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform active:scale-95"
                      >
                        <Navigation size={16} /> Visit Workshop
                      </button>
                      {onViewArtisanProfile && (
                        <button 
                          onClick={() => onViewArtisanProfile(selectedPost.artisan_id)}
                          className="px-6 py-3.5 bg-white text-gold rounded-xl border-2 border-gold/20 font-bold text-[10px] uppercase tracking-widest hover:bg-gold/5 transition-all shadow-lg"
                        >
                          View Profile
                        </button>
                      )}
                      <button className="w-14 h-14 rounded-xl border-2 border-gold/10 flex items-center justify-center text-gold hover:bg-gold/5 transition-all shadow-md active:scale-95">
                        <Heart size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Sliding Info Card - Artisan Profile */}
      <div className={`absolute bottom-0 left-0 right-0 z-[100] transition-transform duration-500 ease-in-out transform ${selectedArtisan ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="bg-white rounded-t-[40px] shadow-2xl border-t-4 border-gold/20 max-h-[85vh] overflow-hidden">
            {selectedArtisan && (
              <div className="max-w-6xl mx-auto p-0 flex flex-col lg:flex-row h-[500px]">
                {/* Left Side: Immersive Image */}
                <div className="lg:w-1/2 h-64 lg:h-full relative overflow-hidden group">
                  <img 
                    src={selectedArtisan.thumbnail || selectedArtisan.profile_picture || 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800'} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                    alt={selectedArtisan.name} 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 text-white">
                    <div className="flex items-center gap-2 mb-1.5">
                      <MapPin size={14} className="text-gold" />
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Near {LOCATIONS.find(l => Math.abs(l.lat - selectedArtisan.location!.lat) < 0.01)?.name || 'Udaipur Center'}</span>
                    </div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.4em] text-gold/80">Master Artisan Profile</h4>
                  </div>
                  <button 
                    onClick={() => setSelectedArtisan(null)}
                    className="absolute top-4 right-4 z-20 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors lg:hidden"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Right Side: Editorial Content */}
                <div className="lg:w-1/2 p-8 lg:p-10 flex flex-col relative bg-white overflow-y-auto no-scrollbar">
                  <button 
                    onClick={() => setSelectedArtisan(null)}
                    className="absolute top-8 right-8 hidden lg:flex bg-gray-100 text-gray-400 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"
                  >
                    <X size={20} />
                  </button>

                  <div className="max-w-lg mx-auto w-full space-y-6 my-auto">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 flex-shrink-0 rounded-2xl bg-royal-gradient flex items-center justify-center text-white text-3xl font-bold shadow-xl overflow-hidden border-2 border-white/20">
                        {selectedArtisan.profile_picture ? (
                          <img src={selectedArtisan.profile_picture} className="w-full h-full object-cover" alt={selectedArtisan.name} />
                        ) : (
                          <span className="font-heritage">{selectedArtisan.name[0]}</span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-3xl font-heritage font-bold text-gray-900 tracking-tighter uppercase leading-none">{selectedArtisan.name}</h3>
                        <p className="text-[9px] font-bold text-gold uppercase tracking-[0.3em] mt-1.5">{selectedArtisan.category || 'Master Craftsman'}</p>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="absolute -left-6 top-0 bottom-0 w-1 bg-royal-gradient opacity-20" />
                      <p className="text-lg text-gray-600 italic leading-relaxed font-heritage uppercase tracking-wide">
                        {cleanHeritageText(selectedArtisan.description || `A master of ${selectedArtisan.category || 'traditional crafts'} based in the heart of Udaipur, preserving centuries of heritage through every creation.`)}
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <button 
                        onClick={() => handleTakeMeThere(selectedArtisan)}
                        className="flex-grow bg-royal-gradient text-white py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform active:scale-95"
                      >
                        <Navigation size={16} /> Visit Workshop
                      </button>
                      {onViewArtisanProfile && (
                        <button 
                          onClick={() => onViewArtisanProfile(selectedArtisan.id)}
                          className="px-6 py-3.5 bg-white text-gold rounded-xl border-2 border-gold/20 font-bold text-[10px] uppercase tracking-widest hover:bg-gold/5 transition-all shadow-lg"
                        >
                          View Profile
                        </button>
                      )}
                      <button className="w-14 h-14 rounded-xl border-2 border-gold/10 flex items-center justify-center text-gold hover:bg-gold/5 transition-all shadow-md active:scale-95">
                        <Heart size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
);
};
