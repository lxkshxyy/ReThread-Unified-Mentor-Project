import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/index.js';
import { findPlace } from '../../../shared/places.js';
import {
  asyncHandler, validate, HttpError, signToken, setAuthCookie, clearAuthCookie, optionalAuth,
} from '../middleware/core.js';
import { serializeMe } from '../utils/serializers.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/[0-9]/, 'Password needs at least one number');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password,
  city: z.string().trim().min(1, 'Choose your city'),
  area: z.string().trim().min(1, 'Choose your area'),
  coords: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

const COLORS = ['#2E5E4E', '#C8643B', '#5B4B8A', '#1F6F8B', '#9A3B5B', '#7A6A2E', '#3E6B2E', '#8A4F2B'];

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, password: pw, city, area, coords } = req.body;
    if (await User.exists({ email })) throw new HttpError(409, 'That email is already registered');
    const place = findPlace(city, area);
    const point = coords || place?.coords;
    if (!point) throw new HttpError(422, 'Choose a valid location');
    const user = await User.create({
      name,
      email,
      password: pw,
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
      location: { city, area, point: { type: 'Point', coordinates: point } },
    });
    setAuthCookie(res, signToken(user));
    res.status(201).json({ user: serializeMe(user) });
  })
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    if (!user || !(await user.comparePassword(req.body.password))) {
      throw new HttpError(401, 'Incorrect email or password');
    }
    if (user.status !== 'active') {
      throw new HttpError(403, `Your account is suspended${user.suspendedReason ? `: ${user.suspendedReason}` : ''}. Contact support@rethread.in`);
    }
    user.lastActiveAt = new Date();
    await user.save();
    setAuthCookie(res, signToken(user));
    res.json({ user: serializeMe(user) });
  })
);

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// Returns { user: null } for guests (no 401 noise on every page load).
router.get(
  '/me',
  optionalAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user ? serializeMe(req.user) : null });
  })
);

export default router;
