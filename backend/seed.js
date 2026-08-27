require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function seed() {
  const sql = fs.readFileSync(
    path.join(__dirname, "..", "database", "schema.sql"),
    "utf8"
  );
  await pool.query(sql);
  console.log("PostgreSQL schema and seed data applied.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
