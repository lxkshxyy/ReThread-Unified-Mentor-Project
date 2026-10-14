import mongoose from 'mongoose';
import User from './User.js';
import Item from './Item.js';
import Swap from './Swap.js';

const { ObjectId } = mongoose.Schema.Types;

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: ObjectId, ref: 'User', required: true }],
    key: { type: String, unique: true }, // sorted participant ids → one thread per pair
    item: { type: ObjectId, ref: 'Item' }, // item the chat started from (context)
    swap: { type: ObjectId, ref: 'Swap' }, // most recent swap between the pair
    lastMessage: { text: String, sender: { type: ObjectId, ref: 'User' }, at: Date },
    unread: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);
conversationSchema.index({ participants: 1, updatedAt: -1 });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: ObjectId, ref: 'User' }, // null for system messages
    type: { type: String, enum: ['text', 'system', 'offer'], default: 'text' },
    text: { type: String, maxlength: 1000, required: true },
    swap: { type: ObjectId, ref: 'Swap' },
  },
  { timestamps: true }
);
messageSchema.index({ conversation: 1, createdAt: 1 });

const imageSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: 'User', required: true },
    contentType: { type: String, required: true },
    size: Number,
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['item', 'user'], required: true },
    item: { type: ObjectId, ref: 'Item' },
    user: { type: ObjectId, ref: 'User' },
    reason: { type: String, required: true },
    details: { type: String, maxlength: 500, default: '' },
    status: { type: String, enum: ['open', 'actioned', 'dismissed'], default: 'open', index: true },
    handledBy: { type: ObjectId, ref: 'User' },
    note: String,
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, default: 'info' },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, createdAt: -1 });

const metaSchema = new mongoose.Schema({ _id: String, value: mongoose.Schema.Types.Mixed, at: Date });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
export const Image = mongoose.model('Image', imageSchema);
export const Report = mongoose.model('Report', reportSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Meta = mongoose.model('Meta', metaSchema);
export { User, Item, Swap };
