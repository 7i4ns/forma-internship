import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(93251017)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const folder = resolve(process.cwd(), 'migrations');
    for (const name of (await readdir(folder)).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      if ((await client.query('SELECT name FROM schema_migrations WHERE name=$1', [name])).rowCount) continue;
      await client.query(await readFile(resolve(folder, name), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
      console.log(`Applied ${name}`);
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); await pool.end(); }
}
migrate().catch(error => { console.error(error); process.exitCode = 1; });
