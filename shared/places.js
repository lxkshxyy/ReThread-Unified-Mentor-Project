// Neighbourhood presets used for location-based matching (no paid geocoding API needed).
// Coordinates are [lng, lat] (GeoJSON order).
export const PLACES = [
  // Delhi NCR
  { city: 'Delhi', area: 'Hauz Khas', coords: [77.2001, 28.5494] },
  { city: 'Delhi', area: 'Lajpat Nagar', coords: [77.2433, 28.5677] },
  { city: 'Delhi', area: 'Saket', coords: [77.2066, 28.5245] },
  { city: 'Delhi', area: 'Rajouri Garden', coords: [77.1209, 28.6415] },
  { city: 'Delhi', area: 'Dwarka', coords: [77.046, 28.5921] },
  { city: 'Delhi', area: 'Karol Bagh', coords: [77.1909, 28.6519] },
  { city: 'Delhi', area: 'Laxmi Nagar', coords: [77.2773, 28.6304] },
  { city: 'Delhi', area: 'Pitampura', coords: [77.1322, 28.7033] },
  { city: 'Delhi', area: 'North Campus (DU)', coords: [77.2090, 28.6880] },
  { city: 'Noida', area: 'Sector 18', coords: [77.3261, 28.5708] },
  { city: 'Gurugram', area: 'DLF Phase 3', coords: [77.0869, 28.4949] },
  // Mumbai
  { city: 'Mumbai', area: 'Bandra West', coords: [72.8295, 19.0596] },
  { city: 'Mumbai', area: 'Andheri West', coords: [72.8296, 19.1364] },
  { city: 'Mumbai', area: 'Powai', coords: [72.906, 19.1176] },
  { city: 'Mumbai', area: 'Dadar', coords: [72.8478, 19.0178] },
  { city: 'Thane', area: 'Thane West', coords: [72.9781, 19.2183] },
  // Bengaluru
  { city: 'Bengaluru', area: 'Indiranagar', coords: [77.6412, 12.9719] },
  { city: 'Bengaluru', area: 'Koramangala', coords: [77.6245, 12.9352] },
  { city: 'Bengaluru', area: 'HSR Layout', coords: [77.6474, 12.9116] },
  { city: 'Bengaluru', area: 'Whitefield', coords: [77.75, 12.9698] },
  { city: 'Bengaluru', area: 'Jayanagar', coords: [77.5838, 12.9308] },
  // Pune
  { city: 'Pune', area: 'Kothrud', coords: [73.8077, 18.5074] },
  { city: 'Pune', area: 'Baner', coords: [73.7868, 18.559] },
  { city: 'Pune', area: 'Viman Nagar', coords: [73.9143, 18.5679] },
  // Hyderabad
  { city: 'Hyderabad', area: 'Banjara Hills', coords: [78.4347, 17.4156] },
  { city: 'Hyderabad', area: 'Gachibowli', coords: [78.3489, 17.4401] },
  // Chennai
  { city: 'Chennai', area: 'T. Nagar', coords: [80.2341, 13.0418] },
  { city: 'Chennai', area: 'Adyar', coords: [80.2565, 13.0012] },
  // Kolkata
  { city: 'Kolkata', area: 'Salt Lake', coords: [88.4171, 22.5867] },
  { city: 'Kolkata', area: 'Park Street', coords: [88.352, 22.5535] },
  // Others
  { city: 'Jaipur', area: 'Malviya Nagar', coords: [75.8243, 26.8549] },
  { city: 'Jaipur', area: 'C-Scheme', coords: [75.7873, 26.9124] },
  { city: 'Chandigarh', area: 'Sector 17', coords: [76.7827, 30.7398] },
  { city: 'Ahmedabad', area: 'Navrangpura', coords: [72.5611, 23.0365] },
  { city: 'Lucknow', area: 'Gomti Nagar', coords: [81.0, 26.85] },
];

export const CITIES = [...new Set(PLACES.map((p) => p.city))];

export const findPlace = (city, area) => PLACES.find((p) => p.city === city && p.area === area);

// Haversine distance in km between two [lng, lat] pairs.
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 10) / 10;
}

export function formatDistance(km) {
  if (km == null) return '';
  if (km < 1) return `${Math.max(100, Math.round(km * 1000 / 100) * 100)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}
