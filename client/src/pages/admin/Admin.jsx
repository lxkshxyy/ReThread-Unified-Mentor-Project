import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import {
  Shirt, Repeat2, Percent, Users, Activity, AlertTriangle, Flag, Download, Leaf, Search, ShieldCheck, Ban, RotateCcw, Trash2, Check, X as XIcon,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useFetch, useDebounced, useDocumentTitle } from '@/lib/hooks';
import { Avatar, EmptyState, ErrorState, Modal, PageLoader, StatusBadge, Tabs } from '@/components/ui';
import { fmtNum, formatINR, timeAgo, dateTime, swapStatus } from '@/lib/utils';

// Validated categorical palette (dataviz reference instance): blue · orange · aqua
const SERIES = { listings: '#2a78d6', requests: '#eb6834', completed: '#1baf7a' };
const BRAND = '#2E5E4E';

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lift">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.name}: <b>{fmtNum(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <Icon className={clsx('h-4 w-4', tone === 'bad' ? 'text-red-600' : 'text-moss')} />
      </div>
      <p className="mt-2 font-display text-4xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Overview() {
  const { data, loading, error, reload } = useFetch('/admin/overview');
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const k = data.kpis;
  const exportCsv = (type) => window.open(`/api/admin/export/${type}`, '_blank');
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Shirt} label="Clothing listings" value={fmtNum(k.totalListings)} sub={`${k.availableListings} available now · ${k.removedListings} removed`} />
        <Kpi icon={Repeat2} label="Successful swaps" value={fmtNum(k.successfulSwaps)} sub={`${k.activeSwaps} in progress · ${k.totalRequests} requests`} />
        <Kpi icon={Percent} label="Request conversion" value={`${k.conversionRate}%`} sub={`Requests that reached agreement · ${k.completionRate}% completed`} />
        <Kpi icon={Users} label="Active users (30 days)" value={fmtNum(k.activeUsers)} sub={`of ${k.users} members · ${k.engagementRate}% engaged (listed, swapped or chatted)`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="?tab=disputes" className="card flex items-center gap-4 p-5 hover:shadow-lift"><AlertTriangle className="h-6 w-6 text-red-600" /><div><p className="font-display text-3xl">{k.openDisputes}</p><p className="text-xs text-muted">open disputes</p></div></Link>
        <Link to="?tab=reports" className="card flex items-center gap-4 p-5 hover:shadow-lift"><Flag className="h-6 w-6 text-amber-600" /><div><p className="font-display text-3xl">{k.openReports}</p><p className="text-xs text-muted">reports to review</p></div></Link>
        <div className="card flex items-center gap-4 p-5"><Leaf className="h-6 w-6 text-moss" /><div><p className="font-display text-3xl">{data.impact.kg} kg</p><p className="text-xs text-muted">textiles diverted · {fmtNum(data.impact.co2)} kg CO₂e avoided</p></div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="card p-6">
          <h2 className="font-display text-xl">Weekly activity</h2>
          <p className="text-xs text-muted">Last 12 weeks · new listings, swap requests and completed swaps</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <LineChart data={data.weekly} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#ece7dd" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b675f' }} tickLine={false} axisLine={{ stroke: '#e4ded3' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b675f' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: '#c9c2b4', strokeDasharray: '3 3' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="listings" name="New listings" stroke={SERIES.listings} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                <Line type="monotone" dataKey="requests" name="Swap requests" stroke={SERIES.requests} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                <Line type="monotone" dataKey="completed" name="Completed swaps" stroke={SERIES.completed} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="font-display text-xl">Swap funnel</h2>
          <p className="text-xs text-muted">All-time requests → agreement → completion</p>
          <div className="mt-5 space-y-4">
            {data.funnel.map((f, i) => {
              const pct = data.funnel[0].n ? Math.round((f.n / data.funnel[0].n) * 100) : 0;
              return (
                <div key={f.stage}>
                  <div className="flex justify-between text-sm"><span>{f.stage}</span><span className="font-semibold">{fmtNum(f.n)} <span className="font-normal text-muted">· {pct}%</span></span></div>
                  <div className="mt-1.5 h-3 rounded-full bg-sand"><div className="h-3 rounded-full" style={{ width: `${pct}%`, background: BRAND, opacity: 1 - i * 0.22 }} /></div>
                </div>
              );
            })}
          </div>
          <h3 className="mt-8 text-sm font-semibold">Swaps by status</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.swapStatus.sort((a, b) => b.n - a.n).map((s) => <span key={s.status} className={clsx('badge px-3 py-1 text-xs', `tone-${swapStatus(s.status).tone}`)}>{swapStatus(s.status).label} · {s.n}</span>)}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <section className="card p-6">
          <h2 className="font-display text-xl">Listings by category</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer>
              <BarChart data={data.byCategory.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 16, left: 24, bottom: 0 }} barCategoryGap={6}>
                <CartesianGrid stroke="#ece7dd" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6b675f' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="category" width={130} tick={{ fontSize: 11, fill: '#191917' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(46,94,78,0.06)' }} />
                <Bar dataKey="n" name="Listings" fill={BRAND} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-6">
          <h2 className="font-display text-xl">Top cities</h2>
          <table className="mt-4 w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="pb-2 font-medium">City</th><th className="pb-2 text-right font-medium">Available listings</th><th className="pb-2 text-right font-medium">Members listing</th></tr></thead>
            <tbody>
              {data.byCity.map((c) => (
                <tr key={c.city} className="border-b border-line/60"><td className="py-2.5">{c.city}</td><td className="py-2.5 text-right font-medium">{c.listings}</td><td className="py-2.5 text-right">{c.members}</td></tr>
              ))}
            </tbody>
          </table>
          <h2 className="mt-8 font-display text-xl">Top swappers</h2>
          <ul className="mt-3 space-y-2">
            {data.topMembers.map((m) => (
              <li key={m._id} className="flex items-center gap-3 text-sm">
                <Avatar user={m} size={30} />
                <Link to={`/profile/${m._id}`} className="flex-1 font-medium hover:underline">{m.name}</Link>
                <span className="text-muted">{m.location?.city}</span>
                <span className="badge tone-good">{m.stats?.swapsCompleted} {m.stats?.swapsCompleted === 1 ? 'swap' : 'swaps'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-display text-xl">Platform reports</h2>
          <p className="text-sm text-muted">Download CSV exports for offline analysis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['users', 'items', 'swaps'].map((t) => <button key={t} className="btn-secondary btn-sm" onClick={() => exportCsv(t)}><Download className="h-3.5 w-3.5" /> {t}.csv</button>)}
        </div>
      </section>
    </div>
  );
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-muted">Page {page} of {pages}</span>
      <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  useEffect(() => setPage(1), [dq, status]);
  const { data, loading, error, reload } = useFetch('/admin/users', { params: { q: dq, status, page } });

  const setUserStatus = async (u, s, r = '') => {
    try {
      await api.patch(`/admin/users/${u._id}`, { status: s, reason: r });
      toast.success(s === 'suspended' ? `${u.name} suspended` : `${u.name} reactivated`);
      setTarget(null);
      setReason('');
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search name, email or city" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All members</option><option value="active">Active</option><option value="suspended">Suspended</option>
        </select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-3 font-medium">Member</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Listings</th><th className="px-4 py-3 font-medium">Swaps</th><th className="px-4 py-3 font-medium">Last active</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {loading && !data ? <tr><td colSpan={7} className="p-8 text-center text-muted">Loading…</td></tr> : data?.users.map((u) => (
                <tr key={u._id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar user={u} size={32} /><div><Link to={`/profile/${u._id}`} className="font-medium hover:underline">{u.name}</Link><p className="text-xs text-muted">{u.email}</p></div></div></td>
                  <td className="px-4 py-3 text-muted">{u.location?.area}, {u.location?.city}</td>
                  <td className="px-4 py-3">{u.listings}</td>
                  <td className="px-4 py-3">{u.stats?.swapsCompleted || 0}{u.rating?.count > 0 && <span className="ml-1 text-xs text-muted">· ★{u.rating.avg}</span>}</td>
                  <td className="px-4 py-3 text-muted">{timeAgo(u.lastActiveAt)}</td>
                  <td className="px-4 py-3">
                    {u.role === 'admin' ? <span className="badge tone-info">Admin</span> : u.status === 'active' ? <span className="badge tone-good">Active</span> : <span className="badge tone-bad" title={u.suspendedReason}>Suspended</span>}
                    {u.openReports > 0 && <span className="badge tone-warn ml-1">{u.openReports} report</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'admin' && (u.status === 'active'
                      ? <button className="btn-ghost btn-sm text-red-700" onClick={() => setTarget(u)}><Ban className="h-3.5 w-3.5" /> Suspend</button>
                      : <button className="btn-ghost btn-sm" onClick={() => setUserStatus(u, 'active')}><RotateCcw className="h-3.5 w-3.5" /> Reactivate</button>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title={`Suspend ${target?.name}?`}>
        <p className="text-sm text-muted">Their listings will be hidden and open swap requests closed. They won’t be able to log in until reactivated.</p>
        <input className="input mt-4" maxLength={200} placeholder="Reason (shown to the member)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setTarget(null)}>Cancel</button><button className="btn-danger" onClick={() => setUserStatus(target, 'suspended', reason)}>Suspend member</button></div>
      </Modal>
    </div>
  );
}

function ListingsTab() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  useEffect(() => setPage(1), [dq, filter]);
  const params = { q: dq, page, limit: 15, ...(filter === 'reported' ? { reported: 'true' } : filter ? { status: filter } : {}) };
  const { data, loading, error, reload } = useFetch('/admin/items', { params });

  const moderate = async (item, action, r = '') => {
    try {
      await api.patch(`/admin/items/${item._id}`, { action, reason: r });
      toast.success(action === 'remove' ? 'Listing removed' : 'Listing restored');
      setTarget(null);
      setReason('');
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Search title or brand" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
          <option value="">All listings</option><option value="reported">Reported</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="swapped">Swapped</option><option value="removed">Removed</option>
        </select>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : (
        <div className="card mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="px-4 py-3 font-medium">Listing</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">Value</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Listed</th><th className="px-4 py-3" /></tr></thead>
            <tbody>
              {loading && !data ? <tr><td colSpan={6} className="p-8 text-center text-muted">Loading…</td></tr> : data?.items.map((it) => (
                <tr key={it._id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={it.images[0]} alt="" className="h-12 w-10 rounded-md object-cover" /><div className="min-w-0"><Link to={`/items/${it._id}`} className="block max-w-[260px] truncate font-medium hover:underline">{it.title}</Link><p className="text-xs text-muted">{it.brand} · {it.size}</p></div></div></td>
                  <td className="px-4 py-3"><p>{it.owner?.name}</p><p className="text-xs text-muted">{it.location?.city}</p></td>
                  <td className="px-4 py-3">{formatINR(it.swapValue)}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('badge capitalize', it.status === 'available' ? 'tone-good' : it.status === 'removed' ? 'tone-bad' : 'tone-muted')}>{it.status}</span>
                    {it.moderation?.reportsCount > 0 && <span className="badge tone-warn ml-1">{it.moderation.reportsCount} report</span>}
                    {it.moderation?.removedByAdmin && <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-muted" title={it.moderation.reason}>{it.moderation.reason}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted">{timeAgo(it.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {it.status === 'available' && <button className="btn-ghost btn-sm text-red-700" onClick={() => setTarget(it)}><Trash2 className="h-3.5 w-3.5" /> Remove</button>}
                    {it.status === 'removed' && it.moderation?.removedByAdmin && <button className="btn-ghost btn-sm" onClick={() => moderate(it, 'restore')}><RotateCcw className="h-3.5 w-3.5" /> Restore</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Remove listing">
        <p className="text-sm text-muted">“{target?.title}” will be hidden, open requests closed and the owner notified.</p>
        <select className="input mt-4" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason</option>
          <option>Counterfeit or fake brand</option><option>Misleading photos or description</option><option>Inappropriate content</option><option>Selling for money instead of swapping</option><option>Duplicate listing</option>
        </select>
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setTarget(null)}>Cancel</button><button className="btn-danger" disabled={!reason} onClick={() => moderate(target, 'remove', reason)}>Remove listing</button></div>
      </Modal>
    </div>
  );
}

function SwapsTab({ disputes = false }) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ outcome: 'cancelled', resolution: '' });
  useEffect(() => setPage(1), [status]);
  const { data, loading, error, reload } = useFetch('/admin/swaps', { params: disputes ? { disputes: 'true', page } : { status, page } });

  const resolve = async () => {
    try {
      await api.post(`/admin/swaps/${target._id}/resolve`, form);
      toast.success('Dispute resolved');
      setTarget(null);
      setForm({ outcome: 'cancelled', resolution: '' });
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      {!disputes && (
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="">All swaps</option><option value="active">Active</option><option value="completed">Completed</option><option value="pending">Pending</option><option value="countered">Countered</option><option value="in_progress">In progress</option><option value="rejected">Declined</option><option value="cancelled">Cancelled</option>
        </select>
      )}
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : data.swaps.length === 0 ? (
        <div className="mt-4"><EmptyState icon={ShieldCheck} title={disputes ? 'No disputes' : 'No swaps'}>{disputes ? 'Nothing needs moderation right now.' : 'Try another filter.'}</EmptyState></div>
      ) : (
        <div className="mt-4 space-y-3">
          {data.swaps.map((s) => (
            <div key={s._id} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={s.status} />
                {s.dispute?.status && <span className={clsx('badge', s.dispute.status === 'open' ? 'tone-bad' : 'tone-good')}>Dispute {s.dispute.status}</span>}
                <span className="text-xs text-muted">Updated {timeAgo(s.updatedAt)} · {s.fulfillment?.method} · {s.distanceKm != null ? `${s.distanceKm} km` : ''} · {s.offers.length} round(s)</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                <div className="flex items-center gap-2"><Avatar user={s.requester} size={26} /><div className="min-w-0"><p className="font-medium">{s.requester.name}</p><p className="truncate text-xs text-muted">{s.offeredItems.map((i) => i.title).join(' + ')} · {formatINR(s.offeredItems.reduce((a, i) => a + i.swapValue, 0))}</p></div></div>
                <Repeat2 className="hidden h-4 w-4 text-muted md:block" />
                <div className="flex items-center gap-2"><Avatar user={s.recipient} size={26} /><div className="min-w-0"><p className="font-medium">{s.recipient.name}</p><p className="truncate text-xs text-muted">{s.requestedItems.map((i) => i.title).join(' + ')} · {formatINR(s.requestedItems.reduce((a, i) => a + i.swapValue, 0))}</p></div></div>
              </div>
              {s.dispute?.status && (
                <div className={clsx('mt-3 rounded-xl p-3 text-sm', s.dispute.status === 'open' ? 'bg-red-50' : 'bg-sand/60')}>
                  <p><b>{s.disputeLabel}</b> — raised by {s.dispute.raisedBy?.name} {timeAgo(s.dispute.createdAt)}</p>
                  <p className="mt-1 text-muted">{s.dispute.details}</p>
                  {s.dispute.resolution && <p className="mt-2"><b>Resolution ({s.dispute.outcome}):</b> {s.dispute.resolution}</p>}
                  {s.dispute.status === 'open' && <button className="btn-primary btn-sm mt-3" onClick={() => setTarget(s)}>Resolve dispute</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
      <Modal open={Boolean(target)} onClose={() => setTarget(null)} title="Resolve dispute">
        <p className="text-sm text-muted">{target?.dispute?.details}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[['cancelled', 'Reverse swap', 'Cancel and release all items back to owners'], ['completed', 'Mark completed', 'The swap stands; items marked swapped']].map(([k, t, d]) => (
            <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, outcome: k }))} className={clsx('rounded-xl border p-3 text-left text-sm', form.outcome === k ? 'border-moss bg-moss-soft/40' : 'border-line')}><b>{t}</b><span className="block text-xs text-muted">{d}</span></button>
          ))}
        </div>
        <textarea className="input mt-4 min-h-[90px]" maxLength={500} placeholder="Resolution note shared with both members" value={form.resolution} onChange={(e) => setForm((f) => ({ ...f, resolution: e.target.value }))} />
        <div className="mt-5 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setTarget(null)}>Cancel</button><button className="btn-primary" disabled={form.resolution.trim().length < 5} onClick={resolve}>Resolve</button></div>
      </Modal>
    </div>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState('open');
  const { data, loading, error, reload } = useFetch('/admin/reports', { params: status ? { status } : {} });
  const handle = async (r, body) => {
    try {
      await api.patch(`/admin/reports/${r._id}`, body);
      toast.success(body.status === 'actioned' ? 'Action taken' : 'Report dismissed');
      reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };
  return (
    <div>
      <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
        <option value="open">Open</option><option value="actioned">Actioned</option><option value="dismissed">Dismissed</option><option value="">All</option>
      </select>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <PageLoader /> : data.reports.length === 0 ? (
        <div className="mt-4"><EmptyState icon={Flag} title="No reports">The community is behaving 🙌</EmptyState></div>
      ) : (
        <div className="mt-4 space-y-3">
          {data.reports.map((r) => (
            <div key={r._id} className="card flex flex-col gap-4 p-4 md:flex-row md:items-start">
              {r.item ? <img src={r.item.images?.[0]} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" /> : <Avatar user={r.user} size={48} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge tone-warn">{r.reasonLabel}</span>
                  <span className={clsx('badge', r.status === 'open' ? 'tone-bad' : 'tone-muted')}>{r.status}</span>
                  <span className="text-xs text-muted">{dateTime(r.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium">{r.item ? <Link to={`/items/${r.item._id}`} className="hover:underline">{r.item.title}</Link> : <Link to={`/profile/${r.user?._id}`} className="hover:underline">Member: {r.user?.name}</Link>} <span className="font-normal text-muted">· reported by {r.reporter?.name}</span></p>
                {r.details && <p className="mt-1 text-sm text-muted">“{r.details}”</p>}
                {r.note && <p className="mt-1 text-xs"><b>Moderator note:</b> {r.note}{r.handledBy?.name && ` — ${r.handledBy.name}`}</p>}
              </div>
              {r.status === 'open' && (
                <div className="flex flex-wrap gap-2 md:flex-col">
                  {r.item && <button className="btn-danger btn-sm" onClick={() => handle(r, { status: 'actioned', removeItem: true, note: `Removed: ${r.reasonLabel}` })}><Trash2 className="h-3.5 w-3.5" /> Remove listing</button>}
                  {!r.item && <button className="btn-danger btn-sm" onClick={() => handle(r, { status: 'actioned', suspendUser: true, note: r.reasonLabel })}><Ban className="h-3.5 w-3.5" /> Suspend member</button>}
                  <button className="btn-secondary btn-sm" onClick={() => handle(r, { status: 'actioned', note: 'Warning sent to member' })}><Check className="h-3.5 w-3.5" /> Warn only</button>
                  <button className="btn-ghost btn-sm" onClick={() => handle(r, { status: 'dismissed', note: 'No violation found' })}><XIcon className="h-3.5 w-3.5" /> Dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  useDocumentTitle('Admin panel');
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const { data: ov } = useFetch('/admin/overview');
  const tabs = [
    { key: 'overview', label: 'Analytics' },
    { key: 'users', label: 'Users' },
    { key: 'listings', label: 'Listings' },
    { key: 'swaps', label: 'Swap activity' },
    { key: 'disputes', label: 'Disputes', count: ov?.kpis.openDisputes },
    { key: 'reports', label: 'Reports', count: ov?.kpis.openReports },
  ];
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin panel</p>
          <h1 className="mt-2 text-4xl">Platform overview</h1>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-muted"><Activity className="h-3.5 w-3.5 text-moss" /> Live data</span>
      </div>
      <Tabs className="mt-6 w-fit max-w-full" tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />
      <div className="mt-6">
        {tab === 'overview' && <Overview />}
        {tab === 'users' && <UsersTab />}
        {tab === 'listings' && <ListingsTab />}
        {tab === 'swaps' && <SwapsTab />}
        {tab === 'disputes' && <SwapsTab disputes />}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}
