require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

async function seed() {
  const candidates = [
    process.env.SCHEMA_PATH,
    path.join(__dirname, "..", "database", "schema.sql"),
    path.join(__dirname, "schema.sql"),
  ].filter(Boolean);
  const schemaFile = candidates.find((file) => fs.existsSync(file));
  if (!schemaFile) {
    throw new Error(
      "schema.sql not found. Set SCHEMA_PATH or keep database/schema.sql next to backend."
    );
  }
  const sql = fs.readFileSync(schemaFile, "utf8");
  await pool.query(sql);
  console.log("PostgreSQL schema and seed data applied.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
