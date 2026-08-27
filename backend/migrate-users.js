require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(80),
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      reset_code_hash TEXT,
      reset_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const email = process.env.ADMIN_EMAIL || "admin@harmonyyoga.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
     SET password_hash = EXCLUDED.password_hash, role = 'admin', name = EXCLUDED.name`,
    ["Studio Admin", email, hash]
  );

  console.log("Users table ready. Admin:", email);
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
