import { useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { Field } from '@/components/ui';
import LocationPicker from '@/components/LocationPicker';
import { CATEGORIES, SIZES } from '@shared/catalog.js';

export default function Settings() {
  useDocumentTitle('Settings');
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name,
    bio: user.bio || '',
    phone: '',
    city: user.location?.city || '',
    area: user.location?.area || '',
    coords: undefined,
    sizes: { top: user.sizes?.top || '', bottom: user.sizes?.bottom || '', footwear: user.sizes?.footwear || '' },
    preferences: user.preferences || [],
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your name';
    if (form.phone && !/^(\+91[ -]?)?[6-9]\d{9}$/.test(form.phone.trim())) errs.phone = 'Enter a valid 10-digit Indian mobile number';
    if (!form.city || !form.area) errs.location = 'Choose your city and area';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), bio: form.bio.trim(), city: form.city, area: form.area, sizes: form.sizes, preferences: form.preferences };
      if (form.coords) payload.coords = form.coords;
      if (form.phone) payload.phone = form.phone.trim();
      const { data } = await api.patch('/users/me', payload);
      setUser(data.user);
      toast.success('Profile saved');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePref = (k) => setForm((f) => ({ ...f, preferences: f.preferences.includes(k) ? f.preferences.filter((x) => x !== k) : [...f.preferences, k].slice(0, 10) }));

  return (
    <div className="container-page max-w-3xl py-8">
      <p className="eyebrow">Settings</p>
      <h1 className="mt-2 text-4xl">Your profile</h1>
      <form onSubmit={save} className="mt-8 space-y-6" noValidate>
        <section className="card space-y-5 p-6">
          <h2 className="font-display text-xl">About you</h2>
          <Field label="Display name" htmlFor="name" error={errors.name}>
            <input id="name" className="input" maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Bio" htmlFor="bio" optional help={`${form.bio.length}/280 · What you like to wear, where you can meet`}>
            <textarea id="bio" className="input min-h-[90px]" maxLength={280} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <Field label="Mobile number" htmlFor="phone" optional error={errors.phone} help="Private — never shown to other members">
            <input id="phone" className="input" inputMode="tel" placeholder="98XXXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <div>
            <span className="label">Neighbourhood</span>
            <LocationPicker value={form} onChange={(loc) => setForm((f) => ({ ...f, ...loc }))} error={errors.location} />
            <p className="help">Changing this also moves your available listings, so nearby members can find them.</p>
          </div>
        </section>

        <section className="card space-y-5 p-6">
          <h2 className="font-display text-xl">Sizes & wishlist</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[['top', 'Tops', SIZES.apparel], ['bottom', 'Waist', SIZES.waist], ['footwear', 'Footwear', SIZES.footwear]].map(([k, l, opts]) => (
              <Field key={k} label={l}>
                <select className="input" value={form.sizes[k]} onChange={(e) => setForm({ ...form, sizes: { ...form.sizes, [k]: e.target.value } })}>
                  <option value="">—</option>
                  {opts.map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            ))}
          </div>
          <div>
            <p className="label">Categories you’re looking for</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => <button type="button" key={c.key} onClick={() => togglePref(c.key)} className={clsx('chip', form.preferences.includes(c.key) && 'chip-active')}>{c.label}</button>)}
            </div>
            <p className="help">Used to rank “Suggested swaps near you”.</p>
          </div>
        </section>

        <div className="flex justify-end">
          <button className="btn-primary px-8" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
