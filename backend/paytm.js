const crypto = require("crypto");

// Paytm Payment Gateway (JS Checkout + Initiate Transaction / Order Status APIs).
// Without PAYTM_MID + PAYTM_MERCHANT_KEY (or with PAYTM_TEST_MODE=true) a local
// test checkout is used, mirroring the Cashfree test SDK behaviour.

const STAGE_HOST = "https://securegw-stage.paytm.in";
const PROD_HOST = "https://securegw.paytm.in";
const IV = "@@@@&&&&####$$$$";

function paytmEnabled() {
  return Boolean(process.env.PAYTM_MID && process.env.PAYTM_MERCHANT_KEY);
}

function useTestPaytm() {
  if (process.env.PAYTM_TEST_MODE === "true") return true;
  return !paytmEnabled();
}

function paytmHost() {
  return process.env.PAYTM_ENV === "production" ? PROD_HOST : STAGE_HOST;
}

// --- Checksum (same algorithm as Paytm's official PaytmChecksum library) ---

function encrypt(input, key) {
  const cipher = crypto.createCipheriv("AES-128-CBC", key, IV);
  let encrypted = cipher.update(input, "binary", "base64");
  encrypted += cipher.final("base64");
  return encrypted;
}

function decrypt(encrypted, key) {
  const decipher = crypto.createDecipheriv("AES-128-CBC", key, IV);
  let decrypted = decipher.update(encrypted, "base64", "binary");
  decrypted += decipher.final("binary");
  return decrypted;
}

function calculateHash(params, salt) {
  return crypto.createHash("sha256").update(`${params}|${salt}`).digest("hex") + salt;
}

function stringByParams(params) {
  return Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      return value !== null && value !== undefined && String(value).toLowerCase() !== "null"
        ? String(value)
        : "";
    })
    .join("|");
}

function generateSignature(params, key) {
  const text = typeof params === "string" ? params : stringByParams(params);
  const salt = crypto.randomBytes(3).toString("base64");
  return encrypt(calculateHash(text, salt), key);
}

function verifySignature(params, key, checksum) {
  if (!checksum) return false;
  let text = params;
  if (typeof params !== "string") {
    const copy = { ...params };
    delete copy.CHECKSUMHASH;
    text = stringByParams(copy);
  }
  try {
    const hash = decrypt(checksum, key);
    const salt = hash.slice(-4);
    return hash === calculateHash(text, salt);
  } catch {
    return false;
  }
}

// --- API calls ---

async function paytmPost(path, body) {
  const key = process.env.PAYTM_MERCHANT_KEY;
  const payload = { body, head: { signature: generateSignature(JSON.stringify(body), key) } };
  const response = await fetch(`${paytmHost()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.body?.resultInfo?.resultMsg || "Paytm request failed");
  }
  return data;
}

async function createPaytmOrder({ orderId, amount, customer, callbackUrl }) {
  if (useTestPaytm()) {
    return {
      test_mode: true,
      order_id: orderId,
      txn_token: `test_token_${orderId}`,
      mid: "TEST_MID",
      host: paytmHost(),
    };
  }
  const mid = process.env.PAYTM_MID;
  const data = await paytmPost(
    `/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(orderId)}`,
    {
      requestType: "Payment",
      mid,
      websiteName: process.env.PAYTM_WEBSITE || (process.env.PAYTM_ENV === "production" ? "DEFAULT" : "WEBSTAGING"),
      orderId,
      callbackUrl,
      txnAmount: { value: Number(amount).toFixed(2), currency: "INR" },
      userInfo: {
        custId: String(customer.id || "guest").slice(0, 60),
        email: customer.email,
        mobile: customer.phone,
        firstName: customer.name,
      },
    }
  );
  const info = data?.body?.resultInfo || {};
  if (info.resultStatus !== "S" || !data.body.txnToken) {
    throw new Error(info.resultMsg || "Could not create Paytm transaction");
  }
  return {
    test_mode: false,
    order_id: orderId,
    txn_token: data.body.txnToken,
    mid,
    host: paytmHost(),
  };
}

async function fetchPaytmStatus(orderId) {
  if (useTestPaytm()) {
    return { status: "TXN_SUCCESS", txn_id: `test_txn_${orderId}` };
  }
  const data = await paytmPost("/v3/order/status", {
    mid: process.env.PAYTM_MID,
    orderId,
  });
  const body = data.body || {};
  return {
    status: body.resultInfo?.resultStatus || "PENDING",
    message: body.resultInfo?.resultMsg || "",
    txn_id: body.txnId || null,
  };
}

function paytmPaymentStatus(status) {
  const raw = String(status || "").toUpperCase();
  if (raw === "TXN_SUCCESS") return "paid";
  if (raw === "TXN_FAILURE") return "failed";
  return "pending";
}

module.exports = {
  paytmEnabled,
  useTestPaytm,
  createPaytmOrder,
  fetchPaytmStatus,
  paytmPaymentStatus,
  verifySignature,
  generateSignature,
};
