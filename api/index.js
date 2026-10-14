// Vercel serverless entry: every /api/* request is handled by the Express app.
// (Socket.io is not available on serverless — the client automatically falls back to polling.)
import app from '../server/src/app.js';

export default app;
