import { distanceKm } from '../../../shared/places.js';

export function serializeMe(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    bio: user.bio,
    avatarColor: user.avatarColor,
    location: {
      city: user.location?.city,
      area: user.location?.area,
      coords: user.location?.point?.coordinates || null,
    },
    sizes: user.sizes,
    preferences: user.preferences,
    favorites: user.favorites || [],
    rating: user.rating,
    stats: user.stats,
    createdAt: user.createdAt,
  };
}

export const publicOwner = (u) =>
  u && typeof u === 'object' && u.name
    ? {
        _id: u._id,
        name: u.name,
        avatarColor: u.avatarColor,
        location: { city: u.location?.city, area: u.location?.area },
        rating: u.rating,
        stats: u.stats,
        createdAt: u.createdAt,
      }
    : u;

// Never expose exact coordinates of other users: only distance + neighbourhood.
export function serializeItem(item, viewer) {
  const o = item.toObject ? item.toObject() : { ...item };
  const coords = o.location?.point?.coordinates;
  const ownerId = String(o.owner?._id || o.owner || '');
  const isOwn = viewer && ownerId === String(viewer._id);
  const mine = isOwn ? null : viewer?.location?.point?.coordinates;
  const out = {
    ...o,
    owner: publicOwner(o.owner),
    location: { city: o.location?.city, area: o.location?.area },
    distanceKm: isOwn ? null : o.distanceKm ?? (coords && mine ? distanceKm(mine, coords) : null),
    // Approximate (≈1 km jitter-free grid) position for map pins.
    approx: coords ? [Math.round(coords[0] * 100) / 100, Math.round(coords[1] * 100) / 100] : null,
  };
  if (viewer) out.isFavorite = (viewer.favorites || []).some((f) => String(f) === String(o._id));
  delete out.__v;
  return out;
}
