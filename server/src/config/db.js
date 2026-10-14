import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

// Cached across hot reloads and serverless invocations.
const g = globalThis;
g.__rtMongo ||= { conn: null, promise: null, memory: null };

async function resolveUri() {
  if (env.mongoUri) return env.mongoUri;
  if (env.useMemoryDb) {
    // Local development without MongoDB installed: spin up an in-memory server.
    // Indirect specifier keeps this dev-only package out of serverless bundles.
    const pkg = 'mongodb-memory-server';
    const { MongoMemoryServer } = await import(pkg);
    g.__rtMongo.memory ||= await MongoMemoryServer.create();
    console.log('[db] Using in-memory MongoDB (data resets on restart)');
    return g.__rtMongo.memory.getUri('rethread');
  }
  throw new Error('MONGODB_URI is not set');
}

export async function connectDB() {
  const cache = g.__rtMongo;
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    cache.promise = resolveUri().then((uri) =>
      mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 10 })
    );
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (g.__rtMongo.memory) await g.__rtMongo.memory.stop();
  g.__rtMongo = { conn: null, promise: null, memory: null };
}
