import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftRight, Flag, Heart, MapPin, MessageCircle, Pencil, ShieldCheck, Trash2, Eye, Sparkles, Info, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { Avatar, ErrorState, PageLoader, Stars, Modal } from '@/components/ui';
import ItemCard from '@/components/ItemCard';
import ReportDialog from '@/components/ReportDialog';
import { estimateValue, AGE_BUCKETS, fairnessLabel } from '@shared/catalog.js';
import { catLabel, condLabel, genderLabel, formatINR, formatDistance, timeAgo, tierLabel } from '@/lib/utils';

export default function ItemDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload, setData } = useFetch(`/items/${id}`, {}, [user?._id]);
  const [img, setImg] = useState(0);
  const [report, setReport] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  useDocumentTitle(data?.item?.title || 'Item');

  if (loading && !data) return <PageLoader />;
  if (error) return <div className="container-page py-16"><ErrorState message={error} onRetry={reload} /></div>;
  const { item, isOwner, similar, matches, activeSwap } = data;
  const est = estimateValue(item);
  const owner = item.owner;

  const toggleFav = async () => {
    if (!user) return navigate('/login', { state: { from: `/items/${id}` } });
    try {
      const { data: r } = await api.post(`/items/${id}/favorite`);
      setData((d) => ({ ...d, item: { ...d.item, isFavorite: r.isFavorite, favoritesCount: d.item.favoritesCount + (r.isFavorite ? 1 : -1) } }));
      toast.success(r.isFavorite ? 'Saved to your wishlist' : 'Removed from wishlist');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const message = async () => {
    if (!user) return navigate('/login', { state: { from: `/items/${id}` } });
    try {
      const { data: r } = await api.post('/chat/conversations', { userId: owner._id, itemId: item._id });
      navigate(`/chat/${r.conversationId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/items/${id}`);
      toast.success('Listing removed');
      navigate('/dashboard?tab=listings');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="container-page py-8">
      <nav className="mb-6 flex items-center gap-1 text-sm text-muted" aria-label="Breadcrumb">
        <Link to="/browse" className="hover:text-ink">Browse</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/browse?category=${item.category}`} className="hover:text-ink">{catLabel(item.category)}</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate text-ink">{item.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand">
            <img src={item.images[img]} alt={item.title} className="h-full w-full object-cover" />
            {item.status !== 'available' && <span className="badge absolute left-4 top-4 bg-ink/85 px-3 py-1 text-xs capitalize text-white">{item.status}</span>}
          </div>
          {item.images.length > 1 && (
            <div className="mt-3 flex gap-3">
              {item.images.map((src, i) => (
                <button key={src} onClick={() => setImg(i)} className={clsx('h-20 w-16 overflow-hidden rounded-xl border-2', i === img ? 'border-moss' : 'border-transparent')} aria-label={`Photo ${i + 1}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{item.brand} · {tierLabel(item.brandTier)}</p>
            <h1 className="mt-2 text-4xl leading-tight">{item.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {[`Size ${item.size}`, condLabel(item.condition), genderLabel(item.gender), catLabel(item.category)].map((t) => <span key={t} className="chip">{t}</span>)}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted">Swap value</p>
                <p className="font-display text-4xl text-moss">{formatINR(item.swapValue)}</p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>Calculator estimate {formatINR(item.estimatedValue)}</p>
                <p>Fair swaps: {formatINR(Math.round(item.swapValue * 0.75))}–{formatINR(Math.round(item.swapValue * 1.25))}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {isOwner ? (
                <>
                  {item.status === 'available' && <Link to={`/items/${id}/edit`} className="btn-primary"><Pencil className="h-4 w-4" /> Edit listing</Link>}
                  {item.status === 'available' && <button className="btn-danger" onClick={() => setConfirmRemove(true)}><Trash2 className="h-4 w-4" /> Remove</button>}
                  <Link to="/swaps" className="btn-secondary">View requests</Link>
                </>
              ) : activeSwap ? (
                <Link to={`/swaps/${activeSwap._id}`} className="btn-primary flex-1"><ArrowLeftRight className="h-4 w-4" /> View your swap request</Link>
              ) : item.status === 'available' ? (
                <Link to={user ? `/swap/new?item=${id}` : '/login'} state={{ from: `/swap/new?item=${id}` }} className="btn-primary w-full py-3 sm:w-auto sm:flex-1">
                  <ArrowLeftRight className="h-4 w-4" /> Request a swap
                </Link>
              ) : (
                <p className="text-sm text-muted">This item is {item.status} and can’t be requested right now.</p>
              )}
              {!isOwner && (
                <>
                  <button className="btn-secondary" onClick={message}><MessageCircle className="h-4 w-4" /> Message</button>
                  <button className="btn-secondary px-3" onClick={toggleFav} aria-label="Save to wishlist"><Heart className={clsx('h-4 w-4', item.isFavorite && 'fill-clay text-clay')} /></button>
                </>
              )}
            </div>
            <p className="mt-3 flex items-center gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {item.views} views</span>
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {item.favoritesCount} saves</span>
              <span>Listed {timeAgo(item.createdAt)}</span>
            </p>
          </div>

          {/* Fair matches from my closet */}
          {user && !isOwner && item.status === 'available' && !activeSwap && (
            <div className="rounded-2xl border border-moss/25 bg-moss-soft/40 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-moss"><Sparkles className="h-4 w-4" /> Fair matches from your closet</p>
              {matches.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Nothing in your closet is close in value yet. <Link to="/items/new" className="link">List an item</Link> or offer a combination on the next step.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {matches.map((m) => {
                    const fl = fairnessLabel(m.fairness);
                    return (
                      <Link key={m.items.map((i) => i._id).join()} to={`/swap/new?item=${id}&offer=${m.items.map((i) => i._id).join(',')}`} className="flex items-center gap-3 rounded-xl bg-surface p-2.5 transition hover:shadow-card">
                        <div className="flex -space-x-3">
                          {m.items.map((i) => <img key={i._id} src={i.images[0]} alt="" className="h-12 w-10 rounded-lg border-2 border-surface object-cover" />)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.items.map((i) => i.title).join(' + ')}</p>
                          <p className="text-xs text-muted">{formatINR(m.total)} · <span className={fl.tone === 'good' ? 'text-moss' : 'text-amber-700'}>{m.fairness}% {fl.label.toLowerCase()}</span></p>
                        </div>
                        <span className="text-xs font-semibold text-moss">Offer →</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Owner */}
          <div className="card flex items-center gap-4 p-5">
            <Avatar user={owner} size={52} />
            <div className="min-w-0 flex-1">
              <Link to={`/profile/${owner._id}`} className="font-semibold hover:underline">{owner.name}</Link>
              <p className="flex items-center gap-1 text-sm text-muted"><MapPin className="h-3.5 w-3.5" /> {item.location.area}, {item.location.city}{item.distanceKm != null && ` · ${formatDistance(item.distanceKm)}`}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                {owner.rating?.count > 0 ? <><Stars value={owner.rating.avg} size={12} /> {owner.rating.avg} ({owner.rating.count})</> : 'New member'}
                <span className="whitespace-nowrap">· {owner.stats?.swapsCompleted || 0} {owner.stats?.swapsCompleted === 1 ? 'swap' : 'swaps'}</span>
              </div>
            </div>
            <Link to={`/profile/${owner._id}`} className="btn-secondary btn-sm">Closet ({data.ownerListings})</Link>
          </div>

          {/* Description & details */}
          <div>
            <h2 className="font-display text-2xl">About this piece</h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink/85">{item.description || 'No description added.'}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Colour', item.color],
                ['Material', item.material],
                ['Age', AGE_BUCKETS.find((a) => a.key === item.age)?.label],
                ['Original price', item.originalPrice ? formatINR(item.originalPrice) : 'Not specified'],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="border-b border-line pb-2">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {item.lookingFor?.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold">{owner.name.split(' ')[0]} would love in return</p>
                <div className="mt-2 flex flex-wrap gap-2">{item.lookingFor.map((c) => <span key={c} className="badge tone-good px-3 py-1 text-xs">{catLabel(c)}</span>)}</div>
              </div>
            )}
          </div>

          {/* Value breakdown */}
          {est && (
            <details className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2"><Info className="h-4 w-4 text-moss" /> How the swap value is calculated</span>
                <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
              </summary>
              <ul className="mt-4 space-y-2 text-sm">
                {est.breakdown.map((b) => (
                  <li key={b.label} className="flex justify-between gap-4"><span className="text-muted">{b.label}</span><span className="font-medium">{b.value}</span></li>
                ))}
                <li className="flex justify-between border-t border-line pt-2 font-semibold"><span>Estimated swap value</span><span>{formatINR(est.value)}</span></li>
              </ul>
            </details>
          )}

          <div className="flex items-start gap-3 rounded-2xl bg-sand/60 p-4 text-sm text-muted">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-moss" />
            <p>Meet in a busy public place, check the item before confirming, and never pay money — ReThread swaps are free. {!isOwner && user && <button className="ml-1 inline-flex items-center gap-1 font-medium text-ink underline-offset-2 hover:underline" onClick={() => setReport(true)}><Flag className="h-3.5 w-3.5" /> Report listing</button>}</p>
          </div>
        </div>
      </div>

      {similar?.length > 0 && (
        <section className="mt-16">
          <h2 className="text-3xl">Similar pieces to swap</h2>
          <div className="no-scrollbar -mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pb-2">
            {similar.map((s) => (
              <div key={s._id} className="w-44 shrink-0 sm:w-56"><ItemCard item={s} /></div>
            ))}
          </div>
        </section>
      )}

      <ReportDialog open={report} onClose={() => setReport(false)} targetType="item" targetId={item._id} name={item.title} />
      <Modal open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove this listing?">
        <p className="text-sm text-muted">It will disappear from Browse and any open swap requests for it will be closed. Your swap history stays intact.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setConfirmRemove(false)}>Keep it</button>
          <button className="btn-danger" onClick={remove}>Remove listing</button>
        </div>
      </Modal>
    </div>
  );
}
