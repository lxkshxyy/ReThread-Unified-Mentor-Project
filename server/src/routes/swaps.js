import { Router } from 'express';
import { z } from 'zod';
import { Swap, Item, User } from '../models/index.js';
import { asyncHandler, validate, HttpError, requireAuth } from '../middleware/core.js';
import { distanceKm } from '../../../shared/places.js';
import {
  shippingEstimate, categoryByKey, COURIERS, DISPUTE_REASONS, formatINR, ACTIVE_SWAP_STATUSES,
} from '../../../shared/catalog.js';
import {
  getOrCreateConversation, postMessage, pushTimeline, swapSystemMessage, broadcastSwap,
  cancelSwapsForItems, completeSwap, cancelAgreedSwap, snapshotTerms, sumValue,
} from '../utils/swapService.js';
import { notify } from '../utils/realtime.js';
import { publicOwner } from '../utils/serializers.js';

const router = Router();
router.use(requireAuth);

const idList = z.array(z.string().regex(/^[a-f0-9]{24}$/, 'Invalid item')).min(1, 'Pick at least one item').max(3, 'Up to 3 items per side');

const ITEM_FIELDS = 'title images swapValue size brand category condition status owner';
const USER_FIELDS = 'name avatarColor location rating stats createdAt';

const isParty = (swap, user) => [String(swap.requester._id || swap.requester), String(swap.recipient._id || swap.recipient)].includes(String(user._id));
const roleOf = (swap, user) => (String(swap.requester._id || swap.requester) === String(user._id) ? 'requester' : 'recipient');
const otherOf = (swap, user) => (roleOf(swap, user) === 'requester' ? swap.recipient : swap.requester);
const firstName = (u) => (u?.name || '').split(' ')[0];
const titles = (items) => items.map((i) => i.title).join(' + ');

async function loadSwap(id, user, { populate = false } = {}) {
  let q = Swap.findById(id);
  if (populate) {
    q = q
      .populate('requester', USER_FIELDS)
      .populate('recipient', USER_FIELDS)
      .populate('offeredItems', ITEM_FIELDS)
      .populate('requestedItems', ITEM_FIELDS)
      .populate('offers.offeredItems', 'title images swapValue')
      .populate('offers.requestedItems', 'title images swapValue')
      .populate('timeline.by', 'name');
  }
  const swap = await q;
  if (!swap) throw new HttpError(404, 'Swap not found');
  if (!isParty(swap, user) && user.role !== 'admin') throw new HttpError(403, 'This swap is between other members');
  return swap;
}

async function loadAvailable(ids, ownerId, label) {
  const items = await Item.find({ _id: { $in: ids } });
  if (items.length !== ids.length) throw new HttpError(404, `One of the ${label} items no longer exists`);
  for (const it of items) {
    if (String(it.owner) !== String(ownerId)) throw new HttpError(422, `${it.title} does not belong to the right closet`);
    if (it.status !== 'available') throw new HttpError(409, `${it.title} is no longer available`);
  }
  return items;
}

function shapeSwap(swap, viewer) {
  const o = swap.toObject();
  const role = roleOf(swap, viewer);
  const mine = o.status === 'pending' || o.status === 'countered';
  return {
    ...o,
    requester: publicOwner(o.requester),
    recipient: publicOwner(o.recipient),
    role: isParty(swap, viewer) ? role : 'admin',
    myTurn: mine && String(o.awaiting) === String(viewer._id),
    offeredValue: sumValue(o.offeredItems || []),
    requestedValue: sumValue(o.requestedItems || []),
  };
}

// ---------- Create ----------
const createSchema = z.object({
  requestedItemIds: idList,
  offeredItemIds: idList,
  message: z.string().trim().max(500).default(''),
  method: z.enum(['meetup', 'courier']).default('meetup'),
});

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const me = req.user;
    const { requestedItemIds, offeredItemIds, message, method } = req.body;
    const first = await Item.findById(requestedItemIds[0]).select('owner');
    if (!first) throw new HttpError(404, 'That listing no longer exists');
    if (String(first.owner) === String(me._id)) throw new HttpError(422, 'You cannot request your own item');
    const recipient = await User.findById(first.owner);
    if (!recipient || recipient.status !== 'active') throw new HttpError(409, 'This member is not accepting swaps right now');

    const requested = await loadAvailable(requestedItemIds, recipient._id, 'requested');
    const offered = await loadAvailable(offeredItemIds, me._id, 'offered');

    const dup = await Swap.findOne({
      requester: me._id,
      requestedItems: { $in: requestedItemIds },
      status: { $in: ACTIVE_SWAP_STATUSES },
    }).select('_id');
    if (dup) throw new HttpError(409, 'You already have an open request for this item', { swapId: dup._id });

    const terms = snapshotTerms(offered, requested);
    const dist = distanceKm(me.location?.point?.coordinates, recipient.location?.point?.coordinates);
    const weight = [...offered, ...requested].reduce((s, i) => s + (categoryByKey(i.category)?.kg || 0.4), 0) / 2;

    const swap = await Swap.create({
      requester: me._id,
      recipient: recipient._id,
      offeredItems: offered.map((i) => i._id),
      requestedItems: requested.map((i) => i._id),
      offers: [{ by: me._id, offeredItems: offered.map((i) => i._id), requestedItems: requested.map((i) => i._id), message, ...terms }],
      awaiting: recipient._id,
      status: 'pending',
      distanceKm: dist,
      fulfillment: { method, shippingEstimate: shippingEstimate(dist ?? 0, weight).amount },
      timeline: [{ status: 'pending', by: me._id, note: 'Swap request sent' }],
    });

    const conv = await getOrCreateConversation(me._id, recipient._id, { swap: swap._id, item: requested[0]._id });
    swap.conversation = conv._id;
    await swap.save();

    await postMessage(conv, {
      sender: me._id,
      type: 'offer',
      swap: swap._id,
      text: `Swap request: ${titles(offered)} (${formatINR(terms.offeredValue)}) for ${titles(requested)} (${formatINR(terms.requestedValue)}) · ${terms.fairness}% value match`,
    });
    if (message) await postMessage(conv, { sender: me._id, text: message, swap: swap._id });

    await notify(recipient._id, {
      type: 'swap',
      title: `${firstName(me)} wants to swap for your ${requested[0].title}`,
      body: `Offering ${titles(offered)} · ${terms.fairness}% value match`,
      link: `/swaps/${swap._id}`,
    });
    broadcastSwap(swap);
    res.status(201).json({ swap: { _id: swap._id, status: swap.status, conversation: conv._id } });
  })
);

// ---------- List ----------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const box = ['incoming', 'outgoing'].includes(req.query.box) ? req.query.box : 'all';
    const me = req.user._id;
    const filter = box === 'incoming' ? { recipient: me } : box === 'outgoing' ? { requester: me } : { $or: [{ requester: me }, { recipient: me }] };
    const st = req.query.status;
    if (st === 'active') filter.status = { $in: ACTIVE_SWAP_STATUSES };
    else if (st === 'closed') filter.status = { $in: ['completed', 'rejected', 'cancelled'] };
    else if (typeof st === 'string' && st) filter.status = st;
    const swaps = await Swap.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('requester', USER_FIELDS)
      .populate('recipient', USER_FIELDS)
      .populate('offeredItems', ITEM_FIELDS)
      .populate('requestedItems', ITEM_FIELDS);
    res.json({ swaps: swaps.map((s) => shapeSwap(s, req.user)) });
  })
);

// ---------- Detail ----------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user, { populate: true });
    const out = shapeSwap(swap, req.user);
    // Closets for counter-offers (only while negotiating)
    if (['pending', 'countered'].includes(swap.status)) {
      const [reqCloset, recCloset] = await Promise.all([
        Item.find({ owner: swap.requester._id, status: 'available' }).select(ITEM_FIELDS).lean(),
        Item.find({ owner: swap.recipient._id, status: 'available' }).select(ITEM_FIELDS).lean(),
      ]);
      out.requesterCloset = reqCloset;
      out.recipientCloset = recCloset;
    }
    out.couriers = COURIERS;
    res.json({ swap: out });
  })
);

// ---------- Respond: accept / reject / counter ----------
const respondSchema = z.object({
  action: z.enum(['accept', 'reject', 'counter']),
  offeredItemIds: idList.optional(),
  requestedItemIds: idList.optional(),
  message: z.string().trim().max(500).default(''),
});

router.post(
  '/:id/respond',
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can respond');
    if (!['pending', 'countered'].includes(swap.status)) throw new HttpError(409, 'This swap is no longer open for negotiation');
    if (String(swap.awaiting) !== String(req.user._id)) throw new HttpError(409, 'Waiting for the other member to respond');
    const { action, message } = req.body;
    const other = otherOf(swap, req.user);
    const me = req.user;

    if (action === 'reject') {
      swap.status = 'rejected';
      swap.awaiting = undefined;
      swap.closedReason = message || 'Declined';
      pushTimeline(swap, 'rejected', me._id, message || 'Swap declined');
      await swap.save();
      await swapSystemMessage(swap, `${firstName(me)} declined the swap${message ? `: “${message}”` : '.'}`);
      await notify(other, { type: 'swap', title: `${firstName(me)} declined your swap`, body: message, link: `/swaps/${swap._id}` });
      broadcastSwap(swap);
      return res.json({ ok: true, status: swap.status });
    }

    if (action === 'accept') {
      // Everything must still be available at the moment of agreement.
      const all = await Item.find({ _id: { $in: [...swap.offeredItems, ...swap.requestedItems] } });
      const gone = all.find((i) => i.status !== 'available');
      if (gone || all.length !== swap.offeredItems.length + swap.requestedItems.length) {
        throw new HttpError(409, `${gone?.title || 'An item'} is no longer available — send a counter-offer instead`);
      }
      // Atomic reservation guards against two people accepting the same item at once.
      const ids = all.map((i) => i._id);
      const r = await Item.updateMany({ _id: { $in: ids }, status: 'available' }, { status: 'reserved' });
      if (r.modifiedCount !== ids.length) {
        await Item.updateMany({ _id: { $in: ids }, status: 'reserved' }, { status: 'available' });
        throw new HttpError(409, 'One of the items was just reserved in another swap');
      }
      swap.status = 'accepted';
      swap.awaiting = undefined;
      pushTimeline(swap, 'accepted', me._id, message || 'Swap agreement confirmed');
      await swap.save();
      await cancelSwapsForItems(ids, 'An item in this request was swapped with someone else', me._id, swap._id);
      await swapSystemMessage(swap, `${firstName(me)} accepted — swap agreed ✅ Items are now reserved. Next step: choose a local meetup or courier.`);
      if (message) {
        const conv = await getOrCreateConversation(swap.requester, swap.recipient);
        await postMessage(conv, { sender: me._id, text: message, swap: swap._id });
      }
      await notify(other, { type: 'swap', title: `${firstName(me)} accepted your swap!`, body: 'Arrange a meetup or courier to finish the exchange.', link: `/swaps/${swap._id}` });
      broadcastSwap(swap);
      return res.json({ ok: true, status: swap.status });
    }

    // counter
    const { offeredItemIds, requestedItemIds } = req.body;
    if (!offeredItemIds || !requestedItemIds) throw new HttpError(422, 'Pick items for both sides of the counter-offer');
    const offered = await loadAvailable(offeredItemIds, swap.requester, 'offered');
    const requested = await loadAvailable(requestedItemIds, swap.recipient, 'requested');
    const sameTerms =
      [...offeredItemIds].sort().join() === swap.offeredItems.map(String).sort().join() &&
      [...requestedItemIds].sort().join() === swap.requestedItems.map(String).sort().join();
    if (sameTerms) throw new HttpError(422, 'Change at least one item to make a counter-offer, or accept the current terms');
    if (swap.offers.length >= 12) throw new HttpError(429, 'Too many rounds — please agree in chat or start a new request');
    const terms = snapshotTerms(offered, requested);
    swap.offeredItems = offered.map((i) => i._id);
    swap.requestedItems = requested.map((i) => i._id);
    swap.offers.push({ by: me._id, offeredItems: swap.offeredItems, requestedItems: swap.requestedItems, message, ...terms });
    swap.status = 'countered';
    swap.awaiting = other;
    pushTimeline(swap, 'countered', me._id, message || 'Counter-offer sent');
    await swap.save();
    const conv = await getOrCreateConversation(swap.requester, swap.recipient, { swap: swap._id });
    await postMessage(conv, {
      sender: me._id,
      type: 'offer',
      swap: swap._id,
      text: `Counter-offer: ${titles(offered)} (${formatINR(terms.offeredValue)}) ⇄ ${titles(requested)} (${formatINR(terms.requestedValue)}) · ${terms.fairness}% value match`,
    });
    if (message) await postMessage(conv, { sender: me._id, text: message, swap: swap._id });
    await notify(other, { type: 'swap', title: `${firstName(me)} sent a counter-offer`, body: `${terms.fairness}% value match`, link: `/swaps/${swap._id}` });
    broadcastSwap(swap);
    res.json({ ok: true, status: swap.status });
  })
);

// ---------- Cancel ----------
router.post(
  '/:id/cancel',
  validate(z.object({ reason: z.string().trim().max(300).default('') })),
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can cancel');
    const me = req.user;
    const reason = req.body.reason || `Cancelled by ${firstName(me)}`;
    if (['pending', 'countered'].includes(swap.status)) {
      swap.status = 'cancelled';
      swap.awaiting = undefined;
      swap.closedReason = reason;
      pushTimeline(swap, 'cancelled', me._id, reason);
      await swap.save();
      broadcastSwap(swap);
    } else if (['accepted', 'in_progress'].includes(swap.status)) {
      const f = swap.fulfillment || {};
      if (f.requesterShipment?.trackingId || f.recipientShipment?.trackingId || swap.received.requester || swap.received.recipient) {
        throw new HttpError(409, 'Items are already on their way — raise a dispute instead');
      }
      await cancelAgreedSwap(swap, me._id, reason);
    } else {
      throw new HttpError(409, 'This swap can no longer be cancelled');
    }
    await swapSystemMessage(swap, `${firstName(me)} cancelled the swap. ${req.body.reason ? `Reason: “${req.body.reason}”` : ''}`.trim());
    await notify(otherOf(swap, me), { type: 'swap', title: `${firstName(me)} cancelled a swap`, body: req.body.reason, link: `/swaps/${swap._id}` });
    res.json({ ok: true, status: swap.status });
  })
);

// ---------- Fulfilment: meetup or courier ----------
const fulfilSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('meetup'),
    meetupPlace: z.string().trim().min(3, 'Suggest a public meetup spot').max(120),
    meetupAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 60 * 60 * 1000, 'Pick a future date and time'),
  }),
  z.object({ method: z.literal('courier') }),
]);

router.post(
  '/:id/fulfillment',
  validate(fulfilSchema),
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can do this');
    if (!['accepted', 'in_progress'].includes(swap.status)) throw new HttpError(409, 'Agree on the swap first');
    const me = req.user;
    swap.fulfillment.method = req.body.method;
    if (req.body.method === 'meetup') {
      swap.fulfillment.meetupPlace = req.body.meetupPlace;
      swap.fulfillment.meetupAt = req.body.meetupAt;
    }
    swap.status = 'in_progress';
    const note =
      req.body.method === 'meetup'
        ? `Meetup set at ${req.body.meetupPlace} on ${new Date(req.body.meetupAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}`
        : `Courier chosen · est. ${formatINR(swap.fulfillment.shippingEstimate || 0)} per parcel`;
    pushTimeline(swap, 'in_progress', me._id, note);
    await swap.save();
    await swapSystemMessage(swap, `${firstName(me)}: ${note}.`);
    await notify(otherOf(swap, me), { type: 'swap', title: 'Swap plan updated', body: note, link: `/swaps/${swap._id}` });
    broadcastSwap(swap);
    res.json({ ok: true });
  })
);

router.post(
  '/:id/ship',
  validate(z.object({
    partner: z.enum(COURIERS.map((c) => c.key)),
    trackingId: z.string().trim().regex(/^[A-Za-z0-9-]{6,30}$/, 'Enter a valid tracking / AWB number'),
  })),
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can do this');
    if (!['accepted', 'in_progress'].includes(swap.status)) throw new HttpError(409, 'Agree on the swap first');
    const role = roleOf(swap, req.user);
    swap.fulfillment.method = 'courier';
    swap.fulfillment[`${role}Shipment`] = { partner: req.body.partner, trackingId: req.body.trackingId, shippedAt: new Date() };
    swap.status = 'in_progress';
    const courier = COURIERS.find((c) => c.key === req.body.partner);
    pushTimeline(swap, 'in_progress', req.user._id, `Shipped via ${courier.label} · ${req.body.trackingId}`);
    await swap.save();
    await swapSystemMessage(swap, `${firstName(req.user)} shipped their item via ${courier.label} (tracking ${req.body.trackingId}).`);
    await notify(otherOf(swap, req.user), { type: 'swap', title: 'Your swap item is on its way', body: `${courier.label} · ${req.body.trackingId}`, link: `/swaps/${swap._id}` });
    broadcastSwap(swap);
    res.json({ ok: true });
  })
);

router.post(
  '/:id/received',
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can do this');
    if (!['accepted', 'in_progress'].includes(swap.status)) throw new HttpError(409, 'This swap is not in progress');
    const role = roleOf(swap, req.user);
    if (swap.received[role]) throw new HttpError(409, 'You already confirmed');
    swap.received[role] = true;
    if (swap.status === 'accepted') swap.status = 'in_progress';
    pushTimeline(swap, 'in_progress', req.user._id, `${firstName(req.user)} confirmed receiving their item`);
    await swap.save();
    if (swap.received.requester && swap.received.recipient) {
      await completeSwap(swap, req.user._id);
    } else {
      await swapSystemMessage(swap, `${firstName(req.user)} confirmed they received their item. Waiting for the other member to confirm.`);
      await notify(otherOf(swap, req.user), { type: 'swap', title: `${firstName(req.user)} received their item`, body: 'Confirm once you receive yours to complete the swap.', link: `/swaps/${swap._id}` });
      broadcastSwap(swap);
    }
    res.json({ ok: true, status: swap.status });
  })
);

// ---------- Dispute ----------
router.post(
  '/:id/dispute',
  validate(z.object({
    reason: z.enum(DISPUTE_REASONS.map((d) => d.key)),
    details: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(800),
  })),
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can raise a dispute');
    if (!['accepted', 'in_progress'].includes(swap.status)) throw new HttpError(409, 'Disputes can be raised only for agreed swaps');
    swap.status = 'disputed';
    swap.dispute = { raisedBy: req.user._id, reason: req.body.reason, details: req.body.details, status: 'open', createdAt: new Date() };
    pushTimeline(swap, 'disputed', req.user._id, DISPUTE_REASONS.find((d) => d.key === req.body.reason).label);
    await swap.save();
    await swapSystemMessage(swap, `${firstName(req.user)} opened a dispute. The ReThread team will review and reply within 48 hours.`);
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const a of admins) {
      await notify(a._id, { type: 'dispute', title: 'New dispute to review', body: req.body.details.slice(0, 120), link: '/admin?tab=disputes' });
    }
    await notify(otherOf(swap, req.user), { type: 'swap', title: 'A dispute was opened on your swap', body: 'Our team will review it shortly.', link: `/swaps/${swap._id}` });
    broadcastSwap(swap);
    res.json({ ok: true });
  })
);

// ---------- Rating ----------
router.post(
  '/:id/rate',
  validate(z.object({ stars: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(300).default('') })),
  asyncHandler(async (req, res) => {
    const swap = await loadSwap(req.params.id, req.user);
    if (!isParty(swap, req.user)) throw new HttpError(403, 'Only swap members can rate');
    if (swap.status !== 'completed') throw new HttpError(409, 'You can rate after the swap is completed');
    const key = roleOf(swap, req.user) === 'requester' ? 'byRequester' : 'byRecipient';
    if (swap.ratings?.[key]?.stars) throw new HttpError(409, 'You already rated this swap');
    swap.ratings[key] = { stars: req.body.stars, comment: req.body.comment };
    await swap.save();
    const target = await User.findById(otherOf(swap, req.user));
    const count = (target.rating?.count || 0) + 1;
    const avg = ((target.rating?.avg || 0) * (count - 1) + req.body.stars) / count;
    target.rating = { avg: Math.round(avg * 10) / 10, count };
    await target.save();
    await notify(target._id, { type: 'rating', title: `${firstName(req.user)} rated your swap ${'★'.repeat(req.body.stars)}`, body: req.body.comment, link: `/profile/${target._id}` });
    res.json({ ok: true });
  })
);

export default router;
