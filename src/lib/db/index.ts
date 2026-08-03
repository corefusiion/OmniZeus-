import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let connectionString = '';
try {
  if (typeof process !== "undefined" && process.env) {
    connectionString = process.env.DATABASE_URL || '';
  }
} catch {}

if (!connectionString) {
  connectionString = 'postgres://mock:mock@mock:5432/mock';
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
