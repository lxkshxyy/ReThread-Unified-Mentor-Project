import { Router } from 'express';
import { z } from 'zod';
import { Item, User, Swap, Report, Notification } from '../models/index.js';
import { asyncHandler, validate, HttpError, requireAuth } from '../middleware/core.js';
import {
  CATEGORIES, CATEGORY_GROUPS, CONDITIONS, GENDERS, BRAND_TIERS, BRANDS, AGE_BUCKETS, SIZES, COURIERS,
  REPORT_REASONS, DISPUTE_REASONS, estimateValue, impactFor,
} from '../../../shared/catalog.js';
import { PLACES, CITIES } from '../../../shared/places.js';
import { notify } from '../utils/realtime.js';

const router = Router();

// GET /api/meta — catalogue used by forms & filters
router.get('/meta', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ CATEGORIES, CATEGORY_GROUPS, CONDITIONS, GENDERS, BRAND_TIERS, BRANDS, AGE_BUCKETS, SIZES, COURIERS, REPORT_REASONS, DISPUTE_REASONS, PLACES, CITIES });
});

// GET /api/stats — public community counters for the landing page
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [listings, members, completed, cities] = await Promise.all([
      Item.countDocuments({ status: 'available' }),
      User.countDocuments({ status: 'active', role: 'user' }),
      Swap.find({ status: 'completed' }).populate('offeredItems requestedItems', 'category'),
      Item.distinct('location.city', { status: 'available' }),
    ]);
    const cats = completed.flatMap((s) => [...s.offeredItems, ...s.requestedItems].map((i) => i.category));
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ listings, members, swaps: completed.length, cities: cities.length, impact: impactFor(cats) });
  })
);

// POST /api/valuation/estimate — the Swap Value Calculator as an API
router.post(
  '/valuation/estimate',
  validate(z.object({
    category: z.enum(CATEGORIES.map((c) => c.key)),
    brand: z.string().trim().max(40).default(''),
    condition: z.enum(CONDITIONS.map((c) => c.key)),
    originalPrice: z.coerce.number().min(0).max(1000000).optional(),
    age: z.enum(AGE_BUCKETS.map((a) => a.key)).optional(),
  })),
  (req, res) => res.json(estimateValue(req.body))
);

// ---------- Notifications ----------
router.get(
  '/notifications',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [items, unread] = await Promise.all([
      Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);
    res.json({ notifications: items, unread });
  })
);

router.post(
  '/notifications/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ ok: true });
  })
);

// ---------- Reports (flag a listing or member) ----------
router.post(
  '/reports',
  requireAuth,
  validate(z.object({
    targetType: z.enum(['item', 'user']),
    targetId: z.string().regex(/^[a-f0-9]{24}$/),
    reason: z.enum(REPORT_REASONS.map((r) => r.key)),
    details: z.string().trim().max(500).default(''),
  })),
  asyncHandler(async (req, res) => {
    const { targetType, targetId, reason, details } = req.body;
    const doc = { reporter: req.user._id, targetType, reason, details };
    if (targetType === 'item') {
      const item = await Item.findById(targetId).select('owner');
      if (!item) throw new HttpError(404, 'Listing not found');
      if (String(item.owner) === String(req.user._id)) throw new HttpError(422, 'You cannot report your own listing');
      doc.item = item._id;
      doc.user = item.owner;
    } else {
      if (targetId === String(req.user._id)) throw new HttpError(422, 'You cannot report yourself');
      const u = await User.findById(targetId).select('_id');
      if (!u) throw new HttpError(404, 'Member not found');
      doc.user = u._id;
    }
    const exists = await Report.findOne({ reporter: req.user._id, status: 'open', ...(doc.item ? { item: doc.item } : { user: doc.user, targetType: 'user' }) });
    if (exists) throw new HttpError(409, 'You already reported this — our team is reviewing it');
    const report = await Report.create(doc);
    if (doc.item) await Item.updateOne({ _id: doc.item }, { $inc: { 'moderation.reportsCount': 1 } });
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const a of admins) await notify(a._id, { type: 'report', title: `New ${targetType} report`, body: REPORT_REASONS.find((r) => r.key === reason).label, link: '/admin?tab=reports' });
    res.status(201).json({ report: { _id: report._id } });
  })
);

export default router;
