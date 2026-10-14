import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, Item, Swap, Notification } from '../models/index.js';
import { asyncHandler, validate, HttpError, requireAuth, optionalAuth } from '../middleware/core.js';
import { serializeMe, serializeItem, publicOwner } from '../utils/serializers.js';
import { nearbySuggestions } from '../utils/matching.js';
import { findPlace } from '../../../shared/places.js';
import { CATEGORIES, impactFor, ACTIVE_SWAP_STATUSES } from '../../../shared/catalog.js';

const router = Router();

const profileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  bio: z.string().trim().max(280).optional(),
  phone: z.string().trim().regex(/^(\+91[ -]?)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number').or(z.literal('')).optional(),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  coords: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
  sizes: z.object({ top: z.string().max(12), bottom: z.string().max(12), footwear: z.string().max(12) }).partial().optional(),
  preferences: z.array(z.enum(CATEGORIES.map((c) => c.key))).max(10).optional(),
});

router.patch(
  '/me',
  requireAuth,
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const u = req.user;
    const { name, bio, phone, city, area, coords, sizes, preferences } = req.body;
    if (name) u.name = name;
    if (bio !== undefined) u.bio = bio;
    if (phone !== undefined) u.phone = phone;
    if (sizes) u.set('sizes', { ...(u.toObject().sizes || {}), ...sizes });
    if (preferences) u.preferences = preferences;
    if (city && area) {
      const point = coords || findPlace(city, area)?.coords;
      if (!point) throw new HttpError(422, 'Choose a valid location');
      u.location = { city, area, point: { type: 'Point', coordinates: point } };
      // Keep available listings in sync with the owner's location for matching.
      await Item.updateMany({ owner: u._id, status: 'available' }, { location: { city, area, point: { type: 'Point', coordinates: point } } });
    }
    await u.save();
    res.json({ user: serializeMe(u) });
  })
);

router.get(
  '/me/items',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await Item.find({ owner: req.user._id, status: { $ne: 'removed' } }).sort({ createdAt: -1 });
    // Count incoming open requests per item for the dashboard.
    const open = await Swap.aggregate([
      { $match: { recipient: req.user._id, status: { $in: ['pending', 'countered'] } } },
      { $unwind: '$requestedItems' },
      { $group: { _id: '$requestedItems', n: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(open.map((o) => [String(o._id), o.n]));
    res.json({ items: items.map((i) => ({ ...serializeItem(i, req.user), openRequests: counts[String(i._id)] || 0 })) });
  })
);

router.get(
  '/me/favorites',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await Item.find({ _id: { $in: req.user.favorites }, status: { $ne: 'removed' } }).populate('owner', 'name avatarColor location rating stats');
    res.json({ items: items.map((i) => serializeItem(i, req.user)) });
  })
);

router.get(
  '/me/suggestions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const radiusKm = Math.min(200, Math.max(2, Number(req.query.radiusKm) || 15));
    const list = await nearbySuggestions(req.user, { radiusKm, limit: 12 });
    res.json({
      radiusKm,
      suggestions: list.map((s) => ({ ...s, item: serializeItem({ ...s.item, distanceKm: s.distanceKm }, req.user) })),
    });
  })
);

router.get(
  '/me/dashboard',
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.user._id;
    const [itemsByStatus, swapsByStatus, incoming, recent, completed, unreadNotifications] = await Promise.all([
      Item.aggregate([{ $match: { owner: me } }, { $group: { _id: '$status', n: { $sum: 1 }, views: { $sum: '$views' }, saves: { $sum: '$favoritesCount' } } }]),
      Swap.aggregate([{ $match: { $or: [{ requester: me }, { recipient: me }] } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Swap.countDocuments({ awaiting: me, status: { $in: ['pending', 'countered'] } }),
      Swap.find({ $or: [{ requester: me }, { recipient: me }] })
        .sort({ updatedAt: -1 })
        .limit(6)
        .populate('requester recipient', 'name avatarColor')
        .populate('offeredItems requestedItems', 'title images swapValue owner'),
      Swap.find({ $or: [{ requester: me }, { recipient: me }], status: 'completed' }).populate('offeredItems requestedItems', 'category owner'),
      Notification.countDocuments({ user: me, read: false }),
    ]);
    const received = completed.flatMap((s) => [...s.offeredItems, ...s.requestedItems].filter((i) => String(i.owner) !== String(me)).map((i) => i.category));
    const iStatus = Object.fromEntries(itemsByStatus.map((x) => [x._id, x.n]));
    const sStatus = Object.fromEntries(swapsByStatus.map((x) => [x._id, x.n]));
    const totalReq = Object.values(sStatus).reduce((a, b) => a + b, 0);
    res.json({
      listings: {
        available: iStatus.available || 0,
        reserved: iStatus.reserved || 0,
        swapped: iStatus.swapped || 0,
        views: itemsByStatus.reduce((s, x) => s + (x._id !== 'removed' ? x.views : 0), 0),
        saves: itemsByStatus.reduce((s, x) => s + (x._id !== 'removed' ? x.saves : 0), 0),
      },
      swaps: {
        byStatus: sStatus,
        total: totalReq,
        active: ACTIVE_SWAP_STATUSES.reduce((s, k) => s + (sStatus[k] || 0), 0),
        completed: sStatus.completed || 0,
        awaitingMe: incoming,
      },
      impact: impactFor(received),
      recent: recent.map((s) => ({
        _id: s._id,
        status: s.status,
        updatedAt: s.updatedAt,
        role: String(s.requester._id) === String(me) ? 'requester' : 'recipient',
        other: String(s.requester._id) === String(me) ? publicOwner(s.recipient) : publicOwner(s.requester),
        requester: publicOwner(s.requester),
        recipient: publicOwner(s.recipient),
        offeredItems: s.offeredItems,
        requestedItems: s.requestedItems,
        myTurn: String(s.awaiting) === String(me),
      })),
      unreadNotifications,
    });
  })
);

// Members near a point, with how many items they have available (for the map).
router.get(
  '/nearby',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const center = Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : req.user?.location?.point?.coordinates;
    if (!center) throw new HttpError(422, 'Location needed');
    const radiusKm = Math.min(200, Math.max(1, Number(req.query.radiusKm) || 15));
    const rows = await Item.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: center },
          distanceField: 'd',
          distanceMultiplier: 0.001,
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: { status: 'available', ...(req.user ? { owner: { $ne: new mongoose.Types.ObjectId(String(req.user._id)) } } : {}) },
        },
      },
      { $group: { _id: '$owner', items: { $sum: 1 }, d: { $min: '$d' }, area: { $first: '$location.area' }, city: { $first: '$location.city' }, point: { $first: '$location.point.coordinates' }, cats: { $addToSet: '$category' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { name: 1, avatarColor: 1, rating: 1, stats: 1, status: 1 } }] } },
      { $unwind: '$u' },
      { $match: { 'u.status': 'active' } },
      { $sort: { d: 1 } },
      { $limit: 60 },
    ]);
    res.json({
      center,
      radiusKm,
      members: rows.map((r) => ({
        _id: r._id,
        name: r.u.name,
        avatarColor: r.u.avatarColor,
        rating: r.u.rating,
        swapsCompleted: r.u.stats?.swapsCompleted || 0,
        items: r.items,
        categories: r.cats.slice(0, 4),
        area: r.area,
        city: r.city,
        distanceKm: Math.round(r.d * 10) / 10,
        // Rounded to ~1 km so exact home locations are never exposed.
        approx: r.point ? [Math.round(r.point[0] * 100) / 100, Math.round(r.point[1] * 100) / 100] : null,
      })),
    });
  })
);

// Public profile
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, 'Member not found');
    const user = await User.findById(req.params.id);
    if (!user || (user.status !== 'active' && req.user?.role !== 'admin')) throw new HttpError(404, 'Member not found');
    const [items, reviews] = await Promise.all([
      Item.find({ owner: user._id, status: 'available' }).sort({ createdAt: -1 }).populate('owner', 'name avatarColor location rating stats'),
      Swap.find({
        status: 'completed',
        $or: [
          { requester: user._id, 'ratings.byRecipient.stars': { $gte: 1 } },
          { recipient: user._id, 'ratings.byRequester.stars': { $gte: 1 } },
        ],
      })
        .sort({ completedAt: -1 })
        .limit(10)
        .populate('requester recipient', 'name avatarColor'),
    ]);
    res.json({
      user: { ...publicOwner(user), bio: user.bio, sizes: user.sizes, preferences: user.preferences },
      items: items.map((i) => serializeItem(i, req.user)),
      reviews: reviews.map((s) => {
        const asRequester = String(s.requester._id) === String(user._id);
        const r = asRequester ? s.ratings.byRecipient : s.ratings.byRequester;
        return { _id: s._id, stars: r.stars, comment: r.comment, by: publicOwner(asRequester ? s.recipient : s.requester), at: s.completedAt };
      }),
    });
  })
);

export default router;
