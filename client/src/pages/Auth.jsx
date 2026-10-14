import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { errorMessage, fieldErrors } from '@/lib/api';
import { photoUrl } from '@shared/photos.js';
import { useDocumentTitle } from '@/lib/hooks';
import { Field, Logo } from '@/components/ui';
import LocationPicker from '@/components/LocationPicker';

const DEMOS = [
  { label: 'Demo member', sub: 'Aanya · Delhi', email: 'aanya@rethread.in', password: 'Demo@1234' },
  { label: 'Second member', sub: 'Rohan · Delhi', email: 'rohan@rethread.in', password: 'Demo@1234' },
  { label: 'Admin', sub: 'Moderation & analytics', email: 'admin@rethread.in', password: 'Admin@1234' },
];

const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

export default function Auth({ mode }) {
  const isLogin = mode === 'login';
  useDocumentTitle(isLogin ? 'Log in' : 'Create account');
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', city: '', area: '', coords: undefined, agree: false });
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!isLogin && form.name.trim().length < 2) e.name = 'Please enter your full name';
    if (!emailOk(form.email)) e.email = 'Enter a valid email address';
    if (isLogin) {
      if (!form.password) e.password = 'Enter your password';
    } else {
      if (form.password.length < 8) e.password = 'At least 8 characters';
      else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) e.password = 'Use letters and at least one number';
      if (form.confirm !== form.password) e.confirm = 'Passwords don’t match';
      if (!form.city || !form.area) e.location = 'Choose your city and area so we can show swaps nearby';
      if (!form.agree) e.agree = 'Please accept the community guidelines';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e, creds) => {
    e?.preventDefault();
    if (!creds && !validate()) return;
    setBusy(true);
    try {
      const u = creds
        ? await login(creds.email, creds.password)
        : isLogin
          ? await login(form.email, form.password)
          : await register({ name: form.name, email: form.email, password: form.password, city: form.city, area: form.area, coords: form.coords });
      toast.success(isLogin || creds ? `Welcome back, ${u.name.split(' ')[0]}!` : 'Account created — welcome to ReThread!');
      const dest = location.state?.from || (u.role === 'admin' ? '/admin' : isLogin || creds ? '/dashboard' : '/items/new');
      navigate(dest, { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page grid min-h-[calc(100vh-4rem)] items-stretch gap-10 py-10 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden rounded-4xl lg:block">
        <img src={photoUrl('hero-assorted', 1400)} alt="Assorted clothes on hangers" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent" />
        <div className="absolute bottom-0 p-10 text-white">
          <p className="font-display text-4xl leading-tight">“I swapped a lehenga I wore once for a jacket I wear every week.”</p>
          <p className="mt-3 text-sm text-white/70">Simran, Pitampura · 1 completed swap</p>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <div className="mx-auto w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <h1 className="text-4xl">{isLogin ? 'Welcome back' : 'Join ReThread'}</h1>
          <p className="mt-2 text-muted">{isLogin ? 'Log in to manage your closet, swaps and chats.' : 'Create a free account and list your first item in two minutes.'}</p>

          {isLogin && (
            <div className="mt-6 rounded-2xl border border-dashed border-moss/40 bg-moss-soft/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-moss"><Sparkles className="h-3.5 w-3.5" /> Evaluating? Use a demo account</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {DEMOS.map((d) => (
                  <button key={d.email} type="button" disabled={busy} onClick={() => submit(null, d)} className="rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-moss">
                    <span className="block text-sm font-semibold">{d.label}</span>
                    <span className="block text-[11px] text-muted">{d.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            {!isLogin && (
              <Field label="Full name" htmlFor="name" error={errors.name}>
                <input id="name" className={`input ${errors.name ? 'input-error' : ''}`} value={form.name} onChange={set('name')} autoComplete="name" placeholder="e.g. Priya Sharma" />
              </Field>
            )}
            <Field label="Email" htmlFor="email" error={errors.email}>
              <input id="email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={form.email} onChange={set('email')} autoComplete="email" placeholder="you@example.com" />
            </Field>
            <Field label="Password" htmlFor="password" error={errors.password} help={!isLogin ? 'At least 8 characters with a number' : undefined}>
              <div className="relative">
                <input id="password" type={show ? 'text' : 'password'} className={`input pr-11 ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={set('password')} autoComplete={isLogin ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {!isLogin && (
              <>
                <Field label="Confirm password" htmlFor="confirm" error={errors.confirm}>
                  <input id="confirm" type={show ? 'text' : 'password'} className={`input ${errors.confirm ? 'input-error' : ''}`} value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
                </Field>
                <div>
                  <span className="label">Your neighbourhood</span>
                  <LocationPicker value={form} onChange={(loc) => setForm((f) => ({ ...f, ...loc }))} error={errors.location} />
                  <p className="help">Only your area name is shown to others — never your exact address.</p>
                </div>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" checked={form.agree} onChange={set('agree')} className="mt-0.5 h-4 w-4 accent-[rgb(var(--moss))]" />
                  <span>I’ll list items honestly, swap without asking for money and meet in public places.</span>
                </label>
                {errors.agree && <p className="error-text -mt-2">{errors.agree}</p>}
              </>
            )}
            <button className="btn-primary w-full py-3" disabled={busy}>
              {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">
            {isLogin ? 'New to ReThread? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} state={location.state} className="link">
              {isLogin ? 'Create an account' : 'Log in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
