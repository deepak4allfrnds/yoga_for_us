require("dotenv").config();
const { ensureReviewColumns } = require("./googleReviews");
const db = require("./db");

async function migrate() {
  await ensureReviewColumns();
  console.log("Review columns ready for website and Google reviews.");
  await db.pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
