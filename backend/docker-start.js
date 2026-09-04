require("dotenv").config();
const path = require("path");
const { spawnSync } = require("child_process");
const { Pool } = require("pg");
const { poolOptions } = require("./db");

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

function startDockerDatabase() {
  const compose = path.join(__dirname, "..", "docker-compose.dev.yml");
  console.log("Starting local Postgres with Docker (port 5433)...");
  const result = spawnSync(
    "docker",
    ["compose", "-f", compose, "up", "-d", "database"],
    { cwd: path.join(__dirname, ".."), stdio: "inherit", shell: true }
  );
  if (result.status !== 0) {
    console.log(
      "Docker could not start Postgres. Open Docker Desktop, wait until it is running, then from the project folder run:\n  docker compose -f docker-compose.dev.yml up -d database"
    );
  }
}

async function waitForDatabase() {
  const pool = new Pool(poolOptions());
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    try {
      await pool.query("SELECT 1");
      const tables = await pool.query("SELECT to_regclass('public.outlets') AS outlets");
      const empty = !tables.rows[0].outlets;
      await pool.end();
      return empty;
    } catch (err) {
      if (attempt === 1 || attempt === 3) {
        startDockerDatabase();
      }
      console.log(`Waiting for PostgreSQL on ${process.env.DATABASE_URL} (${attempt}/50)...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw new Error(
    "Could not connect to the local database.\n" +
      "1. Start Docker Desktop and wait until it says running.\n" +
      "2. From G:\\projects\\yoga_website run: docker compose -f docker-compose.dev.yml up -d database\n" +
      "3. Then run: node docker-start.js (from the backend folder).\n" +
      "Postgres is mapped to localhost:5433 (not 5432)."
  );
}

waitForDatabase()
  .then((needsSeed) => {
    if (needsSeed) {
      run("seed.js");
    }
    run("migrate-users.js");
    run("migrate-schedule.js");
    run("migrate-reviews.js");
    run("migrate-payments.js");
    run("migrate-media.js");
    run("migrate-files.js");
    run("migrate-studio.js");
    require("./index.js");
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
