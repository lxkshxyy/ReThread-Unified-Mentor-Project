import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { Field, PageLoader } from '@/components/ui';
import ImageUploader from '@/components/ImageUploader';
import ValuePanel from '@/components/ValuePanel';
import {
  CATEGORIES, CATEGORY_GROUPS, CONDITIONS, GENDERS, AGE_BUCKETS, SIZES, BRAND_LIST, sizeGroupFor, estimateValue,
} from '@shared/catalog.js';

const EMPTY = {
  images: [], title: '', category: '', gender: '', size: '', brand: '', condition: '', color: '', material: '', age: 'lt1',
  originalPrice: '', description: '', lookingFor: [], swapValue: null,
};

export default function ListingForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  useDocumentTitle(editing ? 'Edit listing' : 'List an item');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!editing) return;
    api.get(`/items/${id}`).then(({ data }) => {
      if (!data.isOwner) {
        toast.error('You can only edit your own listings');
        return navigate(`/items/${id}`);
      }
      const it = data.item;
      setForm({ ...EMPTY, ...it, originalPrice: it.originalPrice || '', lookingFor: it.lookingFor || [] });
      setLoading(false);
    }).catch((err) => {
      toast.error(errorMessage(err));
      navigate('/dashboard');
    });
  }, [editing, id, navigate]);

  const est = useMemo(() => estimateValue(form), [form.category, form.brand, form.condition, form.originalPrice, form.age]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reset a manual value whenever the estimate inputs change and it falls out of range.
  useEffect(() => {
    if (est && form.swapValue != null && (form.swapValue < est.min || form.swapValue > est.max)) setForm((f) => ({ ...f, swapValue: null }));
  }, [est]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const sizeOptions = form.category ? SIZES[sizeGroupFor(form.category)] : [];

  const validate = () => {
    const e = {};
    if (form.images.length < 1) e.images = 'Add at least one photo';
    if (form.title.trim().length < 4) e.title = 'Give it a descriptive title (4+ characters)';
    if (!form.category) e.category = 'Choose a category';
    if (!form.gender) e.gender = 'Who is it for?';
    if (!form.size) e.size = 'Choose a size';
    if (!form.brand.trim()) e.brand = 'Enter the brand, or “Unbranded”';
    if (!form.condition) e.condition = 'Choose the condition';
    if (form.originalPrice && (Number(form.originalPrice) < 0 || Number(form.originalPrice) > 1000000)) e.originalPrice = 'Enter a realistic price';
    if (form.description.length > 1000) e.description = 'Keep it under 1000 characters';
    setErrors(e);
    if (Object.keys(e).length) {
      const first = document.querySelector(`[data-field="${Object.keys(e)[0]}"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return Object.keys(e).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    const payload = {
      title: form.title.trim(), description: form.description.trim(), category: form.category, gender: form.gender, size: form.size,
      brand: form.brand.trim(), condition: form.condition, color: form.color.trim(), material: form.material.trim(), age: form.age,
      originalPrice: form.originalPrice === '' ? null : Number(form.originalPrice), lookingFor: form.lookingFor, images: form.images,
      ...(form.swapValue != null ? { swapValue: form.swapValue } : {}),
    };
    try {
      const { data } = editing ? await api.patch(`/items/${id}`, payload) : await api.post('/items', payload);
      toast.success(editing ? 'Listing updated' : 'Your item is live! 🎉');
      navigate(`/items/${data.item._id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="container-page py-8">
      <p className="eyebrow">{editing ? 'Edit listing' : 'New listing'}</p>
      <h1 className="mt-2 text-4xl">{editing ? 'Update your item' : 'List something to swap'}</h1>
      <p className="mt-2 text-muted">Honest photos and details get 3× more swap requests.</p>
      {!user?.location?.coords && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Set your neighbourhood in <Link to="/settings" className="font-semibold underline">Settings</Link> first so people nearby can find your items.</p>
      )}

      <form onSubmit={submit} noValidate className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <section className="card space-y-5 p-6" data-field="images">
            <h2 className="font-display text-xl">Photos</h2>
            <ImageUploader value={form.images} onChange={(v) => set('images', v)} error={errors.images} />
          </section>

          <section className="card space-y-5 p-6">
            <h2 className="font-display text-xl">The basics</h2>
            <div data-field="title">
              <Field label="Title" htmlFor="title" error={errors.title} help="Brand + item + key detail, e.g. “Levi’s 511 slim jeans, dark wash”">
                <input id="title" className={clsx('input', errors.title && 'input-error')} maxLength={80} value={form.title} onChange={(e) => set('title', e.target.value)} />
              </Field>
            </div>
            <div data-field="category">
              <Field label="Category" htmlFor="category" error={errors.category}>
                <select id="category" className={clsx('input', errors.category && 'input-error')} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, size: '' }))}>
                  <option value="">Choose a category</option>
                  {CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g} label={g}>
                      {CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div data-field="gender">
                <Field label="For" error={errors.gender}>
                  <div className="flex flex-wrap gap-2">
                    {GENDERS.map((g) => (
                      <button type="button" key={g.key} onClick={() => set('gender', g.key)} className={clsx('chip px-4 py-2', form.gender === g.key && 'chip-active')} aria-pressed={form.gender === g.key}>{g.label}</button>
                    ))}
                  </div>
                </Field>
              </div>
              <div data-field="size">
                <Field label="Size" htmlFor="size" error={errors.size}>
                  <select id="size" className={clsx('input', errors.size && 'input-error')} value={form.size} disabled={!form.category} onChange={(e) => set('size', e.target.value)}>
                    <option value="">{form.category ? 'Choose size' : 'Pick a category first'}</option>
                    {sizeOptions.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div data-field="brand">
                <Field label="Brand" htmlFor="brand" error={errors.brand} help="Pick from the list or type your own">
                  <input id="brand" list="brands" className={clsx('input', errors.brand && 'input-error')} maxLength={40} value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="e.g. Fabindia" />
                  <datalist id="brands">{[...BRAND_LIST, 'Unbranded'].map((b) => <option key={b} value={b} />)}</datalist>
                </Field>
              </div>
              <Field label="Original price (MRP ₹)" htmlFor="mrp" optional error={errors.originalPrice} help="Improves the value estimate">
                <input id="mrp" type="number" inputMode="numeric" min="0" className="input" value={form.originalPrice} onChange={(e) => set('originalPrice', e.target.value)} placeholder="e.g. 2999" />
              </Field>
            </div>
          </section>

          <section className="card space-y-5 p-6" data-field="condition">
            <h2 className="font-display text-xl">Condition & details</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONDITIONS.map((c) => (
                <button type="button" key={c.key} onClick={() => set('condition', c.key)} className={clsx('rounded-xl border p-3.5 text-left transition', form.condition === c.key ? 'border-moss bg-moss-soft/50 ring-2 ring-moss/15' : 'border-line hover:border-ink/30')} aria-pressed={form.condition === c.key}>
                  <p className="text-sm font-semibold">{c.label}</p>
                  <p className="text-xs text-muted">{c.hint}</p>
                </button>
              ))}
            </div>
            {errors.condition && <p className="error-text">{errors.condition}</p>}
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Colour" htmlFor="color" optional>
                <input id="color" className="input" maxLength={30} value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="e.g. Indigo" />
              </Field>
              <Field label="Material" htmlFor="material" optional>
                <input id="material" className="input" maxLength={40} value={form.material} onChange={(e) => set('material', e.target.value)} placeholder="e.g. Cotton" />
              </Field>
              <Field label="How old is it?" htmlFor="age">
                <select id="age" className="input" value={form.age} onChange={(e) => set('age', e.target.value)}>
                  {AGE_BUCKETS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </Field>
            </div>
            <div data-field="description">
              <Field label="Description" htmlFor="desc" optional error={errors.description} help={`${form.description.length}/1000 · Fit, measurements, flaws, why you’re swapping it`}>
                <textarea id="desc" className="input min-h-[120px]" maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <div>
              <h2 className="font-display text-xl">What would you like in return?</h2>
              <p className="text-sm text-muted">Optional — helps us suggest better matches (up to 6).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = form.lookingFor.includes(c.key);
                return (
                  <button type="button" key={c.key} className={clsx('chip', on && 'chip-active')} aria-pressed={on} onClick={() => set('lookingFor', on ? form.lookingFor.filter((k) => k !== c.key) : form.lookingFor.length < 6 ? [...form.lookingFor, c.key] : form.lookingFor)}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <ValuePanel est={est} value={form.swapValue} onValue={(v) => set('swapValue', v)} />
          <button className="btn-primary mt-4 w-full py-3 text-base" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Publish listing'}
          </button>
          <p className="mt-3 text-center text-xs text-muted">By listing you confirm the item is yours, authentic and as described.</p>
        </aside>
      </form>
    </div>
  );
}
