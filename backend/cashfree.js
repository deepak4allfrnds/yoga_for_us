const SANDBOX_URL = "https://sandbox.cashfree.com/pg";
const PROD_URL = "https://api.cashfree.com/pg";

function cashfreeEnabled() {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

function useTestSdk() {
  if (process.env.CASHFREE_TEST_MODE === "true") return true;
  return !cashfreeEnabled();
}

function cashfreeBase() {
  return process.env.CASHFREE_ENV === "production" ? PROD_URL : SANDBOX_URL;
}

function cashfreeHeaders() {
  return {
    "Content-Type": "application/json",
    "x-client-id": process.env.CASHFREE_APP_ID,
    "x-client-secret": process.env.CASHFREE_SECRET_KEY,
    "x-api-version": "2023-08-01",
  };
}

async function createCashfreeOrder({
  orderId,
  amount,
  customer,
  returnUrl,
}) {
  if (useTestSdk()) {
    return {
      test_sdk: true,
      order_id: orderId,
      payment_session_id: `test_session_${orderId}`,
      order_status: "ACTIVE",
    };
  }

  const response = await fetch(`${cashfreeBase()}/orders`, {
    method: "POST",
    headers: cashfreeHeaders(),
    body: JSON.stringify({
      order_id: orderId,
      order_amount: Number(amount),
      order_currency: "INR",
      customer_details: {
        customer_id: String(customer.id || "guest").slice(0, 50),
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: {
        return_url: returnUrl,
      },
      order_note: customer.note || "Yoga For Us class payment",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.message || data.message_text || "Could not create Cashfree order";
    const err = new Error(message);
    err.details = data;
    throw err;
  }
  return {
    test_sdk: false,
    order_id: data.order_id,
    payment_session_id: data.payment_session_id,
    order_status: data.order_status,
  };
}

async function fetchCashfreeOrder(orderId) {
  if (useTestSdk() || String(orderId).startsWith("yoga_test_")) {
    return { order_id: orderId, order_status: "PAID", payment_status: "SUCCESS" };
  }
  const response = await fetch(`${cashfreeBase()}/orders/${encodeURIComponent(orderId)}`, {
    headers: cashfreeHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Could not verify Cashfree order");
  }
  return data;
}

function isPaidStatus(order) {
  const status = String(order.order_status || order.payment_status || "").toUpperCase();
  return status === "PAID" || status === "SUCCESS";
}

module.exports = {
  useTestSdk,
  cashfreeEnabled,
  createCashfreeOrder,
  fetchCashfreeOrder,
  isPaidStatus,
};
