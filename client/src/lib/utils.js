import { CATEGORIES, CONDITIONS, GENDERS, SWAP_STATUS, BRAND_TIERS } from '@shared/catalog.js';

export { formatINR } from '@shared/catalog.js';
export { formatDistance } from '@shared/places.js';

export const catLabel = (k) => CATEGORIES.find((c) => c.key === k)?.label || k;
export const condLabel = (k) => CONDITIONS.find((c) => c.key === k)?.label || k;
export const condShort = (k) => CONDITIONS.find((c) => c.key === k)?.short || k;
export const genderLabel = (k) => GENDERS.find((g) => g.key === k)?.label || k;
export const tierLabel = (k) => BRAND_TIERS[k]?.label || k;
export const swapStatus = (s) => SWAP_STATUS[s] || { label: s, tone: 'muted' };

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

export function timeAgo(date) {
  if (!date) return '';
  const s = Math.round((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.round(f / 60)} min`;
    if (f < 86400) return `in ${Math.round(f / 3600)} h`;
    return `in ${Math.round(f / 86400)} days`;
  }
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: s > 300 * 86400 ? 'numeric' : undefined });
}

export const dateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';

export const plural = (n, word, pluralWord) => `${n} ${n === 1 ? word : pluralWord || `${word}s`}`;

export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN');
