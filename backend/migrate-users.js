require("dotenv").config();
const bcrypt = require("bcryptjs");
const { pool } = require("./db");

async function ensureAdminUser() {
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

  const email = String(process.env.ADMIN_EMAIL || "admin@yoga.com")
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const hash = await bcrypt.hash(password, 10);
  const emails = new Set([email, "admin@yoga.com"]);

  for (const adminEmail of emails) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role = 'admin', name = EXCLUDED.name`,
      ["Studio Admin", adminEmail, hash]
    );
  }

  console.log("Users table ready. Admin:", [...emails].join(", "));
}

async function migrate() {
  await ensureAdminUser();
  await pool.end();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureAdminUser };
