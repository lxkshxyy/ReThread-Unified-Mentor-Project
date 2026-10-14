import { Link, useNavigate } from 'react-router-dom';
import { Heart, MapPin } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { condShort, formatINR, formatDistance } from '@/lib/utils';

export default function ItemCard({ item, badge, footer, compact = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fav, setFav] = useState(Boolean(item.isFavorite));

  const toggleFav = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return navigate('/login', { state: { from: `/items/${item._id}` } });
    setFav((f) => !f);
    try {
      const { data } = await api.post(`/items/${item._id}/favorite`);
      setFav(data.isFavorite);
      toast.success(data.isFavorite ? 'Saved to your wishlist' : 'Removed from wishlist');
    } catch (err) {
      setFav((f) => !f);
      toast.error(errorMessage(err));
    }
  };

  return (
    <Link to={`/items/${item._id}`} className="group block focus-visible:rounded-2xl">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        <img src={item.images?.[0]} alt={item.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          <span className="badge bg-surface/95 text-ink shadow-sm backdrop-blur">{condShort(item.condition)}</span>
          {badge}
        </div>
        {item.status && item.status !== 'available' && (
          <span className="badge absolute bottom-2.5 left-2.5 bg-ink/85 capitalize text-white">{item.status}</span>
        )}
        {user && String(item.owner?._id || item.owner) !== String(user._id) && (
          <button
            onClick={toggleFav}
            aria-label={fav ? 'Remove from wishlist' : 'Save to wishlist'}
            className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-surface/95 shadow-sm backdrop-blur transition hover:scale-105"
          >
            <Heart className={clsx('h-4 w-4', fav ? 'fill-clay text-clay' : 'text-ink')} />
          </button>
        )}
      </div>
      <div className={clsx('px-0.5', compact ? 'pt-2' : 'pt-3')}>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{item.brand}</p>
          <p className="shrink-0 text-xs text-muted">Size {item.size}</p>
        </div>
        <h3 className={clsx('mt-0.5 truncate font-medium text-ink', compact ? 'text-sm' : 'text-[15px]')}>{item.title}</h3>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-semibold text-moss">{formatINR(item.swapValue)}</span>
            <span className="text-xs text-muted"> swap value</span>
          </p>
        </div>
        {!compact && (item.distanceKm != null || item.location?.area) && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {item.location?.area}
            {item.location?.city && `, ${item.location.city}`}
            {item.distanceKm != null && <span className="text-ink/70"> · {formatDistance(item.distanceKm)}</span>}
          </p>
        )}
        {footer}
      </div>
    </Link>
  );
}

export function ItemGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          <div className="skeleton aspect-[4/5]" />
          <div className="skeleton mt-3 h-3 w-1/3" />
          <div className="skeleton mt-2 h-4 w-3/4" />
          <div className="skeleton mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function MiniItem({ item, right, className = '' }) {
  if (!item) return null;
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <img src={item.images?.[0]} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted">
          {item.brand ? `${item.brand} · ` : ''}
          {item.size ? `Size ${item.size} · ` : ''}
          <span className="font-semibold text-moss">{formatINR(item.swapValue)}</span>
        </p>
      </div>
      {right}
    </div>
  );
}
