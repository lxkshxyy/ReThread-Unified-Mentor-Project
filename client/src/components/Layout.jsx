import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, MessageCircle, Plus, Menu, X, LayoutDashboard, Repeat2, Settings, LogOut, ShieldCheck, Search, MapPin, Calculator, Shirt,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/utils';
import { Avatar, Logo } from './ui';

const NAV = [
  { to: '/browse', label: 'Browse', icon: Shirt },
  { to: '/nearby', label: 'Nearby', icon: MapPin },
  { to: '/calculator', label: 'Value calculator', icon: Calculator },
];

function useClickOutside(ref, onOut) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOut();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOut]);
}

function NotificationBell() {
  const { unreadNotifications, setUnreadNotifications } = useRealtime();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      const { data } = await api.get('/notifications');
      setItems(data.notifications);
      if (data.unread) {
        await api.post('/notifications/read-all');
        setUnreadNotifications(0);
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-sand" aria-label={`Notifications${unreadNotifications ? ` (${unreadNotifications} unread)` : ''}`}>
        <Bell className="h-5 w-5" />
        {unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{unreadNotifications}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
            <div className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</div>
            <div className="thin-scroll max-h-96 overflow-y-auto">
              {!items && <p className="p-4 text-sm text-muted">Loading…</p>}
              {items?.length === 0 && <p className="p-6 text-center text-sm text-muted">You’re all caught up.</p>}
              {items?.map((n) => (
                <button
                  key={n._id}
                  onClick={() => {
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  className={clsx('block w-full border-b border-line/70 px-4 py-3 text-left transition last:border-0 hover:bg-paper', !n.read && 'bg-moss-soft/50')}
                >
                  <p className="text-sm font-medium leading-snug">{n.title}</p>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>}
                  <p className="mt-1 text-[11px] text-muted">{timeAgo(n.createdAt)}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickOutside(ref, () => setOpen(false));
  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/swaps', label: 'My swaps', icon: Repeat2 },
    { to: `/profile/${user._id}`, label: 'Public profile', icon: Shirt },
    { to: '/settings', label: 'Settings', icon: Settings },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin panel', icon: ShieldCheck }] : []),
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-sand" aria-label="Account menu">
        <Avatar user={user} size={36} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <div className="my-1 h-px bg-line" />
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-paper">
                <l.icon className="h-4 w-4 text-muted" /> {l.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-line" />
            <button
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate('/');
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Navbar() {
  const { user } = useAuth();
  const { unreadMessages } = useRealtime();
  const [mobile, setMobile] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => setMobile(false), [location.pathname]);

  const search = (e) => {
    e.preventDefault();
    navigate(`/browse${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx('rounded-full px-3.5 py-2 text-sm font-medium transition', isActive ? 'bg-sand text-ink' : 'text-muted hover:text-ink')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <form onSubmit={search} className="ml-auto hidden max-w-xs flex-1 md:block">
          <label className="relative block">
            <span className="sr-only">Search clothes</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search kurta, Levi's, sneakers…" className="input rounded-full py-2 pl-10" />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          {user ? (
            <>
              <Link to="/items/new" className="btn-primary btn-sm hidden sm:inline-flex">
                <Plus className="h-4 w-4" /> List an item
              </Link>
              <Link to="/chat" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-sand" aria-label={`Messages${unreadMessages ? ` (${unreadMessages} unread)` : ''}`}>
                <MessageCircle className="h-5 w-5" />
                {unreadMessages > 0 && <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{unreadMessages}</span>}
              </Link>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm hidden sm:inline-flex">Log in</Link>
              <Link to="/register" className="btn-primary btn-sm">Join free</Link>
            </>
          )}
          <button className="grid h-10 w-10 place-items-center rounded-full hover:bg-sand lg:hidden" onClick={() => setMobile((m) => !m)} aria-label="Menu" aria-expanded={mobile}>
            {mobile ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {mobile && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-line bg-paper lg:hidden">
            <div className="container-page space-y-1 py-3">
              <form onSubmit={search} className="pb-2 md:hidden">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clothes…" className="input rounded-full" />
              </form>
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand">
                  <n.icon className="h-4 w-4 text-muted" /> {n.label}
                </NavLink>
              ))}
              {user && (
                <NavLink to="/items/new" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand sm:hidden">
                  <Plus className="h-4 w-4 text-muted" /> List an item
                </NavLink>
              )}
              {!user && (
                <NavLink to="/login" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-sand">
                  Log in
                </NavLink>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm text-muted">
            India’s clothing swap marketplace. Exchange what you don’t wear for something you will — no money, no landfill.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Swap</p>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link className="hover:text-ink" to="/browse">Browse clothes</Link></li>
            <li><Link className="hover:text-ink" to="/nearby">Swaps near you</Link></li>
            <li><Link className="hover:text-ink" to="/calculator">Swap value calculator</Link></li>
            <li><Link className="hover:text-ink" to="/items/new">List an item</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Trust & safety</p>
          <ul className="space-y-2 text-sm text-muted">
            <li>Meet in public places</li>
            <li>Check items before confirming</li>
            <li>Report anything suspicious</li>
            <li>support@rethread.in</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} ReThread · Built for the Unified Mentor Web Development Internship</p>
          <p>Product photos: Unsplash contributors</p>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  const bare = pathname.startsWith('/chat');
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      {!bare && <Footer />}
    </div>
  );
}
