const db = require("./db");

async function ensureReviewColumns() {
  await db.query(`
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source VARCHAR(40) DEFAULT 'website';
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS google_review_id VARCHAR(255);
    ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_photo TEXT;
    ALTER TABLE site_info ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);
    ALTER TABLE site_info ADD COLUMN IF NOT EXISTS google_synced_at TIMESTAMP;
  `);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reviews_google_review_id_key
    ON reviews (google_review_id)
  `);
}

async function getSite() {
  const result = await db.query("SELECT * FROM site_info ORDER BY id LIMIT 1");
  return result.rows[0] || null;
}

async function upsertGoogleReviews(reviews = []) {
  for (const item of reviews) {
    const google_review_id = `${item.author_name || "guest"}-${item.time || Date.now()}`;
    await db.query(
      `INSERT INTO reviews
       (trainer_id, client_name, rating, comment, is_home_featured, source, google_review_id, author_photo)
       VALUES (NULL, $1, $2, $3, TRUE, 'google', $4, $5)
       ON CONFLICT (google_review_id) DO UPDATE
       SET rating = EXCLUDED.rating,
           comment = EXCLUDED.comment,
           author_photo = EXCLUDED.author_photo,
           is_home_featured = TRUE`,
      [
        item.author_name || "Google reviewer",
        item.rating || 5,
        item.text || "",
        google_review_id,
        item.profile_photo_url || null,
      ]
    );
  }
}

async function syncGoogleReviews(force = false) {
  await ensureReviewColumns();
  const site = await getSite();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID || site?.google_place_id;
  if (!apiKey || !placeId) {
    return {
      synced: 0,
      skipped: true,
      reason: !apiKey
        ? "Add GOOGLE_PLACES_API_KEY in backend/.env"
        : "Add a Google Place ID in Admin → Reviews",
    };
  }
  if (!force && site?.google_synced_at) {
    const age = Date.now() - new Date(site.google_synced_at).getTime();
    if (age < 30 * 60 * 1000) {
      return { synced: 0, skipped: true, reason: "Recently synced" };
    }
  }
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=name,rating,reviews,user_ratings_total,url&key=${apiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.status !== "OK") {
    return {
      synced: 0,
      skipped: true,
      reason: data.error_message || data.status || "Google Places request failed",
    };
  }
  const reviews = data.result?.reviews || [];
  await upsertGoogleReviews(reviews);
  await db.query(
    `UPDATE site_info SET google_place_id = $1, google_synced_at = NOW() WHERE id = $2`,
    [placeId, site.id]
  );
  return {
    synced: reviews.length,
    skipped: false,
    rating: data.result?.rating || null,
    total: data.result?.user_ratings_total || reviews.length,
    maps_url: data.result?.url || null,
  };
}

function googleWriteUrl(placeId) {
  if (!placeId) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

module.exports = {
  ensureReviewColumns,
  getSite,
  syncGoogleReviews,
  googleWriteUrl,
};
