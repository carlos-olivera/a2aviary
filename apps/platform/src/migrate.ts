import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';
import { createPool } from './database.ts';
import { readConfig } from './config.ts';

export async function migrationFiles() {
  return (await readdir(new URL('../migrations/',import.meta.url))).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
}
export async function migrationInventory(pool: Pool) {
  const expected=await migrationFiles();
  const actual=(await pool.query('SELECT name,sha256 FROM platform_migration ORDER BY name')).rows;
  if(actual.length!==expected.length || actual.some((r,i)=>r.name!==expected[i]))throw new Error('Migration inventory requires owner reconciliation');
  for(const row of actual){const sql=await readFile(new URL('../migrations/'+row.name,import.meta.url));if(createHash('sha256').update(sql).digest('hex')!==row.sha256)throw new Error('Immutable migration changed');}
  return expected;
}
export async function migrate(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('a2aviary-platform-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS platform_migration (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const directory = new URL('../migrations/', import.meta.url);
    const names=await migrationFiles();
    const applied=(await client.query('SELECT name FROM platform_migration')).rows;
    if(applied.some(row=>!names.includes(row.name)))throw new Error('Unexpected applied migration; owner reconciliation required');
    for (const name of names) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const sha256 = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query('SELECT sha256 FROM platform_migration WHERE name=$1', [name]);
      if (previous.rowCount) {
        if (previous.rows[0].sha256 !== sha256) throw new Error(`Immutable migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO platform_migration(name,sha256) VALUES($1,$2)', [name, sha256]);
    }
    await client.query('COMMIT');
  } catch (error) {await client.query('ROLLBACK'); throw error;}
  finally {client.release();}
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool(readConfig().databaseUrl);
  try {await migrate(pool); console.log('Platform migrations applied');} finally {await pool.end();}
}
