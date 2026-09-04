const db = require("./db");

async function ensureMediaTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS media_items (
      id SERIAL PRIMARY KEY,
      media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('image', 'video')),
      title VARCHAR(255) NOT NULL,
      caption TEXT,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const count = await db.query("SELECT COUNT(*)::int AS n FROM media_items");
  if (count.rows[0].n === 0) {
    await db.query(`
      INSERT INTO media_items (media_type, title, caption, url, sort_order) VALUES
      ('image', 'Morning sun salutation', 'Start the day with breath and light.', 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1400&q=80', 1),
      ('image', 'Studio flow', 'Alignment-focused practice in a calm room.', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=80', 2),
      ('image', 'Restore and yin', 'Long holds to settle the nervous system.', 'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1400&q=80', 3),
      ('video', 'Yoga for beginners', 'A gentle guided practice you can follow at home.', 'https://www.youtube.com/watch?v=v7AYKMP6rOE', 4)
    `);
  }
}

async function migrate() {
  await ensureMediaTable();
  console.log("Media table ready for yoga images and videos.");
  await db.pool.end();
}

if (require.main === module) {
  require("dotenv").config();
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureMediaTable };
