const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.DB_PASSWORD) {
  console.error('Migration failed: DB_PASSWORD must be set before connecting to PostgreSQL.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'scoutops',
  user: process.env.DB_USER || 'scoutops_user',
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

async function ensureMigrationsTable(connection = pool) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(connection = pool) {
  const result = await connection.query('SELECT version FROM schema_migrations ORDER BY applied_at ASC');
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
  const connection = await pool.connect();
  let locked = false;
  try {
    await ensureMigrationsTable(connection);
    await connection.query('SELECT pg_advisory_lock(731904271)');
    locked = true;
    const files = listMigrationFiles();
    const applied = await getAppliedMigrations(connection);
    if (files.length === 0) {
      console.log('No migration files found. Nothing to apply.');
      return;
    }

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await connection.query('BEGIN');
        console.log(`Applying migration: ${file}`);
        await connection.query(sql);
        await connection.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
        await connection.query('COMMIT');
        console.log(`Applied migration: ${file}`);
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      }
    }
    console.log('Database migrations complete.');
  } finally {
    try {
      if (locked) await connection.query('SELECT pg_advisory_unlock(731904271)');
    } finally {
      connection.release();
    }
  }
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
