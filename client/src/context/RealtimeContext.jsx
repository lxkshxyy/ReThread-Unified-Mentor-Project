import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext(null);

/**
 * Live updates: Socket.io when the API runs as a long-lived server, automatic
 * fallback to polling on serverless hosts (e.g. Vercel) where websockets aren't available.
 */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const listeners = useRef(new Map());
  const socketRef = useRef(null);

  const emitLocal = useCallback((event, payload) => {
    (listeners.current.get(event) || []).forEach((fn) => fn(payload));
  }, []);

  const on = useCallback((event, fn) => {
    const list = listeners.current.get(event) || [];
    listeners.current.set(event, [...list, fn]);
    return () => listeners.current.set(event, (listeners.current.get(event) || []).filter((f) => f !== fn));
  }, []);

  const refreshCounts = useCallback(async () => {
    if (!user) return;
    try {
      const [m, n] = await Promise.all([api.get('/chat/unread'), api.get('/notifications')]);
      setUnreadMessages(m.data.unread);
      setUnreadNotifications(n.data.unread);
    } catch {
      /* ignore */
    }
  }, [user]);

  // Socket connection
  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return undefined;
    }
    const socket = io({ path: '/socket.io', withCredentials: true, reconnectionAttempts: 3, timeout: 6000, transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('message:new', (p) => {
      emitLocal('message:new', p);
      if (String(p.message.sender) !== String(user._id)) setUnreadMessages((n) => n + 1);
    });
    socket.on('swap:update', (p) => emitLocal('swap:update', p));
    socket.on('chat:read', () => refreshCounts());
    socket.on('typing', (p) => emitLocal('typing', p));
    socket.on('notification:new', (n) => {
      setUnreadNotifications((c) => c + 1);
      emitLocal('notification:new', n);
      if (n.type !== 'message') toast(n.title, { icon: '🔔' });
    });
    refreshCounts();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, emitLocal, refreshCounts]);

  // Polling fallback (fast when sockets are unavailable, slow heartbeat otherwise)
  useEffect(() => {
    if (!user) return undefined;
    const id = setInterval(refreshCounts, connected ? 60000 : 15000);
    return () => clearInterval(id);
  }, [user, connected, refreshCounts]);

  const sendTyping = useCallback((conversationId, to) => {
    socketRef.current?.emit('typing', { conversationId, to });
  }, []);

  const value = useMemo(
    () => ({ connected, on, unreadMessages, unreadNotifications, refreshCounts, setUnreadNotifications, sendTyping }),
    [connected, on, unreadMessages, unreadNotifications, refreshCounts, sendTyping]
  );
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
