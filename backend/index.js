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
const { requireAdmin, requireAuth, optionalAuth } = require("./middleware/auth");
const {
  ensureReviewColumns,
  syncGoogleReviews,
  getSite,
  googleWriteUrl,
} = require("./googleReviews");
const { ensureScheduleTables } = require("./migrate-schedule");
const { ensureAdminUser } = require("./migrate-users");
const { ensureMediaTable } = require("./migrate-media");
const { ensureFileCache, storeFileBuffer, importDiskUploads, rewriteStoredUrls } = require("./migrate-files");
const { ensurePaymentColumns, PAYMENT_SELECT } = require("./migrate-payments");
const { getSettings, ensureStudioTables, fulfillPaidPayment } = require("./migrate-studio");
const { registerStudioRoutes, resolveOrderItem } = require("./studioRoutes");
const {
  useTestSdk,
  createCashfreeOrder,
  fetchCashfreeOrder,
  isPaidStatus,
} = require("./cashfree");
const {
  useTestPaytm,
  createPaytmOrder,
  fetchPaytmStatus,
  paytmPaymentStatus,
  verifySignature: verifyPaytmSignature,
} = require("./paytm");

const app = express();
const PORT = process.env.PORT || 4000;

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

async function persistUpload(file) {
  const safe = file.originalname.replace(/[^\w.-]/g, "_");
  const filename = `${Date.now()}-${safe}`;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(uploadsDir, filename), file.buffer);
  return storeFileBuffer(filename, file.mimetype, file.buffer);
}

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
app.use(express.urlencoded({ extended: false }));
app.use(
  "/uploads",
  express.static(uploadsDir, {
    maxAge: "365d",
    immutable: true,
  })
);

app.get("/api/files/:id", async (req, res) => {
  try {
    await ensureFileCache();
    const result = await db.query(
      "SELECT filename, mime_type, data FROM file_cache WHERE id = $1",
      [req.params.id]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("Content-Type", row.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${row.filename}"`);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(row.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load file" });
  }
});
registerStudioRoutes(app);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

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
    await ensureScheduleTables();
    await ensureMediaTable();
    await ensureStudioTables();
    await syncGoogleReviews(false).catch((err) => console.error(err));
    const [classes, reviews, outlets, site, schedules, trainers, media, settings] = await Promise.all([
      db.query("SELECT * FROM classes ORDER BY id"),
      db.query(
        `SELECT r.* FROM reviews r
         WHERE r.is_home_featured IS NOT FALSE
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
      db.query(
        "SELECT * FROM media_items ORDER BY sort_order, id DESC LIMIT 6"
      ).catch(() => ({ rows: [] })),
      getSettings(),
    ]);
    const siteRow = site.rows[0] || null;
    res.json({
      classes: classes.rows,
      reviews: reviews.rows,
      outlets: outlets.rows,
      site: siteRow,
      schedules: schedules.rows,
      trainers: trainers.rows,
      media: media.rows,
      settings,
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
    await ensureMediaTable();
    await ensureStudioTables();
    const trainers = await db.query("SELECT * FROM trainers ORDER BY id");
    const reviews = await db.query(
      "SELECT * FROM reviews ORDER BY trainer_id, id"
    );
    const outlets = await db.query("SELECT * FROM outlets ORDER BY id");
    const site = await getSite();
    const settings = await getSettings();
    const media = await db.query(
      "SELECT * FROM media_items ORDER BY sort_order, id DESC"
    );
    const maps_embed =
      settings?.maps_embed_url ||
      `https://maps.google.com/maps?q=${encodeURIComponent(
        outlets.rows[0]?.address || "Yoga For Us"
      )}&output=embed`;
    res.json({
      trainers: trainers.rows,
      reviews: reviews.rows,
      outlets: outlets.rows,
      media: media.rows,
      settings,
      maps_embed,
      maps_link:
        settings?.maps_link ||
        `https://maps.google.com/?q=${encodeURIComponent(
          outlets.rows[0]?.address || "Yoga For Us"
        )}`,
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

// Reviews are for the studio/website as a whole, not for individual teachers.
app.post("/api/public/reviews", async (req, res) => {
  const { client_name, rating, comment } = req.body;
  if (!client_name || !comment) {
    return res.status(400).json({ error: "Name and review are required" });
  }
  const stars = Math.min(5, Math.max(1, Number(rating) || 5));
  try {
    await ensureReviewColumns();
    const result = await db.query(
      `INSERT INTO reviews
       (trainer_id, client_name, rating, comment, is_home_featured, source)
       VALUES (NULL, $1, $2, $3, TRUE, 'website')
       RETURNING *`,
      [client_name.trim(), stars, comment.trim()]
    );
    res.status(201).json(result.rows[0]);
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

function clientOrigin() {
  return String(process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")[0]
    .trim();
}

function apiOrigin(req) {
  if (process.env.PUBLIC_API_URL) return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${req.get("host")}`;
}

// Creates the pending payment row shared by every gateway.
async function createPendingPayment(req, gateway) {
  const { student_name, email, phone, class_id, mode, outlet_id } = req.body;
  if (!student_name || !email) {
    throw Object.assign(new Error("Name and email are required"), { status: 400 });
  }
  await ensurePaymentColumns();
  await ensureStudioTables();
  const item = await resolveOrderItem(req.body);
  const payment = await db.query(
    `INSERT INTO payments
       (student_name, email, phone, class_id, amount, status, payment_method, user_id, mode, outlet_id, kind, ref_id)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      student_name.trim(),
      email.trim().toLowerCase(),
      phone || null,
      item.class_id || class_id || null,
      item.amount,
      gateway,
      req.user?.id || null,
      mode || item.kind,
      mode === "studio" ? outlet_id || null : null,
      item.kind,
      item.ref_id,
    ]
  );
  return { row: payment.rows[0], item };
}

// Marks a payment paid/failed/pending and unlocks what was bought.
async function settlePayment(paymentId, status, gatewayPaymentId, gateway) {
  await db.query(
    `UPDATE payments
     SET status = $1, payment_method = $2, cf_payment_id = COALESCE($3, cf_payment_id)
     WHERE id = $4`,
    [status, gateway, gatewayPaymentId || null, paymentId]
  );
  if (status === "paid") {
    const fresh = await db.query("SELECT * FROM payments WHERE id = $1", [paymentId]);
    await fulfillPaidPayment(fresh.rows[0]).catch((err) => console.error(err));
  }
  const detail = await db.query(`${PAYMENT_SELECT} WHERE p.id = $1`, [paymentId]);
  return detail.rows[0];
}

app.get("/api/payments/gateways", async (_req, res) => {
  const list = String(process.env.PAYMENT_GATEWAYS || "paytm,cashfree")
    .split(",")
    .map((g) => g.trim().toLowerCase())
    .filter((g) => ["paytm", "cashfree"].includes(g));
  let settings = null;
  try {
    await ensureStudioTables();
    settings = await getSettings();
  } catch (err) {
    console.error(err);
  }
  res.json({
    gateways: list.length ? list : ["paytm"],
    // When the admin has uploaded a Paytm QR, "Pay with Paytm" shows that QR
    // and the payment is confirmed manually by the admin.
    paytm_qr: settings?.paytm_qr_url
      ? { image_url: settings.paytm_qr_url, upi_id: settings.paytm_upi_id || "" }
      : null,
    paytm_test: useTestPaytm(),
    cashfree_test: useTestSdk(),
  });
});

// --- Paytm QR (scan & pay, approved by the admin) ---

app.post("/api/payments/paytm-qr/order", optionalAuth, async (req, res) => {
  try {
    const settings = await getSettings();
    if (!settings?.paytm_qr_url) {
      return res.status(400).json({ error: "Paytm QR payments are not set up yet" });
    }
    const { row, item } = await createPendingPayment(req, "paytm_qr");
    const orderId = `QR${row.id}${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    await db.query("UPDATE payments SET cf_order_id = $1 WHERE id = $2", [orderId, row.id]);
    res.status(201).json({
      gateway: "paytm_qr",
      payment_id: row.id,
      order_id: orderId,
      amount: item.amount,
      class_title: item.title,
      qr_image: settings.paytm_qr_url,
      upi_id: settings.paytm_upi_id || "",
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Could not start Paytm QR payment" });
  }
});

app.post("/api/payments/paytm-qr/submit", async (req, res) => {
  const { order_id, upi_ref } = req.body;
  if (!order_id) return res.status(400).json({ error: "Order id is required" });
  try {
    const result = await db.query(
      `UPDATE payments
       SET upi_ref = COALESCE(NULLIF($1, ''), upi_ref), qr_submitted_at = NOW()
       WHERE cf_order_id = $2 AND payment_method = 'paytm_qr' AND status = 'pending'
       RETURNING id, status`,
      [String(upi_ref || "").trim().slice(0, 120), order_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Pending QR payment not found" });
    res.json({ ok: true, status: result.rows[0].status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not submit payment" });
  }
});

// Polled by the checkout page while the admin confirms a QR payment.
app.get("/api/payments/status/:orderId", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT status, kind, payment_method FROM payments WHERE cf_order_id = $1",
      [req.params.orderId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Payment not found" });
    res.json({ status: result.rows[0].status, paid: result.rows[0].status === "paid" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load payment status" });
  }
});

app.put("/api/admin/payments/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["paid", "failed"].includes(status)) {
    return res.status(400).json({ error: "Status must be paid or failed" });
  }
  try {
    const found = await db.query("SELECT * FROM payments WHERE id = $1", [req.params.id]);
    const row = found.rows[0];
    if (!row) return res.status(404).json({ error: "Payment not found" });
    const payment = await settlePayment(row.id, status, row.upi_ref, row.payment_method || "paytm_qr");
    await db.query("UPDATE payments SET reviewed_at = NOW() WHERE id = $1", [row.id]);
    res.json(payment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update payment" });
  }
});

app.post("/api/payments/cashfree/order", optionalAuth, async (req, res) => {
  try {
    const { row, item } = await createPendingPayment(req, "cashfree");
    const { student_name, email, phone } = req.body;
    const amount = item.amount;
    const orderId = `yoga_${row.id}_${Date.now()}`.slice(0, 50);
    const digits = String(phone || "9999999999").replace(/\D/g, "").slice(-10) || "9999999999";
    const cf = await createCashfreeOrder({
      orderId,
      amount,
      returnUrl: `${clientOrigin()}/payments/history?order_id={order_id}`,
      customer: {
        id: req.user?.id || `guest${row.id}`,
        name: student_name.trim(),
        email: email.trim().toLowerCase(),
        phone: digits,
        note: item.title,
      },
    });
    await db.query("UPDATE payments SET cf_order_id = $1 WHERE id = $2", [
      cf.order_id,
      row.id,
    ]);
    res.status(201).json({
      payment_id: row.id,
      order_id: cf.order_id,
      payment_session_id: cf.payment_session_id,
      test_sdk: Boolean(cf.test_sdk),
      environment: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox",
      amount,
      class_title: item.title,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Could not start Cashfree payment" });
  }
});

// --- Paytm ---
// The gateway order id is stored in payments.cf_order_id and the Paytm txn id in
// payments.cf_payment_id, so payment history and verification work for both gateways.

app.post("/api/payments/paytm/order", optionalAuth, async (req, res) => {
  try {
    const { row, item } = await createPendingPayment(req, "paytm");
    const { student_name, email, phone } = req.body;
    const orderId = `YOGA${row.id}T${Date.now()}`.slice(0, 50);
    const digits = String(phone || "").replace(/\D/g, "").slice(-10);
    const order = await createPaytmOrder({
      orderId,
      amount: item.amount,
      callbackUrl: `${apiOrigin(req)}/api/payments/paytm/callback`,
      customer: {
        id: req.user?.id ? `user${req.user.id}` : `guest${row.id}`,
        name: student_name.trim(),
        email: email.trim().toLowerCase(),
        phone: digits,
      },
    });
    await db.query("UPDATE payments SET cf_order_id = $1 WHERE id = $2", [orderId, row.id]);
    res.status(201).json({
      gateway: "paytm",
      payment_id: row.id,
      order_id: orderId,
      txn_token: order.txn_token,
      mid: order.mid,
      host: order.host,
      test_mode: order.test_mode,
      amount: item.amount,
      class_title: item.title,
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Could not start Paytm payment" });
  }
});

async function verifyPaytmOrder(orderId) {
  await ensurePaymentColumns();
  const found = await db.query("SELECT * FROM payments WHERE cf_order_id = $1 LIMIT 1", [orderId]);
  const row = found.rows[0];
  if (!row) throw Object.assign(new Error("Payment not found"), { status: 404 });
  // Always confirm with Paytm's server-side Order Status API; never trust the browser.
  const result = await fetchPaytmStatus(orderId);
  const status = paytmPaymentStatus(result.status);
  const payment = await settlePayment(row.id, status, result.txn_id, "paytm");
  return { payment, paid: status === "paid", message: result.message || "" };
}

app.post("/api/payments/paytm/verify", optionalAuth, async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: "Order id is required" });
  try {
    const result = await verifyPaytmOrder(order_id);
    res.json({ ...result, test_mode: useTestPaytm() });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Could not verify Paytm payment" });
  }
});

// Paytm posts a form here at the end of its redirect flow. We verify the order,
// then send the shopper back to the React payment history page with a normal GET
// (a POST straight to a SPA route would show "page not found").
app.post("/api/payments/paytm/callback", async (req, res) => {
  const orderId = req.body.ORDERID || req.body.orderId;
  const target = (ok) =>
    `${clientOrigin()}/payments/history?order_id=${encodeURIComponent(orderId || "")}${ok ? "" : "&status=failed"}`;
  try {
    if (!orderId) return res.redirect(303, `${clientOrigin()}/payments/history?status=failed`);
    if (!useTestPaytm() && req.body.CHECKSUMHASH) {
      const valid = verifyPaytmSignature(
        { ...req.body },
        process.env.PAYTM_MERCHANT_KEY,
        req.body.CHECKSUMHASH
      );
      if (!valid) console.warn("Paytm callback checksum mismatch for", orderId);
    }
    const result = await verifyPaytmOrder(orderId);
    res.redirect(303, target(result.paid));
  } catch (err) {
    console.error(err);
    res.redirect(303, target(false));
  }
});

app.post("/api/payments/cashfree/verify", optionalAuth, async (req, res) => {
  const { order_id, payment_id } = req.body;
  if (!order_id && !payment_id) {
    return res.status(400).json({ error: "Order id is required" });
  }
  try {
    await ensurePaymentColumns();
    const found = await db.query(
      `${PAYMENT_SELECT} WHERE p.cf_order_id = $1 OR p.id = $2 LIMIT 1`,
      [order_id || null, payment_id || null]
    );
    const row = found.rows[0];
    if (!row) {
      return res.status(404).json({ error: "Payment not found" });
    }
    const cfOrder = await fetchCashfreeOrder(row.cf_order_id || order_id);
    const paid = isPaidStatus(cfOrder);
    const raw = String(cfOrder.order_status || "").toUpperCase();
    const nextStatus = paid ? "paid" : raw === "ACTIVE" || raw === "PENDING" ? "pending" : "failed";
    const payment = await settlePayment(
      row.id,
      nextStatus,
      cfOrder.cf_payment_id || cfOrder.payment_id || null,
      "cashfree"
    );
    res.json({
      payment,
      paid,
      test_sdk: useTestSdk(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not verify payment" });
  }
});

app.get("/api/payments/history", optionalAuth, async (req, res) => {
  try {
    await ensurePaymentColumns();
    const params = [];
    const where = [];
    if (req.user?.id) {
      params.push(req.user.id);
      where.push(`p.user_id = $${params.length}`);
    }
    const email = String(req.query.email || "").trim().toLowerCase();
    if (email) {
      params.push(email);
      where.push(`p.email = $${params.length}`);
    }
    if (req.query.order_id) {
      params.push(req.query.order_id);
      where.push(`p.cf_order_id = $${params.length}`);
    }
    if (!where.length) {
      return res.status(400).json({ error: "Sign in or enter the email used at checkout" });
    }
    const result = await db.query(
      `${PAYMENT_SELECT} WHERE ${where.join(" OR ")} ORDER BY p.created_at DESC LIMIT 50`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load payment history" });
  }
});

app.get("/api/user/payments", requireAuth, async (req, res) => {
  try {
    await ensurePaymentColumns();
    const result = await db.query(
      `${PAYMENT_SELECT} WHERE p.user_id = $1 OR p.email = $2 ORDER BY p.created_at DESC`,
      [req.user.id, req.user.email]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load payment history" });
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
    await db.query(`
      ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS starts_at DATE;
      ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS ends_at DATE;
      ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS payment_id INTEGER;
      ALTER TABLE class_enrollments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(40) DEFAULT 'unpaid';
    `);
    await db.query(
      `UPDATE class_enrollments e
       SET payment_status = 'paid',
           starts_at = COALESCE(e.starts_at, CURRENT_DATE),
           ends_at = COALESCE(e.ends_at, (CURRENT_DATE + INTERVAL '8 weeks')::date)
       WHERE e.user_id = $1
         AND (
           e.payment_status = 'paid'
           OR e.payment_id IS NOT NULL
           OR EXISTS (
             SELECT 1 FROM payments p
             WHERE p.user_id = e.user_id
               AND p.class_id = e.class_id
               AND p.status = 'paid'
           )
         )`,
      [req.user.id]
    );
    const { fulfillPaidPayment } = require("./migrate-studio");
    const paidRows = await db.query(
      `SELECT * FROM payments
       WHERE user_id = $1 AND status = 'paid' AND class_id IS NOT NULL
         AND COALESCE(kind, 'class') = 'class'`,
      [req.user.id]
    );
    for (const row of paidRows.rows) {
      await fulfillPaidPayment({ ...row, kind: "class" });
    }
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
    const paid = await db.query(
      `SELECT e.*
       FROM class_enrollments e
       WHERE e.user_id = $1 AND e.class_id = $2
         AND (
           e.payment_status = 'paid'
           OR e.payment_id IS NOT NULL
           OR EXISTS (
             SELECT 1 FROM payments p
             WHERE p.user_id = e.user_id AND p.class_id = e.class_id AND p.status = 'paid'
           )
         )
       ORDER BY e.created_at DESC
       LIMIT 1`,
      [req.user.id, class_id]
    );
    const enroll = paid.rows[0];
    if (!enroll) {
      return res.status(403).json({ error: "Pay for this course before marking attendance" });
    }
    const start = String(enroll.starts_at || new Date().toISOString()).slice(0, 10);
    const end = String(enroll.ends_at || start).slice(0, 10);
    if (session_date < start || session_date > end) {
      return res.status(400).json({ error: `Attendance is only for ${start} to ${end}` });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (session_date < today) {
      return res.status(400).json({ error: "Past dates cannot be marked" });
    }
    const result = await db.query(
      `INSERT INTO attendance (user_id, class_id, outlet_id, session_date, present)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, class_id, session_date) DO UPDATE
       SET present = EXCLUDED.present, outlet_id = EXCLUDED.outlet_id
       RETURNING *`,
      [req.user.id, class_id, outlet_id || enroll.outlet_id || null, session_date, present !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not mark attendance" });
  }
});

app.post("/api/admin/upload", requireAdmin, upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }
  try {
    const stored = await persistUpload(req.file);
    res.json({ image_url: stored.url, url: stored.url, file_id: stored.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not store image in the database" });
  }
});

app.post("/api/admin/upload-media", requireAdmin, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const stored = await persistUpload(req.file);
    res.json({ url: stored.url, file_id: stored.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not store file in the database" });
  }
});

app.get("/api/admin/media", requireAdmin, async (_req, res) => {
  try {
    await ensureMediaTable();
    const result = await db.query("SELECT * FROM media_items ORDER BY sort_order, id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load media" });
  }
});

app.post("/api/admin/media", requireAdmin, async (req, res) => {
  const { media_type, title, caption, url, sort_order } = req.body;
  if (!title || !url || !["image", "video"].includes(media_type)) {
    return res.status(400).json({ error: "Type, title, and file or URL are required" });
  }
  try {
    await ensureMediaTable();
    const result = await db.query(
      `INSERT INTO media_items (media_type, title, caption, url, sort_order)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [media_type, title.trim(), caption || "", url, Number(sort_order) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add media" });
  }
});

app.put("/api/admin/media/:id", requireAdmin, async (req, res) => {
  const { media_type, title, caption, url, sort_order } = req.body;
  if (!title || !url || !["image", "video"].includes(media_type)) {
    return res.status(400).json({ error: "Type, title, and file or URL are required" });
  }
  try {
    const result = await db.query(
      `UPDATE media_items
       SET media_type = $1, title = $2, caption = $3, url = $4, sort_order = $5
       WHERE id = $6 RETURNING *`,
      [media_type, title.trim(), caption || "", url, Number(sort_order) || 0, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Media not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update media" });
  }
});

app.delete("/api/admin/media/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM media_items WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete media" });
  }
});

app.get("/api/admin/payments", requireAdmin, async (_req, res) => {
  try {
    const list = await db.query(
      `SELECT p.*, c.title AS class_title, c.duration AS class_duration, o.name AS outlet_name,
              COALESCE(mp.name, w.title, c.title) AS item_title
       FROM payments p
       LEFT JOIN classes c ON c.id = p.class_id
       LEFT JOIN outlets o ON o.id = p.outlet_id
       LEFT JOIN membership_plans mp ON p.kind = 'membership' AND mp.id = p.ref_id
       LEFT JOIN workshop_bookings wb ON p.kind = 'workshop' AND wb.id = p.ref_id
       LEFT JOIN workshops w ON w.id = wb.workshop_id
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

const CLASS_CATEGORIES = ["studio", "online", "home"];

function cleanCategories(value) {
  const list = (Array.isArray(value) ? value : [])
    .map((c) => String(c).toLowerCase())
    .filter((c) => CLASS_CATEGORIES.includes(c));
  return [...new Set(list)];
}

app.post("/api/admin/classes", requireAdmin, async (req, res) => {
  const { title, description, price, duration, image_url } = req.body;
  if (!title) return res.status(400).json({ error: "Title is required" });
  const categories = cleanCategories(req.body.categories);
  if (!categories.length) {
    return res.status(400).json({ error: "Choose at least one category: studio, online, or home visit" });
  }
  try {
    await ensureStudioTables();
    const result = await db.query(
      `INSERT INTO classes (title, description, price, duration, image_url, categories)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description || "", price || 0, duration || "", image_url || "", categories]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create class" });
  }
});

app.put("/api/admin/classes/:id", requireAdmin, async (req, res) => {
  const { title, description, price, duration, image_url } = req.body;
  const categories = cleanCategories(req.body.categories);
  if (!categories.length) {
    return res.status(400).json({ error: "Choose at least one category: studio, online, or home visit" });
  }
  try {
    await ensureStudioTables();
    const result = await db.query(
      `UPDATE classes
       SET title = $1, description = $2, price = $3, duration = $4, image_url = $5, categories = $6
       WHERE id = $7 RETURNING *`,
      [title, description, price, duration, image_url, categories, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update class" });
  }
});

app.delete("/api/admin/classes/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid class id" });
  // Clear every row that points at the class first. Older databases may have been
  // created without ON DELETE CASCADE / SET NULL, which made the delete fail.
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE payments SET class_id = NULL WHERE class_id = $1", [id]);
    for (const table of ["weekly_schedules", "attendance", "class_enrollments", "attendance_qr"]) {
      const exists = await client.query("SELECT to_regclass($1) AS t", [table]);
      if (exists.rows[0].t) {
        await client.query(`DELETE FROM ${table} WHERE class_id = $1`, [id]);
      }
    }
    const result = await client.query("DELETE FROM classes WHERE id = $1 RETURNING id", [id]);
    await client.query("COMMIT");
    if (!result.rows[0]) return res.status(404).json({ error: "Class not found" });
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: `Could not delete class: ${err.message}` });
  } finally {
    client.release();
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

app.get("/api/admin/reviews", requireAdmin, async (_req, res) => {
  try {
    await ensureReviewColumns();
    const result = await db.query("SELECT * FROM reviews ORDER BY created_at DESC, id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load reviews" });
  }
});

app.post("/api/admin/reviews", requireAdmin, async (req, res) => {
  const { client_name, rating, comment, is_home_featured } = req.body;
  if (!client_name || !comment) {
    return res.status(400).json({ error: "Client name and review are required" });
  }
  try {
    await ensureReviewColumns();
    const result = await db.query(
      `INSERT INTO reviews (trainer_id, client_name, rating, comment, is_home_featured, source)
       VALUES (NULL, $1, $2, $3, $4, 'website') RETURNING *`,
      [
        client_name.trim(),
        Math.min(5, Math.max(1, Number(rating) || 5)),
        comment.trim(),
        is_home_featured !== false,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create review" });
  }
});

app.put("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE reviews SET is_home_featured = $1 WHERE id = $2 RETURNING *",
      [Boolean(req.body.is_home_featured), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Review not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update review" });
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

app.get("/api/admin/users", requireAdmin, async (_req, res) => {
  try {
    await ensurePaymentColumns();
    await ensureScheduleTables();
    await ensureStudioTables();
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              (SELECT COUNT(*)::int FROM class_enrollments e WHERE e.user_id = u.id) AS enrollments,
              (SELECT COUNT(*)::int FROM payments p
                 WHERE (p.user_id = u.id OR lower(p.email) = lower(u.email)) AND p.status = 'paid') AS paid_payments,
              (SELECT COALESCE(SUM(p.amount), 0)::numeric FROM payments p
                 WHERE (p.user_id = u.id OR lower(p.email) = lower(u.email)) AND p.status = 'paid') AS paid_amount,
              (SELECT MAX(m.expires_at) FROM memberships m
                 WHERE (m.user_id = u.id OR lower(m.email) = lower(u.email)) AND m.status = 'active') AS membership_expires,
              (SELECT COUNT(*)::int FROM attendance a WHERE a.user_id = u.id AND a.present) AS classes_attended
       FROM users u
       ORDER BY u.created_at DESC, u.id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load registered users" });
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
    await ensureScheduleTables();
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

// Weekly teacher assignment for a studio: pick the studio only, then a teacher and
// time for each day (Mon–Sun). These slots are not tied to a yoga class.
app.post("/api/admin/schedules/week", requireAdmin, async (req, res) => {
  const { outlet_id, mode, slots } = req.body;
  if (!outlet_id || !Array.isArray(slots)) {
    return res.status(400).json({ error: "Studio and day slots are required" });
  }
  const classMode = mode || "studio";
  const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  try {
    await ensureScheduleTables();
    const saved = [];
    for (const slot of slots) {
      const day = Number(slot.day_of_week);
      if (day < 1 || day > 7) continue;
      if (slot.enabled === false) {
        await db.query(
          `DELETE FROM weekly_schedules
           WHERE outlet_id = $1 AND class_id IS NULL AND mode = $2 AND day_of_week = $3`,
          [outlet_id, classMode, day]
        );
        continue;
      }
      if (!slot.start_time || !slot.end_time || !slot.trainer_id) {
        return res.status(400).json({
          error: `Choose a teacher and time for ${dayNames[day]}`,
        });
      }
      const existing = await db.query(
        `SELECT id FROM weekly_schedules
         WHERE outlet_id = $1 AND class_id IS NULL AND mode = $2 AND day_of_week = $3
         ORDER BY id LIMIT 1`,
        [outlet_id, classMode, day]
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
           VALUES ($1, NULL, $2, $3, $4, $5, $6) RETURNING *`,
          [outlet_id, slot.trainer_id, day, slot.start_time, slot.end_time, classMode]
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
  if (!outlet_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ error: "Studio, day, and times are required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO weekly_schedules
       (outlet_id, class_id, trainer_id, day_of_week, start_time, end_time, mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        outlet_id,
        class_id || null,
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
        class_id || null,
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

app.get("/api/admin/outlets", requireAdmin, async (_req, res) => {
  try {
    const result = await db.query("SELECT * FROM outlets ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load studios" });
  }
});

app.post("/api/admin/outlets", requireAdmin, async (req, res) => {
  const { name, address, timings, phone } = req.body;
  if (!name || !address || !timings) {
    return res.status(400).json({ error: "Studio name, address, and timings are required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO outlets (name, address, timings, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, address, timings, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not add studio" });
  }
});

app.put("/api/admin/outlets/:id", requireAdmin, async (req, res) => {
  const { name, address, timings, phone } = req.body;
  if (!name || !address || !timings) {
    return res.status(400).json({ error: "Studio name, address, and timings are required" });
  }
  try {
    const result = await db.query(
      `UPDATE outlets SET name = $1, address = $2, timings = $3, phone = $4
       WHERE id = $5 RETURNING *`,
      [name, address, timings, phone || null, req.params.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: "Studio not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update studio" });
  }
});

app.delete("/api/admin/outlets/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM outlets WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete studio" });
  }
});

app.get("/api/admin/attendance", requireAdmin, async (req, res) => {
  const { outlet_id, class_id, from, to, session_date, user_id } = req.query;
  try {
    await ensureScheduleTables();
    const params = [];
    const where = [];
    if (user_id) {
      params.push(user_id);
      where.push(`a.user_id = $${params.length}`);
    }
    if (outlet_id) {
      params.push(outlet_id);
      where.push(`a.outlet_id = $${params.length}`);
    }
    if (class_id) {
      params.push(class_id);
      where.push(`a.class_id = $${params.length}`);
    }
    if (session_date) {
      params.push(session_date);
      where.push(`a.session_date = $${params.length}`);
    } else {
      if (from) {
        params.push(from);
        where.push(`a.session_date >= $${params.length}`);
      }
      if (to) {
        params.push(to);
        where.push(`a.session_date <= $${params.length}`);
      }
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const result = await db.query(
      `SELECT a.*, u.name AS student_name, u.email AS student_email, u.phone AS student_phone,
              c.title AS class_title, o.name AS outlet_name
       FROM attendance a
       LEFT JOIN users u ON u.id = a.user_id
       LEFT JOIN classes c ON c.id = a.class_id
       LEFT JOIN outlets o ON o.id = a.outlet_id
       ${clause}
       ORDER BY a.session_date DESC, u.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load attendance records" });
  }
});

app.get("/api/admin/attendance/roster", requireAdmin, async (req, res) => {
  const { outlet_id, class_id, session_date } = req.query;
  if (!outlet_id || !class_id || !session_date) {
    return res.status(400).json({ error: "Studio, class, and date are required" });
  }
  try {
    await ensureScheduleTables();
    const result = await db.query(
      `SELECT u.id AS user_id, u.name, u.email, u.phone,
              e.outlet_id, e.class_id,
              a.id AS attendance_id, a.present, a.session_date
       FROM class_enrollments e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN attendance a
         ON a.user_id = e.user_id
        AND a.class_id = e.class_id
        AND a.session_date = $3
       WHERE e.mode = 'studio' AND e.outlet_id = $1 AND e.class_id = $2
       ORDER BY u.name`,
      [outlet_id, class_id, session_date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load class roster" });
  }
});

app.post("/api/admin/attendance", requireAdmin, async (req, res) => {
  const { user_id, class_id, outlet_id, session_date, present } = req.body;
  if (!user_id || !class_id || !session_date) {
    return res.status(400).json({ error: "Student, class, and date are required" });
  }
  try {
    const result = await db.query(
      `INSERT INTO attendance (user_id, class_id, outlet_id, session_date, present)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, class_id, session_date) DO UPDATE
       SET present = EXCLUDED.present, outlet_id = EXCLUDED.outlet_id
       RETURNING *`,
      [user_id, class_id, outlet_id || null, session_date, present !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not mark attendance" });
  }
});

app.delete("/api/admin/attendance/:id", requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM attendance WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not delete attendance" });
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
// Create every table before rewriteStoredUrls touches them (fresh databases
// previously failed on "relation workshops does not exist").
ensureAdminUser()
  .then(() => ensurePaymentColumns())
  .then(() => ensureMediaTable())
  .then(() => ensureScheduleTables())
  .then(() => ensureStudioTables())
  .then(() => ensureReviewColumns())
  .then(() => ensureFileCache())
  .then(() => importDiskUploads())
  .then(() => rewriteStoredUrls())
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Harmony Yoga API running on http://${HOST}:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Could not prepare the database", err);
    process.exit(1);
  });
