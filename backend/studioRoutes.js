const crypto = require("crypto");
const db = require("./db");
const { requireAdmin, requireAuth, optionalAuth } = require("./middleware/auth");
const { ensureStudioTables, getSettings, fulfillPaidPayment } = require("./migrate-studio");

function clientOrigin() {
  return String(process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")[0]
    .trim();
}

function whatsappDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function waLink(phone, text) {
  const digits = whatsappDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text || "")}`;
}

function mapsEmbed(settings, outlets) {
  if (settings?.maps_embed_url) return settings.maps_embed_url;
  const q = outlets[0]?.address || "Yoga For Us";
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

async function resolveOrderItem(body) {
  const kind = String(body.kind || "class").toLowerCase();
  if (kind === "membership") {
    const plan = await db.query(
      "SELECT * FROM membership_plans WHERE id = $1 AND active IS NOT FALSE",
      [body.ref_id]
    );
    if (!plan.rows[0]) throw Object.assign(new Error("Membership plan not found"), { status: 404 });
    return {
      kind,
      ref_id: plan.rows[0].id,
      class_id: null,
      amount: Math.max(Number(plan.rows[0].price || 0), 1),
      title: plan.rows[0].name,
    };
  }
  if (kind === "workshop") {
    const booking = await db.query(
      `SELECT b.*, w.title, w.price
       FROM workshop_bookings b
       JOIN workshops w ON w.id = b.workshop_id
       WHERE b.id = $1`,
      [body.ref_id]
    );
    if (!booking.rows[0]) throw Object.assign(new Error("Workshop booking not found"), { status: 404 });
    return {
      kind,
      ref_id: booking.rows[0].id,
      class_id: null,
      amount: Math.max(Number(booking.rows[0].price || 0), 1),
      title: booking.rows[0].title,
    };
  }
  if (kind === "private") {
    const booking = await db.query("SELECT * FROM private_bookings WHERE id = $1", [body.ref_id]);
    if (!booking.rows[0]) throw Object.assign(new Error("Private booking not found"), { status: 404 });
    const klass = await db.query(
      "SELECT * FROM classes WHERE title = $1 LIMIT 1",
      ["Personal/Private Yoga"]
    );
    const price = Number(klass.rows[0]?.price || 2499);
    return {
      kind,
      ref_id: booking.rows[0].id,
      class_id: klass.rows[0]?.id || null,
      amount: Math.max(price, 1),
      title: "Personal/Private Yoga",
    };
  }
  if (!body.class_id) {
    throw Object.assign(new Error("Name, email, and class are required"), { status: 400 });
  }
  const course = await db.query("SELECT * FROM classes WHERE id = $1", [body.class_id]);
  if (!course.rows[0]) throw Object.assign(new Error("Class not found"), { status: 404 });
  return {
    kind: "class",
    ref_id: null,
    class_id: course.rows[0].id,
    amount: Math.max(Number(course.rows[0].price || 0), 1),
    title: course.rows[0].title,
  };
}

function registerStudioRoutes(app) {
  app.get("/api/public/settings", async (_req, res) => {
    try {
      await ensureStudioTables();
      const settings = await getSettings();
      const outlets = await db.query("SELECT * FROM outlets ORDER BY id");
      res.json({
        settings,
        outlets: outlets.rows,
        maps_embed: mapsEmbed(settings, outlets.rows),
        maps_link:
          settings?.maps_link ||
          `https://maps.google.com/?q=${encodeURIComponent(outlets.rows[0]?.address || "Yoga For Us")}`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load settings" });
    }
  });

  app.get("/api/public/memberships", async (_req, res) => {
    try {
      await ensureStudioTables();
      const plans = await db.query(
        "SELECT * FROM membership_plans WHERE active IS NOT FALSE ORDER BY duration_months, access_type"
      );
      res.json({ plans: plans.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load memberships" });
    }
  });

  app.get("/api/public/workshops", async (_req, res) => {
    try {
      await ensureStudioTables();
      const rows = await db.query("SELECT * FROM workshops ORDER BY start_date NULLS LAST, id");
      res.json({ workshops: rows.rows });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load workshops" });
    }
  });

  app.post("/api/public/trial", async (req, res) => {
    const { name, email, phone, class_interest, preferred_date, mode } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    try {
      await ensureStudioTables();
      const row = await db.query(
        `INSERT INTO free_trials (name, email, phone, class_interest, preferred_date, mode)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name.trim(),
          email.trim().toLowerCase(),
          phone || null,
          class_interest || null,
          preferred_date || null,
          mode || "studio",
        ]
      );
      res.status(201).json(row.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not book free trial" });
    }
  });

  app.post("/api/public/private-bookings", optionalAuth, async (req, res) => {
    const { student_name, email, phone, preferred_date, preferred_time, notes } = req.body;
    if (!student_name || !email || !preferred_date || !preferred_time) {
      return res.status(400).json({ error: "Name, email, date, and time are required" });
    }
    try {
      await ensureStudioTables();
      const row = await db.query(
        `INSERT INTO private_bookings
           (user_id, student_name, email, phone, preferred_date, preferred_time, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          req.user?.id || null,
          student_name.trim(),
          email.trim().toLowerCase(),
          phone || null,
          preferred_date,
          preferred_time,
          notes || null,
        ]
      );
      res.status(201).json(row.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save private booking" });
    }
  });

  app.post("/api/public/workshop-bookings", optionalAuth, async (req, res) => {
    const { workshop_id, student_name, email, phone } = req.body;
    if (!workshop_id || !student_name || !email) {
      return res.status(400).json({ error: "Workshop, name, and email are required" });
    }
    try {
      await ensureStudioTables();
      const ws = await db.query("SELECT * FROM workshops WHERE id = $1", [workshop_id]);
      if (!ws.rows[0]) return res.status(404).json({ error: "Workshop not found" });
      const row = await db.query(
        `INSERT INTO workshop_bookings (workshop_id, user_id, student_name, email, phone)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [workshop_id, req.user?.id || null, student_name.trim(), email.trim().toLowerCase(), phone || null]
      );
      res.status(201).json({ booking: row.rows[0], workshop: ws.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not register for workshop" });
    }
  });

  app.get("/api/user/dashboard", requireAuth, async (req, res) => {
    try {
      await ensureStudioTables();
      const userId = req.user.id;
      const [memberships, attendance, enrollments, privateRows, workshops, schedules, settings, payments] =
        await Promise.all([
          db.query(
            `SELECT m.*, p.name AS plan_name, p.access_type, p.duration_months
             FROM memberships m
             LEFT JOIN membership_plans p ON p.id = m.plan_id
             WHERE m.user_id = $1 OR lower(m.email) = lower($2)
             ORDER BY m.expires_at DESC NULLS LAST`,
            [userId, req.user.email]
          ),
          db.query(
            `SELECT a.*, c.title AS class_title
             FROM attendance a
             LEFT JOIN classes c ON c.id = a.class_id
             WHERE a.user_id = $1
             ORDER BY a.session_date DESC
             LIMIT 60`,
            [userId]
          ),
          db.query(
            `SELECT e.*, c.title AS class_title, o.name AS outlet_name
             FROM class_enrollments e
             LEFT JOIN classes c ON c.id = e.class_id
             LEFT JOIN outlets o ON o.id = e.outlet_id
             WHERE e.user_id = $1`,
            [userId]
          ),
          db.query(
            `SELECT * FROM private_bookings WHERE user_id = $1 OR lower(email) = lower($2)
             ORDER BY preferred_date DESC`,
            [userId, req.user.email]
          ),
          db.query(
            `SELECT b.*, w.title, w.category, w.start_date, w.location
             FROM workshop_bookings b
             JOIN workshops w ON w.id = b.workshop_id
             WHERE b.user_id = $1 OR lower(b.email) = lower($2)
             ORDER BY b.created_at DESC`,
            [userId, req.user.email]
          ),
          db.query(
            `SELECT s.*, t.name AS trainer_name, c.title AS class_title, o.name AS outlet_name
             FROM weekly_schedules s
             LEFT JOIN trainers t ON t.id = s.trainer_id
             LEFT JOIN classes c ON c.id = s.class_id
             LEFT JOIN outlets o ON o.id = s.outlet_id
             ORDER BY s.day_of_week, s.start_time`
          ),
          getSettings(),
          db.query(
            `SELECT id, amount, status, kind, created_at FROM payments
             WHERE user_id = $1 OR lower(email) = lower($2)
             ORDER BY created_at DESC LIMIT 12`,
            [userId, req.user.email]
          ),
        ]);

      const active = memberships.rows.find(
        (m) => m.status === "active" && (!m.expires_at || new Date(m.expires_at) >= new Date(Date.now() - 86400000))
      );
      const meet = settings?.default_meet_link || "https://meet.google.com/new";
      const onlineAccess = Boolean(
        active && (active.access_type === "online" || active.access_type === "both")
      );
      const paidOnline = payments.rows.some((p) => p.status === "paid" && (p.kind === "class" || p.kind === "membership"));

      const upcoming = schedules.rows.map((s) => ({
        ...s,
        meet_link: onlineAccess || paidOnline ? s.meet_link || meet : null,
        locked: s.mode === "online" && !(onlineAccess || paidOnline),
      }));

      const settingsRow = settings;
      const wa = settingsRow?.whatsapp || "";

      res.json({
        memberships: memberships.rows,
        active_membership: active || null,
        attendance: attendance.rows,
        enrollments: enrollments.rows,
        private_bookings: privateRows.rows,
        workshops: workshops.rows,
        upcoming: upcoming,
        payments: payments.rows,
        meet_link: onlineAccess || paidOnline ? meet : null,
        whatsapp_url: wa
          ? waLink(wa, "Hi Yoga For Us, I have a question about my membership.")
          : "",
        settings: settingsRow,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load dashboard" });
    }
  });

  app.get("/api/public/attend/:code", async (req, res) => {
    try {
      await ensureStudioTables();
      const qr = await db.query(
        `SELECT q.*, c.title AS class_title, o.name AS outlet_name
         FROM attendance_qr q
         LEFT JOIN classes c ON c.id = q.class_id
         LEFT JOIN outlets o ON o.id = q.outlet_id
         WHERE q.code = $1`,
        [req.params.code]
      );
      if (!qr.rows[0]) return res.status(404).json({ error: "QR code not found" });
      res.json(qr.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load QR session" });
    }
  });

  app.post("/api/user/attend/:code", requireAuth, async (req, res) => {
    try {
      await ensureStudioTables();
      const qr = await db.query("SELECT * FROM attendance_qr WHERE code = $1", [req.params.code]);
      if (!qr.rows[0]) return res.status(404).json({ error: "QR code not found" });
      const session = qr.rows[0];
      const row = await db.query(
        `INSERT INTO attendance (user_id, class_id, outlet_id, session_date, present)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (user_id, class_id, session_date) DO UPDATE
         SET present = TRUE, outlet_id = EXCLUDED.outlet_id
         RETURNING *`,
        [req.user.id, session.class_id, session.outlet_id, session.session_date]
      );
      res.json({ attendance: row.rows[0], marked: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not mark attendance" });
    }
  });

  app.get("/api/admin/studio", requireAdmin, async (_req, res) => {
    try {
      await ensureStudioTables();
      const [settings, trials, privates, workshops, bookings, memberships, plans, qrs] =
        await Promise.all([
          getSettings(),
          db.query("SELECT * FROM free_trials ORDER BY created_at DESC LIMIT 80"),
          db.query("SELECT * FROM private_bookings ORDER BY created_at DESC LIMIT 80"),
          db.query("SELECT * FROM workshops ORDER BY id DESC"),
          db.query(
            `SELECT b.*, w.title AS workshop_title, w.category
             FROM workshop_bookings b
             JOIN workshops w ON w.id = b.workshop_id
             ORDER BY b.created_at DESC LIMIT 80`
          ),
          db.query(
            `SELECT m.*, p.name AS plan_name
             FROM memberships m
             LEFT JOIN membership_plans p ON p.id = m.plan_id
             ORDER BY m.created_at DESC LIMIT 80`
          ),
          db.query("SELECT * FROM membership_plans ORDER BY id"),
          db.query(
            `SELECT q.*, c.title AS class_title, o.name AS outlet_name
             FROM attendance_qr q
             LEFT JOIN classes c ON c.id = q.class_id
             LEFT JOIN outlets o ON o.id = q.outlet_id
             ORDER BY q.created_at DESC LIMIT 40`
          ),
        ]);
      res.json({
        settings,
        trials: trials.rows,
        private_bookings: privates.rows,
        workshops: workshops.rows,
        workshop_bookings: bookings.rows,
        memberships: memberships.rows,
        plans: plans.rows,
        qr_codes: qrs.rows,
        origin: clientOrigin(),
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not load studio admin" });
    }
  });

  app.put("/api/admin/settings", requireAdmin, async (req, res) => {
    const {
      whatsapp,
      instagram_url,
      facebook_url,
      youtube_url,
      maps_embed_url,
      maps_link,
      default_meet_link,
    } = req.body;
    try {
      await ensureStudioTables();
      const existing = await getSettings();
      let row;
      if (!existing) {
        row = await db.query(
          `INSERT INTO site_settings
             (whatsapp, instagram_url, facebook_url, youtube_url, maps_embed_url, maps_link, default_meet_link)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [
            whatsapp || null,
            instagram_url || null,
            facebook_url || null,
            youtube_url || null,
            maps_embed_url || null,
            maps_link || null,
            default_meet_link || null,
          ]
        );
      } else {
        row = await db.query(
          `UPDATE site_settings SET
             whatsapp = $1, instagram_url = $2, facebook_url = $3, youtube_url = $4,
             maps_embed_url = $5, maps_link = $6, default_meet_link = $7
           WHERE id = $8 RETURNING *`,
          [
            whatsapp || null,
            instagram_url || null,
            facebook_url || null,
            youtube_url || null,
            maps_embed_url || null,
            maps_link || null,
            default_meet_link || null,
            existing.id,
          ]
        );
      }
      res.json(row.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save settings" });
    }
  });

  app.post("/api/admin/workshops", requireAdmin, async (req, res) => {
    const { category, title, description, location, start_date, end_date, price, image_url, seats } =
      req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });
    try {
      const result = await db.query(
        `INSERT INTO workshops (category, title, description, location, start_date, end_date, price, image_url, seats)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          category || "event",
          title,
          description || null,
          location || null,
          start_date || null,
          end_date || null,
          price || 0,
          image_url || null,
          seats || 20,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not save workshop" });
    }
  });

  app.put("/api/admin/workshops/:id", requireAdmin, async (req, res) => {
    const { category, title, description, location, start_date, end_date, price, image_url, seats } =
      req.body;
    try {
      const result = await db.query(
        `UPDATE workshops SET category=$1, title=$2, description=$3, location=$4, start_date=$5,
         end_date=$6, price=$7, image_url=$8, seats=$9 WHERE id=$10 RETURNING *`,
        [
          category,
          title,
          description,
          location,
          start_date || null,
          end_date || null,
          price,
          image_url,
          seats,
          req.params.id,
        ]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update workshop" });
    }
  });

  app.delete("/api/admin/workshops/:id", requireAdmin, async (req, res) => {
    try {
      await db.query("DELETE FROM workshops WHERE id = $1", [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not delete workshop" });
    }
  });

  app.post("/api/admin/membership-plans", requireAdmin, async (req, res) => {
    const { name, duration_months, access_type, price, description, active } = req.body;
    if (!name || !duration_months || !access_type) {
      return res.status(400).json({ error: "Name, duration, and access type are required" });
    }
    try {
      await ensureStudioTables();
      const result = await db.query(
        `INSERT INTO membership_plans (name, duration_months, access_type, price, description, active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name.trim(),
          Number(duration_months),
          access_type,
          Number(price || 0),
          description || null,
          active !== false,
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not create membership plan" });
    }
  });

  app.put("/api/admin/membership-plans/:id", requireAdmin, async (req, res) => {
    const { name, duration_months, access_type, price, description, active } = req.body;
    if (!name || !duration_months || !access_type) {
      return res.status(400).json({ error: "Name, duration, and access type are required" });
    }
    try {
      const result = await db.query(
        `UPDATE membership_plans
         SET name = $1, duration_months = $2, access_type = $3, price = $4,
             description = $5, active = $6
         WHERE id = $7
         RETURNING *`,
        [
          name.trim(),
          Number(duration_months),
          access_type,
          Number(price || 0),
          description || null,
          active !== false,
          req.params.id,
        ]
      );
      if (!result.rows[0]) return res.status(404).json({ error: "Plan not found" });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update membership plan" });
    }
  });

  app.delete("/api/admin/membership-plans/:id", requireAdmin, async (req, res) => {
    try {
      await db.query("DELETE FROM membership_plans WHERE id = $1", [req.params.id]);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not delete membership plan" });
    }
  });

  app.put("/api/admin/workshop-bookings/:id", requireAdmin, async (req, res) => {
    try {
      const result = await db.query(
        `UPDATE workshop_bookings SET confirmed = $1 WHERE id = $2 RETURNING *`,
        [Boolean(req.body.confirmed), req.params.id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not update booking" });
    }
  });

  app.post("/api/admin/attendance/qr", requireAdmin, async (req, res) => {
    const { class_id, outlet_id, session_date } = req.body;
    if (!class_id || !session_date) {
      return res.status(400).json({ error: "Class and date are required" });
    }
    try {
      await ensureStudioTables();
      const code = crypto.randomBytes(8).toString("hex");
      const row = await db.query(
        `INSERT INTO attendance_qr (class_id, outlet_id, session_date, code)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [class_id, outlet_id || null, session_date, code]
      );
      const url = `${clientOrigin()}/attend/${code}`;
      res.status(201).json({
        ...row.rows[0],
        attend_url: url,
        qr_image: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not create QR code" });
    }
  });
}

module.exports = {
  registerStudioRoutes,
  resolveOrderItem,
  fulfillPaidPayment,
  ensureStudioTables,
};
