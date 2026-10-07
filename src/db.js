const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'scoutops',
  user: process.env.DB_USER || 'scoutops_user',
  password: process.env.DB_PASSWORD || 'change_me',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function testConnection() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0];
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  testConnection,
  closePool,
};
