# ReThread — Product Requirements Document

| | |
|---|---|
| **Product** | ReThread — Clothing Exchange & Swap Marketplace |
| **Programme** | Unified Mentor · Web Development Internship |
| **Author** | Lakshay Pandit |
| **Version / date** | 1.0 · October 2026 |
| **Status** | Phase 1 built, tested and live |
| **Live site** | <https://rethread-ten.vercel.app> |

---

## 1. Summary

ReThread is a web marketplace where people **swap clothes instead of buying new ones**. Members list garments they no longer wear, discover items from people nearby, send swap requests (one-to-three items per side), negotiate through counter-offers and chat, and complete the exchange through a local meetup or a tracked courier. A transparent **Swap Value Calculator** keeps trades fair, and **location-based matching** surfaces good swaps within a few kilometres. An **admin panel** gives moderators analytics, user and listing management, swap monitoring and dispute resolution.

## 2. Background & problem

Fast fashion has sharply increased clothing consumption. India alone accumulates up to **7,800 kilotonnes of textile waste a year — about 8.5% of the global total — and roughly half of it is post-consumer** (Fashion for Good, *Wealth in Waste*, 2022). Many wearable garments sit unused because selling or donating them is inconvenient.

| Problem (from the brief) | How ReThread addresses it |
|---|---|
| People have unused clothes but no easy way to exchange them | Two-minute listing with photo compression and auto-valuation |
| E-commerce focuses only on buying and selling | Item-for-item barter; no payments, prices or wallets anywhere |
| Resale pricing is complicated | Rule-based value estimate with a visible breakdown and a ±25% fair band |
| Few platforms are dedicated to swapping | Swap-first flows: request, counter-offer, agreement, fulfilment, rating |
| Sustainable options are limited | Nearby matching, meetups, and impact tracking (kg kept in use, CO₂e, water) |

### 2.1 Competitive research

| Platform | Model | What we borrow | Gap ReThread fills |
|---|---|---|---|
| **Depop** | Social resale app | Profile-as-closet, likes, direct messages | Money-based; no barter |
| **Poshmark** | Resale + offers | Offer/counter-offer negotiation | Pricing friction; seller fees |
| **Swap.com** | Consignment resale | Condition grading, catalogue filters | Not peer-to-peer swapping |
| **This For That (Gurugram, 2019)** | Credit-based swapping, curation team | Indian context, quality checks, courier slabs | Credits act like money; no local matching |
| **Vinted** | Peer-to-peer resale | Size/brand filters, buyer protection | Swap feature limited; no fairness engine |

**Insight:** no mainstream product combines (a) direct item-for-item swaps, (b) an objective fairness signal, and (c) neighbourhood matching — the three things that make swapping feel safe and worthwhile.

## 3. Goals & objectives

**Primary (from the brief)**
1. A marketplace dedicated to clothing exchange.
2. Direct swaps without monetary transactions.
3. Encourage sustainable fashion practices.
4. Location-based swap matching.

**Secondary**
5. Negotiation before finalising swaps (counter-offers + chat).
6. Estimated swap value calculation.
7. Filters by category and location.
8. Courier support for remote swaps (partner + tracking + cost estimate).
9. Community around sustainable fashion (profiles, reviews, impact).

**Non-goals (Phase 1, as per brief):** online payments, AI recommendations, AR try-on, native mobile apps.

## 4. Users & personas

| Persona | Needs | Key features |
|---|---|---|
| **Aanya, 20, DU student (Delhi)** — budget-conscious, loves thrifting | Refresh wardrobe for free; meet near metro | Browse + distance filter, fair matches, meetup planner |
| **Kabir, 29, professional** — wedding-season outfits worn once | Rehome expensive ethnic wear fairly | Value calculator, counter-offers, ratings |
| **Priya, 34, parent (Dwarka)** — kids outgrow clothes fast | Swap kidswear bundles locally | Kids category, nearby suggestions |
| **Meera, 31, frequent traveller** | Remote swaps | Courier option, tracking numbers |
| **Platform admin** | Keep the community safe and measure growth | Analytics, moderation, disputes, exports |

## 5. Scope (Phase 1)

In scope and implemented: registration/login · profiles · clothing listings · browsing & filters · swap requests · negotiation (counter-offers + chat) · swap value calculator · location-based suggestions & map · fulfilment (meetup / courier) · ratings · reports · disputes · notifications · admin panel with analytics and CSV reports.

## 6. Functional requirements

### 6.1 User module
| ID | Requirement | Status |
|---|---|---|
| U1 | Register with name, email, password (≥ 8 chars, letter + number), neighbourhood (list or GPS) | ✅ |
| U2 | Log in / log out; session in httpOnly cookie (7 days) | ✅ |
| U3 | Profile: name, bio, private phone, sizes (top/waist/footwear), wishlist categories, location | ✅ |
| U4 | Public profile: closet, swaps completed, kg kept in use, reviews | ✅ |
| U5 | Wishlist (save items) | ✅ |
| U6 | Swap history with statuses | ✅ |

### 6.2 Clothing listing module
| ID | Requirement | Status |
|---|---|---|
| L1 | Upload 1–5 photos (JPG/PNG/WebP, compressed in browser to ≤ 1200 px, server checks magic bytes, 2 MB cap) | ✅ |
| L2 | Details: title, category (23), gender, size (context-aware), brand, condition (4 levels), colour, material, age, MRP, description | ✅ |
| L3 | Estimated swap value + owner adjustment within ±25% | ✅ |
| L4 | Availability status: available → reserved → swapped (or removed) | ✅ |
| L5 | Edit / remove own listings (blocked while in an agreed swap) | ✅ |
| L6 | “Looking for” categories to improve matching | ✅ |

### 6.3 Swap request module
| ID | Requirement | Status |
|---|---|---|
| S1 | Request 1–3 items from one member, offering 1–3 of your own | ✅ |
| S2 | Incoming / sent / history views with “your move” indicators | ✅ |
| S3 | Accept, decline (with reason), or counter-offer (change items on either side); up to 12 rounds | ✅ |
| S4 | Accepting = swap agreement; all items reserved atomically; other open requests for those items auto-closed | ✅ |
| S5 | Fulfilment: meetup (place + future date/time) or courier (partner + AWB, tracking link, cost estimate) | ✅ |
| S6 | Both members confirm receipt → completed; items marked swapped; stats & impact updated | ✅ |
| S7 | Cancel before items move; dispute after agreement | ✅ |
| S8 | Ratings (1–5 stars + comment), one per member per swap | ✅ |
| S9 | Timeline of every status change | ✅ |

### 6.4 Negotiation chat module
| ID | Requirement | Status |
|---|---|---|
| C1 | One thread per pair of members, started from a listing, profile or swap | ✅ |
| C2 | Offer cards and system messages for every swap event inside the chat | ✅ |
| C3 | Real-time delivery & typing indicator (Socket.io); automatic polling fallback on serverless hosts | ✅ |
| C4 | Unread counts (navbar badge + per thread), read receipts on open | ✅ |
| C5 | Swap context bar with status and “View swap” link | ✅ |
| C6 | Safety nudge if someone mentions UPI/bank details | ✅ |

### 6.5 Swap value calculator
| ID | Requirement | Status |
|---|---|---|
| V1 | Estimate from brand, condition, category (+ optional MRP and age) | ✅ |
| V2 | Show value breakdown | ✅ |
| V3 | Suggest fair matches (single items or pairs from your closet) | ✅ |
| V4 | Two-sided value comparison with fairness meter | ✅ |
| V5 | Public calculator page and `POST /api/valuation/estimate` | ✅ |

### 6.6 Location-based matching
| ID | Requirement | Status |
|---|---|---|
| G1 | Show nearby members on a map (approximate ~1 km pins for privacy) | ✅ |
| G2 | Filter listings by city and by distance radius; sort by nearest | ✅ |
| G3 | Suggested nearby swaps ranked by value, distance and fit | ✅ |
| G4 | Distance on every card for logged-in members | ✅ |

### 6.7 Admin module
| ID | Requirement | Status |
|---|---|---|
| A1 | Manage users: search, filter, suspend (with reason, closes open requests), reactivate | ✅ |
| A2 | Manage listings: search, filter (reported/status), remove with reason, restore | ✅ |
| A3 | Monitor swap activity with filters | ✅ |
| A4 | Review reports: remove listing, suspend member, warn, dismiss | ✅ |
| A5 | Resolve disputes: reverse (release items) or mark completed, with a note to both members | ✅ |
| A6 | Analytics: KPIs, 12-week activity, funnel, categories, cities, top swappers, impact | ✅ |
| A7 | Reports: CSV export of users, items, swaps | ✅ |

## 7. Non-functional requirements

| Area | Implementation |
|---|---|
| **Secure authentication** | bcrypt (cost 10) · JWT in httpOnly, SameSite=Lax, Secure (prod) cookie · suspended users rejected on every request · auth rate limit 30 / 15 min |
| **Input validation** | Zod schemas on every write endpoint; mirrored client-side validation with inline errors |
| **Injection & XSS** | `$`/dotted keys stripped from input; regex-escaped search; React escaping; Helmet CSP; CSV formula-injection guard |
| **Privacy** | Exact coordinates never returned — only area name, distance and ~1 km rounded map pins; phone numbers private; chats only visible to participants |
| **Performance** | 2dsphere + compound indexes; `$geoNear` aggregation with facet pagination; code-split routes; immutable image caching; gzip |
| **Responsive** | Mobile-first Tailwind layout, tested at 390 px and 1440 px |
| **Scalability** | Stateless API (JWT), works as serverless functions or a long-running server; connection pooling; images stored in MongoDB for zero extra services |
| **Accessibility** | Semantic landmarks, labelled controls, focus rings, `aria-pressed` on toggles, reduced-motion support, colour + text for every status |
| **Reliability** | Atomic reservation on accept; idempotent auto-seed with a lock for concurrent cold starts |

## 8. Swap value algorithm

```
reference retail = MRP (if given)  or  category reference price × brand price index
swap value       = reference retail × brand resale rate × condition multiplier × age multiplier
                   (rounded to ₹50; owner may adjust ±25%)
```

| Brand tier | Example brands | Price index | Resale rate |
|---|---|---|---|
| Luxury / Designer | Gucci, Sabyasachi, Anita Dongre | ×12 | 45% |
| Premium | Levi’s, Nike, Fabindia, Raymond | ×2 | 32% |
| High-street | Zara, H&M, Uniqlo, Biba, W | ×1 | 22% |
| Value | Roadster, Max, Decathlon | ×0.7 | 20% |
| Local / Unbranded | Handmade, market finds | ×0.6 | 20% |

Condition: New with tags ×1.45 · Like new ×1.2 · Good ×1.0 · Fair ×0.7. Age: < 1 yr ×1 · 1–2 yrs ×0.92 · 2–4 yrs ×0.82 · 4+ yrs ×0.72. Resale rates reflect published resale-to-retail ratios (fast fashion ≈ 17–23%, premium ≈ 27–45%, luxury ≈ 40–60%).

**Fairness** = min(A, B) ÷ max(A, B) → ≥ 90% *Excellent* · ≥ 75% *Fair* · ≥ 60% *Slightly uneven* · else *Uneven*.

**Fair matches** (item page): all single items and pairs from the viewer’s closet, ranked by fairness (≥ 60%).

**Nearby suggestions**: candidates within the radius (via `$geoNear`), filtered to the genders the member lists, scored `0.5·fairness + 0.3·proximity + 0.2·fit`, where fit = wishlist category (0.4) + owner wants your category (0.3) + in your size (0.3).

**Courier estimate**: Local (≤ 50 km) ₹70, Regional (≤ 500 km) ₹95, National ₹125 for the first 0.5 kg, plus ₹35–55 per extra 0.5 kg (based on category weights).

## 9. Impact model

Each completed swap adds the received garments’ typical weight (e.g. T-shirt 0.2 kg, jeans 0.6 kg, lehenga 1.5 kg) to a member’s “kg kept in use”. CO₂e avoided = 25 kg per kg reused (INTEXTER–UPC, 2022); water saved ≈ 13,500 L per kg (WWF: ~2,700 L per 0.2 kg cotton T-shirt). Figures are labelled as estimates.

## 10. User flows

**Member:** Register → set neighbourhood → list items (calculator suggests value) → browse / nearby / suggestions → open item → see fair matches → request swap → negotiate (counter-offers + chat) → agreement (items reserved) → plan meetup or add courier tracking → both confirm receipt → rate → impact updates.

**Admin:** Log in → analytics overview → review reports (remove / suspend / warn / dismiss) → resolve disputes → moderate listings and users → export CSV reports.

### Swap state machine

```
pending ──accept──▶ accepted ──plan/ship──▶ in_progress ──both received──▶ completed
   │  ▲                 │                        │
counter│                cancel (nothing shipped)  dispute ──admin──▶ completed | cancelled
   ▼  │                 ▼                        ▼
countered            cancelled                disputed
   │
reject/withdraw ──▶ rejected / cancelled
```

## 11. Data model

| Collection | Key fields |
|---|---|
| **users** | name, email (unique), password (hash), role, status, phone (private), bio, location {city, area, point (2dsphere)}, sizes, preferences, favorites, rating {avg, count}, stats {swapsCompleted, kgDiverted}, lastActiveAt |
| **items** | owner, title, description, category, gender, size, brand, brandTier, condition, colour, material, age, originalPrice, estimatedValue, swapValue, lookingFor, images, location (2dsphere), status, moderation, views, favoritesCount |
| **swaps** | requester, recipient, offeredItems, requestedItems, offers[] (each round with values & fairness), awaiting, status, distanceKm, fulfillment {method, meetup, shipments, estimate}, received, ratings, dispute, timeline, conversation |
| **conversations** | participants, key (pair), item, swap, lastMessage, unread (per user) |
| **messages** | conversation, sender, type (text / offer / system), text, swap |
| **images** | owner, contentType, size, data (binary) |
| **reports** | reporter, targetType, item, user, reason, details, status, handledBy, note |
| **notifications** | user, type, title, body, link, read |

Sample clothing data fields required by the brief (item ID, type, brand, size, condition, estimated value, location) and sample user data (name, contact, location, swap history) are all present. The seed contains **24 members in 10 Indian cities, 65 live listings + 24 historical items, 33 swaps across every status, 92 messages, reports and a dispute**.

## 12. API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` |
| Items | `GET /api/items` (q, category, gender, size, condition, brand, city, min/maxValue, lat/lng, radiusKm, sort, page) · `GET/PATCH/DELETE /api/items/:id` · `POST /api/items` · `POST /api/items/:id/favorite` |
| Swaps | `POST /api/swaps` · `GET /api/swaps` · `GET /api/swaps/:id` · `POST /api/swaps/:id/{respond,cancel,fulfillment,ship,received,dispute,rate}` |
| Chat | `GET/POST /api/chat/conversations` · `GET /api/chat/conversations/:id` · `POST …/messages` · `POST …/read` · `GET /api/chat/unread` |
| Users | `PATCH /api/users/me` · `GET /api/users/me/{items,favorites,suggestions,dashboard}` · `GET /api/users/nearby` · `GET /api/users/:id` |
| Other | `POST /api/images` · `GET /api/images/:id` · `GET /api/meta` · `GET /api/stats` · `POST /api/valuation/estimate` · `GET /api/notifications` · `POST /api/reports` |
| Admin | `GET /api/admin/overview` · `GET/PATCH /api/admin/users` · `GET/PATCH /api/admin/items` · `GET /api/admin/swaps` · `POST /api/admin/swaps/:id/resolve` · `GET/PATCH /api/admin/reports` · `GET /api/admin/export/:type` |

## 13. KPIs (tracked live in the admin panel)

| KPI (brief) | Definition in ReThread |
|---|---|
| Number of clothing listings | Listings ever published (available + reserved + swapped); available shown separately |
| Number of successful swaps | Swaps with status *completed* |
| User engagement rate | Members active in the last 30 days who listed, swapped or chatted ÷ all members |
| Swap request conversion rate | Requests that reached agreement (accepted, in progress, completed, disputed) ÷ all requests; completion rate shown alongside |
| Active users | Members with activity in the last 30 days |
| Impact (extra) | kg of textiles kept in use, kg CO₂e avoided |

## 14. Pages (brief requires 6–8; ReThread ships 13)

Landing · Login/Register · Clothing listings (Browse) · Item detail · List/Edit item · Swap request · Swaps & swap detail · Chat · User dashboard · Nearby map · Value calculator · Profile & Settings · Admin panel.

## 15. Testing

* **Automated:** 11 end-to-end API tests (`npm test`) on an in-memory MongoDB with the full seed — auth & validation, injection attempt, role guards, listing bounds, geo search ordering, complete swap lifecycle with counter-offer and auto-cancellation of competing requests, chat privacy, suggestions, moderation, dispute resolution, CSV export, suspension.
* **UI:** every page rendered in Chromium at 1440 px and 390 px with zero console errors; screenshots in the submission.
* **Manual checklist:** register → list → request → counter → accept → meetup → receive → rate; admin removes a reported listing and resolves a dispute.

## 16. Assumptions & constraints

* Members upload accurate information; quality depends on members → reports, ratings and disputes mitigate.
* Swap fairness is ultimately agreed by members → the calculator is guidance, not enforcement.
* Courier costs are borne by members → estimates are shown before choosing courier; meetups are encouraged.
* Location uses curated neighbourhoods + browser GPS (no paid geocoding).

## 17. Future enhancements

AI-based swap recommendations and photo-based condition checks · native mobile app with push notifications · in-app courier booking via Shiprocket/Delhivery APIs · sustainability leaderboard and badges · community fashion groups and swap events · multi-party swap chains · Hindi and regional-language UI.

## 18. Deliverables

| Deliverable | Where |
|---|---|
| Fully functional Clothing Exchange Marketplace | Source code (this repository) |
| Listing & browsing, swap request & negotiation, location matching, admin panel | Implemented — see §6 |
| Live deployed application link | **<https://rethread-ten.vercel.app>** (Vercel, Mumbai + MongoDB Atlas) |
| Complete PRD document | This document |

### Sources
Fashion for Good, *Wealth in Waste: India’s Potential to Lead Circular Textile Sourcing* (2022) · INTEXTER–UPC, *Reusing 1 kg of clothing saves 25 kg of CO₂* (2022) · Closo, *Resale Price vs Original: Ratios by Category* (2026) · YourStory, *This For That* (2019) · Unified Mentor project brief.
