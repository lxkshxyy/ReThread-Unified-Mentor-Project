import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';

export const COOKIE_NAME = 'rt_token';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpires });
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/' });
}

export function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.[COOKIE_NAME] || null;
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

async function loadUser(req) {
  const token = readToken(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await User.findById(payload.sub);
  if (!user || user.status !== 'active') return null;
  // Track activity at most once every 5 minutes (feeds "active users" KPI).
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > 5 * 60 * 1000) {
    User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
  }
  return user;
}

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = await loadUser(req);
  next();
});

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const user = await loadUser(req);
  if (!user) throw new HttpError(401, 'Please log in to continue');
  req.user = user;
  next();
});

export const requireAdmin = asyncHandler(async (req, _res, next) => {
  if (!req.user) req.user = await loadUser(req);
  if (!req.user) throw new HttpError(401, 'Please log in to continue');
  if (req.user.role !== 'admin') throw new HttpError(403, 'Admins only');
  next();
});

// Zod validation: replaces req[source] with the parsed (typed, stripped) value.
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new HttpError(422, issues[0]?.message || 'Invalid input', issues));
  }
  req[source] = result.data;
  next();
};

// Strip MongoDB operator keys ($gt, $where…) and dotted keys from user input (NoSQL injection guard).
function clean(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) delete obj[key];
    else clean(obj[key]);
  }
  return obj;
}
export const sanitize = (req, _res, next) => {
  clean(req.body);
  clean(req.params);
  if (req.query) clean(req.query);
  next();
};

export function notFound(_req, _res, next) {
  next(new HttpError(404, 'Not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  if (err.name === 'ValidationError') {
    status = 422;
    message = Object.values(err.errors)[0]?.message || 'Invalid data';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid id';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That email is already registered';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'Image is too large (max 2 MB)';
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && env.isProd ? 'Something went wrong' : message, details: err.details });
}
