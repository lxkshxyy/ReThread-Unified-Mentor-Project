import { Swap, Item, User, Conversation, Message } from '../models/index.js';
import { fairness, impactFor, SWAP_STATUS } from '../../../shared/catalog.js';
import { emitToUser, notify } from './realtime.js';

export const sumValue = (items) => items.reduce((s, i) => s + (i.swapValue || 0), 0);

export const pairKey = (a, b) => [String(a), String(b)].sort().join(':');

export async function getOrCreateConversation(userA, userB, extra = {}) {
  const key = pairKey(userA, userB);
  let conv = await Conversation.findOne({ key });
  if (!conv) {
    conv = await Conversation.create({ key, participants: [userA, userB], ...extra });
  } else if (extra.swap || extra.item) {
    if (extra.swap) conv.swap = extra.swap;
    if (extra.item) conv.item = extra.item;
    await conv.save();
  }
  return conv;
}

export async function postMessage(conv, { sender = null, type = 'text', text, swap }) {
  const msg = await Message.create({ conversation: conv._id, sender, type, text, swap });
  conv.lastMessage = { text: type === 'system' ? `• ${text}` : text, sender, at: msg.createdAt };
  for (const p of conv.participants) {
    if (!sender || String(p) !== String(sender)) {
      conv.unread.set(String(p), (conv.unread.get(String(p)) || 0) + 1);
    }
  }
  await conv.save();
  const payload = { conversationId: String(conv._id), message: msg };
  for (const p of conv.participants) emitToUser(p, 'message:new', payload);
  return msg;
}

export function pushTimeline(swap, status, by, note) {
  swap.timeline.push({ status, by, note, at: new Date() });
}

export async function swapSystemMessage(swap, text) {
  const conv = swap.conversation
    ? await Conversation.findById(swap.conversation)
    : await getOrCreateConversation(swap.requester, swap.recipient, { swap: swap._id });
  if (!conv) return null;
  return postMessage(conv, { type: 'system', text, swap: swap._id });
}

export function broadcastSwap(swap) {
  const payload = { swapId: String(swap._id), status: swap.status };
  emitToUser(swap.requester, 'swap:update', payload);
  emitToUser(swap.recipient, 'swap:update', payload);
}

/** Cancel every open (not yet agreed) swap that references any of these items. */
export async function cancelSwapsForItems(itemIds, reason, byUserId, exceptSwapId) {
  const open = await Swap.find({
    _id: { $ne: exceptSwapId },
    status: { $in: ['pending', 'countered'] },
    $or: [{ offeredItems: { $in: itemIds } }, { requestedItems: { $in: itemIds } }],
  });
  for (const s of open) {
    s.status = 'cancelled';
    s.closedReason = reason;
    s.awaiting = undefined;
    pushTimeline(s, 'cancelled', byUserId, reason);
    await s.save();
    await swapSystemMessage(s, `Swap request closed automatically — ${reason.toLowerCase()}.`);
    for (const u of [s.requester, s.recipient]) {
      await notify(u, { type: 'swap', title: 'A swap request was closed', body: reason, link: `/swaps/${s._id}` });
    }
    broadcastSwap(s);
  }
  return open.length;
}

/** Mark a swap completed: items → swapped, stats + impact for both members. */
export async function completeSwap(swap, byUserId, note = 'Both members confirmed they received their items') {
  swap.status = 'completed';
  swap.completedAt = new Date();
  pushTimeline(swap, 'completed', byUserId, note);
  await swap.save();
  const allIds = [...swap.offeredItems, ...swap.requestedItems];
  await Item.updateMany({ _id: { $in: allIds } }, { status: 'swapped' });
  const items = await Item.find({ _id: { $in: allIds } }).select('category owner');
  for (const uid of [swap.requester, swap.recipient]) {
    const received = items.filter((i) => String(i.owner) !== String(uid)).map((i) => i.category);
    const { kg } = impactFor(received);
    await User.updateOne({ _id: uid }, { $inc: { 'stats.swapsCompleted': 1, 'stats.kgDiverted': kg } });
  }
  await swapSystemMessage(swap, 'Swap completed 🎉 Thanks for keeping clothes in circulation. You can now rate each other.');
  for (const u of [swap.requester, swap.recipient]) {
    await notify(u, { type: 'swap', title: 'Swap completed', body: 'Leave a rating for your swap partner.', link: `/swaps/${swap._id}` });
  }
  broadcastSwap(swap);
}

/** Cancel a swap that might already have reserved items. */
export async function cancelAgreedSwap(swap, byUserId, reason) {
  const wasAgreed = ['accepted', 'in_progress', 'disputed'].includes(swap.status);
  swap.status = 'cancelled';
  swap.closedReason = reason;
  swap.awaiting = undefined;
  pushTimeline(swap, 'cancelled', byUserId, reason);
  await swap.save();
  if (wasAgreed) {
    await Item.updateMany({ _id: { $in: [...swap.offeredItems, ...swap.requestedItems] }, status: 'reserved' }, { status: 'available' });
  }
  broadcastSwap(swap);
}

export function snapshotTerms(offeredItems, requestedItems) {
  const offeredValue = sumValue(offeredItems);
  const requestedValue = sumValue(requestedItems);
  return { offeredValue, requestedValue, fairness: fairness(offeredValue, requestedValue) };
}

export const statusLabel = (s) => SWAP_STATUS[s]?.label || s;
