import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { Avatar, StatusBadge } from './ui';
import { formatINR, timeAgo } from '@/lib/utils';
import { fairness } from '@shared/catalog.js';

function Stack({ items }) {
  return (
    <div className="flex -space-x-4">
      {items.slice(0, 3).map((i) => (
        <img key={i._id} src={i.images?.[0]} alt={i.title} title={i.title} className="h-16 w-12 rounded-lg border-2 border-surface object-cover shadow-sm" />
      ))}
    </div>
  );
}

export default function SwapRow({ swap, me }) {
  const iAmRequester = swap.role === 'requester' || String(swap.requester?._id) === String(me?._id);
  const other = iAmRequester ? swap.recipient : swap.requester;
  const give = iAmRequester ? swap.offeredItems : swap.requestedItems;
  const get = iAmRequester ? swap.requestedItems : swap.offeredItems;
  const gv = give.reduce((s, i) => s + (i.swapValue || 0), 0);
  const tv = get.reduce((s, i) => s + (i.swapValue || 0), 0);
  return (
    <Link to={`/swaps/${swap._id}`} className="card flex flex-col gap-4 p-4 transition hover:shadow-lift sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <Stack items={give} />
        <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted" />
        <Stack items={get} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={swap.status} />
          {swap.myTurn && <span className="badge bg-clay text-white">Your move</span>}
          <span className="text-xs text-muted">{iAmRequester ? 'You requested' : 'Request received'} · {timeAgo(swap.updatedAt)}</span>
        </div>
        <p className="mt-1.5 truncate text-sm font-medium">
          {give.map((i) => i.title).join(' + ')} <span className="text-muted">for</span> {get.map((i) => i.title).join(' + ')}
        </p>
        <p className="mt-0.5 text-xs text-muted">{formatINR(gv)} ⇄ {formatINR(tv)} · {fairness(gv, tv)}% value match</p>
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
        <Avatar user={other} size={28} />
        <span className="text-xs text-muted">{other?.name}</span>
      </div>
    </Link>
  );
}
