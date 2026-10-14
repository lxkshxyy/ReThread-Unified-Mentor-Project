import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    phone: { type: String, trim: true, maxlength: 15, select: false },
    bio: { type: String, trim: true, maxlength: 280, default: '' },
    avatarColor: { type: String, default: '#2E5E4E' },
    location: {
      city: { type: String, trim: true, default: '' },
      area: { type: String, trim: true, default: '' },
      point: { type: pointSchema, default: undefined },
    },
    sizes: {
      top: { type: String, default: '' },
      bottom: { type: String, default: '' },
      footwear: { type: String, default: '' },
    },
    preferences: { type: [String], default: [] }, // categories they want
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    rating: { avg: { type: Number, default: 0 }, count: { type: Number, default: 0 } },
    stats: {
      swapsCompleted: { type: Number, default: 0 },
      kgDiverted: { type: Number, default: 0 },
    },
    lastActiveAt: { type: Date, default: Date.now },
    suspendedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.index({ 'location.point': '2dsphere' });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    name: this.name,
    avatarColor: this.avatarColor,
    bio: this.bio,
    location: { city: this.location?.city, area: this.location?.area },
    rating: this.rating,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
