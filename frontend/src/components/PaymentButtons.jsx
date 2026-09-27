import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, money } from "../api";

const LABELS = { paytm: "Paytm", cashfree: "Cashfree" };

function loadScript(src, ready) {
  return new Promise((resolve, reject) => {
    if (ready()) {
      resolve(ready());
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(ready());
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.body.appendChild(script);
  });
}

function loadCashfreeSdk() {
  return loadScript("https://sdk.cashfree.com/js/v3/cashfree.js", () => window.Cashfree);
}

async function openPaytm(order) {
  await loadScript(
    `${order.host}/merchantpgpui/checkoutjs/merchants/${order.mid}.js`,
    () => window.Paytm?.CheckoutJS
  );
  const checkout = window.Paytm.CheckoutJS;
  return new Promise((resolve, reject) => {
    const config = {
      root: "",
      flow: "DEFAULT",
      data: {
        orderId: order.order_id,
        token: order.txn_token,
        tokenType: "TXN_TOKEN",
        amount: String(order.amount),
      },
      handler: {
        notifyMerchant(eventName) {
          if (eventName === "APP_CLOSED") reject(new Error("Paytm checkout closed"));
        },
        transactionStatus(status) {
          checkout.close();
          resolve(status);
        },
      },
    };
    checkout.onLoad(() => {
      checkout.init(config).then(() => checkout.invoke()).catch(reject);
    });
  });
}

// Gateway buttons shared by the course payment page and the general checkout.
// `getBody` returns the order payload (name, email, phone, class_id or kind/ref_id...).
export default function PaymentButtons({ getBody, amount, email }) {
  const navigate = useNavigate();
  const [gateways, setGateways] = useState(["paytm"]);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/payments/gateways")
      .then((d) => setGateways(d.gateways?.length ? d.gateways : ["paytm"]))
      .catch(() => {});
  }, []);

  async function verify(gateway, order) {
    const result = await api(`/api/payments/${gateway}/verify`, {
      method: "POST",
      body: JSON.stringify({ order_id: order.order_id, payment_id: order.payment_id }),
    });
    if (email) sessionStorage.setItem("yoga_pay_email", email.trim().toLowerCase());
    if (result.paid) {
      navigate(`/payments/history?order_id=${encodeURIComponent(order.order_id)}`);
    } else {
      setError(result.message || "Payment was not completed. You can try again.");
    }
  }

  async function pay(gateway) {
    setError("");
    setPending(null);
    setBusy(true);
    try {
      const order = await api(`/api/payments/${gateway}/order`, {
        method: "POST",
        body: JSON.stringify(getBody()),
      });
      if (gateway === "paytm") {
        if (order.test_mode) {
          setPending({ gateway, order });
          return;
        }
        await openPaytm(order);
        await verify("paytm", order);
        return;
      }
      if (order.test_sdk) {
        setPending({ gateway, order });
        return;
      }
      const Cashfree = await loadCashfreeSdk();
      const cf = Cashfree({ mode: order.environment === "production" ? "production" : "sandbox" });
      const result = await cf.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: "_modal",
      });
      if (result.error) {
        setError(result.error.message || "Checkout closed");
        return;
      }
      await verify("cashfree", order);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function submitWith(gateway) {
    return (e) => {
      const form = e.currentTarget.form;
      if (form && !form.reportValidity()) return;
      pay(gateway);
    };
  }

  return (
    <div className="pay-buttons">
      {gateways.map((g, i) => (
        <button
          key={g}
          type="button"
          className={`btn ${i === 0 ? "btn-green" : "btn-outline"}`}
          disabled={busy}
          onClick={submitWith(g)}
        >
          {amount != null ? `Pay ${money(amount)} with ${LABELS[g]}` : `Pay with ${LABELS[g]}`}
        </button>
      ))}
      {error ? <p className="error">{error}</p> : null}
      {pending ? (
        <div className="cf-test-box">
          <p>
            <strong>{LABELS[pending.gateway]} test checkout</strong>
          </p>
          <p className="muted">
            Order {pending.order.order_id} · {pending.order.class_title} ·{" "}
            {money(pending.order.amount)}
          </p>
          <p className="muted">
            Test mode is on because live {LABELS[pending.gateway]} keys are not set on the server.
          </p>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => verify(pending.gateway, pending.order).catch((err) => setError(err.message))}
          >
            Complete test payment
          </button>
        </div>
      ) : null}
    </div>
  );
}
