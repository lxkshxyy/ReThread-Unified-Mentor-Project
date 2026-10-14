import mongoose from 'mongoose';
import { Item } from '../models/index.js';
import { fairness, categoryByKey } from '../../../shared/catalog.js';

/**
 * Suggest which of *my* items (alone or as a pair) best balance a target swap value.
 * Returns up to `limit` bundles sorted by fairness (singles preferred on ties).
 */
export function fairBundles(targetValue, myItems, limit = 3) {
  const options = [];
  for (const a of myItems) {
    options.push({ items: [a], total: a.swapValue, fairness: fairness(a.swapValue, targetValue) });
  }
  for (let i = 0; i < myItems.length; i++) {
    for (let j = i + 1; j < myItems.length; j++) {
      const total = myItems[i].swapValue + myItems[j].swapValue;
      options.push({ items: [myItems[i], myItems[j]], total, fairness: fairness(total, targetValue) - 2 });
    }
  }
  return options
    .filter((o) => o.fairness >= 60)
    .sort((x, y) => y.fairness - x.fairness || x.items.length - y.items.length)
    .slice(0, limit)
    .map((o) => ({ ...o, fairness: Math.min(100, Math.max(0, o.fairness)) }));
}

/**
 * Location-based swap suggestions: items from other people near `user` whose swap value
 * is close to one of the user's own available items.
 * score = 0.5·fairness + 0.3·proximity + 0.2·fit (wishlist category, they want your category, your size)
 */
export async function nearbySuggestions(user, { radiusKm = 15, limit = 12 } = {}) {
  const coords = user.location?.point?.coordinates;
  if (!coords) return [];
  const mine = await Item.find({ owner: user._id, status: 'available' }).lean();
  if (!mine.length) return [];

  const candidates = await Item.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: coords },
        distanceField: 'distanceKm',
        distanceMultiplier: 0.001,
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: { status: 'available', owner: { $ne: new mongoose.Types.ObjectId(String(user._id)) } },
      },
    },
    { $limit: 200 },
    { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner', pipeline: [{ $project: { name: 1, avatarColor: 1, location: 1, rating: 1, stats: 1, status: 1 } }] } },
    { $unwind: '$owner' },
    { $match: { 'owner.status': 'active' } },
  ]);

  const prefs = new Set(user.preferences || []);
  // Infer who the member dresses for from their own closet (women / men / kids) + unisex.
  const genders = new Set([...mine.map((m) => m.gender), 'unisex']);
  const mySizes = new Set(Object.values(user.sizes || {}).filter(Boolean));
  const results = [];
  for (const c of candidates) {
    if (!genders.has(c.gender)) continue;
    let best = null;
    for (const m of mine) {
      const f = fairness(m.swapValue, c.swapValue);
      const wantsMine = (c.lookingFor || []).includes(m.category);
      if (!best || f + (wantsMine ? 8 : 0) > best.f + (best.wantsMine ? 8 : 0)) best = { m, f, wantsMine };
    }
    if (!best || best.f < 70) continue;
    const proximity = Math.max(0, 1 - c.distanceKm / radiusKm);
    const sizeFit = mySizes.has(c.size) || c.size === 'One size' || c.size === 'Free size';
    const pref = (prefs.has(c.category) ? 0.4 : 0) + (best.wantsMine ? 0.3 : 0) + (sizeFit ? 0.3 : 0);
    const score = 0.5 * (best.f / 100) + 0.3 * proximity + 0.2 * pref;
    const reasons = [`${best.f}% value match with your ${best.m.title}`];
    if (best.wantsMine) reasons.push(`${c.owner.name.split(' ')[0]} is looking for a ${(categoryByKey(best.m.category)?.label || 'piece').toLowerCase()}`);
    if (prefs.has(c.category)) reasons.push('Matches your wishlist categories');
    if (sizeFit) reasons.push('In your size');
    results.push({
      item: c,
      forItem: { _id: best.m._id, title: best.m.title, images: best.m.images, swapValue: best.m.swapValue },
      fairness: best.f,
      distanceKm: Math.round(c.distanceKm * 10) / 10,
      score: Math.round(score * 100),
      reasons,
    });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
