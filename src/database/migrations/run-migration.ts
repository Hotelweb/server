import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Tiny one-off migration runner.
 *
 * Applies every `*.sql` file in this directory in alphabetical order.
 *
 * Splits each file into individual statements before executing, so that
 * Postgres can run statements that refuse to be combined with others
 * (notably `ALTER TYPE ... ADD VALUE`, which can't be in a multi-statement
 * transaction on some PG versions).
 *
 * Statements are idempotent (each uses `IF NOT EXISTS` / `DO $$ ... EXCEPTION`)
 * so re-running is safe.
 *
 * Usage:
 *   pnpm run migrate
 *   # or
 *   pnpm exec ts-node src/database/migrations/run-migration.ts
 */
async function run(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'a25_db',
  });

  await client.connect();

  const dir = __dirname;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const path = join(dir, file);
    const raw = readFileSync(path, 'utf-8');
    const statements = splitSql(raw);

    console.log(`▶ Applying ${file} (${statements.length} statements)…`);

    for (const [idx, sql] of statements.entries()) {
      const preview = sql.replace(/\s+/g, ' ').slice(0, 80);
      try {
        await client.query(sql);
        console.log(`  ${String(idx + 1).padStart(2, '0')}. ✅ ${preview}`);
      } catch (err) {
        // "duplicate value" / "already exists" / "column ... already exists"
        // are expected on re-runs; everything else aborts.
        const msg = (err as Error).message;
        if (
          /already exists|duplicate_object|duplicate column/i.test(msg) ||
          /enum value already exists/i.test(msg)
        ) {
          console.log(
            `  ${String(idx + 1).padStart(2, '0')}. ↪  skipped (already applied) — ${preview}`,
          );
          continue;
        }
        console.error(`  ${String(idx + 1).padStart(2, '0')}. ❌ ${preview}`);
        console.error(`     ${msg}`);
        await client.end();
        process.exit(1);
      }
    }

    console.log(`✅ ${file} applied\n`);
  }

  await client.end();
  console.log('🎉 All migrations applied successfully');
}

/**
 * Splits a SQL file into individual statements, respecting `DO $$ ... $$`
 * dollar-quoted blocks and stripping `--` line comments.
 */
function splitSql(raw: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;

  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    // Strip leading-of-line single-line comments (keep ones inside strings alone — we don't have any)
    const line = rawLine.replace(/--.*$/, '');

    if (!line.trim() && !buf.trim()) continue;

    buf += line + '\n';

    if (line.includes('$$')) {
      // Toggle for every $$ encountered on this line
      const matches = line.match(/\$\$/g);
      if (matches) {
        for (let i = 0; i < matches.length; i++) inDollar = !inDollar;
      }
    }

    if (!inDollar && line.trimEnd().endsWith(';')) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
    }
  }

  if (buf.trim()) out.push(buf.trim());
  return out;
}

void run();
