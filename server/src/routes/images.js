import { Router } from 'express';
import multer from 'multer';
import { Image } from '../models/index.js';
import { asyncHandler, HttpError, requireAuth } from '../middleware/core.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new HttpError(415, 'Only JPG, PNG or WebP images are allowed'));
    }
    cb(null, true);
  },
});

// Magic-byte check so a renamed file can't masquerade as an image.
function looksLikeImage(buf) {
  if (!buf || buf.length < 12) return false;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const webp = buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  return jpg || png || webp;
}

// POST /api/images — one image per request (client compresses to ~1200px first).
router.post(
  '/',
  requireAuth,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(422, 'Choose an image to upload');
    if (!looksLikeImage(req.file.buffer)) throw new HttpError(415, 'That file is not a valid image');
    const recent = await Image.countDocuments({ owner: req.user._id, createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) } });
    if (recent > 60) throw new HttpError(429, 'Upload limit reached — try again in a while');
    const img = await Image.create({ owner: req.user._id, contentType: req.file.mimetype, size: req.file.size, data: req.file.buffer });
    res.status(201).json({ url: `/api/images/${img._id}` });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!/^[a-f0-9]{24}$/.test(req.params.id)) throw new HttpError(404, 'Image not found');
    const img = await Image.findById(req.params.id);
    if (!img) throw new HttpError(404, 'Image not found');
    res.set('Content-Type', img.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(img.data);
  })
);

export default router;
