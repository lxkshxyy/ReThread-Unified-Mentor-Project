import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, Item, Swap, Conversation, Message, Report, Notification, Meta, Image } from '../models/index.js';
import { estimateValue, fairness, shippingEstimate, categoryByKey, impactFor } from '../../../shared/catalog.js';
import { findPlace, distanceKm } from '../../../shared/places.js';
import { USERS, ITEMS, HISTORY_ITEMS, COMPLETED, DEMO_PASSWORD, ADMIN } from './data.js';
import { pairKey } from '../utils/swapService.js';
import { photoUrl } from '../../../shared/photos.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const COLORS = ['#2E5E4E', '#C8643B', '#5B4B8A', '#1F6F8B', '#9A3B5B', '#7A6A2E', '#3E6B2E', '#8A4F2B'];

// Deterministic PRNG so every fresh database looks the same.
function rng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

async function insertRaw(Model, docs) {
  if (!docs.length) return;
  for (const d of docs) await d.validate();
  await Model.collection.insertMany(docs.map((d) => d.toObject({ depopulate: true, flattenMaps: true })));
}

export async function seedDatabase({ reset = false, log = console.log } = {}) {
  if (reset) {
    await Promise.all([User, Item, Swap, Conversation, Message, Report, Notification, Meta, Image].map((M) => M.deleteMany({})));
  }
  await Promise.all([User, Item, Swap, Conversation, Message, Report, Notification].map((M) => M.syncIndexes()));
  const rand = rng(7);
  const now = Date.now();
  const ago = (ms) => new Date(now - ms);
  const [demoHash, adminHash] = await Promise.all([bcrypt.hash(DEMO_PASSWORD, 10), bcrypt.hash(ADMIN.password, 10)]);

  // ---------- Users ----------
  const U = {};
  const userDocs = [];
  const mkUser = (key, name, email, hash, city, area, extra = {}) => {
    const place = findPlace(city, area);
    const d = new User({
      name,
      email,
      password: hash,
      avatarColor: COLORS[userDocs.length % COLORS.length],
      location: { city, area, point: { type: 'Point', coordinates: place.coords } },
      ...extra,
    });
    U[key] = d;
    userDocs.push(d);
    return d;
  };
  mkUser('admin', ADMIN.name, ADMIN.email, adminHash, ADMIN.city, ADMIN.area, {
    role: 'admin', bio: 'Keeping ReThread safe, fair and friendly.', createdAt: ago(16 * 7 * DAY), lastActiveAt: ago(HOUR),
  });
  for (const [key, name, city, area, bio, sizes, prefs, weeks] of USERS) {
    const first = name.split(' ')[0].toLowerCase();
    mkUser(key, name, `${first}@rethread.in`, demoHash, city, area, {
      bio,
      sizes: { top: sizes[0], bottom: sizes[1], footwear: sizes[2] },
      preferences: prefs,
      phone: `98${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
      createdAt: ago(weeks * 7 * DAY + rand() * 3 * DAY),
      lastActiveAt: ago(key === 'aanya' ? HOUR : rand() * (weeks > 6 ? 48 : 12) * DAY),
    });
  }
  userDocs.forEach((u) => { u.updatedAt = u.lastActiveAt; });

  // ---------- Items ----------
  const I = {};
  const itemDocs = [];
  const mkItem = (key, [image, title, category, gender, size, brand, condition, color, material, age, mrp, owner, lookingFor, description], createdAt) => {
    const est = estimateValue({ category, brand, condition, originalPrice: mrp, age });
    const u = U[owner];
    const d = new Item({
      owner: u._id, title, description, category, gender, size, brand, condition, color, material, age,
      originalPrice: mrp || undefined,
      estimatedValue: est.value,
      swapValue: est.value,
      brandTier: est.tier,
      lookingFor,
      images: [photoUrl(image)],
      location: { city: u.location.city, area: u.location.area, point: u.location.point },
      views: Math.floor(15 + rand() * 260),
      favoritesCount: Math.floor(rand() * 18),
      createdAt,
      updatedAt: createdAt,
    });
    I[key] = d;
    itemDocs.push(d);
    return d;
  };
  ITEMS.forEach((row) => {
    const ownerJoined = U[row[11]].createdAt.getTime();
    const created = new Date(ownerJoined + DAY + rand() * Math.max(DAY, now - ownerJoined - 2 * DAY));
    mkItem(row[0], row, created);
  });
  HISTORY_ITEMS.forEach(([key, image, title, category, gender, size, brand, condition, mrp, owner]) => {
    const created = new Date(U[owner].createdAt.getTime() + DAY);
    const d = mkItem(key, [image, title, category, gender, size, brand, condition, '', '', '1to2', mrp, owner, [], ''], created);
    d.status = 'swapped';
  });

  // ---------- Swaps, conversations, messages ----------
  const swapDocs = [];
  const convByKey = new Map();
  const msgDocs = [];
  const notifDocs = [];

  const conv = (a, b, at, extra = {}) => {
    const key = pairKey(a._id, b._id);
    let c = convByKey.get(key);
    if (!c) {
      c = new Conversation({ key, participants: [a._id, b._id], createdAt: at, updatedAt: at, unread: {}, ...extra });
      convByKey.set(key, c);
    }
    Object.assign(c, extra);
    return c;
  };
  const say = (c, sender, text, at, type = 'text', swap) => {
    const m = new Message({ conversation: c._id, sender: sender?._id || null, type, text, swap: swap?._id, createdAt: at, updatedAt: at });
    msgDocs.push(m);
    if (!c.lastMessage?.at || c.lastMessage.at <= at) {
      c.lastMessage = { text: type === 'system' ? `• ${text}` : text, sender: sender?._id || null, at };
      c.updatedAt = at;
    }
    return m;
  };
  const value = (keys) => keys.reduce((s, k) => s + I[k].swapValue, 0);
  const names = (keys) => keys.map((k) => I[k].title).join(' + ');
  const inr = (n) => `₹${n.toLocaleString('en-IN')}`;

  const mkSwap = ({ from, to, offered, requested, status, at, method = 'meetup', extra = {} }) => {
    const ov = value(offered);
    const rv = value(requested);
    const dist = distanceKm(U[from].location.point.coordinates, U[to].location.point.coordinates);
    const weight = [...offered, ...requested].reduce((s, k) => s + (categoryByKey(I[k].category)?.kg || 0.4), 0) / 2;
    const s = new Swap({
      requester: U[from]._id,
      recipient: U[to]._id,
      offeredItems: offered.map((k) => I[k]._id),
      requestedItems: requested.map((k) => I[k]._id),
      offers: [{ by: U[from]._id, offeredItems: offered.map((k) => I[k]._id), requestedItems: requested.map((k) => I[k]._id), offeredValue: ov, requestedValue: rv, fairness: fairness(ov, rv), message: extra.message || '', at }],
      status,
      distanceKm: dist,
      fulfillment: { method, shippingEstimate: shippingEstimate(dist, weight).amount },
      timeline: [{ status: 'pending', by: U[from]._id, note: 'Swap request sent', at }],
      createdAt: at,
      updatedAt: at,
    });
    const c = conv(U[from], U[to], at, { swap: s._id, item: I[requested[0]]._id });
    s.conversation = c._id;
    say(c, U[from], `Swap request: ${names(offered)} (${inr(ov)}) for ${names(requested)} (${inr(rv)}) · ${fairness(ov, rv)}% value match`, at, 'offer', s);
    if (extra.message) say(c, U[from], extra.message, new Date(at.getTime() + 60 * 1000), 'text', s);
    swapDocs.push(s);
    return { s, c };
  };

  // Completed history
  COMPLETED.forEach(([reqKeys, recKeys, weeks, [byReq, byRec], method], idx) => {
    const from = HISTORY_ITEMS.find((h) => h[0] === reqKeys[0])[9];
    const to = HISTORY_ITEMS.find((h) => h[0] === recKeys[0])[9];
    const at = ago(weeks * 7 * DAY + rand() * 2 * DAY);
    const { s, c } = mkSwap({ from, to, offered: reqKeys, requested: recKeys, status: 'completed', at, method });
    const t1 = new Date(at.getTime() + (3 + rand() * 10) * HOUR);
    const t2 = new Date(t1.getTime() + (1 + rand() * 2) * DAY);
    const t3 = new Date(t2.getTime() + (1 + rand() * 2) * DAY);
    say(c, U[to], idx % 2 ? 'Sounds fair to me! Accepting 🙂' : 'Hi! Yes, happy to swap.', t1, 'text', s);
    say(c, null, `${U[to].name.split(' ')[0]} accepted — swap agreed ✅ Items are now reserved. Next step: choose a local meetup or courier.`, t1, 'system', s);
    s.timeline.push({ status: 'accepted', by: U[to]._id, note: 'Swap agreement confirmed', at: t1 });
    if (method === 'meetup') {
      s.fulfillment.meetupPlace = `${U[to].location.area} metro station`;
      s.fulfillment.meetupAt = t2;
      s.timeline.push({ status: 'in_progress', by: U[from]._id, note: `Meetup set at ${U[to].location.area} metro station`, at: new Date(t1.getTime() + 2 * HOUR) });
    } else {
      s.fulfillment.requesterShipment = { partner: 'delhivery', trackingId: `DLV${Math.floor(1e9 + rand() * 9e9)}`, shippedAt: new Date(t1.getTime() + DAY / 2) };
      s.fulfillment.recipientShipment = { partner: 'shiprocket', trackingId: `SR${Math.floor(1e9 + rand() * 9e9)}`, shippedAt: new Date(t1.getTime() + DAY) };
      s.timeline.push({ status: 'in_progress', by: U[from]._id, note: 'Shipped via Delhivery', at: new Date(t1.getTime() + DAY / 2) });
    }
    s.received = { requester: true, recipient: true };
    s.status = 'completed';
    s.completedAt = t3;
    s.updatedAt = t3;
    s.timeline.push({ status: 'completed', by: U[from]._id, note: 'Both members confirmed they received their items', at: t3 });
    say(c, null, 'Swap completed 🎉 Thanks for keeping clothes in circulation. You can now rate each other.', t3, 'system', s);
    if (byReq[0]) s.ratings.byRequester = { stars: byReq[0], comment: byReq[1] || '' };
    if (byRec[0]) s.ratings.byRecipient = { stars: byRec[0], comment: byRec[1] || '' };
    for (const k of [...reqKeys, ...recKeys]) I[k].updatedAt = t3;
  });

  // ---------- Active / closed scenarios ----------
  const reserve = (keys) => keys.forEach((k) => { I[k].status = 'reserved'; });

  // 1. Ishita → Aanya (incoming request waiting on the demo user)
  {
    const at = ago(2 * DAY + 3 * HOUR);
    const { s } = mkSwap({ from: 'ishita', to: 'aanya', offered: ['skirt-black'], requested: ['kurta-women-maroon'], status: 'pending', at, extra: { message: 'Hi Aanya! I’ve been hunting for a chikankari kurta for Navratri 😍 Would you swap for my skater skirt? I can meet at Lajpat Nagar metro any evening.' } });
    s.awaiting = U.aanya._id;
  }
  // 2. Aanya → Meera (counter-offer waiting on the demo user)
  {
    const at = ago(3 * DAY + 5 * HOUR);
    const { s, c } = mkSwap({ from: 'aanya', to: 'meera', offered: ['cardigan-yellow'], requested: ['puffer-white'], status: 'countered', at, method: 'courier', extra: { message: 'Hi Meera! Would love this puffer for a Shimla trip in December. Offering my mustard cardigan — happy to courier.' } });
    const t = new Date(at.getTime() + 20 * HOUR);
    const off = ['cardigan-yellow', 'dress-floral-red'];
    const ov = value(off);
    const rv = value(['puffer-white']);
    s.offers.push({ by: U.meera._id, offeredItems: off.map((k) => I[k]._id), requestedItems: [I['puffer-white']._id], offeredValue: ov, requestedValue: rv, fairness: fairness(ov, rv), message: 'The cardigan alone is a bit low for a puffer with tags — could you add your Zara wrap dress? Then it’s a deal 🙂', at: t });
    s.offeredItems = off.map((k) => I[k]._id);
    s.status = 'countered';
    s.awaiting = U.aanya._id;
    s.timeline.push({ status: 'countered', by: U.meera._id, note: 'Counter-offer sent', at: t });
    s.updatedAt = t;
    say(c, U.meera, `Counter-offer: ${names(off)} (${inr(ov)}) ⇄ ${names(['puffer-white'])} (${inr(rv)}) · ${fairness(ov, rv)}% value match`, t, 'offer', s);
    say(c, U.meera, 'The cardigan alone is a bit low for a puffer with tags — could you add your Zara wrap dress? Then it’s a deal 🙂', new Date(t.getTime() + 60 * 1000), 'text', s);
  }
  // 3. Kabir ↔ Simran — agreed, local meetup scheduled
  {
    const at = ago(4 * DAY);
    const { s, c } = mkSwap({ from: 'kabir', to: 'simran', offered: ['leather-jacket-black'], requested: ['bag-handbag-brown', 'hoodie-white'], status: 'in_progress', at, extra: { message: 'Hey Simran, the tote is for my sister and I’d love the hoodie. Biker jacket in exchange?' } });
    const t1 = new Date(at.getTime() + 6 * HOUR);
    const t2 = new Date(t1.getTime() + 3 * HOUR);
    s.timeline.push({ status: 'accepted', by: U.simran._id, note: 'Swap agreement confirmed', at: t1 });
    say(c, U.simran, 'Deal! My brother has been eyeing biker jackets 😄', t1, 'text', s);
    say(c, null, 'Simran accepted — swap agreed ✅ Items are now reserved. Next step: choose a local meetup or courier.', t1, 'system', s);
    s.fulfillment.meetupPlace = 'Rajouri Garden Metro Station, Gate 2';
    s.fulfillment.meetupAt = new Date(now + 2 * DAY + 4 * HOUR);
    s.timeline.push({ status: 'in_progress', by: U.kabir._id, note: 'Meetup set at Rajouri Garden Metro Station, Gate 2', at: t2 });
    say(c, null, 'Kabir: Meetup set at Rajouri Garden Metro Station, Gate 2.', t2, 'system', s);
    say(c, U.simran, 'Works for me. See you there at 6!', new Date(t2.getTime() + HOUR), 'text', s);
    s.updatedAt = new Date(t2.getTime() + HOUR);
    reserve(['leather-jacket-black', 'bag-handbag-brown', 'hoodie-white']);
  }
  // 4. Neil → Aditya — courier swap, Neil has shipped
  {
    const at = ago(6 * DAY);
    const { s, c } = mkSwap({ from: 'neil', to: 'aditya', offered: ['sneaker-af1'], requested: ['bomber-brown', 'kurta-men-yellow'], status: 'in_progress', at, method: 'courier', extra: { message: 'Hi Aditya — AF1s for the bomber + kurta set? I can ship from Mumbai.' } });
    const t1 = new Date(at.getTime() + 9 * HOUR);
    const t2 = new Date(t1.getTime() + DAY);
    s.timeline.push({ status: 'accepted', by: U.aditya._id, note: 'Swap agreement confirmed', at: t1 });
    say(c, null, 'Aditya accepted — swap agreed ✅ Items are now reserved. Next step: choose a local meetup or courier.', t1, 'system', s);
    s.fulfillment.requesterShipment = { partner: 'delhivery', trackingId: 'DLV4829105573', shippedAt: t2 };
    s.timeline.push({ status: 'in_progress', by: U.neil._id, note: 'Shipped via Delhivery · DLV4829105573', at: t2 });
    say(c, null, 'Neil shipped their item via Delhivery (tracking DLV4829105573).', t2, 'system', s);
    say(c, U.aditya, 'Got the tracking, thanks! I’ll ship mine tomorrow morning.', new Date(t2.getTime() + 2 * HOUR), 'text', s);
    s.updatedAt = new Date(t2.getTime() + 2 * HOUR);
    reserve(['sneaker-af1', 'bomber-brown', 'kurta-men-yellow']);
  }
  // 5. Rahul → Tanvi — dispute after meetup
  {
    const at = ago(9 * DAY);
    const { s, c } = mkSwap({ from: 'rahul', to: 'tanvi', offered: ['sneaker-red', 'tee-white'], requested: ['dress-display'], status: 'disputed', at, extra: { message: 'Hi Tanvi, the gown is for my sister’s engagement. Would you take my Nike Free RN + Supima tee?' } });
    const t1 = new Date(at.getTime() + 5 * HOUR);
    const t2 = new Date(t1.getTime() + 2 * DAY);
    const t3 = new Date(t2.getTime() + DAY);
    s.timeline.push({ status: 'accepted', by: U.tanvi._id, note: 'Swap agreement confirmed', at: t1 });
    s.fulfillment.meetupPlace = 'Powai Lake promenade, near Hiranandani gate';
    s.fulfillment.meetupAt = t2;
    s.timeline.push({ status: 'in_progress', by: U.tanvi._id, note: 'Meetup set at Powai Lake promenade', at: new Date(t1.getTime() + HOUR) });
    say(c, U.rahul, 'Hi Tanvi, my sister noticed a big tear in the tulle layer at the back that wasn’t in the photos. Can we sort this out?', new Date(t2.getTime() + 8 * HOUR), 'text', s);
    say(c, U.tanvi, 'It was perfect when I handed it over! You checked it at the meetup.', new Date(t2.getTime() + 10 * HOUR), 'text', s);
    s.status = 'disputed';
    s.dispute = { raisedBy: U.rahul._id, reason: 'not_as_described', details: 'There is a 10 cm tear in the tulle layer at the back that was not visible in the listing photos. Requesting the swap be reversed.', status: 'open', createdAt: t3 };
    s.timeline.push({ status: 'disputed', by: U.rahul._id, note: 'Item not as described', at: t3 });
    say(c, null, 'Rahul opened a dispute. The ReThread team will review and reply within 48 hours.', t3, 'system', s);
    s.updatedAt = t3;
    reserve(['sneaker-red', 'tee-white', 'dress-display']);
  }
  // 6. Ananya ↔ Divya — agreed, method not chosen yet
  {
    const at = ago(1 * DAY + 6 * HOUR);
    const { s, c } = mkSwap({ from: 'ananya', to: 'divya', offered: ['sundress-floral'], requested: ['running-shoes'], status: 'accepted', at, extra: { message: 'Hi! Same shoe size 🙌 sundress for the Skechers?' } });
    const t1 = new Date(at.getTime() + 4 * HOUR);
    s.timeline.push({ status: 'accepted', by: U.divya._id, note: 'Swap agreement confirmed', at: t1 });
    say(c, null, 'Divya accepted — swap agreed ✅ Items are now reserved. Next step: choose a local meetup or courier.', t1, 'system', s);
    s.updatedAt = t1;
    reserve(['sundress-floral', 'running-shoes']);
  }
  // 7. Vikram → Kabir — pending
  {
    const { s } = mkSwap({ from: 'vikram', to: 'kabir', offered: ['leather-jacket-brown'], requested: ['kurta-men-green'], status: 'pending', at: ago(20 * HOUR), extra: { message: 'Genuine leather vintage jacket for your Fabindia kurta? Values match almost exactly.' } });
    s.awaiting = U.kabir._id;
  }
  // 8. Arjun → Rohan — declined
  {
    const at = ago(12 * DAY);
    const { s, c } = mkSwap({ from: 'arjun', to: 'rohan', offered: ['sweater-blue'], requested: ['denim-jacket-1'], status: 'rejected', at });
    const t = new Date(at.getTime() + 7 * HOUR);
    s.status = 'rejected';
    s.closedReason = 'Values are too far apart — looking for sweaters or boots.';
    s.timeline.push({ status: 'rejected', by: U.rohan._id, note: s.closedReason, at: t });
    say(c, null, `Rohan declined the swap: “${s.closedReason}”`, t, 'system', s);
    s.updatedAt = t;
  }
  // 9. Fatima → Sneha — declined (value gap)
  {
    const at = ago(15 * DAY);
    const { s, c } = mkSwap({ from: 'fatima', to: 'sneha', offered: ['saree-pink-orange'], requested: ['saree-purple'], status: 'rejected', at, method: 'courier' });
    const t = new Date(at.getTime() + 30 * HOUR);
    s.status = 'rejected';
    s.closedReason = 'Thank you, but I’d like something closer in value.';
    s.timeline.push({ status: 'rejected', by: U.sneha._id, note: s.closedReason, at: t });
    say(c, null, `Sneha declined the swap: “${s.closedReason}”`, t, 'system', s);
    s.updatedAt = t;
  }
  // 10. Omkar → Sayan — declined
  {
    const at = ago(20 * DAY);
    const { s } = mkSwap({ from: 'omkar', to: 'sayan', offered: ['polo-black'], requested: ['hoodie-grey'], status: 'rejected', at, method: 'courier' });
    s.status = 'rejected';
    s.closedReason = 'Shipping Pune–Kolkata doesn’t make sense for one hoodie.';
    s.timeline.push({ status: 'rejected', by: U.sayan._id, note: s.closedReason, at: new Date(at.getTime() + DAY) });
  }
  // 11. Sayan → Karthik — withdrawn
  {
    const at = ago(25 * DAY);
    const { s } = mkSwap({ from: 'sayan', to: 'karthik', offered: ['tee-graphic'], requested: ['tee-black'], status: 'cancelled', at, method: 'courier' });
    s.status = 'cancelled';
    s.closedReason = 'Cancelled by Sayan';
    s.timeline.push({ status: 'cancelled', by: U.sayan._id, note: 'Cancelled by Sayan', at: new Date(at.getTime() + 2 * DAY) });
  }
  // 12. Riya → Simran — auto-closed because the tote got reserved in Kabir's swap
  {
    const at = ago(5 * DAY);
    const { s, c } = mkSwap({ from: 'riya', to: 'simran', offered: ['sweater-brown'], requested: ['bag-handbag-brown'], status: 'cancelled', at, method: 'courier' });
    const t = new Date(at.getTime() + 2 * DAY);
    s.status = 'cancelled';
    s.closedReason = 'An item in this request was swapped with someone else';
    s.timeline.push({ status: 'cancelled', by: U.simran._id, note: s.closedReason, at: t });
    say(c, null, 'Swap request closed automatically — an item in this request was swapped with someone else.', t, 'system', s);
  }

  // Extra closed requests across the last 12 weeks to give the funnel realistic depth.
  const pool = ITEMS.filter((r) => !['reserved'].includes(I[r[0]].status)).map((r) => r[0]);
  for (let n = 0; n < 9; n++) {
    const a = pool[Math.floor(rand() * pool.length)];
    let b = pool[Math.floor(rand() * pool.length)];
    let guard = 0;
    while ((I[b].owner.equals(I[a].owner) || I[b].status !== 'available' || I[a].status !== 'available') && guard++ < 50) b = pool[Math.floor(rand() * pool.length)];
    if (guard >= 50) continue;
    const fromKey = Object.keys(U).find((k) => U[k]._id.equals(I[a].owner));
    const toKey = Object.keys(U).find((k) => U[k]._id.equals(I[b].owner));
    const at = ago((14 + rand() * 60) * DAY);
    const st = n % 3 === 0 ? 'cancelled' : 'rejected';
    const { s } = mkSwap({ from: fromKey, to: toKey, offered: [a], requested: [b], status: st, at, method: 'courier' });
    s.status = st;
    s.closedReason = st === 'rejected' ? 'Not looking for this right now, thanks!' : 'Cancelled by requester';
    s.timeline.push({ status: st, by: st === 'rejected' ? U[toKey]._id : U[fromKey]._id, note: s.closedReason, at: new Date(at.getTime() + DAY) });
    s.updatedAt = new Date(at.getTime() + DAY);
  }

  // Stats for members who completed swaps
  for (const s of swapDocs.filter((x) => x.status === 'completed')) {
    const all = [...s.offeredItems, ...s.requestedItems].map((id) => itemDocs.find((i) => i._id.equals(id)));
    for (const uid of [s.requester, s.recipient]) {
      const u = userDocs.find((x) => x._id.equals(uid));
      const received = all.filter((i) => !i.owner.equals(uid)).map((i) => i.category);
      u.stats.swapsCompleted += 1;
      u.stats.kgDiverted = Math.round((u.stats.kgDiverted + impactFor(received).kg) * 10) / 10;
      const r = s.requester.equals(uid) ? s.ratings.byRecipient : s.ratings.byRequester;
      if (r?.stars) {
        const count = u.rating.count + 1;
        u.rating = { avg: Math.round(((u.rating.avg * u.rating.count + r.stars) / count) * 10) / 10, count };
      }
    }
  }

  // Unread counters: the demo user has unread messages from Ishita and Meera.
  for (const c of convByKey.values()) {
    const last = msgDocs.filter((m) => m.conversation.equals(c._id)).sort((x, y) => y.createdAt - x.createdAt)[0];
    if (last?.sender && last.createdAt > ago(4 * DAY)) {
      const other = c.participants.find((p) => !p.equals(last.sender));
      c.unread.set(String(other), 2);
    }
  }

  // Favourites for the demo user
  U.aanya.favorites = [I['denim-jacket-2']._id, I['boots-suede']._id, I['trench-coat']._id];

  // ---------- Reports ----------
  const reportDocs = [
    new Report({ reporter: U.karthik._id, targetType: 'item', item: I['puffer-black']._id, user: U.neil._id, reason: 'counterfeit', details: 'Logo stitching looks different from the authentic 1996 Nuptse. Could the owner upload the bill?', status: 'open', createdAt: ago(30 * HOUR) }),
    new Report({ reporter: U.fatima._id, targetType: 'user', user: U.vikram._id, reason: 'selling', details: 'Asked me to pay ₹500 extra over UPI on top of the swap.', status: 'open', createdAt: ago(10 * HOUR) }),
    new Report({ reporter: U.ananya._id, targetType: 'item', item: I['bag-gucci']._id, user: U.meera._id, reason: 'counterfeit', details: 'Price seems too good for an authentic Marmont.', status: 'dismissed', handledBy: U.admin._id, note: 'Owner shared the original invoice and authenticity card — verified.', createdAt: ago(9 * DAY) }),
  ];
  I['puffer-black'].moderation.reportsCount = 1;
  I['bag-gucci'].moderation.reportsCount = 1;

  // ---------- Notifications ----------
  const N = (user, title, body, link, at, read = false, type = 'swap') => notifDocs.push(new Notification({ user: user._id, type, title, body, link, read, createdAt: at, updatedAt: at }));
  const ishitaSwap = swapDocs.find((s) => s.requester.equals(U.ishita._id) && s.recipient.equals(U.aanya._id));
  const meeraSwap = swapDocs.find((s) => s.requester.equals(U.aanya._id) && s.recipient.equals(U.meera._id));
  const disputeSwap = swapDocs.find((s) => s.status === 'disputed');
  N(U.aanya, 'Ishita wants to swap for your Maroon Chikankari Anarkali Kurta', `Offering Black Pleated Skater Skirt · ${ishitaSwap.offers[0].fairness}% value match`, `/swaps/${ishitaSwap._id}`, ago(2 * DAY + 3 * HOUR));
  N(U.aanya, 'Meera sent a counter-offer', `${meeraSwap.offers[1].fairness}% value match`, `/swaps/${meeraSwap._id}`, ago(2 * DAY + 9 * HOUR));
  N(U.aanya, 'Swap completed', 'Leave a rating for your swap partner.', '/swaps', ago(3 * 7 * DAY), true);
  N(U.admin, 'New dispute to review', 'Tear in the tulle layer — Rahul vs Tanvi', '/admin?tab=disputes', disputeSwap.dispute.createdAt, false, 'dispute');
  N(U.admin, 'New item report', 'Counterfeit / fake brand', '/admin?tab=reports', ago(30 * HOUR), false, 'report');
  N(U.admin, 'New user report', 'Asking for money (not a swap)', '/admin?tab=reports', ago(10 * HOUR), false, 'report');

  // ---------- Write ----------
  await insertRaw(User, userDocs);
  await insertRaw(Item, itemDocs);
  await insertRaw(Swap, swapDocs);
  await insertRaw(Conversation, [...convByKey.values()]);
  await insertRaw(Message, msgDocs);
  await insertRaw(Report, reportDocs);
  await insertRaw(Notification, notifDocs);
  log(`[seed] ${userDocs.length} users · ${itemDocs.length} items · ${swapDocs.length} swaps · ${msgDocs.length} messages · ${reportDocs.length} reports`);
  return { users: userDocs.length, items: itemDocs.length, swaps: swapDocs.length };
}

// Seed once on an empty database (safe under concurrent serverless cold starts).
let seededChecked = false;
export async function ensureSeeded() {
  if (seededChecked) return;
  if (await Meta.exists({ _id: 'seeded' })) { seededChecked = true; return; }
  if ((await User.estimatedDocumentCount()) > 0) {
    await Meta.updateOne({ _id: 'seeded' }, { value: 'existing-data', at: new Date() }, { upsert: true });
    seededChecked = true;
    return;
  }
  try {
    await Meta.create({ _id: 'seed-lock', at: new Date() });
  } catch {
    // Another instance is seeding; wait briefly for it to finish.
    for (let i = 0; i < 20 && !(await Meta.exists({ _id: 'seeded' })); i++) await new Promise((r) => setTimeout(r, 500));
    seededChecked = true;
    return;
  }
  try {
    await seedDatabase();
    await Meta.create({ _id: 'seeded', value: 'demo', at: new Date() });
  } finally {
    await Meta.deleteOne({ _id: 'seed-lock' });
  }
  seededChecked = true;
}

export const isValidObjectId = (v) => mongoose.isValidObjectId(v);
