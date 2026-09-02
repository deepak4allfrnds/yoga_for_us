const db = require("./db");

async function ensurePaymentColumns() {
  await db.query(`
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS mode VARCHAR(20);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS outlet_id INTEGER REFERENCES outlets(id) ON DELETE SET NULL;
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_order_id VARCHAR(120);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS cf_payment_id VARCHAR(120);
  `);
}

const PAYMENT_SELECT = `
  SELECT p.*,
         c.title AS class_title,
         c.description AS class_description,
         c.duration AS class_duration,
         c.image_url AS class_image,
         o.name AS outlet_name
  FROM payments p
  LEFT JOIN classes c ON c.id = p.class_id
  LEFT JOIN outlets o ON o.id = p.outlet_id
`;

async function migrate() {
  await ensurePaymentColumns();
  console.log("Payment columns ready for Cashfree.");
  await db.pool.end();
}

if (require.main === module) {
  require("dotenv").config();
  migrate().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensurePaymentColumns, PAYMENT_SELECT };
