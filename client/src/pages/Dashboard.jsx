import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Plus, Shirt, Repeat2, Eye, Inbox, Leaf, Droplets, Recycle, Sparkles, MapPin, Heart, ArrowRight } from 'lucide-react';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, ErrorState, PageLoader, Tabs } from '@/components/ui';
import ItemCard, { ItemGridSkeleton } from '@/components/ItemCard';
import SwapRow from '@/components/SwapRow';
import { fmtNum, formatINR, formatDistance } from '@/lib/utils';

function Stat({ icon: Icon, label, value, hint, accent }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? 'bg-clay-soft text-clay' : 'bg-moss-soft text-moss'}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 font-display text-4xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Overview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/users/me/dashboard');
  const { data: sug } = useFetch('/users/me/suggestions', { params: { radiusKm: 15 } });
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const attention = data.recent.filter((r) => r.myTurn || ['accepted', 'in_progress'].includes(r.status));
  const profileGaps = [!user.bio && 'add a short bio', !user.sizes?.top && 'save your sizes', !(user.preferences || []).length && 'pick categories you want'].filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Shirt} label="Active listings" value={data.listings.available} hint={`${data.listings.reserved} reserved · ${data.listings.swapped} swapped`} />
        <Stat icon={Inbox} label="Awaiting your reply" value={data.swaps.awaitingMe} hint={`${data.swaps.active} active swaps`} accent={data.swaps.awaitingMe > 0} />
        <Stat icon={Repeat2} label="Swaps completed" value={data.swaps.completed} hint={`${data.swaps.total} requests in total`} />
        <Stat icon={Eye} label="Views on your items" value={fmtNum(data.listings.views)} hint={`${data.listings.saves} saves`} />
      </div>

      {profileGaps.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-clay/40 bg-clay-soft/50 p-4 text-sm">
          <p>Get better matches — {profileGaps.join(', ')}.</p>
          <Link to="/settings" className="btn-secondary btn-sm">Complete profile</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">Needs your attention</h2>
            <Link to="/swaps" className="text-sm font-semibold text-moss hover:underline">All swaps</Link>
          </div>
          {attention.length === 0 ? (
            <EmptyState icon={Inbox} title="You’re all caught up">New requests and swaps in progress will show here.</EmptyState>
          ) : (
            <div className="space-y-3">{attention.map((s) => <SwapRow key={s._id} swap={s} me={user} />)}</div>
          )}
        </section>
        <section className="overflow-hidden rounded-3xl bg-moss p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">Your impact</p>
          <h2 className="mt-2 font-display text-3xl">Every swap keeps clothes out of landfill.</h2>
          <div className="mt-6 space-y-4">
            {[[Recycle, `${data.impact.kg} kg`, 'clothing given a second life'], [Leaf, `${fmtNum(data.impact.co2)} kg`, 'CO₂e emissions avoided'], [Droplets, `${fmtNum(data.impact.water)} L`, 'water footprint saved']].map(([I, v, k]) => (
              <div key={k} className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><I className="h-5 w-5" /></span><div><p className="font-display text-2xl leading-none">{v}</p><p className="text-xs text-white/70">{k}</p></div></div>
            ))}
          </div>
          <p className="mt-6 text-[11px] text-white/60">Estimates: 25 kg CO₂e per kg reused (INTEXTER/UPC 2022); ~2,700 L water per cotton T-shirt (WWF).</p>
        </section>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles className="h-5 w-5 text-moss" /> Suggested swaps near you</h2>
            <p className="text-sm text-muted">Within 15 km of {user.location?.area}, matched on value, distance and fit.</p>
          </div>
          <Link to="/nearby" className="btn-secondary btn-sm">Open map <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {!sug ? (
          <ItemGridSkeleton count={4} />
        ) : sug.suggestions.length === 0 ? (
          <EmptyState icon={MapPin} title="No suggestions yet" action={<Link to="/items/new" className="btn-primary">List an item</Link>}>List a few items so we can find fair swaps near you.</EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {sug.suggestions.slice(0, 8).map((s) => (
              <ItemCard
                key={s.item._id}
                item={s.item}
                badge={<span className="badge bg-moss text-white">{s.fairness}% match</span>}
                footer={<p className="mt-1.5 line-clamp-2 text-[11px] text-moss">For your {s.forItem.title} ({formatINR(s.forItem.swapValue)}) · {formatDistance(s.distanceKm)}</p>}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Listings() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useFetch('/users/me/items');
  if (loading) return <ItemGridSkeleton count={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data.items.length) return <EmptyState icon={Shirt} title="Your closet is empty" action={<Link to="/items/new" className="btn-primary">List your first item</Link>}>Snap a few photos of something you don’t wear anymore — it takes two minutes.</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {data.items.map((it) => (
        <ItemCard
          key={it._id}
          item={it}
          badge={it.openRequests > 0 && <span className="badge bg-clay text-white">{it.openRequests} request{it.openRequests > 1 ? 's' : ''}</span>}
          footer={
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {it.views} · <Heart className="h-3.5 w-3.5" /> {it.favoritesCount}</span>
              {it.status === 'available' && (
                <span role="button" tabIndex={0} onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/items/${it._id}/edit`); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); navigate(`/items/${it._id}/edit`); } }} className="font-semibold text-moss hover:underline">Edit</span>
              )}
            </div>
          }
        />
      ))}
    </div>
  );
}

function History() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/swaps');
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data.swaps.length) return <EmptyState icon={Repeat2} title="No swaps yet" action={<Link to="/browse" className="btn-primary">Browse clothes</Link>}>Your swap requests and completed swaps will appear here.</EmptyState>;
  return <div className="space-y-3">{data.swaps.map((s) => <SwapRow key={s._id} swap={s} me={user} />)}</div>;
}

function Saved() {
  const { data, loading, error, reload } = useFetch('/users/me/favorites');
  if (loading) return <ItemGridSkeleton count={4} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data.items.length) return <EmptyState icon={Heart} title="No saved items" action={<Link to="/browse" className="btn-primary">Browse clothes</Link>}>Tap the heart on any listing to save it for later.</EmptyState>;
  return <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">{data.items.map((it) => <ItemCard key={it._id} item={it} />)}</div>;
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'listings', label: 'My listings' },
    { key: 'history', label: 'Swap history' },
    { key: 'saved', label: 'Saved' },
  ];
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="mt-2 text-4xl">Namaste, {user.name.split(' ')[0]} 👋</h1>
          <p className="mt-1 text-sm text-muted"><MapPin className="mr-1 inline h-3.5 w-3.5" />{user.location?.area}, {user.location?.city}</p>
        </div>
        <Link to="/items/new" className="btn-primary"><Plus className="h-4 w-4" /> List an item</Link>
      </div>
      <Tabs className="mt-6 w-fit max-w-full" tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />
      <div className="mt-6">
        {tab === 'overview' && <Overview />}
        {tab === 'listings' && <Listings />}
        {tab === 'history' && <History />}
        {tab === 'saved' && <Saved />}
      </div>
    </div>
  );
}
