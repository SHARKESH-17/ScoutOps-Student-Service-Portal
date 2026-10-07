const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'scoutops',
  user: process.env.DB_USER || 'scoutops_user',
  password: process.env.DB_PASSWORD || 'change_me',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations() {
  const result = await pool.query('SELECT version FROM schema_migrations ORDER BY applied_at ASC');
  return new Set(result.rows.map((row) => row.version));
}

function listMigrationFiles() {
  return fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function status() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = listMigrationFiles();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    const state = applied.has(file) ? 'APPLIED' : 'PENDING';
    console.log(`${state} ${file}`);
  }
}

async function runMigrations() {
  await ensureMigrationsTable();

  const files = listMigrationFiles();
  const applied = await getAppliedMigrations();

  if (files.length === 0) {
    console.log('No migration files found. Nothing to apply.');
    return;
  }

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Applying migration: ${file}`);
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
    console.log(`Applied migration: ${file}`);
  }

  console.log('Database migrations complete.');
}

async function main() {
  try {
    if (process.argv.includes('--status')) {
      await status();
      return;
    }

    await runMigrations();
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
