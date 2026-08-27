require("dotenv").config();
const { spawnSync } = require("child_process");
const { Pool } = require("pg");

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function waitForDatabase() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      const tables = await pool.query("SELECT to_regclass('public.outlets') AS outlets");
      const empty = !tables.rows[0].outlets;
      await pool.end();
      return empty;
    } catch (err) {
      console.log(`Waiting for PostgreSQL (${attempt}/40)...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error("PostgreSQL did not become ready");
}

waitForDatabase()
  .then((needsSeed) => {
    if (needsSeed) {
      run("seed.js");
    }
    run("migrate-users.js");
    run("migrate-schedule.js");
    run("migrate-reviews.js");
    require("./index.js");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
