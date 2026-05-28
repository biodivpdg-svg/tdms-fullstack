const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const useSSL = process.env.DB_SSL === 'true' || (connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'));

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'tdms',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

poolConfig.max = 10;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 2000;

const pool = new Pool(poolConfig);

async function testConnection() {
  try {
    console.log('🔄 Attempting to connect to PostgreSQL...');
    if (connectionString) {
      console.log('ℹ️ Using DATABASE_URL connection string (SSL:', useSSL ? 'enabled' : 'disabled', ')');
    } else {
      console.log(`ℹ️ Using connection parameters -> Host: ${poolConfig.host}, Port: ${poolConfig.port}, Database: ${poolConfig.database}, User: ${poolConfig.user}`);
    }
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now');
    console.log('✅ PostgreSQL connected —', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('   Error stack:', err.stack);
    console.error('   Check your .env DB_* settings and make sure PostgreSQL is running.');
  }
}

module.exports = { pool, testConnection };
