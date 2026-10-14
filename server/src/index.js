import http from 'node:http';
import { Server } from 'socket.io';
import cookie from 'cookie';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { ensureSeeded } from './seed/seed.js';
import { verifyToken, COOKIE_NAME } from './middleware/core.js';
import { setIO } from './utils/realtime.js';
import { User } from './models/index.js';

const server = http.createServer(app);

// Real-time layer (chat messages, swap status, notifications).
const io = new Server(server, {
  cors: { origin: env.clientOrigin, credentials: true },
  path: '/socket.io',
});

io.use(async (socket, next) => {
  try {
    const cookies = cookie.parse(socket.handshake.headers.cookie || '');
    const token = cookies[COOKIE_NAME] || socket.handshake.auth?.token;
    const payload = token && verifyToken(token);
    if (!payload) return next(new Error('unauthorized'));
    const user = await User.findById(payload.sub).select('_id status');
    if (!user || user.status !== 'active') return next(new Error('unauthorized'));
    socket.data.userId = String(user._id);
    next();
  } catch (e) {
    next(e);
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);
  socket.on('typing', ({ conversationId, to }) => {
    if (typeof to === 'string' && /^[a-f0-9]{24}$/.test(to)) {
      io.to(`user:${to}`).emit('typing', { conversationId, from: socket.data.userId });
    }
  });
});

setIO(io);

async function start() {
  await connectDB();
  if (env.autoSeed) await ensureSeeded();
  server.listen(env.port, () => {
    console.log(`[api] ReThread running on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
