# ReThread — Clothing Exchange & Swap Marketplace

> **Swap, don't shop.** A full-stack marketplace where people list clothes they no longer wear, find fair swaps nearby, negotiate in chat and exchange by meetup or courier — no money involved.

Built for the **Unified Mentor Web Development Internship** (project: *Clothing Exchange & Swap Marketplace*).

**🔗 Live site: <https://rethread-ten.vercel.app>** — works on phone and desktop. Log in with any demo account below (e.g. `aanya@rethread.in` / `Demo@1234`, admin `admin@rethread.in` / `Admin@1234`).

| | |
|---|---|
| **Frontend** | React 18 · Vite · Tailwind CSS · React Router · Framer Motion · Recharts · Leaflet (OpenStreetMap) |
| **Backend** | Node.js · Express · MongoDB (Mongoose) · Socket.io · Zod validation · JWT in httpOnly cookies |
| **Security** | bcrypt hashing · Helmet CSP · rate limiting · NoSQL-injection sanitiser · upload magic-byte checks · CSV-injection guard |
| **Deploy** | Vercel (serverless API + static client) or Render (single service with websockets) + MongoDB Atlas |

---

## Run it locally (no database install needed)

```bash
npm install                    # server deps
npm --prefix client install    # client deps
npm run dev                    # API on :5000 + React on :5173
```

Open **http://localhost:5173**. Without `MONGODB_URI` the API starts an **in-memory MongoDB** and seeds realistic demo data automatically (24 members across 10 Indian cities, 89 listings, 33 swaps, chats, reports and a dispute).

To use a real database: copy `.env.example` → `.env` and set `MONGODB_URI`. Run `npm run seed` to reset it to the demo data.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Member (Delhi, has an incoming request + a counter-offer waiting) | `aanya@rethread.in` | `Demo@1234` |
| Member (Delhi) | `rohan@rethread.in` | `Demo@1234` |
| Admin | `admin@rethread.in` | `Admin@1234` |

Every seeded member uses `firstname@rethread.in` / `Demo@1234`. The login page has one-click demo buttons.

### Tests

```bash
npm test     # 11 end-to-end API tests on an in-memory database
```

Covers registration/validation, login + NoSQL-injection attempt, role guards, listing CRUD with value bounds, geo search, the full swap lifecycle (request → counter → accept → meetup → received → rating), chat privacy, suggestions, moderation, dispute resolution, CSV export and suspension.

---

## Pages (13)

| Route | Page |
|---|---|
| `/` | Landing — hero, live community stats, categories, how it works, impact |
| `/login`, `/register` | Auth with validation, demo logins, neighbourhood picker (GPS or list) |
| `/browse` | Listings — search, category/size/condition/gender/city/value filters, distance radius, sort |
| `/items/:id` | Item detail — gallery, swap value + breakdown, **fair matches from your closet**, owner, report |
| `/items/new`, `/items/:id/edit` | Listing form — photo upload (client-side compression), live **swap value calculator** |
| `/swap/new?item=` | Swap request — pick up to 3 items each side, live fairness meter, meetup/courier |
| `/swaps`, `/swaps/:id` | Swap manager — accept / counter / decline, meetup planner, courier tracking, received, dispute, rating, timeline |
| `/chat`, `/chat/:id` | Negotiation chat — real-time (Socket.io) with polling fallback, swap context bar |
| `/dashboard` | User dashboard — KPIs, impact, needs-attention, nearby suggestions, listings, history, saved |
| `/nearby` | Location matching — map of nearby swappers, radius, suggested swaps |
| `/calculator` | Public swap value calculator + two-sided swap comparer |
| `/profile/:id`, `/settings` | Public closet + reviews; profile, sizes, wishlist categories, location |
| `/admin` | Admin panel — analytics & KPIs, users, listings moderation, swap monitor, disputes, reports, CSV exports |

## Key algorithms

**Swap value** = reference retail × brand resale rate × condition × age — see `shared/catalog.js` (used by both client and server so estimates always match). Owners can adjust ±25%.

**Fairness** = min(A, B) ÷ max(A, B). ≥ 90 % excellent · ≥ 75 % fair · ≥ 60 % slightly uneven.

**Nearby suggestions** = 0.5 × value fairness + 0.3 × proximity + 0.2 × fit (wishlist category, they want your category, your size), via MongoDB `$geoNear` on 2dsphere indexes.

## Deploy

Live on Vercel at **<https://rethread-ten.vercel.app>** (Mumbai region, MongoDB Atlas via the Vercel Marketplace). To host your own copy see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. Product requirements: **[docs/PRD.md](docs/PRD.md)**.

## Project structure

```
api/index.js            Vercel serverless entry (wraps the Express app)
server/src/app.js       Express app: security middleware, routes, static client
server/src/index.js     Long-running server + Socket.io
server/src/models/      User, Item, Swap, Conversation, Message, Image, Report, Notification
server/src/routes/      auth, items, swaps, chat, users, images, admin, misc (meta/stats/reports/notifications)
server/src/utils/       swap service, matching, realtime, serializers
server/src/seed/        realistic demo data + idempotent auto-seed
server/tests/           end-to-end API tests (node:test)
shared/                 catalogue + value engine, places & distance, photo map (used by client and server)
client/src/             React app (pages, components, context, lib)
docs/                   PRD and deployment guide
```

Product photos: Unsplash contributors (Unsplash License). Impact factors: Fashion for Good “Wealth in Waste” (2022), INTEXTER–UPC (2022), WWF.
