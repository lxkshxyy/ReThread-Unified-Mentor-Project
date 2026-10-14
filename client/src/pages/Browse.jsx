import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { SlidersHorizontal, X, Search, MapPin, Shirt } from 'lucide-react';
import clsx from 'clsx';
import { api, errorMessage } from '@/lib/api';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import ItemCard, { ItemGridSkeleton } from '@/components/ItemCard';
import { EmptyState, ErrorState, Modal } from '@/components/ui';
import { CATEGORIES, CATEGORY_GROUPS, CONDITIONS, GENDERS } from '@shared/catalog.js';
import { CITIES } from '@shared/places.js';
import { catLabel, condLabel, genderLabel, fmtNum } from '@/lib/utils';

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '28', '30', '32', '34', 'UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'One size'];
const SORTS = [
  { key: 'newest', label: 'Newest first' },
  { key: 'nearest', label: 'Nearest to me' },
  { key: 'value_asc', label: 'Swap value: low to high' },
  { key: 'value_desc', label: 'Swap value: high to low' },
  { key: 'popular', label: 'Most saved' },
];
const RADII = [2, 5, 10, 25, 50];
const MULTI = ['category', 'gender', 'size', 'condition', 'city'];

function useFilters() {
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || '';
  const getList = (k) => (params.get(k) ? params.get(k).split(',') : []);
  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      const val = Array.isArray(v) ? v.join(',') : v;
      if (val === '' || val == null) next.delete(k);
      else next.set(k, val);
    });
    setParams(next, { replace: true });
  };
  const toggle = (k, v) => {
    const list = getList(k);
    update({ [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] });
  };
  return { params, get, getList, update, toggle, clear: () => setParams(new URLSearchParams(), { replace: true }) };
}

function FilterPanel({ f, user, geo, setGeo }) {
  const chip = (k, v, label) => (
    <button key={v} type="button" onClick={() => f.toggle(k, v)} className={clsx('chip', f.getList(k).includes(v) && 'chip-active')} aria-pressed={f.getList(k).includes(v)}>
      {label}
    </button>
  );
  const canRadius = Boolean(user?.location?.coords || geo);
  const askGeo = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setGeo([p.coords.longitude, p.coords.latitude]);
        f.update({ radiusKm: f.get('radiusKm') || 10, sort: 'nearest' });
      },
      () => {}
    );

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2.5 text-sm font-semibold">Distance</p>
        {canRadius ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => f.update({ radiusKm: '' })} className={clsx('chip', !f.get('radiusKm') && 'chip-active')}>Any</button>
            {RADII.map((r) => (
              <button key={r} type="button" onClick={() => f.update({ radiusKm: String(r) === f.get('radiusKm') ? '' : r })} className={clsx('chip', f.get('radiusKm') === String(r) && 'chip-active')}>
                {r} km
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className="chip" onClick={askGeo}><MapPin className="h-3.5 w-3.5" /> Use my location</button>
        )}
        {canRadius && <p className="help">{user?.location?.area ? `From ${user.location.area}, ${user.location.city}` : 'From your current location'}</p>}
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">Shopping for</p>
        <div className="flex flex-wrap gap-2">{GENDERS.map((g) => chip('gender', g.key, g.label))}</div>
      </div>
      {CATEGORY_GROUPS.map((group) => (
        <div key={group}>
          <p className="mb-2.5 text-sm font-semibold">{group}</p>
          <div className="flex flex-wrap gap-2">{CATEGORIES.filter((c) => c.group === group).map((c) => chip('category', c.key, c.label))}</div>
        </div>
      ))}
      <div>
        <p className="mb-2.5 text-sm font-semibold">Size</p>
        <div className="flex flex-wrap gap-2">{SIZE_OPTIONS.map((s) => chip('size', s, s))}</div>
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">Condition</p>
        <div className="flex flex-wrap gap-2">{CONDITIONS.map((c) => chip('condition', c.key, c.label))}</div>
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">Swap value (₹)</p>
        <div className="flex items-center gap-2">
          <input type="number" min="0" inputMode="numeric" placeholder="Min" className="input" value={f.get('minValue')} onChange={(e) => f.update({ minValue: e.target.value })} aria-label="Minimum swap value" />
          <span className="text-muted">–</span>
          <input type="number" min="0" inputMode="numeric" placeholder="Max" className="input" value={f.get('maxValue')} onChange={(e) => f.update({ maxValue: e.target.value })} aria-label="Maximum swap value" />
        </div>
      </div>
      <div>
        <p className="mb-2.5 text-sm font-semibold">City</p>
        <div className="flex flex-wrap gap-2">{CITIES.map((c) => chip('city', c, c))}</div>
      </div>
    </div>
  );
}

export default function Browse() {
  useDocumentTitle('Browse clothes');
  const { user } = useAuth();
  const f = useFilters();
  const [q, setQ] = useState(f.get('q'));
  const dq = useDebounced(q);
  const [geo, setGeo] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (dq !== f.get('q')) f.update({ q: dq });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);
  useEffect(() => setQ(f.get('q')), [f.params.get('q')]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = useMemo(() => {
    const p = Object.fromEntries(f.params.entries());
    if (geo && !user?.location?.coords && (p.radiusKm || p.sort === 'nearest')) {
      p.lng = geo[0];
      p.lat = geo[1];
    }
    return p;
  }, [f.params, geo, user]);

  const load = async (page = 1) => {
    page === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const { data } = await api.get('/items', { params: { ...query, page, limit: 24 } });
      setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
      setMeta({ total: data.total, page: data.page, pages: data.pages });
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(query)]);

  const active = [
    ...MULTI.flatMap((k) => f.getList(k).map((v) => ({ k, v, label: k === 'category' ? catLabel(v) : k === 'condition' ? condLabel(v) : k === 'gender' ? genderLabel(v) : v }))),
    ...(f.get('radiusKm') ? [{ k: 'radiusKm', v: '', label: `Within ${f.get('radiusKm')} km`, single: true }] : []),
    ...(f.get('minValue') || f.get('maxValue') ? [{ k: 'value', label: `₹${f.get('minValue') || 0} – ₹${f.get('maxValue') || '∞'}`, single: true }] : []),
  ];

  return (
    <div className="container-page py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Browse</p>
          <h1 className="mt-2 text-4xl">Clothes ready to swap</h1>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:w-72">
            <span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input rounded-full pl-10" placeholder="Search brand, colour, item…" />
          </label>
          <select className="input w-auto rounded-full pr-8" value={f.get('sort') || 'newest'} onChange={(e) => f.update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="Sort by">
            {SORTS.filter((s) => s.key !== 'nearest' || user?.location?.coords || geo).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <button className="btn-secondary lg:hidden" onClick={() => setDrawer(true)} aria-label="Filters">
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="thin-scroll sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            <FilterPanel f={f} user={user} geo={geo} setGeo={setGeo} />
          </div>
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-muted">{loading ? 'Searching…' : `${fmtNum(meta.total)} ${meta.total === 1 ? 'item' : 'items'}`}</span>
            {active.map((a) => (
              <button
                key={`${a.k}-${a.v}`}
                onClick={() => (a.k === 'value' ? f.update({ minValue: '', maxValue: '' }) : a.single ? f.update({ [a.k]: '' }) : f.toggle(a.k, a.v))}
                className="chip chip-active"
              >
                {a.label} <X className="h-3 w-3" />
              </button>
            ))}
            {(active.length > 0 || f.get('q')) && (
              <button onClick={() => { setQ(''); f.clear(); }} className="text-xs font-semibold text-muted underline-offset-2 hover:underline">
                Clear all
              </button>
            )}
          </div>

          {error ? (
            <ErrorState message={error} onRetry={() => load(1)} />
          ) : loading ? (
            <ItemGridSkeleton count={9} />
          ) : items.length === 0 ? (
            <EmptyState icon={Shirt} title="No matches yet" action={<button className="btn-secondary" onClick={() => { setQ(''); f.clear(); }}>Reset filters</button>}>
              Try widening the distance, removing a size, or searching a different brand. New pieces are listed every day.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
                {items.map((it) => <ItemCard key={it._id} item={it} />)}
              </div>
              {meta.page < meta.pages && (
                <div className="mt-10 text-center">
                  <button className="btn-secondary" disabled={loadingMore} onClick={() => load(meta.page + 1)}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
          {!user && !loading && (
            <p className="mt-10 text-center text-sm text-muted">
              <Link to="/register" className="link">Join ReThread</Link> to request swaps, chat and see distances from your area.
            </p>
          )}
        </div>
      </div>

      <Modal open={drawer} onClose={() => setDrawer(false)} title="Filters">
        <FilterPanel f={f} user={user} geo={geo} setGeo={setGeo} />
        <button className="btn-primary mt-6 w-full" onClick={() => setDrawer(false)}>Show {fmtNum(meta.total)} items</button>
      </Modal>
    </div>
  );
}
