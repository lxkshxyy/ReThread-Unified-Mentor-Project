import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, MessagesSquare, ArrowLeftRight, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { api, errorMessage } from '@/lib/api';
import { useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/context/AuthContext';
import { useRealtime } from '@/context/RealtimeContext';
import { Avatar, EmptyState, Spinner, StatusBadge } from '@/components/ui';
import { timeAgo } from '@/lib/utils';
import { ACTIVE_SWAP_STATUSES } from '@shared/catalog.js';

const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const fmtDay = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function ConversationList({ list, activeId, loading }) {
  if (loading) return <div className="grid place-items-center p-10"><Spinner /></div>;
  if (!list.length) return <p className="p-6 text-center text-sm text-muted">No conversations yet. Message a member from any listing.</p>;
  return (
    <ul>
      {list.map((c) => (
        <li key={c._id}>
          <Link to={`/chat/${c._id}`} className={clsx('flex items-center gap-3 border-b border-line/60 px-4 py-3.5 transition hover:bg-paper', activeId === c._id && 'bg-moss-soft/50')}>
            <Avatar user={c.other} size={42} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={clsx('truncate text-sm', c.unread ? 'font-bold' : 'font-medium')}>{c.other?.name}</p>
                <span className="shrink-0 text-[11px] text-muted">{c.lastMessage?.at && timeAgo(c.lastMessage.at)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className={clsx('truncate text-xs', c.unread ? 'text-ink' : 'text-muted')}>{c.lastMessage?.text || 'Say hello 👋'}</p>
                {c.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
              </div>
              {c.swap && <div className="mt-1"><StatusBadge status={c.swap.status} /></div>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Thread({ id, onActivity }) {
  const { user } = useAuth();
  const { on, connected, refreshCounts, sendTyping } = useRealtime();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [swaps, setSwaps] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);
  const bottom = useRef(null);
  const lastAt = useRef(null);
  const typingTimer = useRef(null);

  const markRead = useCallback(() => api.post(`/chat/conversations/${id}/read`).then(() => { refreshCounts(); onActivity?.(); }).catch(() => {}), [id, refreshCounts, onActivity]);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/chat/conversations/${id}`);
      setConv(data.conversation);
      setMessages(data.messages);
      setSwaps(data.swaps);
      lastAt.current = data.messages.at(-1)?.createdAt || null;
      setError(null);
      markRead();
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id, markRead]);

  const poll = useCallback(async () => {
    try {
      const { data } = await api.get(`/chat/conversations/${id}`, { params: lastAt.current ? { after: lastAt.current } : {} });
      if (data.messages.length) {
        setMessages((m) => {
          const ids = new Set(m.map((x) => x._id));
          return [...m, ...data.messages.filter((x) => !ids.has(x._id))];
        });
        lastAt.current = data.messages.at(-1).createdAt;
        setSwaps(data.swaps);
        markRead();
      }
    } catch {
      /* ignore transient */
    }
  }, [id, markRead]);

  useEffect(() => {
    setConv(null);
    setMessages([]);
    load();
  }, [load]);

  // Realtime via socket, polling fallback when sockets aren't available.
  useEffect(() => {
    const off1 = on('message:new', (p) => {
      if (p.conversationId !== id) return;
      setMessages((m) => (m.some((x) => x._id === p.message._id) ? m : [...m, p.message]));
      lastAt.current = p.message.createdAt;
      if (String(p.message.sender) !== String(user._id)) markRead();
      if (p.message.type !== 'text') api.get(`/chat/conversations/${id}`).then(({ data }) => setSwaps(data.swaps)).catch(() => {});
    });
    const off2 = on('typing', (p) => {
      if (p.conversationId !== id) return;
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 2500);
    });
    return () => { off1(); off2(); };
  }, [on, id, user._id, markRead]);

  useEffect(() => {
    if (connected) return undefined;
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, [connected, poll]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, typing]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    if (/\b(upi|gpay|paytm|phonepe|bank account|ifsc)\b/i.test(body)) {
      toast('Reminder: ReThread swaps never involve payments.', { icon: '⚠️' });
    }
    setSending(true);
    try {
      const { data } = await api.post(`/chat/conversations/${id}/messages`, { text: body });
      setMessages((m) => (m.some((x) => x._id === data.message._id) ? m : [...m, data.message]));
      lastAt.current = data.message.createdAt;
      setText('');
      onActivity?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (error) return <div className="grid h-full place-items-center p-6 text-sm text-red-700">{error}</div>;
  if (!conv) return <div className="grid h-full place-items-center"><Spinner /></div>;

  const active = swaps.find((s) => ACTIVE_SWAP_STATUSES.includes(s.status)) || swaps[0];
  let lastDay = '';

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Link to="/chat" className="rounded-full p-1.5 hover:bg-sand md:hidden" aria-label="Back"><ArrowLeft className="h-5 w-5" /></Link>
        <Avatar user={conv.other} size={40} />
        <div className="min-w-0 flex-1">
          <Link to={`/profile/${conv.other?._id}`} className="block truncate font-semibold hover:underline">{conv.other?.name}</Link>
          <p className="truncate text-xs text-muted">{typing ? <span className="text-moss">typing…</span> : `${conv.other?.location?.area || ''}${conv.other?.location?.city ? `, ${conv.other.location.city}` : ''}`}</p>
        </div>
        <span className="hidden items-center gap-1 text-[11px] text-muted sm:flex" title={connected ? 'Live updates' : 'Auto-refreshing every few seconds'}>
          {connected ? <Wifi className="h-3.5 w-3.5 text-moss" /> : <WifiOff className="h-3.5 w-3.5" />} {connected ? 'Live' : 'Auto-refresh'}
        </span>
      </header>

      {active && (
        <Link to={`/swaps/${active._id}`} className="flex items-center gap-3 border-b border-line bg-moss-soft/40 px-4 py-2.5 transition hover:bg-moss-soft/70">
          <div className="flex -space-x-2">
            {[...active.offeredItems, ...active.requestedItems].slice(0, 3).map((i) => <img key={i._id} src={i.images[0]} alt="" className="h-9 w-8 rounded-md border-2 border-surface object-cover" />)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium"><ArrowLeftRight className="mr-1 inline h-3 w-3" />{active.offeredItems.map((i) => i.title).join(' + ')} ⇄ {active.requestedItems.map((i) => i.title).join(' + ')}</p>
            <div className="mt-0.5 flex items-center gap-2"><StatusBadge status={active.status} />{String(active.awaiting) === String(user._id) && <span className="badge bg-clay text-white">Your move</span>}</div>
          </div>
          <span className="shrink-0 text-xs font-semibold text-moss"><span className="hidden sm:inline">View swap </span>→</span>
        </Link>
      )}

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto bg-paper px-4 py-5">
        <div className="mx-auto mb-4 flex max-w-sm items-start gap-2 rounded-xl bg-surface p-3 text-[11px] text-muted shadow-sm">
          <ShieldAlert className="h-4 w-4 shrink-0 text-moss" /> Keep chats on ReThread, meet in public places and never send money — swaps are always free.
        </div>
        {messages.map((m) => {
          const day = fmtDay(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = String(m.sender) === String(user._id);
          return (
            <div key={m._id}>
              {showDay && <p className="my-3 text-center text-[11px] font-medium text-muted">{day}</p>}
              {m.type === 'system' ? (
                <p className="mx-auto my-2 max-w-md rounded-full bg-sand px-4 py-1.5 text-center text-xs text-ink/80">{m.text}</p>
              ) : (
                <div className={clsx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={clsx('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', mine ? 'rounded-br-md bg-moss text-white' : 'rounded-bl-md bg-surface', m.type === 'offer' && (mine ? 'bg-moss-dark' : 'border border-moss/30 bg-moss-soft'))}>
                    {m.type === 'offer' && <p className={clsx('mb-0.5 text-[10px] font-bold uppercase tracking-wider', mine ? 'text-white/70' : 'text-moss')}>Swap offer</p>}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={clsx('mt-0.5 text-right text-[10px]', mine ? 'text-white/60' : 'text-muted')}>{fmtTime(m.createdAt)}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-surface p-3">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (conv.other?._id) sendTyping(id, String(conv.other._id));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) send(e);
          }}
          maxLength={1000}
          placeholder="Write a message…"
          className="input max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl"
          aria-label="Message"
        />
        <button className="btn-primary h-11 w-11 shrink-0 p-0" disabled={sending || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}

export default function Chat() {
  useDocumentTitle('Messages');
  const { id } = useParams();
  const { on } = useRealtime();
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/conversations');
      setList(data.conversations);
      return data.conversations;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList().then((l) => {
      if (!id && l.length && window.innerWidth >= 768) navigate(`/chat/${l[0]._id}`, { replace: true });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => on('message:new', () => loadList()), [on, loadList]);
  useEffect(() => {
    const t = setInterval(loadList, 20000);
    return () => clearInterval(t);
  }, [loadList]);

  return (
    <div className="container-page py-4 sm:py-6">
      <div className="card grid h-[calc(100vh-7.5rem)] supports-[height:100dvh]:h-[calc(100dvh-7.5rem)] grid-cols-1 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={clsx('flex min-w-0 flex-col border-r border-line', id && 'hidden md:flex')}>
          <div className="border-b border-line px-4 py-4">
            <h1 className="text-2xl">Messages</h1>
          </div>
          <div className="thin-scroll flex-1 overflow-y-auto">
            <ConversationList list={list} activeId={id} loading={loading} />
          </div>
        </aside>
        <section className={clsx('min-h-0 min-w-0', !id && 'hidden md:block')}>
          {id ? (
            <Thread key={id} id={id} onActivity={loadList} />
          ) : (
            <div className="grid h-full place-items-center p-6">
              <EmptyState icon={MessagesSquare} title="Your conversations">Pick a chat on the left, or message a member from any listing to start negotiating a swap.</EmptyState>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
