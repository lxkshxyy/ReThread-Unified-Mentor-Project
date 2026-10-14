import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Check, X, Repeat, MessageCircle, Handshake, Truck, PackageCheck, AlertTriangle, Clock, MapPin, ExternalLink, Leaf, ChevronDown,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { Avatar, ErrorState, FairnessMeter, Modal, PageLoader, StarInput, Stars, StatusBadge } from '@/components/ui';
import { MiniItem } from '@/components/ItemCard';
import ClosetPicker from '@/components/ClosetPicker';
import { COURIERS, DISPUTE_REASONS, impactFor, fairness } from '@shared/catalog.js';
import { dateTime, formatINR, formatDistance, timeAgo, swapStatus } from '@/lib/utils';

const TIMELINE_LABEL = { pending: 'Request sent', countered: 'Counter-offer', accepted: 'Swap agreed', in_progress: 'Exchange update', completed: 'Completed', rejected: 'Declined', cancelled: 'Cancelled', disputed: 'Dispute opened', resolved: 'Dispute resolved' };

function ItemsBlock({ title, items, who }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
        {who && <span className="flex items-center gap-1.5 text-xs text-muted"><Avatar user={who} size={20} />{who.name}</span>}
      </div>
      <div className="space-y-3">
        {items.map((i) => (
          <Link key={i._id} to={`/items/${i._id}`} className="block rounded-xl p-1 transition hover:bg-paper"><MiniItem item={i} /></Link>
        ))}
      </div>
    </div>
  );
}

export default function SwapDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { on } = useRealtime();
  const { data, loading, error, reload } = useFetch(`/swaps/${id}`);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  useDocumentTitle('Swap');
  useEffect(() => on('swap:update', (p) => p.swapId === id && reload(true)), [on, id, reload]);

  if (loading && !data) return <PageLoader />;
  if (error) return <div className="container-page py-16"><ErrorState message={error} onRetry={reload} /></div>;
  const s = data.swap;
  const isReq = s.role === 'requester';
  const me = isReq ? s.requester : s.recipient;
  const other = isReq ? s.recipient : s.requester;
  const give = isReq ? s.offeredItems : s.requestedItems;
  const get = isReq ? s.requestedItems : s.offeredItems;
  const giveV = give.reduce((a, i) => a + i.swapValue, 0);
  const getV = get.reduce((a, i) => a + i.swapValue, 0);
  const myShip = s.fulfillment?.[`${isReq ? 'requester' : 'recipient'}Shipment`];
  const theirShip = s.fulfillment?.[`${isReq ? 'recipient' : 'requester'}Shipment`];
  const iReceived = s.received?.[isReq ? 'requester' : 'recipient'];
  const theyReceived = s.received?.[isReq ? 'recipient' : 'requester'];
  const myRating = s.ratings?.[isReq ? 'byRequester' : 'byRecipient'];
  const theirRating = s.ratings?.[isReq ? 'byRecipient' : 'byRequester'];
  const first = (u) => u?.name?.split(' ')[0];

  const act = async (path, body, success) => {
    setBusy(true);
    try {
      await api.post(`/swaps/${id}/${path}`, body);
      if (success) toast.success(success);
      setModal(null);
      setForm({});
      await reload(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openCounter = () => {
    setForm({ offered: s.offeredItems.map((i) => i._id), requested: s.requestedItems.map((i) => i._id), message: '' });
    setModal('counter');
  };
  const counterGive = isReq ? form.offered : form.requested;
  const counterGet = isReq ? form.requested : form.offered;
  const closetMine = isReq ? s.requesterCloset : s.recipientCloset;
  const closetTheirs = isReq ? s.recipientCloset : s.requesterCloset;
  const valueOf = (ids = [], pool = []) => ids.reduce((a, x) => a + (pool.find((p) => p._id === x)?.swapValue || 0), 0);

  return (
    <div className="container-page py-8">
      <Link to="/swaps" className="text-sm text-muted hover:text-ink">← All swaps</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><StatusBadge status={s.status} />{s.myTurn && <span className="badge bg-clay text-white">Your move</span>}</div>
          <h1 className="mt-2 text-3xl sm:text-4xl">Swap with {other.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {isReq ? 'You sent this request' : `${first(other)} sent this request`} {timeAgo(s.createdAt)}
            {s.distanceKm != null && ` · ${formatDistance(s.distanceKm)}`} · {s.offers.length} {s.offers.length === 1 ? 'offer' : 'offers'}
          </p>
        </div>
        {s.conversation && <Link to={`/chat/${s.conversation}`} className="btn-secondary"><MessageCircle className="h-4 w-4" /> Open chat</Link>}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* Terms */}
          <section className="card p-6">
            <h2 className="font-display text-xl">Current terms</h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <ItemsBlock title="You give" items={give} who={me} />
              <ItemsBlock title="You get" items={get} who={other} />
            </div>
            <div className="mt-6"><FairnessMeter left={giveV} right={getV} /></div>
          </section>

          {/* Actions */}
          <section className="card p-6">
            {['pending', 'countered'].includes(s.status) && (
              s.myTurn ? (
                <>
                  <h2 className="font-display text-xl">{s.status === 'countered' ? `${first(other)} sent a counter-offer` : `${first(other)} wants to swap`}</h2>
                  {s.offers.at(-1)?.message && <blockquote className="mt-3 rounded-xl border-l-4 border-moss bg-paper p-3 text-sm italic">“{s.offers.at(-1).message}”</blockquote>}
                  <p className="mt-2 text-sm text-muted">Accepting confirms the swap agreement and reserves all items. You can still chat to arrange the details.</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button className="btn-primary" disabled={busy} onClick={() => setModal('accept')}><Check className="h-4 w-4" /> Accept swap</button>
                    <button className="btn-secondary" disabled={busy} onClick={openCounter}><Repeat className="h-4 w-4" /> Counter-offer</button>
                    <button className="btn-danger" disabled={busy} onClick={() => { setForm({ message: '' }); setModal('reject'); }}><X className="h-4 w-4" /> Decline</button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="flex items-center gap-2 font-display text-xl"><Clock className="h-5 w-5 text-amber-600" /> Waiting for {first(other)}</h2>
                  <p className="mt-2 text-sm text-muted">{first(other)} can accept, decline or counter. You’ll get a notification as soon as they respond.</p>
                  <button className="btn-ghost mt-4 text-red-700" disabled={busy} onClick={() => act('cancel', { reason: 'Withdrawn' }, 'Request withdrawn')}>Withdraw request</button>
                </>
              )
            )}

            {['accepted', 'in_progress'].includes(s.status) && (
              <>
                <h2 className="font-display text-xl">Swap agreed — let’s make the exchange</h2>
                {!s.fulfillment?.meetupPlace && !myShip && !theirShip && s.status === 'accepted' ? (
                  <>
                    <p className="mt-2 text-sm text-muted">Choose how you’ll exchange items. {first(other)} sees your plan instantly.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button className="flex items-start gap-3 rounded-xl border border-line p-4 text-left hover:border-moss" onClick={() => { setForm({ meetupPlace: '', meetupAt: '' }); setModal('meetup'); }}>
                        <Handshake className="mt-0.5 h-5 w-5 text-moss" /><span><span className="block text-sm font-semibold">Plan a meetup</span><span className="text-xs text-muted">Free · {s.distanceKm != null ? formatDistance(s.distanceKm) : 'nearby'}</span></span>
                      </button>
                      <button className="flex items-start gap-3 rounded-xl border border-line p-4 text-left hover:border-moss" onClick={() => act('fulfillment', { method: 'courier' }, 'Courier selected')}>
                        <Truck className="mt-0.5 h-5 w-5 text-moss" /><span><span className="block text-sm font-semibold">Use a courier</span><span className="text-xs text-muted">est. {formatINR(s.fulfillment?.shippingEstimate || 0)} per parcel</span></span>
                      </button>
                    </div>
                  </>
                ) : s.fulfillment?.method === 'meetup' && s.fulfillment.meetupPlace ? (
                  <div className="mt-4 rounded-xl bg-moss-soft/50 p-4 text-sm">
                    <p className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-moss" /> {s.fulfillment.meetupPlace}</p>
                    <p className="mt-1 text-muted">{dateTime(s.fulfillment.meetupAt)} ({timeAgo(s.fulfillment.meetupAt)})</p>
                    <button className="mt-2 text-xs font-semibold text-moss hover:underline" onClick={() => { setForm({ meetupPlace: s.fulfillment.meetupPlace, meetupAt: '' }); setModal('meetup'); }}>Change plan</button>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[['Your parcel', myShip], [`${first(other)}’s parcel`, theirShip]].map(([label, sh]) => {
                      const c = COURIERS.find((x) => x.key === sh?.partner);
                      return (
                        <div key={label} className="rounded-xl border border-line p-4 text-sm">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
                          {sh?.trackingId ? (
                            <>
                              <p className="mt-1 font-semibold">{c?.label}</p>
                              <p className="font-mono text-xs">{sh.trackingId}</p>
                              <a href={c?.key === 'delhivery' || c?.key === 'shiprocket' ? `${c.track}${sh.trackingId}` : c?.track} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-moss hover:underline">Track parcel <ExternalLink className="h-3 w-3" /></a>
                            </>
                          ) : <p className="mt-1 text-muted">Not shipped yet</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {s.fulfillment?.method === 'courier' && !myShip?.trackingId && (s.status === 'in_progress' || theirShip) && (
                    <button className="btn-secondary" onClick={() => { setForm({ partner: 'delhivery', trackingId: '' }); setModal('ship'); }}><Truck className="h-4 w-4" /> Add my tracking number</button>
                  )}
                  {(s.status === 'in_progress' || s.fulfillment?.meetupPlace) && !iReceived && (
                    <button className="btn-primary" disabled={busy} onClick={() => act('received', {}, 'Marked as received')}><PackageCheck className="h-4 w-4" /> I received my item</button>
                  )}
                  {iReceived && <span className="badge tone-good px-3 py-1.5 text-xs">You confirmed receipt{theyReceived ? '' : ` · waiting for ${first(other)}`}</span>}
                  <button className="btn-ghost text-amber-800" onClick={() => { setForm({ reason: '', details: '' }); setModal('dispute'); }}><AlertTriangle className="h-4 w-4" /> Report a problem</button>
                  {!myShip?.trackingId && !theirShip?.trackingId && !iReceived && !theyReceived && (
                    <button className="btn-ghost text-red-700" disabled={busy} onClick={() => act('cancel', { reason: 'Cancelled before exchange' }, 'Swap cancelled')}>Cancel swap</button>
                  )}
                </div>
              </>
            )}

            {s.status === 'disputed' && (
              <div className="flex gap-3">
                <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
                <div>
                  <h2 className="font-display text-xl">Dispute under review</h2>
                  <p className="mt-1 text-sm"><span className="font-semibold">{DISPUTE_REASONS.find((d) => d.key === s.dispute?.reason)?.label}</span> — {s.dispute?.details}</p>
                  <p className="mt-2 text-sm text-muted">The ReThread team reviews disputes within 48 hours. Items stay reserved until it’s resolved.</p>
                </div>
              </div>
            )}

            {s.status === 'completed' && (
              <>
                <h2 className="flex items-center gap-2 font-display text-xl"><Leaf className="h-5 w-5 text-moss" /> Swap completed {s.completedAt && <span className="text-sm font-normal text-muted">· {dateTime(s.completedAt)}</span>}</h2>
                {(() => {
                  const imp = impactFor(get.map((i) => i.category));
                  return <p className="mt-2 text-sm text-muted">You kept about <b className="text-ink">{imp.kg} kg</b> of clothing in use — roughly <b className="text-ink">{imp.co2} kg CO₂e</b> avoided.</p>;
                })()}
                {s.dispute?.resolution && <p className="mt-2 rounded-xl bg-sand/60 p-3 text-sm">Resolution: {s.dispute.resolution}</p>}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your rating of {first(other)}</p>
                    {myRating?.stars ? (
                      <><Stars value={myRating.stars} className="mt-2" />{myRating.comment && <p className="mt-1 text-sm">“{myRating.comment}”</p>}</>
                    ) : (
                      <div className="mt-2 space-y-3">
                        <StarInput value={form.stars || 0} onChange={(v) => setForm((f) => ({ ...f, stars: v }))} />
                        <textarea className="input min-h-[70px]" maxLength={300} placeholder="How was the swap? (optional)" value={form.comment || ''} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
                        <button className="btn-primary btn-sm" disabled={!form.stars || busy} onClick={() => act('rate', { stars: form.stars, comment: form.comment || '' }, 'Thanks for rating!')}>Submit rating</button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{first(other)}’s rating of you</p>
                    {theirRating?.stars ? <><Stars value={theirRating.stars} className="mt-2" />{theirRating.comment && <p className="mt-1 text-sm">“{theirRating.comment}”</p>}</> : <p className="mt-2 text-sm text-muted">Not rated yet</p>}
                  </div>
                </div>
              </>
            )}

            {['rejected', 'cancelled'].includes(s.status) && (
              <div>
                <h2 className="font-display text-xl">{swapStatus(s.status).label}</h2>
                <p className="mt-2 text-sm text-muted">{s.closedReason || 'This swap was closed.'}</p>
                {s.dispute?.resolution && <p className="mt-2 rounded-xl bg-sand/60 p-3 text-sm">Resolution: {s.dispute.resolution}</p>}
                <Link to="/browse" className="btn-secondary mt-4">Find another swap</Link>
              </div>
            )}
          </section>

          {/* Offer history */}
          {s.offers.length > 1 && (
            <details className="card group p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between font-display text-xl">Negotiation history <ChevronDown className="h-5 w-5 transition group-open:rotate-180" /></summary>
              <ol className="mt-4 space-y-4">
                {s.offers.map((o, i) => {
                  const by = String(o.by) === String(s.requester._id) ? s.requester : s.recipient;
                  return (
                    <li key={i} className="rounded-xl border border-line p-4 text-sm">
                      <p className="font-semibold">Round {i + 1} · {by.name} <span className="font-normal text-muted">· {timeAgo(o.at)}</span></p>
                      <p className="mt-1">{o.offeredItems.map((x) => x.title).join(' + ')} <span className="text-muted">⇄</span> {o.requestedItems.map((x) => x.title).join(' + ')}</p>
                      <p className="text-xs text-muted">{formatINR(o.offeredValue)} ⇄ {formatINR(o.requestedValue)} · {o.fairness}% value match</p>
                      {o.message && <p className="mt-1 italic text-muted">“{o.message}”</p>}
                    </li>
                  );
                })}
              </ol>
            </details>
          )}
        </div>

        {/* Timeline */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h2 className="font-display text-xl">Timeline</h2>
            <ol className="relative mt-5 space-y-5 border-l border-line pl-5">
              {[...s.timeline].reverse().map((t, i) => (
                <li key={i} className="relative">
                  <span className={clsx('absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-surface', i === 0 ? 'bg-moss' : 'bg-line')} />
                  <p className="text-sm font-medium">{TIMELINE_LABEL[t.status] || swapStatus(t.status).label}</p>
                  {t.note && <p className="text-xs text-muted">{t.note}</p>}
                  <p className="mt-0.5 text-[11px] text-muted">{t.by?.name ? `${t.by.name} · ` : ''}{dateTime(t.at)}</p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      {/* Modals */}
      <Modal open={modal === 'accept'} onClose={() => setModal(null)} title="Confirm swap agreement">
        <p className="text-sm text-muted">You’ll give <b className="text-ink">{give.map((i) => i.title).join(' + ')}</b> and get <b className="text-ink">{get.map((i) => i.title).join(' + ')}</b>. All items will be reserved and other open requests for them will be closed.</p>
        <div className="mt-4"><FairnessMeter left={giveV} right={getV} compact /></div>
        <textarea className="input mt-4 min-h-[70px]" maxLength={500} placeholder="Add a note (optional)" value={form.message || ''} onChange={(e) => setForm({ message: e.target.value })} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setModal(null)}>Not yet</button>
          <button className="btn-primary" disabled={busy} onClick={() => act('respond', { action: 'accept', message: form.message || '' }, 'Swap agreed! 🎉')}>Confirm agreement</button>
        </div>
      </Modal>

      <Modal open={modal === 'reject'} onClose={() => setModal(null)} title="Decline this swap?">
        <textarea className="input min-h-[80px]" maxLength={500} placeholder={`Let ${first(other)} know why (optional) — e.g. “Looking for something closer in value”`} value={form.message || ''} onChange={(e) => setForm({ message: e.target.value })} />
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
          <button className="btn-danger" disabled={busy} onClick={() => act('respond', { action: 'reject', message: form.message || '' }, 'Swap declined')}>Decline swap</button>
        </div>
      </Modal>

      <Modal open={modal === 'counter'} onClose={() => setModal(null)} title="Make a counter-offer" wide>
        {modal === 'counter' && (
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-semibold">What you’ll give (from your closet)</p>
              <ClosetPicker items={closetMine} selected={counterGive || []} onChange={(v) => setForm((f) => (isReq ? { ...f, offered: v } : { ...f, requested: v }))} />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">What you’d like (from {first(other)}’s closet)</p>
              <ClosetPicker items={closetTheirs} selected={counterGet || []} onChange={(v) => setForm((f) => (isReq ? { ...f, requested: v } : { ...f, offered: v }))} />
            </div>
            <FairnessMeter left={valueOf(counterGive, closetMine)} right={valueOf(counterGet, closetTheirs)} />
            <textarea className="input min-h-[70px]" maxLength={500} placeholder="Explain your counter-offer (optional)" value={form.message || ''} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" disabled={busy || !form.offered?.length || !form.requested?.length} onClick={() => act('respond', { action: 'counter', offeredItemIds: form.offered, requestedItemIds: form.requested, message: form.message || '' }, 'Counter-offer sent')}>
                Send counter-offer · {fairness(valueOf(counterGive, closetMine), valueOf(counterGet, closetTheirs))}% match
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal === 'meetup'} onClose={() => setModal(null)} title="Plan a meetup">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="place">Public meeting spot</label>
            <input id="place" className="input" maxLength={120} placeholder="e.g. Hauz Khas metro station, Gate 3" value={form.meetupPlace || ''} onChange={(e) => setForm((f) => ({ ...f, meetupPlace: e.target.value }))} />
            <p className="help">Metro stations, malls and cafés work best. Avoid home addresses.</p>
          </div>
          <div>
            <label className="label" htmlFor="when">Date & time</label>
            <input id="when" type="datetime-local" className="input" min={new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16)} value={form.meetupAt || ''} onChange={(e) => setForm((f) => ({ ...f, meetupAt: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !form.meetupPlace || !form.meetupAt} onClick={() => act('fulfillment', { method: 'meetup', meetupPlace: form.meetupPlace, meetupAt: new Date(form.meetupAt).toISOString() }, 'Meetup planned')}>Save plan</button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'ship'} onClose={() => setModal(null)} title="Add tracking details">
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="courier">Courier partner</label>
            <select id="courier" className="input" value={form.partner || 'delhivery'} onChange={(e) => setForm((f) => ({ ...f, partner: e.target.value }))}>
              {COURIERS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="awb">Tracking / AWB number</label>
            <input id="awb" className="input font-mono" maxLength={30} placeholder="e.g. DLV4829105573" value={form.trackingId || ''} onChange={(e) => setForm((f) => ({ ...f, trackingId: e.target.value.trim() }))} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" disabled={busy || !/^[A-Za-z0-9-]{6,30}$/.test(form.trackingId || '')} onClick={() => act('ship', { partner: form.partner || 'delhivery', trackingId: form.trackingId }, 'Tracking shared')}>Share tracking</button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === 'dispute'} onClose={() => setModal(null)} title="Report a problem">
        <div className="space-y-4">
          <select className="input" value={form.reason || ''} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} aria-label="Reason">
            <option value="">What went wrong?</option>
            {DISPUTE_REASONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <textarea className="input min-h-[100px]" maxLength={800} placeholder="Describe what happened (10+ characters). Photos can be shared in chat." value={form.details || ''} onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))} />
          <p className="text-xs text-muted">Opening a dispute pauses the swap and alerts the ReThread team.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-danger" disabled={busy || !form.reason || (form.details || '').length < 10} onClick={() => act('dispute', { reason: form.reason, details: form.details }, 'Dispute opened')}>Open dispute</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
