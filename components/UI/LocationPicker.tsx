
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, AlertTriangle, Search, Loader2, X } from 'lucide-react';

// Fix Leaflet marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const UDAIPUR_CENTER: [number, number] = [24.5764, 73.6835];
const UDAIPUR_RADIUS_DEG = 0.08; // Roughly 8-9km

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelect: (lat: number, lng: number) => void;
}

const MapEvents = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const ChangeView = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

export const LocationPicker: React.FC<LocationPickerProps> = ({ initialLocation, onLocationSelect }) => {
  const [position, setPosition] = useState<[number, number]>(
    initialLocation ? [initialLocation.lat, initialLocation.lng] : UDAIPUR_CENTER
  );
  const [isOutside, setIsOutside] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Nominatim API call - restricted to Udaipur area if possible, or just append Udaipur
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Udaipur')}&limit=5&addressdetails=1`);
        const data = await response.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSuggestionSelect = (suggestion: any) => {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    handleMapClick(lat, lng);
    setSearchQuery(suggestion.display_name);
    setShowSuggestions(false);
  };

  const checkBoundary = (lat: number, lng: number) => {
    const distLat = Math.abs(lat - UDAIPUR_CENTER[0]);
    const distLng = Math.abs(lng - UDAIPUR_CENTER[1]);
    return distLat > UDAIPUR_RADIUS_DEG || distLng > UDAIPUR_RADIUS_DEG;
  };

  const handleMapClick = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onLocationSelect(lat, lng);
    setIsOutside(checkBoundary(lat, lng));
  };

  const handleCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        handleMapClick(latitude, longitude);
      });
    }
  };

  const hubs = [
    { name: 'Hathi Pol', lat: 24.5850, lng: 73.6850 },
    { name: 'Shilpgram', lat: 24.6050, lng: 73.6550 },
    { name: 'Bada Bazaar', lat: 24.5820, lng: 73.6880 }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={14} className="text-gold" /> Workshop Location
          </label>
          <button 
            type="button"
            onClick={handleCurrentLocation}
            className="text-[10px] font-bold text-saffron uppercase tracking-widest flex items-center gap-2 hover:underline"
          >
            <Navigation size={12} /> Use Current
          </button>
        </div>

        {/* Manual Address Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40" size={16} />
            <input 
              type="text"
              placeholder="Type your workshop address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 3 && setShowSuggestions(true)}
              className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-12 text-sm focus:border-saffron focus:outline-none transition-all shadow-sm"
            />
            {isSearching ? (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="text-gold animate-spin" />
              </div>
            ) : searchQuery && (
              <button 
                type="button"
                onClick={() => {setSearchQuery(''); setSuggestions([]);}}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-[100] w-full mt-2 bg-white border border-gold/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className="w-full text-left px-6 py-4 hover:bg-gold/5 transition-colors border-b border-gold/5 last:border-0 flex items-start gap-3 group"
                >
                  <MapPin size={16} className="text-gold/40 group-hover:text-gold shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{suggestion.display_name.split(',')[0]}</p>
                    <p className="text-[10px] text-gray-400 line-clamp-1">{suggestion.display_name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="h-64 rounded-3xl overflow-hidden border-2 border-gold/10 relative z-0">
        <MapContainer center={position} zoom={13} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={position} icon={DefaultIcon} />
          <MapEvents onMapClick={handleMapClick} />
          <ChangeView center={position} />
        </MapContainer>
      </div>

      {isOutside && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl animate-in slide-in-from-top-2">
          <div className="flex items-start gap-3 text-orange-700">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-xs font-bold">Outside Udaipur Boundary</p>
              <p className="text-[10px] leading-relaxed">Your location seems to be outside the main city. Please select a valid artisan hub within Udaipur:</p>
              <div className="flex flex-wrap gap-2">
                {hubs.map(hub => (
                  <button
                    key={hub.name}
                    type="button"
                    onClick={() => handleMapClick(hub.lat, hub.lng)}
                    className="px-3 py-1.5 bg-white border border-orange-200 rounded-full text-[9px] font-bold uppercase tracking-wider hover:bg-orange-100 transition-colors"
                  >
                    {hub.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
