import postgres from 'postgres';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Prefer .env.local (local dev), fallback to .env (EC2)
const envFile = existsSync(join(root, '.env.local'))
  ? join(root, '.env.local')
  : join(root, '.env');

if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL);

// Ensure tracking table exists
await sql`
  CREATE TABLE IF NOT EXISTS _migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

const migrationsDir = join(root, 'migrations');
const allFiles = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

// On first run (tracking table is empty), detect if schema is already up to date.
// If category_budgets already has a 'month' column, all prior migrations have been
// applied by previous (untracked) runs — mark them all as applied without re-running.
const [trackedCount] = await sql`SELECT COUNT(*)::int AS n FROM _migrations`;
if (trackedCount.n === 0) {
  const [monthColExists] = await sql`
    SELECT COUNT(*)::int AS n
    FROM information_schema.columns
    WHERE table_name = 'category_budgets' AND column_name = 'month'
  `;
  if (monthColExists.n > 0) {
    console.log('First run with tracking — seeding _migrations with all existing files.');
    for (const file of allFiles) {
      await sql`INSERT INTO _migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`;
    }
    console.log('Seeded. No migrations to run.');
    await sql.end();
    process.exit(0);
  }
}

// Load already-applied migrations
const applied = new Set(
  (await sql`SELECT filename FROM _migrations`).map((r) => r.filename)
);

for (const file of allFiles) {
  if (applied.has(file)) {
    console.log(`skip ${file} (already applied)`);
    continue;
  }
  const path = join(migrationsDir, file);
  const text = readFileSync(path, 'utf8');
  console.log(`Running ${file}...`);
  await sql.unsafe(text);
  await sql`INSERT INTO _migrations (filename) VALUES (${file})`;
  console.log(`✓ ${file}`);
}

await sql.end();
console.log('Migrations complete.');
