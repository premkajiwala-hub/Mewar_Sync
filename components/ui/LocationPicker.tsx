import React, { useEffect, useId, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, LocateFixed, MapPin, Search, X } from 'lucide-react';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Spinner } from './Surface';

const DefaultIcon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });

const UDAIPUR_CENTER: [number, number] = [24.5764, 73.6835];
const UDAIPUR_RADIUS_DEG = 0.08;
const HUBS = [
  { name: 'Hathi Pol', lat: 24.585, lng: 73.685 },
  { name: 'Shilpgram', lat: 24.605, lng: 73.655 },
  { name: 'Bada Bazaar', lat: 24.582, lng: 73.688 },
];

interface Suggestion {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelect: (lat: number, lng: number) => void;
}

function MapClicks({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({ initialLocation, onLocationSelect }) => {
  const [position, setPosition] = useState<[number, number]>(initialLocation ? [initialLocation.lat, initialLocation.lng] : UDAIPUR_CENTER);
  const [picked, setPicked] = useState(!!initialLocation);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [geoError, setGeoError] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const inputId = useId();

  const outside = picked && (Math.abs(position[0] - UDAIPUR_CENTER[0]) > UDAIPUR_RADIUS_DEG || Math.abs(position[1] - UDAIPUR_CENTER[1]) > UDAIPUR_RADIUS_DEG);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError('');
      try {
        // OpenStreetMap Nominatim: debounced, max 5 results, scoped to Udaipur.
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(`${q.slice(0, 120)}, Udaipur`)}`;
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('search failed');
        const data = (await res.json()) as Suggestion[];
        setSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) setSearchError('Address search is unavailable right now — tap the map instead.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 800);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const pick = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPosition([lat, lng]);
    setPicked(true);
    onLocationSelect(lat, lng);
  };

  const useCurrent = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Location is not available in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => pick(pos.coords.latitude, pos.coords.longitude),
      err => setGeoError(err.code === err.PERMISSION_DENIED ? 'Location permission was denied. Search for your address or tap the map.' : 'Could not get your location. Tap the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <MapPin aria-hidden className="size-4 text-gold-deep" /> Workshop location
        </label>
        <button type="button" onClick={useCurrent} className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-indigo hover:underline">
          <LocateFixed aria-hidden className="size-4" /> Use my location
        </button>
      </div>

      <div ref={boxRef} className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Search your workshop address"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="ms-glass-field h-11 w-full rounded-md border border-line pl-9 pr-10 text-[15px] focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/15"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2">
          {searching ? <Spinner label="Searching" className="[&>span:last-child]:sr-only" /> : query && (
            <button type="button" onClick={() => { setQuery(''); setSuggestions([]); }} aria-label="Clear search" className="flex size-8 items-center justify-center rounded text-ink-muted hover:text-ink">
              <X aria-hidden className="size-4" />
            </button>
          )}
        </span>
        {open && suggestions.length > 0 && (
          <ul id={listId} role="listbox" className="ms-glass-strong absolute z-[500] mt-1 w-full overflow-hidden rounded-lg">
            {suggestions.map(s => (
              <li key={s.place_id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-parchment-soft focus:bg-parchment-soft focus:outline-none"
                  onClick={() => {
                    pick(parseFloat(s.lat), parseFloat(s.lon));
                    setQuery(s.display_name.split(',')[0]);
                    setOpen(false);
                  }}
                >
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gold-deep" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.display_name.split(',')[0]}</span>
                    <span className="block truncate text-xs text-ink-muted">{s.display_name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {(searchError || geoError) && <p role="status" className="text-xs text-warning">{searchError || geoError}</p>}

      <div className="relative z-0 h-64 overflow-hidden rounded-lg border border-line">
        <MapContainer center={position} zoom={14} className="size-full" scrollWheelZoom={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
          {picked && <Marker position={position} icon={DefaultIcon} />}
          <MapClicks onPick={pick} />
          <Recenter center={position} />
        </MapContainer>
      </div>
      <p className="text-xs text-ink-muted">{picked ? `Pinned at ${position[0].toFixed(4)}, ${position[1].toFixed(4)}.` : 'Tap the map to drop a pin on your workshop.'}</p>

      {outside && (
        <div role="status" className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning">
          <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle aria-hidden className="size-4" /> This pin is outside Udaipur city.</p>
          <p className="mt-1 text-xs">If that’s not intended, pick a nearby artisan hub:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {HUBS.map(h => (
              <button key={h.name} type="button" onClick={() => pick(h.lat, h.lng)} className="rounded-full border border-warning/30 bg-surface px-3 py-1 text-xs font-semibold text-warning hover:bg-white">
                {h.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
