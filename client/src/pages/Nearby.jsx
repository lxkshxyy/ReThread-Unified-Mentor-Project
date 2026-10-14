import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed, MapPin, Sparkles, Users } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, Spinner, Stars } from '@/components/ui';
import ItemCard, { ItemGridSkeleton } from '@/components/ItemCard';
import { PLACES, CITIES } from '@shared/places.js';
import { catLabel, formatDistance, initials } from '@/lib/utils';

const RADII = [3, 5, 10, 15, 25, 50];

function Recenter({ center, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    const zoom = radiusKm <= 3 ? 14 : radiusKm <= 5 ? 13 : radiusKm <= 10 ? 12 : radiusKm <= 25 ? 11 : 9;
    map.setView([center[1], center[0]], zoom);
  }, [center, radiusKm, map]);
  return null;
}

const pin = (m) =>
  L.divIcon({
    className: 'rt-pin',
    html: `<div style="display:flex;align-items:center;gap:4px;transform:translate(-50%,-100%);"><div style="background:${m.avatarColor};color:#fff;border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);width:34px;height:34px;border-radius:999px;display:grid;place-items:center;font:600 12px Inter,sans-serif">${initials(m.name)}</div><div style="background:#191917;color:#fff;border-radius:999px;padding:1px 7px;font:600 11px Inter,sans-serif">${m.items}</div></div>`,
    iconSize: [0, 0],
  });

const mePin = L.divIcon({ className: 'rt-pin', html: '<div style="transform:translate(-50%,-50%);width:18px;height:18px;border-radius:999px;background:#C8643B;border:3px solid #fff;box-shadow:0 0 0 6px rgba(200,100,59,.25)"></div>', iconSize: [0, 0] });

export default function Nearby() {
  useDocumentTitle('Swaps near you');
  const { user } = useAuth();
  const [radiusKm, setRadiusKm] = useState(15);
  const [center, setCenter] = useState(user?.location?.coords || PLACES[0].coords);
  const [label, setLabel] = useState(user?.location?.area ? `${user.location.area}, ${user.location.city}` : 'Hauz Khas, Delhi');
  const [members, setMembers] = useState(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (user?.location?.coords) {
      setCenter(user.location.coords);
      setLabel(`${user.location.area}, ${user.location.city}`);
    }
  }, [user]);

  useEffect(() => {
    setMembers(null);
    api.get('/users/nearby', { params: { lng: center[0], lat: center[1], radiusKm } }).then(({ data }) => setMembers(data.members)).catch(() => setMembers([]));
  }, [center, radiusKm]);

  const itemsQuery = useMemo(() => ({ params: { lng: center[0], lat: center[1], radiusKm, sort: 'nearest', limit: 12 } }), [center, radiusKm]);
  const { data: items, loading: itemsLoading } = useFetch('/items', itemsQuery);
  const { data: sug } = useFetch(user ? '/users/me/suggestions' : null, { params: { radiusKm } });

  const gps = () => {
    setLocating(true);
    navigator.geolocation?.getCurrentPosition(
      (p) => { setCenter([p.coords.longitude, p.coords.latitude]); setLabel('Your current location'); setLocating(false); },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Location-based matching</p>
          <h1 className="mt-2 text-4xl">Swaps near you</h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> Around {label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!user && (
            <select className="input w-auto rounded-full" aria-label="City" onChange={(e) => { const p = PLACES.find((x) => x.city === e.target.value); if (p) { setCenter(p.coords); setLabel(`${p.area}, ${p.city}`); } }}>
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
          <button className="btn-secondary btn-sm" onClick={gps} disabled={locating}><LocateFixed className="h-4 w-4" /> {locating ? 'Locating…' : 'Use GPS'}</button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {RADII.map((r) => <button key={r} onClick={() => setRadiusKm(r)} className={clsx('chip', radiusKm === r && 'chip-active')}>{r} km</button>)}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative z-0 h-[420px] overflow-hidden rounded-3xl border border-line shadow-card sm:h-[520px]">
          <MapContainer center={[center[1], center[0]]} zoom={12} scrollWheelZoom className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} className="rt-tiles" />
            <Recenter center={center} radiusKm={radiusKm} />
            <Circle center={[center[1], center[0]]} radius={radiusKm * 1000} pathOptions={{ color: '#2E5E4E', weight: 1.5, fillOpacity: 0.06 }} />
            <Marker position={[center[1], center[0]]} icon={mePin} />
            {(members || []).filter((m) => m.approx).map((m) => (
              <Marker key={m._id} position={[m.approx[1], m.approx[0]]} icon={pin(m)}>
                <Popup>
                  <div className="min-w-[180px] font-sans">
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.area} · {formatDistance(m.distanceKm)}</p>
                    <p className="mt-1 text-xs">{m.items} items · {m.categories.map(catLabel).join(', ')}</p>
                    <a href={`/profile/${m._id}`} className="mt-1 inline-block text-xs font-semibold text-[#2E5E4E]">View closet →</a>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
          <p className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-full bg-surface/95 px-3 py-1 text-[11px] text-muted shadow-sm">Pins are approximate (~1 km) to protect privacy</p>
        </div>

        <aside className="card flex max-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-5 py-4">
            <Users className="h-4 w-4 text-moss" />
            <h2 className="font-semibold">{members ? `${members.length} swappers within ${radiusKm} km` : 'Finding swappers…'}</h2>
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto">
            {!members ? (
              <div className="grid place-items-center p-10"><Spinner /></div>
            ) : members.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">Nobody within {radiusKm} km yet — try a wider radius.</p>
            ) : (
              members.map((m) => (
                <Link key={m._id} to={`/profile/${m._id}`} className="flex items-center gap-3 border-b border-line/60 px-5 py-3 hover:bg-paper">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: m.avatarColor }}>{initials(m.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted">{m.area} · {formatDistance(m.distanceKm)}</p>
                    {m.rating?.count > 0 && <Stars value={m.rating.avg} size={11} />}
                  </div>
                  <span className="badge tone-good">{m.items} items</span>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>

      {user && (
        <section className="mt-12">
          <h2 className="flex items-center gap-2 text-3xl"><Sparkles className="h-6 w-6 text-moss" /> Suggested for you</h2>
          <p className="mt-1 text-sm text-muted">Items within {radiusKm} km that balance well with something in your closet.</p>
          <div className="mt-6">
            {!sug ? <ItemGridSkeleton count={4} /> : sug.suggestions.length === 0 ? (
              <EmptyState icon={Sparkles} title="No fair matches in this radius" action={<Link to="/items/new" className="btn-primary">List an item</Link>}>Try a bigger radius or list more items to unlock suggestions.</EmptyState>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
                {sug.suggestions.map((s) => (
                  <ItemCard key={s.item._id} item={s.item} badge={<span className="badge bg-moss text-white">{s.fairness}% match</span>}
                    footer={<ul className="mt-1.5 space-y-0.5 text-[11px] text-moss">{s.reasons.slice(0, 2).map((r) => <li key={r} className="line-clamp-1">• {r}</li>)}</ul>} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-3xl">Closest listings</h2>
        <div className="mt-6">
          {itemsLoading ? <ItemGridSkeleton count={8} /> : items?.items?.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{items.items.map((it) => <ItemCard key={it._id} item={it} />)}</div>
          ) : <p className="text-sm text-muted">No listings within {radiusKm} km.</p>}
        </div>
        {items?.total > 12 && <div className="mt-8 text-center"><Link to={`/browse?radiusKm=${radiusKm}&sort=nearest`} className="btn-secondary">See all {items.total} nearby</Link></div>}
      </section>
    </div>
  );
}
