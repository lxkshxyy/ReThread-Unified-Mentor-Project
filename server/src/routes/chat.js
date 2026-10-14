import { Router } from 'express';
import { z } from 'zod';
import { Conversation, Message, User, Item, Swap } from '../models/index.js';
import { asyncHandler, validate, HttpError, requireAuth } from '../middleware/core.js';
import { getOrCreateConversation, postMessage } from '../utils/swapService.js';
import { publicOwner } from '../utils/serializers.js';
import { emitToUser } from '../utils/realtime.js';

const router = Router();
router.use(requireAuth);

const PARTICIPANT_FIELDS = 'name avatarColor location rating stats createdAt';

async function loadConversation(id, user) {
  const conv = await Conversation.findById(id);
  if (!conv) throw new HttpError(404, 'Conversation not found');
  if (!conv.participants.some((p) => String(p) === String(user._id))) throw new HttpError(403, 'Not your conversation');
  return conv;
}

function shapeConversation(conv, me) {
  const o = conv.toObject({ flattenMaps: true });
  const other = (o.participants || []).find((p) => String(p._id || p) !== String(me._id));
  return {
    _id: o._id,
    other: publicOwner(other),
    item: o.item && o.item.title ? { _id: o.item._id, title: o.item.title, images: o.item.images, swapValue: o.item.swapValue } : null,
    swap: o.swap && o.swap.status ? { _id: o.swap._id, status: o.swap.status } : null,
    lastMessage: o.lastMessage,
    unread: o.unread?.[String(me._id)] || 0,
    updatedAt: o.updatedAt,
  };
}

// GET /api/chat/conversations
router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const convs = await Conversation.find({ participants: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('participants', PARTICIPANT_FIELDS)
      .populate('item', 'title images swapValue')
      .populate('swap', 'status');
    res.json({ conversations: convs.map((c) => shapeConversation(c, req.user)) });
  })
);

// GET /api/chat/unread — total unread count for the navbar badge
router.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const convs = await Conversation.find({ participants: req.user._id }).select('unread');
    const total = convs.reduce((s, c) => s + (c.unread.get(String(req.user._id)) || 0), 0);
    res.json({ unread: total });
  })
);

// POST /api/chat/conversations — open (or reuse) a thread with another member
router.post(
  '/conversations',
  validate(z.object({ userId: z.string().regex(/^[a-f0-9]{24}$/), itemId: z.string().regex(/^[a-f0-9]{24}$/).optional() })),
  asyncHandler(async (req, res) => {
    if (req.body.userId === String(req.user._id)) throw new HttpError(422, 'You cannot message yourself');
    const other = await User.findById(req.body.userId).select('status');
    if (!other || other.status !== 'active') throw new HttpError(404, 'Member not found');
    let item;
    if (req.body.itemId) item = await Item.findById(req.body.itemId).select('_id owner');
    const conv = await getOrCreateConversation(req.user._id, other._id, item ? { item: item._id } : {});
    res.status(201).json({ conversationId: conv._id });
  })
);

// GET /api/chat/conversations/:id — thread + messages (supports ?after=ISO for polling)
router.get(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user);
    const filter = { conversation: conv._id };
    if (req.query.after) {
      const d = new Date(req.query.after);
      if (!Number.isNaN(d.getTime())) filter.createdAt = { $gt: d };
    }
    const messages = await Message.find(filter).sort({ createdAt: -1 }).limit(200);
    await conv.populate([
      { path: 'participants', select: PARTICIPANT_FIELDS },
      { path: 'item', select: 'title images swapValue' },
      { path: 'swap', select: 'status' },
    ]);
    // Swaps between this pair, for the context panel.
    const ids = conv.participants.map((p) => p._id);
    const swaps = await Swap.find({ requester: { $in: ids }, recipient: { $in: ids } })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('status offeredItems requestedItems requester recipient awaiting updatedAt')
      .populate('offeredItems requestedItems', 'title images swapValue');
    res.json({ conversation: shapeConversation(conv, req.user), messages: messages.reverse(), swaps });
  })
);

router.post(
  '/conversations/:id/messages',
  validate(z.object({ text: z.string().trim().min(1, 'Type a message').max(1000) })),
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user);
    const other = conv.participants.find((p) => String(p) !== String(req.user._id));
    const otherUser = await User.findById(other).select('status');
    if (!otherUser || otherUser.status !== 'active') throw new HttpError(409, 'This member can no longer receive messages');
    const msg = await postMessage(conv, { sender: req.user._id, text: req.body.text });
    res.status(201).json({ message: msg });
  })
);

router.post(
  '/conversations/:id/read',
  asyncHandler(async (req, res) => {
    const conv = await loadConversation(req.params.id, req.user);
    conv.unread.set(String(req.user._id), 0);
    await conv.save();
    emitToUser(req.user._id, 'chat:read', { conversationId: String(conv._id) });
    res.json({ ok: true });
  })
);

export default router;
