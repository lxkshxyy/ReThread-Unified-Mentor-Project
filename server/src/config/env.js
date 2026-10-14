import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  // Fail loudly in production rather than signing tokens with a guessable secret.
  console.warn('[env] JWT_SECRET is not set — set it in your hosting dashboard.');
}

export const env = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpires: process.env.JWT_EXPIRES || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  autoSeed: process.env.AUTO_SEED !== 'false',
  useMemoryDb: process.env.USE_MEMORY_DB === 'true' || (!process.env.MONGODB_URI && !isProd),
};
