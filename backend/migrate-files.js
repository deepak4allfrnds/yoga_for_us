const fs = require("fs");
const path = require("path");
const db = require("./db");

const uploadsDir = path.join(__dirname, "uploads");

async function ensureFileCache() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS file_cache (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120),
      byte_size INTEGER,
      data BYTEA NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS file_cache_filename_idx ON file_cache (filename);
  `);
}

async function storeFileBuffer(filename, mimeType, buffer) {
  await ensureFileCache();
  const result = await db.query(
    `INSERT INTO file_cache (filename, mime_type, byte_size, data)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (filename) DO UPDATE
       SET mime_type = EXCLUDED.mime_type,
           byte_size = EXCLUDED.byte_size,
           data = EXCLUDED.data
     RETURNING id, filename, mime_type, byte_size`,
    [
      filename,
      mimeType || "application/octet-stream",
      buffer.length,
      buffer,
    ]
  );
  const row = result.rows[0];
  return {
    ...row,
    url: `/api/files/${row.id}`,
    image_url: `/api/files/${row.id}`,
  };
}

async function importDiskUploads() {
  if (!fs.existsSync(uploadsDir)) return 0;
  const names = fs.readdirSync(uploadsDir).filter((name) => {
    const full = path.join(uploadsDir, name);
    return fs.statSync(full).isFile();
  });
  let imported = 0;
  for (const name of names) {
    const exists = await db.query("SELECT id FROM file_cache WHERE filename = $1", [name]);
    if (exists.rows[0]) continue;
    const buffer = fs.readFileSync(path.join(uploadsDir, name));
    const ext = path.extname(name).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".gif"
            ? "image/gif"
            : ext === ".mp4"
              ? "video/mp4"
              : ext === ".webm"
                ? "video/webm"
                : ext === ".mov"
                  ? "video/quicktime"
                  : "image/jpeg";
    await storeFileBuffer(name, mime, buffer);
    imported += 1;
  }
  return imported;
}

async function rewriteStoredUrls() {
  const files = await db.query("SELECT id, filename FROM file_cache");
  for (const file of files.rows) {
    const oldUrl = `/uploads/${file.filename}`;
    const nextUrl = `/api/files/${file.id}`;
    await db.query("UPDATE classes SET image_url = $1 WHERE image_url = $2", [nextUrl, oldUrl]);
    await db.query("UPDATE trainers SET image_url = $1 WHERE image_url = $2", [nextUrl, oldUrl]);
    await db.query("UPDATE media_items SET url = $1 WHERE url = $2", [nextUrl, oldUrl]);
    await db.query("UPDATE workshops SET image_url = $1 WHERE image_url = $2", [nextUrl, oldUrl]);
  }
}

async function migrate() {
  await ensureFileCache();
  const imported = await importDiskUploads();
  await rewriteStoredUrls();
  console.log(`File cache ready. Imported ${imported} disk upload(s) into the database.`);
  await db.pool.end();
}

if (require.main === module) {
  require("dotenv").config();
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  ensureFileCache,
  storeFileBuffer,
  importDiskUploads,
  rewriteStoredUrls,
};
