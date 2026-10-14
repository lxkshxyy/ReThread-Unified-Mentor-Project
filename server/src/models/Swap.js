import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const offerSchema = new mongoose.Schema(
  {
    by: { type: ObjectId, ref: 'User', required: true },
    offeredItems: [{ type: ObjectId, ref: 'Item' }], // always items owned by the requester
    requestedItems: [{ type: ObjectId, ref: 'Item' }], // always items owned by the recipient
    offeredValue: Number,
    requestedValue: Number,
    fairness: Number,
    message: { type: String, maxlength: 500, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const shipmentSchema = new mongoose.Schema(
  {
    partner: String,
    trackingId: String,
    shippedAt: Date,
  },
  { _id: false }
);

const swapSchema = new mongoose.Schema(
  {
    requester: { type: ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: ObjectId, ref: 'User', required: true, index: true },
    // Current agreed / proposed terms (mirror of the latest offer)
    offeredItems: [{ type: ObjectId, ref: 'Item' }],
    requestedItems: [{ type: ObjectId, ref: 'Item' }],
    offers: [offerSchema],
    awaiting: { type: ObjectId, ref: 'User' }, // whose move it is while negotiating
    status: {
      type: String,
      enum: ['pending', 'countered', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'disputed'],
      default: 'pending',
      index: true,
    },
    distanceKm: Number,
    fulfillment: {
      method: { type: String, enum: ['meetup', 'courier'], default: 'meetup' },
      meetupPlace: String,
      meetupAt: Date,
      shippingEstimate: Number,
      requesterShipment: shipmentSchema,
      recipientShipment: shipmentSchema,
    },
    received: {
      requester: { type: Boolean, default: false },
      recipient: { type: Boolean, default: false },
    },
    ratings: {
      byRequester: { stars: Number, comment: String },
      byRecipient: { stars: Number, comment: String },
    },
    dispute: {
      raisedBy: { type: ObjectId, ref: 'User' },
      reason: String,
      details: String,
      status: { type: String, enum: ['open', 'resolved'] },
      resolution: String,
      outcome: { type: String, enum: ['completed', 'cancelled'] },
      resolvedBy: { type: ObjectId, ref: 'User' },
      createdAt: Date,
      resolvedAt: Date,
    },
    timeline: [
      {
        _id: false,
        status: String,
        note: String,
        by: { type: ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
    conversation: { type: ObjectId, ref: 'Conversation' },
    closedReason: String,
    completedAt: Date,
  },
  { timestamps: true }
);

swapSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('Swap', swapSchema);
