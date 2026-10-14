import { Router } from 'express';
import { z } from 'zod';
import { User, Item, Swap, Report, Message } from '../models/index.js';
import { asyncHandler, validate, HttpError, requireAdmin } from '../middleware/core.js';
import { CATEGORIES, impactFor, ACTIVE_SWAP_STATUSES, DISPUTE_REASONS, REPORT_REASONS } from '../../../shared/catalog.js';
import { cancelSwapsForItems, completeSwap, cancelAgreedSwap, pushTimeline, swapSystemMessage } from '../utils/swapService.js';
import { notify } from '../utils/realtime.js';
import { serializeItem, publicOwner } from '../utils/serializers.js';

const router = Router();
router.use(requireAdmin);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const DAY = 24 * 60 * 60 * 1000;
const pageOf = (q) => ({ page: Math.max(1, Number(q.page) || 1), limit: Math.min(100, Math.max(5, Number(q.limit) || 20)) });

// ---------- Analytics overview ----------
router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const since30 = new Date(now - 30 * DAY);
    const weeks = 12;
    const start = new Date(now - weeks * 7 * DAY);

    const [
      users, activeUsers, suspended, itemsByStatus, swapsByStatus, completedSwaps,
      listers, swappers, messagers, byCategory, byCity, weeklyItems, weeklySwaps, weeklyDone, weeklyUsers,
      openReports, topMembers,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.find({ role: 'user', lastActiveAt: { $gte: since30 } }).distinct('_id'),
      User.countDocuments({ status: 'suspended' }),
      Item.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Swap.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Swap.find({ status: 'completed' }).populate('offeredItems requestedItems', 'category').select('offeredItems requestedItems'),
      Item.distinct('owner', { createdAt: { $gte: since30 } }),
      Swap.aggregate([{ $match: { updatedAt: { $gte: since30 } } }, { $project: { u: ['$requester', '$recipient'] } }, { $unwind: '$u' }, { $group: { _id: '$u' } }]),
      Message.distinct('sender', { createdAt: { $gte: since30 }, sender: { $ne: null } }),
      Item.aggregate([{ $match: { status: { $ne: 'removed' } } }, { $group: { _id: '$category', n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      Item.aggregate([{ $match: { status: 'available' } }, { $group: { _id: '$location.city', listings: { $sum: 1 }, members: { $addToSet: '$owner' } } }, { $project: { listings: 1, members: { $size: '$members' } } }, { $sort: { listings: -1 } }, { $limit: 8 }]),
      Item.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', start] }, 7 * DAY] } }, n: { $sum: 1 } } }]),
      Swap.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', start] }, 7 * DAY] } }, n: { $sum: 1 } } }]),
      Swap.aggregate([{ $match: { status: 'completed', completedAt: { $gte: start } } }, { $group: { _id: { $floor: { $divide: [{ $subtract: ['$completedAt', start] }, 7 * DAY] } }, n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { createdAt: { $gte: start }, role: 'user' } }, { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', start] }, 7 * DAY] } }, n: { $sum: 1 } } }]),
      Report.countDocuments({ status: 'open' }),
      User.find({ role: 'user' }).sort({ 'stats.swapsCompleted': -1, 'rating.avg': -1 }).limit(5).select('name avatarColor location stats rating'),
    ]);

    const iS = Object.fromEntries(itemsByStatus.map((x) => [x._id, x.n]));
    const sS = Object.fromEntries(swapsByStatus.map((x) => [x._id, x.n]));
    const totalRequests = Object.values(sS).reduce((a, b) => a + b, 0);
    const agreed = (sS.accepted || 0) + (sS.in_progress || 0) + (sS.completed || 0) + (sS.disputed || 0);
    const activeSet = new Set(activeUsers.map(String));
    const engaged = new Set([...listers.map(String), ...swappers.map((s) => String(s._id)), ...messagers.map(String)].filter((id) => activeSet.has(id)));
    const cats = completedSwaps.flatMap((s) => [...s.offeredItems, ...s.requestedItems].map((i) => i.category));

    const series = (rows) => {
      const arr = Array(weeks).fill(0);
      rows.forEach((r) => { if (r._id >= 0 && r._id < weeks) arr[r._id] = r.n; });
      return arr;
    };
    const wi = series(weeklyItems); const ws = series(weeklySwaps); const wd = series(weeklyDone); const wu = series(weeklyUsers);
    const weekly = wi.map((_, i) => ({
      week: new Date(start.getTime() + i * 7 * DAY).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      listings: wi[i], requests: ws[i], completed: wd[i], users: wu[i],
    }));

    res.json({
      kpis: {
        totalListings: (iS.available || 0) + (iS.reserved || 0) + (iS.swapped || 0),
        availableListings: iS.available || 0,
        removedListings: iS.removed || 0,
        successfulSwaps: sS.completed || 0,
        totalRequests,
        activeSwaps: ACTIVE_SWAP_STATUSES.reduce((s, k) => s + (sS[k] || 0), 0),
        conversionRate: totalRequests ? Math.round((agreed / totalRequests) * 100) : 0,
        completionRate: totalRequests ? Math.round(((sS.completed || 0) / totalRequests) * 100) : 0,
        users,
        activeUsers: activeUsers.length,
        engagementRate: users ? Math.round((engaged.size / users) * 100) : 0,
        suspended,
        openDisputes: sS.disputed || 0,
        openReports,
      },
      impact: impactFor(cats),
      weekly,
      swapStatus: Object.entries(sS).map(([status, n]) => ({ status, n })),
      funnel: [
        { stage: 'Requests sent', n: totalRequests },
        { stage: 'Agreed', n: agreed },
        { stage: 'Completed', n: sS.completed || 0 },
      ],
      byCategory: byCategory.map((c) => ({ category: CATEGORIES.find((x) => x.key === c._id)?.label || c._id, n: c.n })),
      byCity: byCity.map((c) => ({ city: c._id, listings: c.listings, members: c.members })),
      topMembers: topMembers.map(publicOwner),
    });
  })
);

// ---------- Users ----------
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { page, limit } = pageOf(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { 'location.city': rx }];
    }
    const [rows, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(filter),
    ]);
    const ids = rows.map((u) => u._id);
    const [itemCounts, reportCounts] = await Promise.all([
      Item.aggregate([{ $match: { owner: { $in: ids }, status: { $ne: 'removed' } } }, { $group: { _id: '$owner', n: { $sum: 1 } } }]),
      Report.aggregate([{ $match: { user: { $in: ids }, status: 'open' } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    ]);
    const ic = Object.fromEntries(itemCounts.map((x) => [String(x._id), x.n]));
    const rc = Object.fromEntries(reportCounts.map((x) => [String(x._id), x.n]));
    res.json({
      total, page, pages: Math.ceil(total / limit) || 1,
      users: rows.map((u) => ({
        _id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, avatarColor: u.avatarColor,
        location: { city: u.location?.city, area: u.location?.area }, stats: u.stats, rating: u.rating,
        lastActiveAt: u.lastActiveAt, createdAt: u.createdAt, suspendedReason: u.suspendedReason,
        listings: ic[String(u._id)] || 0, openReports: rc[String(u._id)] || 0,
      })),
    });
  })
);

router.patch(
  '/users/:id',
  validate(z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().max(200).default('') })),
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u) throw new HttpError(404, 'Member not found');
    if (u.role === 'admin') throw new HttpError(403, 'Admins cannot be suspended here');
    u.status = req.body.status;
    u.suspendedReason = req.body.status === 'suspended' ? req.body.reason || 'Community guidelines violation' : '';
    await u.save();
    if (u.status === 'suspended') {
      const items = await Item.find({ owner: u._id, status: 'available' }).select('_id');
      await cancelSwapsForItems(items.map((i) => i._id), 'The member’s account was suspended', req.user._id);
    }
    res.json({ ok: true, status: u.status });
  })
);

// ---------- Listings ----------
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const { page, limit } = pageOf(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.reported === 'true') filter['moderation.reportsCount'] = { $gt: 0 };
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
      filter.$or = [{ title: rx }, { brand: rx }];
    }
    const [rows, total] = await Promise.all([
      Item.find(filter).sort({ 'moderation.reportsCount': -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('owner', 'name avatarColor location status email'),
      Item.countDocuments(filter),
    ]);
    res.json({ total, page, pages: Math.ceil(total / limit) || 1, items: rows.map((i) => ({ ...serializeItem(i), ownerEmail: i.owner?.email })) });
  })
);

router.patch(
  '/items/:id',
  validate(z.object({ action: z.enum(['remove', 'restore']), reason: z.string().trim().max(200).default('') })),
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) throw new HttpError(404, 'Listing not found');
    if (req.body.action === 'remove') {
      if (item.status === 'reserved') throw new HttpError(409, 'Item is in an agreed swap — resolve the swap first');
      item.status = 'removed';
      item.moderation.removedByAdmin = true;
      item.moderation.reason = req.body.reason || 'Violates listing guidelines';
      await item.save();
      await cancelSwapsForItems([item._id], 'The listing was removed by moderators', req.user._id);
      await notify(item.owner, { type: 'moderation', title: `Your listing “${item.title}” was removed`, body: item.moderation.reason, link: '/dashboard?tab=listings' });
    } else {
      if (!item.moderation.removedByAdmin) throw new HttpError(409, 'Only moderator-removed listings can be restored');
      item.status = 'available';
      item.moderation.removedByAdmin = false;
      item.moderation.reason = '';
      await item.save();
      await notify(item.owner, { type: 'moderation', title: `Your listing “${item.title}” was restored`, link: `/items/${item._id}` });
    }
    res.json({ ok: true, status: item.status });
  })
);

// ---------- Swaps & disputes ----------
router.get(
  '/swaps',
  asyncHandler(async (req, res) => {
    const { page, limit } = pageOf(req.query);
    const filter = {};
    if (req.query.status === 'active') filter.status = { $in: ACTIVE_SWAP_STATUSES };
    else if (req.query.status) filter.status = req.query.status;
    if (req.query.disputes === 'true') filter['dispute.status'] = { $in: ['open', 'resolved'] };
    const [rows, total] = await Promise.all([
      Swap.find(filter)
        .sort(req.query.disputes === 'true' ? { 'dispute.status': 1, 'dispute.createdAt': -1 } : { updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('requester recipient', 'name avatarColor location email')
        .populate('offeredItems requestedItems', 'title images swapValue')
        .populate('dispute.raisedBy', 'name'),
      Swap.countDocuments(filter),
    ]);
    res.json({
      total, page, pages: Math.ceil(total / limit) || 1,
      swaps: rows.map((s) => ({
        ...s.toObject(),
        requester: { ...publicOwner(s.requester), email: s.requester?.email },
        recipient: { ...publicOwner(s.recipient), email: s.recipient?.email },
        disputeLabel: s.dispute?.reason ? DISPUTE_REASONS.find((d) => d.key === s.dispute.reason)?.label : undefined,
      })),
    });
  })
);

router.post(
  '/swaps/:id/resolve',
  validate(z.object({ outcome: z.enum(['completed', 'cancelled']), resolution: z.string().trim().min(5, 'Add a short resolution note').max(500) })),
  asyncHandler(async (req, res) => {
    const swap = await Swap.findById(req.params.id);
    if (!swap) throw new HttpError(404, 'Swap not found');
    if (swap.status !== 'disputed' || swap.dispute?.status !== 'open') throw new HttpError(409, 'No open dispute on this swap');
    swap.dispute.status = 'resolved';
    swap.dispute.resolution = req.body.resolution;
    swap.dispute.outcome = req.body.outcome;
    swap.dispute.resolvedBy = req.user._id;
    swap.dispute.resolvedAt = new Date();
    pushTimeline(swap, 'resolved', req.user._id, `Dispute resolved by ReThread team: ${req.body.resolution}`);
    await swapSystemMessage(swap, `ReThread team resolved the dispute — ${req.body.resolution}`);
    if (req.body.outcome === 'completed') await completeSwap(swap, req.user._id, 'Marked completed after dispute review');
    else await cancelAgreedSwap(swap, req.user._id, 'Cancelled after dispute review');
    for (const u of [swap.requester, swap.recipient]) {
      await notify(u, { type: 'dispute', title: 'Your dispute was resolved', body: req.body.resolution, link: `/swaps/${swap._id}` });
    }
    res.json({ ok: true, status: swap.status });
  })
);

// ---------- Reports ----------
router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const filter = req.query.status ? { status: req.query.status } : {};
    const rows = await Report.find(filter)
      .sort({ status: 1, createdAt: -1 })
      .limit(100)
      .populate('reporter', 'name avatarColor')
      .populate('user', 'name avatarColor status email')
      .populate('item', 'title images status swapValue')
      .populate('handledBy', 'name');
    res.json({ reports: rows.map((r) => ({ ...r.toObject(), reasonLabel: REPORT_REASONS.find((x) => x.key === r.reason)?.label })) });
  })
);

router.patch(
  '/reports/:id',
  validate(z.object({
    status: z.enum(['actioned', 'dismissed']),
    note: z.string().trim().max(300).default(''),
    removeItem: z.boolean().default(false),
    suspendUser: z.boolean().default(false),
  })),
  asyncHandler(async (req, res) => {
    const r = await Report.findById(req.params.id);
    if (!r) throw new HttpError(404, 'Report not found');
    r.status = req.body.status;
    r.note = req.body.note;
    r.handledBy = req.user._id;
    await r.save();
    if (req.body.status === 'actioned' && req.body.removeItem && r.item) {
      const item = await Item.findById(r.item);
      if (item && item.status === 'available') {
        item.status = 'removed';
        item.moderation.removedByAdmin = true;
        item.moderation.reason = req.body.note || 'Removed after a community report';
        await item.save();
        await cancelSwapsForItems([item._id], 'The listing was removed by moderators', req.user._id);
        await notify(item.owner, { type: 'moderation', title: `Your listing “${item.title}” was removed`, body: item.moderation.reason });
      }
    }
    if (req.body.status === 'actioned' && req.body.suspendUser && r.user) {
      const u = await User.findById(r.user);
      if (u && u.role !== 'admin') {
        u.status = 'suspended';
        u.suspendedReason = req.body.note || 'Community guidelines violation';
        await u.save();
      }
    }
    await notify(r.reporter, { type: 'report', title: 'Thanks for your report', body: req.body.status === 'actioned' ? 'We reviewed it and took action.' : 'We reviewed it and found no violation.' });
    res.json({ ok: true });
  })
);

// ---------- CSV export (platform reports) ----------
const csv = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // CSV-injection guard
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};

router.get(
  '/export/:type',
  asyncHandler(async (req, res) => {
    let rows = [];
    if (req.params.type === 'users') {
      const users = await User.find().sort({ createdAt: -1 });
      rows = users.map((u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, city: u.location?.city, area: u.location?.area, swaps_completed: u.stats?.swapsCompleted, rating: u.rating?.avg, joined: u.createdAt?.toISOString(), last_active: u.lastActiveAt?.toISOString() }));
    } else if (req.params.type === 'items') {
      const items = await Item.find().sort({ createdAt: -1 }).populate('owner', 'name email');
      rows = items.map((i) => ({ id: i._id, title: i.title, category: i.category, brand: i.brand, size: i.size, condition: i.condition, estimated_value: i.estimatedValue, swap_value: i.swapValue, status: i.status, city: i.location?.city, owner: i.owner?.name, owner_email: i.owner?.email, views: i.views, saves: i.favoritesCount, listed: i.createdAt?.toISOString() }));
    } else if (req.params.type === 'swaps') {
      const swaps = await Swap.find().sort({ createdAt: -1 }).populate('requester recipient', 'name').populate('offeredItems requestedItems', 'title swapValue');
      rows = swaps.map((s) => ({ id: s._id, status: s.status, requester: s.requester?.name, recipient: s.recipient?.name, offered: s.offeredItems.map((i) => i.title).join(' + '), requested: s.requestedItems.map((i) => i.title).join(' + '), offered_value: s.offeredItems.reduce((a, i) => a + i.swapValue, 0), requested_value: s.requestedItems.reduce((a, i) => a + i.swapValue, 0), method: s.fulfillment?.method, distance_km: s.distanceKm, rounds: s.offers.length, created: s.createdAt?.toISOString(), completed: s.completedAt?.toISOString() || '' }));
    } else {
      throw new HttpError(404, 'Unknown report');
    }
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="rethread-${req.params.type}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv(rows));
  })
);

export default router;
