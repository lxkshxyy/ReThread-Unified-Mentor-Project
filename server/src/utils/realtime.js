import { Notification } from '../models/index.js';

// Socket.io is attached only when running as a long-lived server (Render / local).
// On serverless (Vercel) `io` stays null and clients fall back to polling.
let io = null;
export const setIO = (instance) => {
  io = instance;
};
export const getIO = () => io;

export function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

export async function notify(userId, { type = 'info', title, body = '', link = '' }) {
  const n = await Notification.create({ user: userId, type, title, body, link });
  emitToUser(userId, 'notification:new', n);
  return n;
}
