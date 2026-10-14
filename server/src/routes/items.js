import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Item, Swap, User } from '../models/index.js';
import {
  CATEGORIES, CONDITIONS, GENDERS, AGE_BUCKETS, estimateValue, brandTier, ACTIVE_SWAP_STATUSES,
} from '../../../shared/catalog.js';
import { asyncHandler, validate, HttpError, optionalAuth, requireAuth } from '../middleware/core.js';
import { serializeItem } from '../utils/serializers.js';
import { UNSPLASH_URL } from '../../../shared/photos.js';
import { fairBundles } from '../utils/matching.js';
import { cancelSwapsForItems } from '../utils/swapService.js';

const router = Router();
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const UPLOAD_URL = /^\/api\/images\/[a-f0-9]{24}$/;
const validImage = (v) => UPLOAD_URL.test(v) || UNSPLASH_URL.test(v);

const itemSchema = z.object({
  title: z.string().trim().min(4, 'Title should be at least 4 characters').max(80),
  description: z.string().trim().max(1000).default(''),
  category: z.enum(CATEGORIES.map((c) => c.key), { errorMap: () => ({ message: 'Choose a category' }) }),
  gender: z.enum(GENDERS.map((g) => g.key), { errorMap: () => ({ message: 'Choose who it is for' }) }),
  size: z.string().trim().min(1, 'Choose a size').max(20),
  brand: z.string().trim().min(1, 'Enter the brand (or “Unbranded”)').max(40),
  condition: z.enum(CONDITIONS.map((c) => c.key), { errorMap: () => ({ message: 'Choose the condition' }) }),
  color: z.string().trim().max(30).default(''),
  material: z.string().trim().max(40).default(''),
  age: z.enum(AGE_BUCKETS.map((a) => a.key)).default('lt1'),
  originalPrice: z.coerce.number().min(0).max(1000000).optional().nullable(),
  swapValue: z.coerce.number().positive().optional(),
  lookingFor: z.array(z.enum(CATEGORIES.map((c) => c.key))).max(6).default([]),
  images: z.array(z.string().max(300).refine(validImage, 'Invalid image')).min(1, 'Add at least one photo').max(5, 'Up to 5 photos'),
});

function priced(body) {
  const est = estimateValue(body);
  if (!est) throw new HttpError(422, 'Could not estimate value');
  let swapValue = body.swapValue ?? est.value;
  if (swapValue < est.min || swapValue > est.max) {
    throw new HttpError(422, `Swap value must stay within ₹${est.min}–₹${est.max} of the estimate`);
  }
  swapValue = Math.round(swapValue / 10) * 10;
  return { estimatedValue: est.value, swapValue, brandTier: est.tier };
}

const listQuery = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.string().optional(), // comma separated
  gender: z.string().optional(),
  size: z.string().optional(),
  condition: z.string().optional(),
  brand: z.string().optional(),
  city: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  near: z.enum(['me']).optional(),
  radiusKm: z.coerce.number().min(1).max(3000).optional(),
  owner: z.string().regex(/^[a-f0-9]{24}$/).optional(),
  sort: z.enum(['newest', 'nearest', 'value_asc', 'value_desc', 'popular']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});

const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

// GET /api/items — browse with filters, search and location
router.get(
  '/',
  optionalAuth,
  validate(listQuery, 'query'),
  asyncHandler(async (req, res) => {
    const q = req.query;
    const match = { status: 'available' };
    if (q.owner) match.owner = oid(q.owner);
    else if (req.user) match.owner = { $ne: req.user._id };
    if (list(q.category).length) match.category = { $in: list(q.category) };
    if (list(q.gender).length) match.gender = { $in: list(q.gender) };
    if (list(q.size).length) match.size = { $in: list(q.size) };
    if (list(q.condition).length) match.condition = { $in: list(q.condition) };
    if (list(q.brand).length) match.brand = { $in: list(q.brand) };
    if (list(q.city).length) match['location.city'] = { $in: list(q.city) };
    if (q.minValue || q.maxValue) {
      match.swapValue = {};
      if (q.minValue) match.swapValue.$gte = q.minValue;
      if (q.maxValue) match.swapValue.$lte = q.maxValue;
    }
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), 'i');
      match.$or = [{ title: rx }, { brand: rx }, { color: rx }, { description: rx }];
    }

    let center = null;
    if (q.lat != null && q.lng != null) center = [q.lng, q.lat];
    else if ((q.near === 'me' || q.sort === 'nearest' || q.radiusKm) && req.user?.location?.point?.coordinates) {
      center = req.user.location.point.coordinates;
    }

    const pipeline = [];
    if (center) {
      const geo = {
        near: { type: 'Point', coordinates: center },
        distanceField: 'distanceKm',
        distanceMultiplier: 0.001,
        spherical: true,
        query: match,
      };
      if (q.radiusKm) geo.maxDistance = q.radiusKm * 1000;
      pipeline.push({ $geoNear: geo });
    } else {
      pipeline.push({ $match: match });
    }
    const sorts = {
      newest: { createdAt: -1 },
      nearest: center ? { distanceKm: 1 } : { createdAt: -1 },
      value_asc: { swapValue: 1, createdAt: -1 },
      value_desc: { swapValue: -1, createdAt: -1 },
      popular: { favoritesCount: -1, views: -1 },
    };
    pipeline.push(
      { $lookup: { from: 'users', localField: 'owner', foreignField: '_id', as: 'owner', pipeline: [{ $project: { name: 1, avatarColor: 1, location: 1, rating: 1, stats: 1, status: 1, createdAt: 1 } }] } },
      { $unwind: '$owner' },
      { $match: { 'owner.status': 'active' } },
      { $sort: sorts[q.sort] },
      {
        $facet: {
          items: [{ $skip: (q.page - 1) * q.limit }, { $limit: q.limit }],
          total: [{ $count: 'n' }],
        },
      }
    );
    const [out] = await Item.aggregate(pipeline);
    const total = out.total[0]?.n || 0;
    res.json({
      items: out.items.map((i) => {
        const s = serializeItem({ ...i, distanceKm: i.distanceKm != null ? Math.round(i.distanceKm * 10) / 10 : undefined }, req.user);
        return s;
      }),
      total,
      page: q.page,
      pages: Math.max(1, Math.ceil(total / q.limit)),
      center,
    });
  })
);

// GET /api/items/:id — detail + similar items + fair matches from my closet
router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id).populate('owner', 'name avatarColor location rating stats createdAt status');
    if (!item || (item.status === 'removed' && String(item.owner?._id) !== String(req.user?._id) && req.user?.role !== 'admin')) {
      throw new HttpError(404, 'This listing is no longer available');
    }
    const isOwner = req.user && String(item.owner._id) === String(req.user._id);
    if (!isOwner) Item.updateOne({ _id: item._id }, { $inc: { views: 1 } }).catch(() => {});

    const similar = await Item.find({
      _id: { $ne: item._id },
      status: 'available',
      category: item.category,
      ...(req.user ? { owner: { $nin: [req.user._id] } } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(8)
      .populate('owner', 'name avatarColor location rating stats');

    let matches = [];
    let activeSwap = null;
    if (req.user && !isOwner) {
      const myItems = await Item.find({ owner: req.user._id, status: 'available' }).lean();
      matches = fairBundles(item.swapValue, myItems).map((b) => ({
        ...b,
        items: b.items.map((i) => ({ _id: i._id, title: i.title, images: i.images, swapValue: i.swapValue, size: i.size, brand: i.brand })),
      }));
      activeSwap = await Swap.findOne({
        requester: req.user._id,
        requestedItems: item._id,
        status: { $in: ACTIVE_SWAP_STATUSES },
      }).select('_id status');
    }
    const ownerListings = await Item.countDocuments({ owner: item.owner._id, status: 'available' });

    res.json({
      item: serializeItem(item, req.user),
      isOwner: Boolean(isOwner),
      similar: similar.map((s) => serializeItem(s, req.user)),
      matches,
      activeSwap,
      ownerListings,
    });
  })
);

// POST /api/items — create listing
router.post(
  '/',
  requireAuth,
  validate(itemSchema),
  asyncHandler(async (req, res) => {
    const count = await Item.countDocuments({ owner: req.user._id, status: { $in: ['available', 'reserved'] } });
    if (count >= 50) throw new HttpError(429, 'You can have up to 50 active listings');
    if (!req.user.location?.point?.coordinates) throw new HttpError(422, 'Set your location in Settings before listing');
    const item = await Item.create({
      ...req.body,
      ...priced(req.body),
      originalPrice: req.body.originalPrice || undefined,
      owner: req.user._id,
      location: { city: req.user.location.city, area: req.user.location.area, point: req.user.location.point },
    });
    res.status(201).json({ item: serializeItem(item, req.user) });
  })
);

// PATCH /api/items/:id — edit own listing
router.patch(
  '/:id',
  requireAuth,
  validate(itemSchema.partial()),
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item || item.status === 'removed') throw new HttpError(404, 'Listing not found');
    if (String(item.owner) !== String(req.user._id)) throw new HttpError(403, 'You can only edit your own listings');
    if (item.status !== 'available') throw new HttpError(409, 'Listings that are part of an agreed or completed swap cannot be edited');
    const merged = { ...item.toObject(), ...req.body };
    if (req.body.swapValue == null) delete merged.swapValue; // re-estimate unless explicitly set
    Object.assign(item, req.body, priced(merged));
    if (req.body.originalPrice === null) item.originalPrice = undefined;
    item.brandTier = brandTier(item.brand);
    await item.save();
    res.json({ item: serializeItem(item, req.user) });
  })
);

// DELETE /api/items/:id — remove own listing (soft delete keeps swap history intact)
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item || item.status === 'removed') throw new HttpError(404, 'Listing not found');
    if (String(item.owner) !== String(req.user._id)) throw new HttpError(403, 'You can only remove your own listings');
    if (item.status === 'reserved') throw new HttpError(409, 'This item is part of an agreed swap — cancel the swap first');
    if (item.status === 'swapped') throw new HttpError(409, 'Swapped items stay in your history');
    item.status = 'removed';
    await item.save();
    await cancelSwapsForItems([item._id], 'The listing was removed by its owner', req.user._id);
    res.json({ ok: true });
  })
);

// POST /api/items/:id/favorite — toggle save
router.post(
  '/:id/favorite',
  requireAuth,
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id).select('_id');
    if (!item) throw new HttpError(404, 'Listing not found');
    const has = req.user.favorites.some((f) => String(f) === String(item._id));
    await User.updateOne({ _id: req.user._id }, has ? { $pull: { favorites: item._id } } : { $addToSet: { favorites: item._id } });
    await Item.updateOne({ _id: item._id }, { $inc: { favoritesCount: has ? -1 : 1 } });
    res.json({ isFavorite: !has });
  })
);

export default router;
