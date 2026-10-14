import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';
import { PLACES, CITIES, distanceKm } from '@shared/places.js';

/**
 * City + neighbourhood picker. "Use my location" snaps the browser's GPS fix
 * to the nearest supported neighbourhood (and keeps the precise point for matching).
 */
export default function LocationPicker({ value, onChange, error }) {
  const [locating, setLocating] = useState(false);
  const areas = PLACES.filter((p) => p.city === value.city);

  const useGps = () => {
    if (!navigator.geolocation) return toast.error('Your browser does not support location');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = [pos.coords.longitude, pos.coords.latitude];
        const nearest = [...PLACES].sort((a, b) => distanceKm(here, a.coords) - distanceKm(here, b.coords))[0];
        const d = distanceKm(here, nearest.coords);
        if (d > 60) {
          toast('We don’t cover your area yet — pick the closest city', { icon: '📍' });
          onChange({ city: nearest.city, area: nearest.area });
        } else {
          onChange({ city: nearest.city, area: nearest.area, coords: here });
          toast.success(`Located near ${nearest.area}, ${nearest.city}`);
        }
        setLocating(false);
      },
      () => {
        toast.error('Location permission denied — choose manually');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">City</span>
          <select className={`input ${error ? 'input-error' : ''}`} value={value.city || ''} onChange={(e) => onChange({ city: e.target.value, area: PLACES.find((p) => p.city === e.target.value)?.area || '' })}>
            <option value="">Select city</option>
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Area</span>
          <select className={`input ${error ? 'input-error' : ''}`} value={value.area || ''} disabled={!value.city} onChange={(e) => onChange({ city: value.city, area: e.target.value })}>
            <option value="">Select area</option>
            {areas.map((a) => <option key={a.area}>{a.area}</option>)}
          </select>
        </label>
      </div>
      <button type="button" onClick={useGps} disabled={locating} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-moss hover:underline">
        <LocateFixed className="h-3.5 w-3.5" /> {locating ? 'Locating…' : 'Use my current location'}
      </button>
      {value.coords && <span className="ml-2 text-xs text-muted">· precise point saved for distance matching</span>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
