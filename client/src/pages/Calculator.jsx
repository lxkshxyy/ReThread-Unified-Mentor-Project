import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Scale } from 'lucide-react';
import clsx from 'clsx';
import { useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import ValuePanel from '@/components/ValuePanel';
import { FairnessMeter } from '@/components/ui';
import { CATEGORIES, CATEGORY_GROUPS, CONDITIONS, AGE_BUCKETS, BRAND_LIST, BRAND_TIERS, BRANDS, estimateValue } from '@shared/catalog.js';
import { formatINR } from '@/lib/utils';

const blank = { category: 'jacket', brand: "Levi's", condition: 'like_new', originalPrice: '', age: 'lt1' };

function ItemInputs({ value, onChange, compact }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className={clsx('grid gap-3', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2')}>
      <label className="block">
        <span className="label">Category</span>
        <select className="input" value={value.category} onChange={set('category')}>
          {CATEGORY_GROUPS.map((g) => <optgroup key={g} label={g}>{CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</optgroup>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Brand</span>
        <input className="input" list="calc-brands" value={value.brand} onChange={set('brand')} />
      </label>
      <label className="block">
        <span className="label">Condition</span>
        <select className="input" value={value.condition} onChange={set('condition')}>
          {CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Age</span>
        <select className="input" value={value.age} onChange={set('age')}>
          {AGE_BUCKETS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="label">Original price (MRP ₹) <span className="font-normal text-muted">optional</span></span>
        <input className="input" type="number" min="0" inputMode="numeric" placeholder="Leave blank to use a reference price" value={value.originalPrice} onChange={set('originalPrice')} />
      </label>
    </div>
  );
}

function Side({ title, list, setList }) {
  return (
    <div className="space-y-4">
      <p className="font-semibold">{title}</p>
      {list.map((it, i) => (
        <div key={i} className="rounded-2xl border border-line p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-medium">Item {i + 1} · <span className="text-moss">{formatINR(estimateValue(it)?.value)}</span></span>
            {list.length > 1 && <button className="text-muted hover:text-red-600" onClick={() => setList(list.filter((_, j) => j !== i))} aria-label="Remove item"><Trash2 className="h-4 w-4" /></button>}
          </div>
          <ItemInputs value={it} onChange={(v) => setList(list.map((x, j) => (j === i ? v : x)))} compact />
        </div>
      ))}
      {list.length < 3 && <button className="btn-ghost btn-sm" onClick={() => setList([...list, { ...blank }])}><Plus className="h-4 w-4" /> Add item</button>}
    </div>
  );
}

export default function Calculator() {
  useDocumentTitle('Swap value calculator');
  const { user } = useAuth();
  const [single, setSingle] = useState(blank);
  const [a, setA] = useState([{ ...blank }]);
  const [b, setB] = useState([{ category: 'footwear', brand: 'Nike', condition: 'good', originalPrice: '7495', age: '1to2' }]);
  const est = useMemo(() => estimateValue(single), [single]);
  const total = (list) => list.reduce((s, it) => s + (estimateValue(it)?.value || 0), 0);


  return (
    <div className="container-page py-8">
      <datalist id="calc-brands">{[...BRAND_LIST, 'Unbranded'].map((x) => <option key={x} value={x} />)}</datalist>
      <p className="eyebrow">Swap value calculator</p>
      <h1 className="mt-2 max-w-3xl text-4xl sm:text-5xl">What’s your piece worth in a swap?</h1>
      <p className="mt-3 max-w-2xl text-muted">
        A transparent estimate built from the item’s category, brand tier, condition and age, using typical second-hand resale ratios (fast fashion ≈ 20% of retail, premium ≈ 30%, luxury ≈ 45%). It’s a guide for fair swaps — no money ever changes hands.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="card p-6"><ItemInputs value={single} onChange={setSingle} /></div>
        <ValuePanel est={est} editable={false} />
      </div>

      <section className="mt-14">
        <h2 className="flex items-center gap-2 text-3xl"><Scale className="h-6 w-6 text-moss" /> Compare a swap</h2>
        <p className="mt-1 text-sm text-muted">Add up to three items on each side to see if a trade is balanced.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="card p-6"><Side title="Side A — what you give" list={a} setList={setA} /></div>
          <div className="card p-6"><Side title="Side B — what you get" list={b} setList={setB} /></div>
        </div>
        <div className="mx-auto mt-6 max-w-2xl"><FairnessMeter left={total(a)} right={total(b)} leftLabel="Side A" rightLabel="Side B" /></div>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-display text-2xl">The formula</h3>
          <p className="mt-3 rounded-xl bg-paper p-4 font-mono text-sm">value = reference retail × brand resale rate × condition × age</p>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li><b className="text-ink">Reference retail</b> — your MRP, or a typical high-street price for the category × the brand’s price index.</li>
            <li><b className="text-ink">Condition</b> — New with tags ×1.45 · Like new ×1.2 · Good ×1.0 · Fair ×0.7</li>
            <li><b className="text-ink">Age</b> — under 1 yr ×1 · 1–2 yrs ×0.92 · 2–4 yrs ×0.82 · 4+ yrs ×0.72</li>
            <li><b className="text-ink">Fair swap</b> — a value match of 75% or more. Owners may adjust ±25% from the estimate.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h3 className="font-display text-2xl">Brand tiers</h3>
          <div className="mt-3 space-y-3 text-sm">
            {Object.entries(BRAND_TIERS).map(([k, t]) => (
              <div key={k} className="border-b border-line pb-2">
                <div className="flex justify-between"><span className="font-semibold">{t.label}</span><span className="text-muted">{Math.round(t.resale * 100)}% resale · price ×{t.price}</span></div>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">{k === 'unbranded' ? 'Local, handmade or no label' : (BRANDS[k] || []).slice(0, 8).join(', ')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-10 text-center">
        <Link to={user ? '/items/new' : '/register'} className="btn-primary px-6 py-3">{user ? 'List an item with this value' : 'Join and start swapping'}</Link>
      </div>
    </div>
  );
}
