const { Pool, types } = require("pg");

// Return DATE columns as plain "YYYY-MM-DD" strings. Converting them to JS Dates
// shifts them by the server's timezone (e.g. a due date of Dec 28 showed as Dec 27).
types.setTypeParser(1082, (value) => value);

function useSsl(connectionString) {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return true;
  if (!connectionString) return false;
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) return false;
  return true;
}

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: useSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  poolOptions: () => ({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : undefined,
  }),
};
