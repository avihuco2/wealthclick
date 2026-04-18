import postgres from 'postgres';
import { readFileSync, existsSync } from 'fs';
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

const migrations = ['002_transactions.sql', '003_bank_accounts.sql', '004_bank_accounts_scrape_enabled.sql', '005_settings.sql', '006_scrape_history.sql', '007_category_rules.sql', '008_api_keys.sql', '009_whatsapp.sql'];

for (const file of migrations) {
  const path = join(root, 'migrations', file);
  if (!existsSync(path)) {
    console.warn(`Skipping ${file} (not found)`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  console.log(`Running ${file}...`);
  await sql.unsafe(text);
  console.log(`✓ ${file}`);
}

await sql.end();
console.log('Migrations complete.');
