import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, Handshake, Truck, Sparkles, Plus, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { EmptyState, ErrorState, FairnessMeter, PageLoader, Avatar, Modal } from '@/components/ui';
import ClosetPicker from '@/components/ClosetPicker';
import { MiniItem } from '@/components/ItemCard';
import { shippingEstimate, categoryByKey, fairness } from '@shared/catalog.js';
import { formatINR, formatDistance } from '@/lib/utils';

export default function SwapRequest() {
  useDocumentTitle('Request a swap');
  const [params] = useSearchParams();
  const itemId = params.get('item');
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true });
  const [requested, setRequested] = useState([itemId]);
  const [offered, setOffered] = useState(params.get('offer') ? params.get('offer').split(',') : []);
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState('meetup');
  const [busy, setBusy] = useState(false);
  const [addMore, setAddMore] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await api.get(`/items/${itemId}`);
        if (d.isOwner) {
          toast.error('That’s your own listing');
          return navigate(`/items/${itemId}`);
        }
        if (d.activeSwap) {
          toast('You already have a request for this item', { icon: 'ℹ️' });
          return navigate(`/swaps/${d.activeSwap._id}`);
        }
        const [mine, theirs] = await Promise.all([
          api.get('/users/me/items'),
          api.get('/items', { params: { owner: d.item.owner._id, limit: 48 } }),
        ]);
        setState({ loading: false, item: d.item, matches: d.matches, mine: mine.data.items.filter((i) => i.status === 'available'), theirs: theirs.data.items });
      } catch (err) {
        setState({ loading: false, error: errorMessage(err) });
      }
    })();
  }, [itemId, navigate]);

  const byId = useMemo(() => Object.fromEntries([...(state.mine || []), ...(state.theirs || []), ...(state.item ? [state.item] : [])].map((i) => [i._id, i])), [state]);
  const offeredItems = offered.map((id) => byId[id]).filter(Boolean);
  const requestedItems = requested.map((id) => byId[id]).filter(Boolean);
  const give = offeredItems.reduce((s, i) => s + i.swapValue, 0);
  const get = requestedItems.reduce((s, i) => s + i.swapValue, 0);
  const score = fairness(give, get);
  const dist = state.item?.distanceKm ?? null;
  const weight = [...offeredItems, ...requestedItems].reduce((s, i) => s + (categoryByKey(i.category)?.kg || 0.4), 0) / 2 || 0.5;
  const ship = shippingEstimate(dist ?? 0, weight);

  const submit = async () => {
    if (!offered.length) return toast.error('Pick at least one item to offer');
    setBusy(true);
    try {
      const { data } = await api.post('/swaps', { requestedItemIds: requested, offeredItemIds: offered, message, method });
      toast.success('Swap request sent!');
      navigate(`/swaps/${data.swap._id}`);
    } catch (err) {
      const swapId = err?.response?.data?.details?.swapId;
      toast.error(errorMessage(err));
      if (swapId) navigate(`/swaps/${swapId}`);
    } finally {
      setBusy(false);
    }
  };

  if (state.loading) return <PageLoader />;
  if (state.error) return <div className="container-page py-16"><ErrorState message={state.error} /></div>;
  const { item, mine, theirs, matches } = state;
  const owner = item.owner;
  const others = theirs.filter((t) => !requested.includes(t._id));

  return (
    <div className="container-page py-8">
      <p className="eyebrow">Swap request</p>
      <h1 className="mt-2 text-4xl">Propose a swap with {owner.name.split(' ')[0]}</h1>
      <p className="mt-2 text-muted">Pick what you’ll give. {owner.name.split(' ')[0]} can accept, decline or send a counter-offer.</p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* You get */}
          <section className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">You get</h2>
              <div className="flex items-center gap-2 text-sm text-muted"><Avatar user={owner} size={24} /> {owner.name}</div>
            </div>
            <div className="mt-4 space-y-3">
              {requestedItems.map((it) => (
                <MiniItem key={it._id} item={it} right={requested.length > 1 && it._id !== itemId && (
                  <button onClick={() => setRequested(requested.filter((r) => r !== it._id))} className="rounded-full p-1.5 text-muted hover:bg-sand" aria-label="Remove"><X className="h-4 w-4" /></button>
                )} />
              ))}
            </div>
            {others.length > 0 && requested.length < 3 && (
              <button onClick={() => setAddMore(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-moss hover:underline">
                <Plus className="h-4 w-4" /> Add another item from {owner.name.split(' ')[0]}’s closet ({others.length})
              </button>
            )}
          </section>

          {/* You give */}
          <section className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">You give <span className="text-sm font-normal text-muted">(up to 3)</span></h2>
              <Link to="/items/new" className="text-sm font-semibold text-moss hover:underline">+ List a new item</Link>
            </div>
            {matches?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="flex items-center gap-1 text-xs font-semibold text-moss"><Sparkles className="h-3.5 w-3.5" /> Suggested:</span>
                {matches.map((m) => (
                  <button key={m.items.map((i) => i._id).join()} onClick={() => setOffered(m.items.map((i) => i._id))} className="chip">
                    {m.items.map((i) => i.title.split(' ').slice(0, 3).join(' ')).join(' + ')} · {m.fairness}%
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4">
              {mine.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} title="Your closet is empty" action={<Link to="/items/new" className="btn-primary">List your first item</Link>}>
                  Swaps are item-for-item. List something you no longer wear to make an offer.
                </EmptyState>
              ) : (
                <ClosetPicker items={mine} selected={offered} onChange={setOffered} />
              )}
            </div>
          </section>

          {/* Message & method */}
          <section className="card space-y-5 p-6">
            <div>
              <label htmlFor="msg" className="label">Message <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="msg" className="input min-h-[100px]" maxLength={500} placeholder={`Hi ${owner.name.split(' ')[0]}! I love this piece — would you swap for…`} value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="help">{message.length}/500 · Never share bank or UPI details. Swaps on ReThread are always free.</p>
            </div>
            <div>
              <p className="label">How would you like to exchange?</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { key: 'meetup', icon: Handshake, title: 'Local meetup', text: dist != null ? `${formatDistance(dist)} · free` : 'Meet at a public place · free' },
                  { key: 'courier', icon: Truck, title: 'Courier', text: `${ship.zone} · est. ${formatINR(ship.amount)} per parcel` },
                ].map((m) => (
                  <button type="button" key={m.key} onClick={() => setMethod(m.key)} aria-pressed={method === m.key} className={clsx('flex items-start gap-3 rounded-xl border p-4 text-left transition', method === m.key ? 'border-moss bg-moss-soft/40 ring-2 ring-moss/15' : 'border-line hover:border-ink/30')}>
                    <m.icon className="mt-0.5 h-5 w-5 text-moss" />
                    <span><span className="block text-sm font-semibold">{m.title}</span><span className="block text-xs text-muted">{m.text}</span></span>
                  </button>
                ))}
              </div>
              <p className="help">You can change this later in the swap.</p>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5">
            <h2 className="font-display text-xl">Swap summary</h2>
            <div className="mt-4"><FairnessMeter left={give} right={get} /></div>
            {offered.length > 0 && score < 60 && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Uneven swaps are often declined. Consider adding an item or picking a suggested match.</p>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">You give</p>
                {offeredItems.length ? offeredItems.map((i) => <MiniItem key={i._id} item={i} className="mb-2" />) : <p className="text-sm text-muted">Nothing selected yet</p>}
              </div>
              <div className="border-t border-line pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">You get</p>
                {requestedItems.map((i) => <MiniItem key={i._id} item={i} className="mb-2" />)}
              </div>
            </div>
            <button className="btn-primary mt-5 w-full py-3" onClick={submit} disabled={busy || !offered.length}>
              <ArrowLeftRight className="h-4 w-4" /> {busy ? 'Sending…' : 'Send swap request'}
            </button>
          </div>
        </aside>
      </div>

      <Modal open={addMore} onClose={() => setAddMore(false)} title={`More from ${owner.name.split(' ')[0]}`} wide>
        <ClosetPicker items={others} selected={requested.filter((r) => r !== itemId)} max={3 - 1} onChange={(sel) => setRequested([itemId, ...sel])} />
        <button className="btn-primary mt-5 w-full" onClick={() => setAddMore(false)}>Done</button>
      </Modal>
    </div>
  );
}
