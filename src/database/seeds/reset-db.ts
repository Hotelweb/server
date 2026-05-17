/**
 * Drop the application database and recreate it from scratch, then exit.
 *
 * Connects to the default `postgres` maintenance database (since you can't
 * drop a DB while you're connected to it), terminates any other sessions
 * holding `a25_db`, drops it, and re-creates it. The schema + seed rows are
 * applied by the regular `pnpm run seed` afterwards.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function reset() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '5432', 10);
  const username = process.env.DB_USERNAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  const dbName = process.env.DB_NAME || 'a25_db';

  // Connect to the maintenance DB so we can DROP/CREATE the target one.
  const client = new Client({
    host,
    port,
    user: username,
    password,
    database: 'postgres',
  });

  console.log(`🔌 Connecting to ${host}:${port} as ${username}…`);
  await client.connect();

  try {
    // Kick out any other clients still using the DB (otherwise DROP fails).
    console.log(`✂  Terminating active connections to "${dbName}"…`);
    await client.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid)
       FROM pg_stat_activity
       WHERE pg_stat_activity.datname = $1
         AND pid <> pg_backend_pid()`,
      [dbName],
    );

    console.log(`💣 Dropping database "${dbName}" if it exists…`);
    // pg_quote_ident equivalent: PG identifier quoting via double-quotes is fine here
    // since dbName comes from our own env, not user input.
    await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);

    console.log(`✨ Creating database "${dbName}"…`);
    await client.query(`CREATE DATABASE "${dbName}"`);

    console.log(`✅ Database "${dbName}" reset complete.`);
  } finally {
    await client.end();
  }
}

reset().catch((err) => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
