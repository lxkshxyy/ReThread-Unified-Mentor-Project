// Shared domain catalogue + swap-value engine.
// Imported by BOTH the Express API (server/src) and the React client (client/src)
// so the estimate a user sees while listing is exactly what the server stores.

export const CATEGORIES = [
  // key, label, group, ref = typical new retail price (INR) for a mid-tier brand, kg = avg garment weight
  { key: 'tshirt', label: 'T-Shirt / Polo', group: 'Tops', ref: 900, kg: 0.2 },
  { key: 'shirt', label: 'Shirt', group: 'Tops', ref: 1600, kg: 0.25 },
  { key: 'top', label: 'Top / Blouse', group: 'Tops', ref: 1300, kg: 0.2 },
  { key: 'sweater', label: 'Sweater / Cardigan', group: 'Tops', ref: 2200, kg: 0.5 },
  { key: 'hoodie', label: 'Hoodie / Sweatshirt', group: 'Tops', ref: 2000, kg: 0.6 },
  { key: 'jacket', label: 'Jacket', group: 'Outerwear', ref: 3500, kg: 0.9 },
  { key: 'coat', label: 'Coat / Trench', group: 'Outerwear', ref: 5000, kg: 1.2 },
  { key: 'blazer', label: 'Blazer / Suit', group: 'Outerwear', ref: 5500, kg: 0.8 },
  { key: 'jeans', label: 'Jeans', group: 'Bottoms', ref: 2400, kg: 0.6 },
  { key: 'trousers', label: 'Trousers / Chinos', group: 'Bottoms', ref: 1900, kg: 0.5 },
  { key: 'shorts', label: 'Shorts', group: 'Bottoms', ref: 1000, kg: 0.25 },
  { key: 'skirt', label: 'Skirt', group: 'Bottoms', ref: 1500, kg: 0.3 },
  { key: 'dress', label: 'Dress', group: 'Dresses', ref: 2600, kg: 0.35 },
  { key: 'jumpsuit', label: 'Jumpsuit / Co-ord', group: 'Dresses', ref: 2500, kg: 0.45 },
  { key: 'kurta', label: 'Kurta / Kurti', group: 'Ethnic', ref: 1800, kg: 0.3 },
  { key: 'ethnic_set', label: 'Ethnic Set / Anarkali', group: 'Ethnic', ref: 3800, kg: 0.7 },
  { key: 'saree', label: 'Saree', group: 'Ethnic', ref: 4500, kg: 0.6 },
  { key: 'lehenga', label: 'Lehenga', group: 'Ethnic', ref: 12000, kg: 1.5 },
  { key: 'dupatta', label: 'Dupatta / Stole', group: 'Ethnic', ref: 900, kg: 0.15 },
  { key: 'footwear', label: 'Footwear', group: 'Footwear & Bags', ref: 3500, kg: 0.9 },
  { key: 'bag', label: 'Bag', group: 'Footwear & Bags', ref: 3000, kg: 0.6 },
  { key: 'accessory', label: 'Accessory', group: 'Footwear & Bags', ref: 800, kg: 0.1 },
  { key: 'kidswear', label: 'Kidswear', group: 'Kids', ref: 900, kg: 0.2 },
];

export const CATEGORY_GROUPS = [...new Set(CATEGORIES.map((c) => c.group))];

export const GENDERS = [
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'unisex', label: 'Unisex' },
  { key: 'kids', label: 'Kids' },
];

// Condition multipliers are relative to "Good"; see docs/PRD.md §8 for rationale.
export const CONDITIONS = [
  { key: 'new_with_tags', label: 'New with tags', short: 'NWT', mult: 1.45, hint: 'Never worn, original tags attached' },
  { key: 'like_new', label: 'Like new', short: 'Like new', mult: 1.2, hint: 'Worn once or twice, no visible wear' },
  { key: 'good', label: 'Good', short: 'Good', mult: 1.0, hint: 'Gently used, light signs of wear' },
  { key: 'fair', label: 'Fair', short: 'Fair', mult: 0.7, hint: 'Visible wear or small flaw, fully wearable' },
];

// Brand tiers. price = how expensive vs a mid-tier brand; resale = share of retail
// typically recovered in second-hand markets (fast fashion ≈ 17–23%, premium ≈ 27–45%, luxury ≈ 40–60%).
export const BRAND_TIERS = {
  luxury: { label: 'Luxury / Designer', price: 12, resale: 0.45 },
  premium: { label: 'Premium', price: 2, resale: 0.32 },
  mid: { label: 'High-street', price: 1, resale: 0.22 },
  value: { label: 'Value', price: 0.7, resale: 0.2 },
  unbranded: { label: 'Local / Unbranded', price: 0.6, resale: 0.2 },
};

export const BRANDS = {
  luxury: ['Gucci', 'Prada', 'Louis Vuitton', 'Burberry', 'Coach', 'Michael Kors', 'Sabyasachi', 'Manish Malhotra', 'Anita Dongre', 'Ritu Kumar', 'Tarun Tahiliani'],
  premium: ["Levi's", 'Tommy Hilfiger', 'Calvin Klein', 'Ralph Lauren', 'Hugo Boss', 'Lacoste', 'Diesel', 'Nike', 'Adidas', 'The North Face', 'Columbia', 'Under Armour', 'Raymond', 'Louis Philippe', 'Fabindia', 'Jaypore', 'AND', 'Superdry', 'Steve Madden', 'Hidesign', 'Nalli', 'Kalki Fashion'],
  mid: ['Zara', 'H&M', 'Mango', 'Uniqlo', 'Marks & Spencer', 'Allen Solly', 'Van Heusen', 'Peter England', 'W', 'Biba', 'Global Desi', 'Manyavar', 'Puma', 'Arrow', 'U.S. Polo Assn.', 'Jack & Jones', 'Only', 'Vero Moda', 'Skechers', 'Woodland', 'Forever New', 'Lavie', 'Soch', 'Aurelia'],
  value: ['Roadster', 'Max', 'Pantaloons', 'Westside', 'Decathlon', 'Bata', 'Trends', 'Libas', 'HRX', 'Campus', 'Anouk', 'Here&Now', 'FirstCry', 'Hopscotch'],
};

export const BRAND_LIST = Object.values(BRANDS).flat().sort((a, b) => a.localeCompare(b));

export const AGE_BUCKETS = [
  { key: 'lt1', label: 'Less than 1 year', mult: 1 },
  { key: '1to2', label: '1–2 years', mult: 0.92 },
  { key: '2to4', label: '2–4 years', mult: 0.82 },
  { key: 'gt4', label: '4+ years', mult: 0.72 },
];

export const SIZES = {
  apparel: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free size'],
  waist: ['26', '28', '30', '32', '34', '36', '38', '40'],
  footwear: ['UK 3', 'UK 4', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  kids: ['0–1 yr', '1–2 yrs', '2–3 yrs', '3–4 yrs', '4–6 yrs', '6–8 yrs', '8–10 yrs', '10–12 yrs'],
  onesize: ['One size'],
};

export function sizeGroupFor(category) {
  if (category === 'footwear') return 'footwear';
  if (category === 'jeans' || category === 'trousers') return 'waist';
  if (category === 'kidswear') return 'kids';
  if (['bag', 'accessory', 'dupatta', 'saree'].includes(category)) return 'onesize';
  return 'apparel';
}

export const COURIERS = [
  { key: 'delhivery', label: 'Delhivery', track: 'https://www.delhivery.com/track/package/' },
  { key: 'shiprocket', label: 'Shiprocket', track: 'https://shiprocket.co/tracking/' },
  { key: 'indiapost', label: 'India Post (Speed Post)', track: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx' },
  { key: 'bluedart', label: 'Blue Dart', track: 'https://www.bluedart.com/tracking' },
  { key: 'dtdc', label: 'DTDC', track: 'https://www.dtdc.in/tracking.asp' },
];

export const REPORT_REASONS = [
  { key: 'counterfeit', label: 'Counterfeit / fake brand' },
  { key: 'misleading', label: 'Misleading photos or description' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'selling', label: 'Asking for money (not a swap)' },
  { key: 'spam', label: 'Spam or duplicate listing' },
  { key: 'harassment', label: 'Harassment or abusive behaviour' },
  { key: 'other', label: 'Something else' },
];

export const DISPUTE_REASONS = [
  { key: 'not_received', label: 'Item not received' },
  { key: 'not_as_described', label: 'Item not as described' },
  { key: 'damaged', label: 'Item arrived damaged' },
  { key: 'no_show', label: 'Other person did not show up' },
  { key: 'other', label: 'Other' },
];

const norm = (s = '') => s.toString().trim().toLowerCase();

export function brandTier(brand) {
  const b = norm(brand);
  if (!b || b === 'unbranded' || b === 'local' || b === 'handmade') return 'unbranded';
  for (const [tier, list] of Object.entries(BRANDS)) {
    if (list.some((x) => norm(x) === b)) return tier;
  }
  return 'mid'; // unknown brands are treated as high-street
}

export const categoryByKey = (k) => CATEGORIES.find((c) => c.key === k);
export const conditionByKey = (k) => CONDITIONS.find((c) => c.key === k);

const roundTo = (n, step = 50) => Math.max(step * 2, Math.round(n / step) * step);

/**
 * Swap Value Calculator.
 * value = referenceRetail × brandResaleRate × conditionMultiplier × ageMultiplier
 * referenceRetail = user-entered MRP, or category reference price × brand price index.
 */
export function estimateValue({ category, brand, condition, originalPrice, age } = {}) {
  const cat = categoryByKey(category);
  const cond = conditionByKey(condition);
  if (!cat || !cond) return null;
  const tierKey = brandTier(brand);
  const tier = BRAND_TIERS[tierKey];
  const ageB = AGE_BUCKETS.find((a) => a.key === age) || AGE_BUCKETS[0];
  const mrp = Number(originalPrice) > 0 ? Number(originalPrice) : null;
  const retail = mrp ?? cat.ref * tier.price;
  const raw = retail * tier.resale * cond.mult * ageB.mult;
  const value = roundTo(raw);
  return {
    value,
    min: roundTo(value * 0.75),
    max: roundTo(value * 1.25),
    tier: tierKey,
    breakdown: [
      { label: mrp ? 'Original price (MRP)' : `Reference retail · ${cat.label} × ${tier.label}`, value: `₹${Math.round(retail).toLocaleString('en-IN')}` },
      { label: `Brand resale rate · ${tier.label}`, value: `${Math.round(tier.resale * 100)}%` },
      { label: `Condition · ${cond.label}`, value: `×${cond.mult}` },
      { label: `Age · ${ageB.label}`, value: `×${ageB.mult}` },
    ],
  };
}

export function fairness(a, b) {
  const x = Number(a) || 0;
  const y = Number(b) || 0;
  if (!x || !y) return 0;
  return Math.round((Math.min(x, y) / Math.max(x, y)) * 100);
}

export function fairnessLabel(score) {
  if (score >= 90) return { label: 'Excellent match', tone: 'good' };
  if (score >= 75) return { label: 'Fair swap', tone: 'good' };
  if (score >= 60) return { label: 'Slightly uneven', tone: 'warn' };
  return { label: 'Uneven', tone: 'bad' };
}

// Rough courier cost for a domestic parcel (INR), by distance zone and weight.
export function shippingEstimate(distanceKm, weightKg = 0.5) {
  const slabs = Math.max(1, Math.ceil(weightKg / 0.5));
  let base = 70, perSlab = 35, zone = 'Local';
  if (distanceKm > 50) { base = 95; perSlab = 45; zone = 'Regional'; }
  if (distanceKm > 500) { base = 125; perSlab = 55; zone = 'National'; }
  return { zone, amount: base + perSlab * (slabs - 1) };
}

// Impact factors (see PRD §9): 25 kg CO2e avoided per kg reused (INTEXTER/UPC 2022),
// ~2,700 L water per cotton T-shirt (≈0.2 kg) → 13,500 L/kg.
export const IMPACT = { co2PerKg: 25, waterPerKg: 13500 };

export function impactFor(categories = []) {
  const kg = categories.reduce((s, c) => s + (categoryByKey(c)?.kg || 0.3), 0);
  return {
    kg: Math.round(kg * 10) / 10,
    co2: Math.round(kg * IMPACT.co2PerKg),
    water: Math.round(kg * IMPACT.waterPerKg),
  };
}

export const SWAP_STATUS = {
  pending: { label: 'Awaiting response', tone: 'warn' },
  countered: { label: 'Counter-offer', tone: 'warn' },
  accepted: { label: 'Agreed', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'good' },
  rejected: { label: 'Declined', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  disputed: { label: 'Disputed', tone: 'bad' },
};

export const ACTIVE_SWAP_STATUSES = ['pending', 'countered', 'accepted', 'in_progress', 'disputed'];

export const formatINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
