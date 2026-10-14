// End-to-end API tests on an in-memory MongoDB with the full demo seed.
// Run: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.USE_MEMORY_DB = 'true';
process.env.AUTO_SEED = 'true';

const { createApp } = await import('../src/app.js');
const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { ensureSeeded } = await import('../src/seed/seed.js');

let server;
let base;

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body) {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* non-json */ }
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b || {}); }
  patch(p, b) { return this.req('PATCH', p, b || {}); }
  del(p) { return this.req('DELETE', p); }
}

before(async () => {
  await connectDB();
  await ensureSeeded();
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server?.close();
  await disconnectDB();
});

const newUser = new Client();
const aanya = new Client();
const admin = new Client();
const state = {};

test('health + public catalogue', async () => {
  const c = new Client();
  assert.equal((await c.get('/health')).status, 200);
  const stats = await c.get('/stats');
  assert.ok(stats.data.listings > 40, 'seeded listings present');
  const meta = await c.get('/meta');
  assert.ok(meta.data.CATEGORIES.length > 20);
});

test('registration validates input and sets an httpOnly cookie', async () => {
  const weak = await newUser.post('/auth/register', { name: 'Test User', email: 'test@example.com', password: 'short', city: 'Delhi', area: 'Saket' });
  assert.equal(weak.status, 422);
  const badLoc = await newUser.post('/auth/register', { name: 'Test User', email: 'test@example.com', password: 'Passw0rd!', city: 'Atlantis', area: 'Nowhere' });
  assert.equal(badLoc.status, 422);
  const ok = await newUser.post('/auth/register', { name: 'Test User', email: 'test@example.com', password: 'Passw0rd!', city: 'Delhi', area: 'Saket' });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.user.password, undefined, 'password never returned');
  const dup = await new Client().post('/auth/register', { name: 'Another', email: 'TEST@example.com', password: 'Passw0rd!', city: 'Delhi', area: 'Saket' });
  assert.equal(dup.status, 409);
  const me = await newUser.get('/auth/me');
  assert.equal(me.data.user.email, 'test@example.com');
});

test('login rejects bad credentials and NoSQL operator injection', async () => {
  assert.equal((await new Client().post('/auth/login', { email: 'aanya@rethread.in', password: 'wrong' })).status, 401);
  assert.equal((await new Client().post('/auth/login', { email: { $gt: '' }, password: { $gt: '' } })).status, 422);
  assert.equal((await aanya.post('/auth/login', { email: 'aanya@rethread.in', password: 'Demo@1234' })).status, 200);
  assert.equal((await admin.post('/auth/login', { email: 'admin@rethread.in', password: 'Admin@1234' })).status, 200);
});

test('protected routes require auth; admin routes require admin', async () => {
  assert.equal((await new Client().get('/users/me/dashboard')).status, 401);
  assert.equal((await newUser.get('/admin/overview')).status, 403);
  assert.equal((await admin.get('/admin/overview')).status, 200);
});

test('listing CRUD with swap value calculator bounds', async () => {
  const body = { title: 'Blue Denim Jacket', category: 'jacket', gender: 'women', size: 'S', brand: "Levi's", condition: 'like_new', images: ['https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=900&q=70'], originalPrice: 4999 };
  const tooHigh = await newUser.post('/items', { ...body, swapValue: 99999 });
  assert.equal(tooHigh.status, 422);
  const badImg = await newUser.post('/items', { ...body, images: ['https://evil.example/x.jpg'] });
  assert.equal(badImg.status, 422);
  const created = await newUser.post('/items', body);
  assert.equal(created.status, 201);
  assert.ok(created.data.item.swapValue > 0);
  assert.equal(created.data.item.swapValue, created.data.item.estimatedValue);
  state.myItem = created.data.item;
  const upd = await newUser.patch(`/items/${state.myItem._id}`, { description: 'Worn twice' });
  assert.equal(upd.status, 200);
  assert.equal((await aanya.patch(`/items/${state.myItem._id}`, { description: 'hack' })).status, 403);
});

test('browse supports filters, search and location', async () => {
  const c = new Client();
  const all = await c.get('/items?limit=5');
  assert.equal(all.status, 200);
  const ethnic = await c.get('/items?category=saree,lehenga');
  assert.ok(ethnic.data.items.every((i) => ['saree', 'lehenga'].includes(i.category)));
  const near = await c.get('/items?lat=28.5494&lng=77.2001&radiusKm=5&sort=nearest');
  assert.ok(near.data.items.length > 0);
  assert.ok(near.data.items.every((i) => i.distanceKm <= 5));
  assert.ok(near.data.items.every((i, k, a) => k === 0 || a[k - 1].distanceKm <= i.distanceKm), 'sorted by distance');
  const q = await c.get('/items?q=levi');
  assert.ok(q.data.items.some((i) => /levi/i.test(i.brand)));
  assert.equal(all.data.items[0].location.point, undefined, 'exact coordinates are not exposed');
});

test('full swap lifecycle: request → counter → accept → meetup → received → rating', async () => {
  const browse = await newUser.get('/items?q=Chikankari');
  const target = browse.data.items.find((i) => i.owner.name === 'Aanya Sharma');
  assert.ok(target, 'found Aanya’s kurta');

  const own = await newUser.post('/swaps', { requestedItemIds: [state.myItem._id], offeredItemIds: [state.myItem._id] });
  assert.equal(own.status, 422, 'cannot request own item');

  const sent = await newUser.post('/swaps', { requestedItemIds: [target._id], offeredItemIds: [state.myItem._id], message: 'Hi!', method: 'meetup' });
  assert.equal(sent.status, 201);
  const swapId = sent.data.swap._id;
  const dup = await newUser.post('/swaps', { requestedItemIds: [target._id], offeredItemIds: [state.myItem._id] });
  assert.equal(dup.status, 409);

  // Requester can't respond to their own request
  assert.equal((await newUser.post(`/swaps/${swapId}/respond`, { action: 'accept' })).status, 409);

  // Aanya counters: asks for the same jacket but offers her kurta + hoodie
  const detail = await aanya.get(`/swaps/${swapId}`);
  assert.ok(detail.data.swap.myTurn);
  const hoodie = detail.data.swap.recipientCloset.find((i) => /Hoodie/.test(i.title));
  const counter = await aanya.post(`/swaps/${swapId}/respond`, { action: 'counter', offeredItemIds: [state.myItem._id], requestedItemIds: [target._id, hoodie._id], message: 'Take the hoodie too!' });
  assert.equal(counter.status, 200);
  assert.equal(counter.data.status, 'countered');

  const accepted = await newUser.post(`/swaps/${swapId}/respond`, { action: 'accept' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.status, 'accepted');

  // Items are reserved; Ishita's seeded pending request for the kurta is auto-cancelled
  const kurta = await new Client().get(`/items/${target._id}`);
  assert.equal(kurta.data.item.status, 'reserved');
  const aanyaSwaps = await aanya.get('/swaps?box=incoming');
  const ishita = aanyaSwaps.data.swaps.find((s) => s.requester.name === 'Ishita Verma');
  assert.equal(ishita.status, 'cancelled');

  const bad = await newUser.post(`/swaps/${swapId}/fulfillment`, { method: 'meetup', meetupPlace: 'Saket', meetupAt: '2000-01-01T10:00:00Z' });
  assert.equal(bad.status, 422, 'meetup must be in the future');
  const plan = await newUser.post(`/swaps/${swapId}/fulfillment`, { method: 'meetup', meetupPlace: 'Saket metro station, Gate 1', meetupAt: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(plan.status, 200);

  assert.equal((await newUser.post(`/swaps/${swapId}/received`)).data.status, 'in_progress');
  assert.equal((await aanya.post(`/swaps/${swapId}/received`)).data.status, 'completed');
  const after = await newUser.get(`/swaps/${swapId}`);
  assert.equal(after.data.swap.status, 'completed');
  assert.equal((await new Client().get(`/items/${state.myItem._id}`)).data.item.status, 'swapped');

  assert.equal((await newUser.post(`/swaps/${swapId}/rate`, { stars: 5, comment: 'Lovely' })).status, 200);
  assert.equal((await newUser.post(`/swaps/${swapId}/rate`, { stars: 4 })).status, 409, 'one rating per member');
  state.swapId = swapId;
});

test('chat: conversation created with the swap, messages + unread counts', async () => {
  const convs = await newUser.get('/chat/conversations');
  const conv = convs.data.conversations.find((c) => c.other.name === 'Aanya Sharma');
  assert.ok(conv);
  const sent = await newUser.post(`/chat/conversations/${conv._id}/messages`, { text: 'Thanks for the swap!' });
  assert.equal(sent.status, 201);
  const unread = await aanya.get('/chat/unread');
  assert.ok(unread.data.unread >= 1);
  const thread = await aanya.get(`/chat/conversations/${conv._id}`);
  assert.ok(thread.data.messages.some((m) => m.type === 'offer'));
  assert.ok(thread.data.messages.some((m) => m.type === 'system'));
  assert.equal((await admin.get(`/chat/conversations/${conv._id}`)).status, 403, 'others cannot read');
});

test('dashboard, suggestions and nearby members', async () => {
  const dash = await aanya.get('/users/me/dashboard');
  assert.equal(dash.status, 200);
  assert.ok(dash.data.swaps.completed >= 3);
  const sug = await aanya.get('/users/me/suggestions?radiusKm=20');
  assert.ok(sug.data.suggestions.length > 0);
  assert.ok(sug.data.suggestions.every((s) => s.fairness >= 70 && s.distanceKm <= 20));
  const near = await new Client().get('/users/nearby?lat=28.5494&lng=77.2001&radiusKm=10');
  assert.ok(near.data.members.length > 0);
});

test('reports, moderation and dispute resolution', async () => {
  const items = await newUser.get('/items?q=Nuptse');
  const nuptse = items.data.items[0];
  const rep = await newUser.post('/reports', { targetType: 'item', targetId: nuptse._id, reason: 'counterfeit', details: 'Looks fake' });
  assert.equal(rep.status, 201);
  assert.equal((await newUser.post('/reports', { targetType: 'item', targetId: nuptse._id, reason: 'counterfeit' })).status, 409);

  const removed = await admin.patch(`/admin/items/${nuptse._id}`, { action: 'remove', reason: 'Counterfeit or fake brand' });
  assert.equal(removed.status, 200);
  assert.equal((await new Client().get(`/items/${nuptse._id}`)).status, 404, 'removed listing hidden from public');
  assert.equal((await admin.patch(`/admin/items/${nuptse._id}`, { action: 'restore' })).status, 200);

  const reserved = (await admin.get('/admin/items?status=reserved')).data.items[0];
  assert.equal((await admin.patch(`/admin/items/${reserved._id}`, { action: 'remove', reason: 'x' })).status, 409, 'items in an agreed swap cannot be removed');

  const disputes = await admin.get('/admin/swaps?disputes=true');
  const open = disputes.data.swaps.find((s) => s.dispute?.status === 'open');
  assert.ok(open);
  const res = await admin.post(`/admin/swaps/${open._id}/resolve`, { outcome: 'cancelled', resolution: 'Reversed — tear confirmed from photos.' });
  assert.equal(res.status, 200);
  assert.equal(res.data.status, 'cancelled');

  const csv = await fetch(`${base}/api/admin/export/swaps`, { headers: { Cookie: admin.cookie } });
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /^id,status,requester/);
});

test('suspended members cannot log in', async () => {
  const users = await admin.get('/admin/users?q=test@example.com');
  const u = users.data.users[0];
  assert.equal((await admin.patch(`/admin/users/${u._id}`, { status: 'suspended', reason: 'Testing' })).status, 200);
  const login = await new Client().post('/auth/login', { email: 'test@example.com', password: 'Passw0rd!' });
  assert.equal(login.status, 403);
  assert.equal((await newUser.get('/auth/me')).data.user, null, 'existing session invalidated');
  assert.equal((await newUser.get('/users/me/dashboard')).status, 401);
});
