require("dotenv").config();
const { pool } = require("./db");

async function ensureScheduleTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS weekly_schedules (
      id SERIAL PRIMARY KEY,
      outlet_id INTEGER REFERENCES outlets(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      trainer_id INTEGER REFERENCES trainers(id) ON DELETE SET NULL,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
      start_time VARCHAR(20) NOT NULL,
      end_time VARCHAR(20) NOT NULL,
      mode VARCHAR(20) NOT NULL DEFAULT 'studio'
    );

    CREATE TABLE IF NOT EXISTS class_enrollments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
      mode VARCHAR(20) NOT NULL,
      whatsapp VARCHAR(40),
      meet_link TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (user_id, class_id, mode)
    );

    ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS starts_at DATE;
    ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS ends_at DATE;
    ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS payment_id INTEGER;
    ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(40) DEFAULT 'unpaid';

    CREATE TABLE IF NOT EXISTS attendance (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
      outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL,
      session_date DATE NOT NULL,
      present BOOLEAN NOT NULL DEFAULT TRUE,
      UNIQUE (user_id, class_id, session_date)
    );
  `);

  // Seed the demo timetable only once, and only for studios/classes/teachers that
  // still exist. Re-seeding with hard-coded ids after an admin deleted classes (or
  // cleared the timetable) broke deploys with a weekly_schedules_class_id_fkey error.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_seeds (
      key VARCHAR(255) PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  const seeded = await pool.query("SELECT 1 FROM app_seeds WHERE key = 'schedule:demo'");
  const existing = await pool.query("SELECT COUNT(*)::int AS n FROM weekly_schedules");
  if (!seeded.rows[0] && existing.rows[0].n === 0) {
    await pool.query(`
      INSERT INTO weekly_schedules (outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode)
      SELECT v.outlet_id, v.class_id, t.id, v.day_of_week, v.start_time, v.end_time, v.mode
      FROM (VALUES
      (1, 1, 1, 1, '06:30', '07:30', 'studio'),
      (1, 1, 1, 2, '06:30', '07:30', 'studio'),
      (1, 1, 1, 3, '06:30', '07:30', 'studio'),
      (1, 1, 1, 4, '06:30', '07:30', 'studio'),
      (1, 1, 1, 5, '06:30', '07:30', 'studio'),
      (1, 1, 1, 6, '07:00', '08:00', 'studio'),
      (1, 2, 2, 1, '18:00', '19:15', 'studio'),
      (1, 2, 2, 3, '18:00', '19:15', 'studio'),
      (1, 2, 2, 5, '18:00', '19:15', 'studio'),
      (2, 3, 3, 1, '07:00', '08:15', 'studio'),
      (2, 3, 3, 2, '07:00', '08:15', 'studio'),
      (2, 3, 3, 3, '07:00', '08:15', 'studio'),
      (2, 3, 3, 4, '07:00', '08:15', 'studio'),
      (2, 3, 3, 5, '07:00', '08:15', 'studio'),
      (2, 3, 3, 6, '08:00', '09:15', 'studio'),
      (2, 3, 3, 7, '08:00', '09:15', 'studio'),
      (2, 5, 2, 2, '18:30', '19:45', 'studio'),
      (2, 5, 2, 4, '18:30', '19:45', 'studio'),
      (3, 6, 4, 1, '06:00', '06:45', 'studio'),
      (3, 6, 4, 2, '06:00', '06:45', 'studio'),
      (3, 6, 4, 3, '06:00', '06:45', 'studio'),
      (3, 6, 4, 4, '06:00', '06:45', 'studio'),
      (3, 6, 4, 5, '06:00', '06:45', 'studio'),
      (3, 6, 4, 6, '06:00', '06:45', 'studio'),
      (3, 6, 4, 7, '07:00', '07:45', 'studio'),
      (3, 4, 3, 6, '09:00', '10:00', 'studio'),
      (1, 1, 1, 1, '07:00', '08:00', 'online'),
      (1, 2, 2, 2, '19:00', '20:00', 'online'),
      (1, 3, 3, 3, '08:00', '09:00', 'online'),
      (1, 6, 4, 4, '07:00', '07:45', 'online'),
      (1, 5, 2, 5, '18:30', '19:30', 'online'),
      (1, 1, 1, 6, '08:00', '09:00', 'online'),
      (1, 6, 4, 7, '08:00', '08:45', 'online')
      ) AS v (outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode)
      JOIN outlets o ON o.id = v.outlet_id
      JOIN classes c ON c.id = v.class_id
      LEFT JOIN trainers t ON t.id = v.trainer_id
    `);
  }
  await pool.query("INSERT INTO app_seeds (key) VALUES ('schedule:demo') ON CONFLICT DO NOTHING");
}

async function migrate() {
  await ensureScheduleTables();
  console.log("Schedule, enrollment, and attendance tables ready.");
  await pool.end();
}

if (require.main === module) {
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureScheduleTables };
