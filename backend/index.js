require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("./db");
const { requireAdmin, requireAuth } = require("./middleware/auth");
const {
  ensureReviewColumns,
  syncGoogleReviews,
  getSite,
  googleWriteUrl,
} = require("./googleReviews");

const app = express();
const PORT = process.env.PORT || 4000;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function corsOrigin() {
  const raw = process.env.CLIENT_ORIGIN;
  if (!raw || raw === "*") return true;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] || true;
  return list;
}

app.use(
  cors({
    origin: corsOrigin(),
  })
);
app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
  };
}

function signUser(row) {
  return jwt.sign(
    { id: row.id, email: row.email, role: row.role, name: row.name },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

app.post("/api/auth/register", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES ($1, $2, $3, $4, 'user') RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), phone || null, hash]
    );
    const user = result.rows[0];
    const token = signUser(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "An account with this email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Could not register" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email.trim().toLowerCase(),
    ]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = signUser(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not sign in" });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ user: publicUser(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load account" });
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    const user = result.rows[0];
    if (!user) {
      return res.json({
        message: "If that email is registered, a reset code was created.",
      });
    }
    const code = String(crypto.randomInt(100000, 1000000));
    const reset_code_hash = await bcrypt.hash(code, 10);
    await db.query(
      `UPDATE users SET reset_code_hash = $1, reset_expires = NOW() + INTERVAL '15 minutes'
       WHERE id = $2`,
      [reset_code_hash, user.id]
    );
    res.json({
      message: "Reset code created. Enter it on the next page to set a new password.",
      reset_code: code,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start password reset" });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code || !password) {
    return res.status(400).json({ error: "Email, reset code, and new password are required" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const result = await db.query(
      `SELECT * FROM users
       WHERE email = $1 AND reset_expires > NOW()`,
      [String(email).trim().toLowerCase()]
    );
    const user = result.rows[0];
    const validCode =
      user &&
      user.reset_code_hash &&
      (await bcrypt.compare(String(code), user.reset_code_hash));
    if (!validCode) {
      return res.status(400).json({ error: "Invalid or expired reset code" });
    }
    const password_hash = await bcrypt.hash(password, 10);
    await db.query(
      `UPDATE users
       SET password_hash = $1, reset_code_hash = NULL, reset_expires = NULL
       WHERE id = $2`,
      [password_hash, user.id]
    );
    res.json({ message: "Password updated. You can sign in now." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset password" });
  }
});

app.get("/api/public/home", async (_req, res) => {
  try {
    await ensureReviewColumns();
    await syncGoogleReviews(false).catch((err) => console.error(err));
    const [classes, reviews, outlets, site, schedules, trainers] = await Promise.all([
      db.query("SELECT * FROM classes ORDER BY id"),
      db.query(
        `SELECT r.*, t.name AS trainer_name
         FROM reviews r
         LEFT JOIN trainers t ON t.id = r.trainer_id
         ORDER BY r.created_at DESC, r.id DESC
         LIMIT 18`
      ),
      db.query("SELECT * FROM outlets ORDER BY id"),
      db.query("SELECT * FROM site_info ORDER BY id LIMIT 1"),
      db.query(
        `SELECT s.*, t.name AS trainer_name, c.title AS class_title, o.name AS outlet_name
         FROM weekly_schedules s
         LEFT JOIN trainers t ON t.id = s.trainer_id
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN outlets o ON o.id = s.outlet_id
         ORDER BY s.outlet_id, s.day_of_week, s.start_time`
      ),
      db.query("SELECT id, name FROM trainers ORDER BY name"),
    ]);
    const siteRow = site.rows[0] || null;
    res.json({
      classes: classes.rows,
      reviews: reviews.rows,
      outlets: outlets.rows,
      site: siteRow,
      schedules: schedules.rows,
      trainers: trainers.rows,
      google_review_url: googleWriteUrl(
        process.env.GOOGLE_PLACE_ID || siteRow?.google_place_id
      ),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load home data" });
  }
});

app.get("/api/public/about", async (_req, res) => {
  try {
    const [site, outlets] = await Promise.all([
      db.query("SELECT * FROM site_info ORDER BY id LIMIT 1"),
      db.query("SELECT * FROM outlets ORDER BY id"),
    ]);
    res.json({ site: site.rows[0] || null, outlets: outlets.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load about data" });
  }
});

app.get("/api/public/gallery", async (_req, res) => {
  try {
    const trainers = await db.query("SELECT * FROM trainers ORDER BY id");
    const reviews = await db.query(
      "SELECT * FROM reviews ORDER BY trainer_id, id"
    );
    const outlets = await db.query("SELECT * FROM outlets ORDER BY id");
    const site = await getSite();
    res.json({
      trainers: trainers.rows,
      reviews: reviews.rows,
      outlets: outlets.rows,
      google_review_url: googleWriteUrl(
        process.env.GOOGLE_PLACE_ID || site?.google_place_id
      ),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load gallery" });
  }
});

app.get("/api/public/contact", async (_req, res) => {
  try {
    const outlets = await db.query("SELECT * FROM outlets ORDER BY id");
    res.json({ outlets: outlets.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load contact data" });
  }
});

app.post("/api/public/reviews", async (req, res) => {
  const { client_name, rating, comment, trainer_id } = req.body;
  if (!client_name || !comment) {
    return res.status(400).json({ error: "Name and review are required" });
  }
  const stars = Math.min(5, Math.max(1, Number(rating) || 5));
  try {
    await ensureReviewColumns();
    const result = await db.query(
      `INSERT INTO reviews
       (trainer_id, client_name, rating, comment, is_home_featured, source)
       VALUES ($1, $2, $3, $4, TRUE, 'website')
       RETURNING *`,
      [trainer_id || null, client_name.trim(), stars, comment.trim()]
    );
    const trainer = result.rows[0].trainer_id
      ? await db.query("SELECT name FROM trainers WHERE id = $1", [
          result.rows[0].trainer_id,
        ])
      : { rows: [] };
    res.status(201).json({
      ...result.rows[0],
      trainer_name: trainer.rows[0]?.name || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save review" });
  }
});

app.post("/api/public/contact", async (req, res) => {
  const { name, email, phone, address } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO contacts (name, email, phone, address)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, phone || null, address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit form" });
  }
});

app.get("/api/public/classes/:id", async (req, res) => {
  try {
    const course = await db.query("SELECT * FROM classes WHERE id = $1", [
      req.params.id,
    ]);
    if (!course.rows[0]) {
      return res.status(404).json({ error: "Course not found" });
    }
    const [outlets, schedules] = await Promise.all([
      db.query("SELECT * FROM outlets ORDER BY id"),
      db.query(
        `SELECT s.*, t.name AS trainer_name, c.title AS class_title, o.name AS outlet_name
         FROM weekly_schedules s
         LEFT JOIN trainers t ON t.id = s.trainer_id
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN outlets o ON o.id = s.outlet_id
         WHERE s.class_id = $1
         ORDER BY s.outlet_id, s.day_of_week, s.start_time`,
        [req.params.id]
      ),
    ]);
    res.json({
      course: course.rows[0],
      outlets: outlets.rows,
      schedules: schedules.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load course" });
  }
});

app.post("/api/public/enroll", async (req, res) => {
  const { student_name, email, class_id, payment_method } = req.body;
  if (!student_name || !class_id) {
    return res.status(400).json({ error: "Name and class are required" });
  }
  try {
    const course = await db.query("SELECT * FROM classes WHERE id = $1", [
      class_id,
    ]);
    if (!course.rows[0]) {
      return res.status(404).json({ error: "Class not found" });
    }
    const payment = await db.query(
      `INSERT INTO payments (student_name, email, class_id, amount, status, payment_method)
       VALUES ($1, $2, $3, $4, 'paid', $5) RETURNING *`,
      [
        student_name,
        email || null,
        class_id,
        course.rows[0].price,
        payment_method || "card",
      ]
    );
    res.status(201).json(payment.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not complete enrollment" });
  }
});

function meetLink() {
  const chunk = () => Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 3);
  return `https://meet.google.com/${chunk()}-${chunk()}${chunk().slice(0, 1)}-${chunk()}`;
}

function whatsappDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function whatsappUrl(phone, text) {
  const digits = whatsappDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

app.get("/api/public/schedules", async (req, res) => {
  try {
    const params = [];
    let where = "";
    if (req.query.outlet_id) {
      params.push(req.query.outlet_id);
      where = `WHERE s.outlet_id = $${params.length}`;
    }
    const result = await db.query(
      `SELECT s.*, t.name AS trainer_name, c.title AS class_title, o.name AS outlet_name
       FROM weekly_schedules s
       LEFT JOIN trainers t ON t.id = s.trainer_id
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN outlets o ON o.id = s.outlet_id
       ${where}
       ORDER BY s.outlet_id, s.day_of_week, s.start_time`,
      params
    );
    const outlets = await db.query("SELECT * FROM outlets ORDER BY id");
    res.json({ schedules: result.rows, outlets: outlets.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load schedule" });
  }
});

app.post("/api/user/choose-class", requireAuth, async (req, res) => {
  const { class_id, mode, outlet_id, whatsapp } = req.body;
  if (!class_id || !["studio", "online"].includes(mode)) {
    return res.status(400).json({ error: "Class and mode (studio or online) are required" });
  }
  if (mode === "studio" && !outlet_id) {
    return res.status(400).json({ error: "Please choose a studio" });
  }
  if (mode === "online" && !whatsapp) {
    return res.status(400).json({ error: "WhatsApp number is required for online class" });
  }
  try {
    const link = mode === "online" ? meetLink() : null;
    const result = await db.query(
      `INSERT INTO class_enrollments (user_id, class_id, outlet_id, mode, whatsapp, meet_link)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, class_id, mode) DO UPDATE
       SET outlet_id = EXCLUDED.outlet_id,
           whatsapp = EXCLUDED.whatsapp,
           meet_link = COALESCE(class_enrollments.meet_link, EXCLUDED.meet_link)
       RETURNING *`,
      [
        req.user.id,
        class_id,
        mode === "studio" ? outlet_id : null,
        mode,
        mode === "online" ? whatsapp : null,
        link,
      ]
    );
    const row = result.rows[0];
    const course = await db.query("SELECT title FROM classes WHERE id = $1", [class_id]);
    const title = course.rows[0]?.title || "Yoga class";
    const message = row.meet_link
      ? `Yoga For Us — ${title} online class. Join Google Meet: ${row.meet_link}`
      : "";
    res.status(201).json({
      enrollment: row,
      whatsapp_url: row.meet_link ? whatsappUrl(row.whatsapp, message) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save class choice" });
  }
});

app.get("/api/user/enrollments", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, c.title AS class_title, o.name AS outlet_name
       FROM class_enrollments e
       LEFT JOIN classes c ON c.id = e.class_id
       LEFT JOIN outlets o ON o.id = e.outlet_id
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load enrollments" });
  }
});

app.get("/api/user/attendance", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM attendance WHERE user_id = $1 AND class_id = $2 ORDER BY session_date`,
      [req.user.id, req.query.class_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load attendance" });
  }
});

app.post("/api/user/attendance", requireAuth, async (req, res) => {
  const { class_id, outlet_id, session_date, present } = req.body;
  if (!class_id || !session_date) {
    return res.status(400).json({ error: "Class and date are required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO attendance (user_id, class_id, outlet_id, session_date, present)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, class_id, session_date) DO UPDATE
       SET present = EXCLUDED.present, outlet_id = EXCLUDED.outlet_id
       RETURNING *`,
      [req.user.id, class_id, outlet_id || null, session_date, present !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not mark attendance" });
  }
});

app.post("/api/admin/upload", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }
  res.json({ image_url: `/uploads/${req.file.filename}` });
});

app.get("/api/admin/payments", requireAdmin, async (_req, res) => {
  try {
    const list = await db.query(
      `SELECT p.*, c.title AS class_title
       FROM payments p
       LEFT JOIN classes c ON c.id = p.class_id
       ORDER BY p.created_at DESC`
    );
    const summary = await db.query(`
      SELECT
        COUNT(*)::int AS total_count,
        COALESCE(SUM(amount), 0)::numeric AS total_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0)::numeric AS paid_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::numeric AS pending_amount,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0)::numeric AS failed_amount,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid_count,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count
      FROM payments
    `);
    res.json({ payments: list.rows, summary: summary.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load payments" });
  }
});

app.get("/api/admin/classes", requireAdmin, async (_req, res) => {
  try {
    const result = await db.query("SELECT * FROM classes ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load classes" });
  }
});

app.post("/api/admin/classes", requireAdmin, async (req, res) => {
  const { title, description, price, duration, image_url } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  try {
    const result = await db.query(
      `INSERT INTO classes (title, description, price, duration, image_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [title, description || "", price || 0, duration || "", image_url || ""]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create class" });
  }
});

app.put("/api/admin/classes/:id", requireAdmin, async (req, res) => {
  const { title, description, price, duration, image_url } = req.body;
  try {
    const result = await db.query(
      `UPDATE classes
       SET title = $1, description = $2, price = $3, duration = $4, image_url = $5
       WHERE id = $6 RETURNING *`,
      [title, description, price, duration, image_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update class" });
  }
});

app.delete("/api/admin/classes/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM classes WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete class" });
  }
});

app.get("/api/admin/trainers", requireAdmin, async (_req, res) => {
  try {
    const trainers = await db.query("SELECT * FROM trainers ORDER BY id DESC");
    const reviews = await db.query("SELECT * FROM reviews ORDER BY id DESC");
    res.json({ trainers: trainers.rows, reviews: reviews.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load trainers" });
  }
});

app.post("/api/admin/trainers", requireAdmin, async (req, res) => {
  const { name, specialization, bio, image_url } = req.body;
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const result = await db.query(
      `INSERT INTO trainers (name, specialization, bio, image_url)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, specialization || "", bio || "", image_url || ""]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create trainer" });
  }
});

app.put("/api/admin/trainers/:id", requireAdmin, async (req, res) => {
  const { name, specialization, bio, image_url } = req.body;
  try {
    const result = await db.query(
      `UPDATE trainers
       SET name = $1, specialization = $2, bio = $3, image_url = $4
       WHERE id = $5 RETURNING *`,
      [name, specialization, bio, image_url, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update trainer" });
  }
});

app.delete("/api/admin/trainers/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM trainers WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete trainer" });
  }
});

app.post("/api/admin/reviews", requireAdmin, async (req, res) => {
  const { trainer_id, client_name, rating, comment, is_home_featured } =
    req.body;
  if (!trainer_id || !client_name) {
    return res.status(400).json({ error: "Trainer and client name required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO reviews (trainer_id, client_name, rating, comment, is_home_featured)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        trainer_id,
        client_name,
        rating || 5,
        comment || "",
        Boolean(is_home_featured),
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create review" });
  }
});

app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM reviews WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete review" });
  }
});

app.get("/api/admin/google", requireAdmin, async (_req, res) => {
  try {
    await ensureReviewColumns();
    const site = await getSite();
    res.json({
      google_place_id: process.env.GOOGLE_PLACE_ID || site?.google_place_id || "",
      google_synced_at: site?.google_synced_at || null,
      has_api_key: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      google_review_url: googleWriteUrl(
        process.env.GOOGLE_PLACE_ID || site?.google_place_id
      ),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load Google review settings" });
  }
});

app.put("/api/admin/google", requireAdmin, async (req, res) => {
  const { google_place_id } = req.body;
  try {
    await ensureReviewColumns();
    const site = await getSite();
    if (!site) {
      return res.status(400).json({ error: "Site information is missing" });
    }
    await db.query("UPDATE site_info SET google_place_id = $1 WHERE id = $2", [
      google_place_id || null,
      site.id,
    ]);
    res.json({
      google_place_id: google_place_id || "",
      google_review_url: googleWriteUrl(google_place_id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save Place ID" });
  }
});

app.post("/api/admin/google/sync", requireAdmin, async (_req, res) => {
  try {
    const result = await syncGoogleReviews(true);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch Google reviews" });
  }
});

app.get("/api/admin/contacts", requireAdmin, async (_req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM contacts ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load contacts" });
  }
});

app.get("/api/admin/schedules", requireAdmin, async (_req, res) => {
  try {
    const [schedules, outlets, classes, trainers] = await Promise.all([
      db.query(
        `SELECT s.*, t.name AS trainer_name, c.title AS class_title,
                o.name AS outlet_name, o.address AS outlet_address
         FROM weekly_schedules s
         LEFT JOIN trainers t ON t.id = s.trainer_id
         LEFT JOIN classes c ON c.id = s.class_id
         LEFT JOIN outlets o ON o.id = s.outlet_id
         ORDER BY o.name, s.day_of_week, s.start_time`
      ),
      db.query("SELECT * FROM outlets ORDER BY id"),
      db.query("SELECT id, title FROM classes ORDER BY title"),
      db.query("SELECT id, name FROM trainers ORDER BY name"),
    ]);
    res.json({
      schedules: schedules.rows,
      outlets: outlets.rows,
      classes: classes.rows,
      trainers: trainers.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load schedules" });
  }
});

app.post("/api/admin/schedules/week", requireAdmin, async (req, res) => {
  const { outlet_id, class_id, mode, slots } = req.body;
  if (!outlet_id || !class_id || !Array.isArray(slots)) {
    return res.status(400).json({ error: "Studio, class, and weekday slots are required" });
  }
  const classMode = mode || "studio";
  try {
    const saved = [];
    for (const slot of slots) {
      const day = Number(slot.day_of_week);
      if (day < 1 || day > 7) continue;
      if (slot.enabled === false) {
        await db.query(
          `DELETE FROM weekly_schedules
           WHERE outlet_id = $1 AND class_id = $2 AND mode = $3 AND day_of_week = $4`,
          [outlet_id, class_id, classMode, day]
        );
        continue;
      }
      if (!slot.start_time || !slot.end_time || !slot.trainer_id) {
        return res.status(400).json({
          error: `Choose a teacher and time for ${["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day]}`,
        });
      }
      const existing = await db.query(
        `SELECT id FROM weekly_schedules
         WHERE outlet_id = $1 AND class_id = $2 AND mode = $3 AND day_of_week = $4
         ORDER BY id LIMIT 1`,
        [outlet_id, class_id, classMode, day]
      );
      if (existing.rows[0]) {
        const updated = await db.query(
          `UPDATE weekly_schedules
           SET trainer_id = $1, start_time = $2, end_time = $3
           WHERE id = $4 RETURNING *`,
          [slot.trainer_id, slot.start_time, slot.end_time, existing.rows[0].id]
        );
        saved.push(updated.rows[0]);
      } else {
        const created = await db.query(
          `INSERT INTO weekly_schedules
           (outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            outlet_id,
            class_id,
            slot.trainer_id,
            day,
            slot.start_time,
            slot.end_time,
            classMode,
          ]
        );
        saved.push(created.rows[0]);
      }
    }
    res.json({ ok: true, schedules: saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save weekly schedule" });
  }
});

app.post("/api/admin/schedules", requireAdmin, async (req, res) => {
  const { outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode } =
    req.body;
  if (!outlet_id || !class_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ error: "Studio, class, day, and times are required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO weekly_schedules
       (outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        outlet_id,
        class_id,
        trainer_id || null,
        day_of_week,
        start_time,
        end_time,
        mode || "studio",
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create schedule" });
  }
});

app.put("/api/admin/schedules/:id", requireAdmin, async (req, res) => {
  const { outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode } =
    req.body;
  try {
    const result = await db.query(
      `UPDATE weekly_schedules
       SET outlet_id = $1, class_id = $2, trainer_id = $3, day_of_week = $4,
           start_time = $5, end_time = $6, mode = $7
       WHERE id = $8 RETURNING *`,
      [
        outlet_id,
        class_id,
        trainer_id || null,
        day_of_week,
        start_time,
        end_time,
        mode || "studio",
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update schedule" });
  }
});

app.delete("/api/admin/schedules/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM weekly_schedules WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete schedule" });
  }
});

const clientDist = path.join(__dirname, "../frontend/dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Harmony Yoga API running on http://${HOST}:${PORT}`);
});
