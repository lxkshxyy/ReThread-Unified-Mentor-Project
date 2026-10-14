// npm run seed  → wipes the database and loads the realistic demo data.
import { connectDB, disconnectDB } from '../config/db.js';
import { seedDatabase } from './seed.js';
import { Meta } from '../models/index.js';

await connectDB();
await seedDatabase({ reset: true });
await Meta.updateOne({ _id: 'seeded' }, { value: 'demo', at: new Date() }, { upsert: true });
await disconnectDB();
console.log('[seed] done. Demo login: aanya@rethread.in / Demo@1234 · Admin: admin@rethread.in / Admin@1234');
