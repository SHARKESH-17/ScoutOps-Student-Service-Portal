const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD must be set before connecting to PostgreSQL.');
}

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'scoutops',
  user: process.env.DB_USER || 'scoutops_user',
  password: process.env.DB_PASSWORD,
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

async function withTransaction(callback) {
  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');
    const result = await callback(connection);
    await connection.query('COMMIT');
    return result;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  } finally {
    connection.release();
  }
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection,
  closePool,
};
