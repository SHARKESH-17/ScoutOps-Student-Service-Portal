const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const { ADMIN_USERNAME, ADMIN_PASSWORD, DB_PASSWORD } = process.env;
const username = typeof ADMIN_USERNAME === 'string' ? ADMIN_USERNAME.trim() : '';
if (!DB_PASSWORD || !username || username.length > 100
  || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 72) {
  console.error('Set DB_PASSWORD, an ADMIN_USERNAME of at most 100 characters, and an ADMIN_PASSWORD of 12 to 72 characters.');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'scoutops',
  user: process.env.DB_USER || 'scoutops_user',
  password: DB_PASSWORD,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function bootstrapAdmin() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const result = await pool.query(
    "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (username) DO NOTHING",
    [username, passwordHash],
  );
  if (result.rowCount === 0) {
    console.log(`Bootstrap administrator "${username}" already exists; credentials were not changed.`);
    return;
  }
  console.log(`Created bootstrap administrator "${username}".`);
}

bootstrapAdmin()
  .catch((error) => {
    console.error('Administrator bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
