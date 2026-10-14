import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MapPin, MessageCircle, Flag, Repeat2, Leaf, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { Avatar, EmptyState, ErrorState, PageLoader, Stars } from '@/components/ui';
import ItemCard from '@/components/ItemCard';
import ReportDialog from '@/components/ReportDialog';
import { catLabel, timeAgo } from '@/lib/utils';

export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState(false);
  const { data, loading, error, reload } = useFetch(`/users/${id}`, {}, [user?._id]);
  useDocumentTitle(data?.user?.name || 'Profile');
  if (loading && !data) return <PageLoader />;
  if (error) return <div className="container-page py-16"><ErrorState message={error} onRetry={reload} /></div>;
  const { user: p, items, reviews } = data;
  const isMe = user?._id === p._id;

  const message = async () => {
    if (!user) return navigate('/login', { state: { from: `/profile/${id}` } });
    try {
      const { data: r } = await api.post('/chat/conversations', { userId: p._id });
      navigate(`/chat/${r.conversationId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="container-page py-8">
      <div className="card overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-moss to-moss-dark sm:h-36" />
        <div className="flex flex-col gap-5 px-6 pb-6 sm:flex-row sm:items-end">
          <Avatar user={p} size={96} className="-mt-12 border-4 border-surface text-3xl" />
          <div className="flex-1">
            <h1 className="text-3xl">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {p.location?.area}, {p.location?.city}</span>
              <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Joined {new Date(p.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
              {p.rating?.count > 0 && <span className="flex items-center gap-1"><Stars value={p.rating.avg} size={13} /> {p.rating.avg} · {p.rating.count} reviews</span>}
            </div>
          </div>
          <div className="flex gap-2">
            {isMe ? (
              <Link to="/settings" className="btn-secondary">Edit profile</Link>
            ) : (
              <>
                <button className="btn-primary" onClick={message}><MessageCircle className="h-4 w-4" /> Message</button>
                {user && <button className="btn-secondary px-3" onClick={() => setReport(true)} aria-label="Report member"><Flag className="h-4 w-4" /></button>}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card p-5">
            <p className="text-sm">{p.bio || 'No bio yet.'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-paper p-3"><Repeat2 className="mx-auto h-4 w-4 text-moss" /><p className="mt-1 font-display text-2xl">{p.stats?.swapsCompleted || 0}</p><p className="text-[11px] text-muted">swaps</p></div>
              <div className="rounded-xl bg-paper p-3"><Leaf className="mx-auto h-4 w-4 text-moss" /><p className="mt-1 font-display text-2xl">{p.stats?.kgDiverted || 0} kg</p><p className="text-[11px] text-muted">kept in use</p></div>
            </div>
            {(p.sizes?.top || p.sizes?.bottom || p.sizes?.footwear) && (
              <div className="mt-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Sizes</p>
                <p className="mt-1">{[p.sizes.top && `Top ${p.sizes.top}`, p.sizes.bottom && `Waist ${p.sizes.bottom}`, p.sizes.footwear && p.sizes.footwear].filter(Boolean).join(' · ')}</p>
              </div>
            )}
            {p.preferences?.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Looking for</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{p.preferences.map((c) => <span key={c} className="badge tone-good">{catLabel(c)}</span>)}</div>
              </div>
            )}
          </div>
          <div className="card p-5">
            <h2 className="font-display text-xl">Reviews</h2>
            {reviews.length === 0 ? <p className="mt-2 text-sm text-muted">No reviews yet.</p> : (
              <ul className="mt-3 space-y-4">
                {reviews.map((r) => (
                  <li key={r._id} className="text-sm">
                    <div className="flex items-center gap-2"><Avatar user={r.by} size={24} /><span className="font-medium">{r.by.name}</span></div>
                    <Stars value={r.stars} size={12} className="mt-1" />
                    {r.comment && <p className="mt-1 text-muted">“{r.comment}”</p>}
                    <p className="mt-0.5 text-[11px] text-muted">{timeAgo(r.at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section>
          <h2 className="text-3xl">{isMe ? 'Your closet' : `${p.name.split(' ')[0]}’s closet`} <span className="text-lg text-muted">({items.length})</span></h2>
          <div className="mt-6">
            {items.length === 0 ? <EmptyState title="Nothing listed right now">Check back soon.</EmptyState> : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">{items.map((it) => <ItemCard key={it._id} item={it} />)}</div>
            )}
          </div>
        </section>
      </div>
      <ReportDialog open={report} onClose={() => setReport(false)} targetType="user" targetId={p._id} name={p.name} />
    </div>
  );
}
