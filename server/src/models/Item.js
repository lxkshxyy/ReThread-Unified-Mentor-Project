import mongoose from 'mongoose';
import { CATEGORIES, CONDITIONS, GENDERS, AGE_BUCKETS } from '../../../shared/catalog.js';

const itemSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    category: { type: String, enum: CATEGORIES.map((c) => c.key), required: true },
    gender: { type: String, enum: GENDERS.map((g) => g.key), required: true },
    size: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, maxlength: 40 },
    brandTier: { type: String, default: 'mid' },
    condition: { type: String, enum: CONDITIONS.map((c) => c.key), required: true },
    color: { type: String, trim: true, maxlength: 30, default: '' },
    material: { type: String, trim: true, maxlength: 40, default: '' },
    age: { type: String, enum: AGE_BUCKETS.map((a) => a.key), default: 'lt1' },
    originalPrice: { type: Number, min: 0, max: 1000000 },
    estimatedValue: { type: Number, required: true },
    swapValue: { type: Number, required: true },
    lookingFor: { type: [String], default: [] }, // category keys the owner would like in return
    images: {
      type: [String],
      validate: [(v) => v.length >= 1 && v.length <= 5, 'Add between 1 and 5 photos'],
    },
    location: {
      city: String,
      area: String,
      point: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] },
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'swapped', 'removed'],
      default: 'available',
      index: true,
    },
    moderation: {
      removedByAdmin: { type: Boolean, default: false },
      reason: { type: String, default: '' },
      reportsCount: { type: Number, default: 0 },
    },
    views: { type: Number, default: 0 },
    favoritesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

itemSchema.index({ 'location.point': '2dsphere' });
itemSchema.index({ status: 1, category: 1, createdAt: -1 });

export default mongoose.model('Item', itemSchema);
