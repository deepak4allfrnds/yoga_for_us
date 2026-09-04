const db = require("./db");

const CLASS_SEED = [
  ["Regular Yoga", "Balanced asana practice for everyday strength, flexibility, and calm.", 2499, "Drop-in or membership", "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80"],
  ["Power Yoga", "Athletic flows to build heat, stamina, and focus.", 3299, "75 min", "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&w=1200&q=80"],
  ["Weight Loss Yoga", "Dynamic sequences plus breathwork to support a healthier body.", 2999, "60 min", "https://images.unsplash.com/photo-1518611012118-696072aa5798?auto=format&fit=crop&w=1200&q=80"],
  ["Meditation", "Guided sits and mantra to settle the mind.", 1899, "45 min", "https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=1200&q=80"],
  ["Pranayama", "Breath techniques you can use every day.", 1899, "45 min", "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80"],
  ["Zumba", "High-energy dance fitness with a joyful studio vibe.", 2199, "60 min", "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=1200&q=80"],
  ["Beginners Yoga", "Slow foundations for first-timers and returning students.", 1999, "60 min", "https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80"],
  ["Senior Citizen Yoga", "Gentle, joint-friendly practice with chairs and props.", 1799, "45 min", "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80"],
  ["Personal/Private Yoga", "One-to-one session. Pick your preferred date and time.", 2499, "60 min private", "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80"],
];

async function ensureStudioTables() {
  await db.query(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS kind VARCHAR(40) DEFAULT 'class';
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS ref_id INTEGER;

    CREATE TABLE IF NOT EXISTS site_settings (
      id SERIAL PRIMARY KEY,
      whatsapp VARCHAR(40),
      instagram_url TEXT,
      facebook_url TEXT,
      youtube_url TEXT,
      maps_embed_url TEXT,
      maps_link TEXT,
      default_meet_link TEXT
    );
    ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS default_meet_link TEXT;

    CREATE TABLE IF NOT EXISTS membership_plans (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      duration_months INTEGER NOT NULL,
      access_type VARCHAR(40) NOT NULL,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      description TEXT,
      active BOOLEAN DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      plan_id INTEGER REFERENCES membership_plans(id) ON DELETE SET NULL,
      email VARCHAR(255),
      starts_at DATE,
      expires_at DATE,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      payment_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS private_bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      student_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(40),
      preferred_date DATE NOT NULL,
      preferred_time VARCHAR(20) NOT NULL,
      notes TEXT,
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      payment_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workshops (
      id SERIAL PRIMARY KEY,
      category VARCHAR(80) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      location TEXT,
      start_date DATE,
      end_date DATE,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      image_url TEXT,
      seats INTEGER DEFAULT 20,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workshop_bookings (
      id SERIAL PRIMARY KEY,
      workshop_id INTEGER REFERENCES workshops(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      student_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(40),
      status VARCHAR(40) NOT NULL DEFAULT 'pending',
      confirmed BOOLEAN DEFAULT FALSE,
      payment_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS free_trials (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(40),
      class_interest VARCHAR(255),
      preferred_date DATE,
      mode VARCHAR(20),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS attendance_qr (
      id SERIAL PRIMARY KEY,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
      session_date DATE NOT NULL,
      code VARCHAR(64) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  for (const [title, description, price, duration, image_url] of CLASS_SEED) {
    const exists = await db.query("SELECT id FROM classes WHERE title = $1", [title]);
    if (!exists.rows[0]) {
      await db.query(
        `INSERT INTO classes (title, description, price, duration, image_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [title, description, price, duration, image_url]
      );
    }
  }

  const plans = await db.query("SELECT COUNT(*)::int AS n FROM membership_plans");
  if (plans.rows[0].n === 0) {
    await db.query(`
      INSERT INTO membership_plans (name, duration_months, access_type, price, description) VALUES
      ('3 months · Online only', 3, 'online', 4999, 'Live Zoom/Meet classes, timetable, and recordings access.'),
      ('6 months · Online only', 6, 'online', 8999, 'Live online classes with quarterly check-ins.'),
      ('1 year · Online only', 12, 'online', 14999, 'Full year of live online yoga and meditation.'),
      ('3 months · Studio + Online', 3, 'both', 8999, 'Studio floor access plus live online classes.'),
      ('6 months · Studio + Online', 6, 'both', 15999, 'Offline and online practice for half a year.'),
      ('1 year · Studio + Online', 12, 'both', 27999, 'Premium membership for studio and live online classes.')
    `);
  }

  const settings = await db.query("SELECT COUNT(*)::int AS n FROM site_settings");
  if (settings.rows[0].n === 0) {
    await db.query(`
      INSERT INTO site_settings (whatsapp, instagram_url, facebook_url, youtube_url, maps_link)
      VALUES ('918384887724', 'https://instagram.com/', 'https://facebook.com/', 'https://youtube.com/',
              'https://maps.google.com/?q=Yoga+For+Us')
    `);
  }

  const workshops = await db.query("SELECT COUNT(*)::int AS n FROM workshops");
  if (workshops.rows[0].n === 0) {
    await db.query(`
      INSERT INTO workshops (category, title, description, location, start_date, end_date, price, image_url, seats) VALUES
      ('workshop', 'Yoga workshop weekend', 'Alignment, breath, and philosophy in a focused weekend.', 'Studio', CURRENT_DATE + 14, CURRENT_DATE + 15, 3499,
       'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80', 25),
      ('meditation', 'Meditation session', 'Evening sit with guided pranayama and silence.', 'Studio / Online', CURRENT_DATE + 7, CURRENT_DATE + 7, 499,
       'https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=1200&q=80', 40),
      ('retreat', 'Yoga retreat', 'Two-day restore retreat with sattvic meals.', 'Hills nearby', CURRENT_DATE + 30, CURRENT_DATE + 32, 12999,
       'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80', 16),
      ('rishikesh', 'Rishikesh trip', 'Ganga, temples, and twice-daily asana. Book online and we confirm your seat.', 'Rishikesh', CURRENT_DATE + 45, CURRENT_DATE + 50, 24999,
       'https://images.unsplash.com/photo-1545389336-cf090694435e?auto=format&fit=crop&w=1200&q=80', 12),
      ('event', 'Special community event', 'Kirtan, tea, and open practice for students and friends.', 'Studio', CURRENT_DATE + 21, CURRENT_DATE + 21, 299,
       'https://images.unsplash.com/photo-1518611012118-696072aa5798?auto=format&fit=crop&w=1200&q=80', 60)
    `);
  }
}

async function getSettings() {
  const result = await db.query("SELECT * FROM site_settings ORDER BY id LIMIT 1");
  return result.rows[0] || null;
}

async function fulfillPaidPayment(payment) {
  const kind = payment.kind || "class";
  const ref = payment.ref_id;
  if (kind === "membership" && ref) {
    const plan = await db.query("SELECT * FROM membership_plans WHERE id = $1", [ref]);
    const row = plan.rows[0];
    if (!row) return;
    const exists = await db.query("SELECT id FROM memberships WHERE payment_id = $1", [payment.id]);
    if (exists.rows[0]) return;
    const months = Number(row.duration_months || 3);
    await db.query(
      `INSERT INTO memberships (user_id, plan_id, email, starts_at, expires_at, status, payment_id)
       VALUES ($1, $2, $3, CURRENT_DATE, (CURRENT_DATE + ($4::int * INTERVAL '1 month'))::date, 'active', $5)`,
      [payment.user_id || null, row.id, payment.email, months, payment.id]
    );
  }
  if (kind === "workshop" && ref) {
    await db.query(
      `UPDATE workshop_bookings SET status = 'paid', payment_id = $1
       WHERE id = $2`,
      [payment.id, ref]
    );
  }
  if (kind === "private" && ref) {
    await db.query(
      `UPDATE private_bookings SET status = 'paid', payment_id = $1 WHERE id = $2`,
      [payment.id, ref]
    );
  }
  if (kind === "class" && payment.class_id) {
    let userId = payment.user_id;
    if (!userId && payment.email) {
      const found = await db.query("SELECT id FROM users WHERE lower(email) = lower($1)", [
        payment.email,
      ]);
      userId = found.rows[0]?.id || null;
    }
    if (!userId) return;
    const course = await db.query("SELECT duration FROM classes WHERE id = $1", [payment.class_id]);
    const weeksMatch = String(course.rows[0]?.duration || "").match(/(\d+)\s*week/i);
    const weeks = weeksMatch ? Number(weeksMatch[1]) : 8;
    const chunk = () => Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 3);
    const meet = `https://meet.google.com/${chunk()}-${chunk()}${chunk().slice(0, 1)}-${chunk()}`;
    await db.query(
      `INSERT INTO class_enrollments
         (user_id, class_id, outlet_id, mode, meet_link, starts_at, ends_at, payment_id, payment_status)
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, (CURRENT_DATE + ($6::int * INTERVAL '1 week'))::date, $7, 'paid')
       ON CONFLICT (user_id, class_id, mode) DO UPDATE
       SET meet_link = COALESCE(class_enrollments.meet_link, EXCLUDED.meet_link),
           starts_at = COALESCE(class_enrollments.starts_at, EXCLUDED.starts_at),
           ends_at = EXCLUDED.ends_at,
           payment_id = EXCLUDED.payment_id,
           payment_status = 'paid'`,
      [
        userId,
        payment.class_id,
        payment.outlet_id || null,
        payment.mode === "studio" ? "studio" : "online",
        meet,
        weeks,
        payment.id,
      ]
    );
  }
}

async function migrate() {
  await ensureStudioTables();
  console.log("Studio programs, memberships, workshops, and settings ready.");
  await db.pool.end();
}

if (require.main === module) {
  require("dotenv").config();
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureStudioTables, getSettings, fulfillPaidPayment };
