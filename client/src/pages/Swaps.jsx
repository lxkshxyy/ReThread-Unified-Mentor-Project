import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Repeat2 } from 'lucide-react';
import { useFetch, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { EmptyState, ErrorState, PageLoader, Tabs } from '@/components/ui';
import SwapRow from '@/components/SwapRow';
import { ACTIVE_SWAP_STATUSES } from '@shared/catalog.js';

export default function Swaps() {
  useDocumentTitle('My swaps');
  const { user } = useAuth();
  const { on } = useRealtime();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'action';
  const { data, loading, error, reload } = useFetch('/swaps');
  useEffect(() => on('swap:update', () => reload(true)), [on, reload]);

  const groups = useMemo(() => {
    const swaps = data?.swaps || [];
    return {
      action: swaps.filter((s) => s.myTurn || (['accepted', 'in_progress'].includes(s.status))),
      incoming: swaps.filter((s) => s.role === 'recipient' && ACTIVE_SWAP_STATUSES.includes(s.status)),
      outgoing: swaps.filter((s) => s.role === 'requester' && ACTIVE_SWAP_STATUSES.includes(s.status)),
      history: swaps.filter((s) => !ACTIVE_SWAP_STATUSES.includes(s.status)),
    };
  }, [data]);

  const tabs = [
    { key: 'action', label: 'Needs attention', count: groups.action.length },
    { key: 'incoming', label: 'Incoming', count: 0 },
    { key: 'outgoing', label: 'Sent', count: 0 },
    { key: 'history', label: 'History', count: 0 },
  ];
  const list = groups[tab] || [];

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Swaps</p>
          <h1 className="mt-2 text-4xl">Requests & swap history</h1>
        </div>
        <Link to="/browse" className="btn-primary">Find something to swap</Link>
      </div>
      <Tabs className="mt-6 w-fit max-w-full" tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />
      <div className="mt-6 space-y-3">
        {loading && !data ? (
          <PageLoader />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState icon={Repeat2} title={tab === 'action' ? 'Nothing needs your attention' : 'No swaps here yet'}>
            {tab === 'history' ? 'Completed, declined and cancelled swaps will appear here.' : 'When you send or receive a swap request, it shows up here.'}
          </EmptyState>
        ) : (
          list.map((s) => <SwapRow key={s._id} swap={s} me={user} />)
        )}
      </div>
    </div>
  );
}
