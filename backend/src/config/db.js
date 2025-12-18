const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: __dirname + '/../../.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // optional: parse host/port/user/pass from individual vars
  // host: process.env.DATABASE_HOST,
  // port: process.env.DATABASE_PORT,
  // database: process.env.DATABASE_NAME,
  // user: process.env.DATABASE_USER,
  // password: process.env.DATABASE_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
  process.exit(-1);
});

module.exports = pool;

