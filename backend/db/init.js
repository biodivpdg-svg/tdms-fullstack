require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool, testConnection } = require('../config/db');

async function init() {
  console.log('\n🚀  Initializing TDMS database...\n');
  await testConnection();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅  Schema & seed data applied successfully.\n');
  } catch (err) {
    console.error('❌  Error applying schema:', err.message);
  } finally {
    await pool.end();
  }
}

init();
