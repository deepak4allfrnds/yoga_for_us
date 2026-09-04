import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money } from "../api";
import { useAuth } from "../AuthContext";

function loadCashfreeSdk() {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve(window.Cashfree);
    script.onerror = () => reject(new Error("Could not load Cashfree SDK"));
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const kind = params.get("kind") || "class";
  const refId = params.get("ref_id");
  const [title, setTitle] = useState("Checkout");
  const [amount, setAmount] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    student_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(null);

  useEffect(() => {
    api("/api/public/contact").then((d) => setOutlets(d.outlets || [])).catch(() => {});
    if (kind === "membership") {
      api("/api/public/memberships").then((d) => {
        const plan = (d.plans || []).find((p) => String(p.id) === String(refId));
        if (plan) {
          setTitle(plan.name);
          setAmount(plan.price);
        }
      });
    }
    if (kind === "workshop") {
      api("/api/public/workshops").then(() => {
        setTitle("Workshop / event");
      });
    }
    if (kind === "private") {
      setTitle("Personal/Private Yoga");
    }
  }, [kind, refId]);

  async function verifyAndGo(order) {
    const result = await api("/api/payments/cashfree/verify", {
      method: "POST",
      body: JSON.stringify({
        order_id: order.order_id,
        payment_id: order.payment_id,
      }),
    });
    sessionStorage.setItem("yoga_pay_email", form.email.trim().toLowerCase());
    if (result.paid) {
      navigate(`/payments/history?order_id=${encodeURIComponent(order.order_id)}`);
    } else {
      setError("Payment was not completed. You can try again.");
    }
  }

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const order = await api("/api/payments/cashfree/order", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          kind,
          ref_id: refId,
        }),
      });
      setCheckout(order);
      setTitle(order.class_title || title);
      setAmount(order.amount);
      if (order.test_sdk) {
        setMessage("Cashfree test SDK is ready. Confirm the sandbox payment below.");
        return;
      }
      const Cashfree = await loadCashfreeSdk();
      const cf = Cashfree({
        mode: order.environment === "production" ? "production" : "sandbox",
      });
      const result = await cf.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: "_modal",
      });
      if (result.error) {
        setError(result.error.message || "Checkout closed");
        return;
      }
      await verifyAndGo(order);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Secure checkout</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            {title}
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container payment-layout">
          <aside className="card">
            <div className="card-body">
              <h2 style={{ marginTop: 0 }}>{title}</h2>
              <p className="muted">
                {kind === "membership"
                  ? "Membership access starts after payment."
                  : kind === "workshop"
                    ? "Your seat / trip is held after payment. We confirm Rishikesh and retreat bookings in admin."
                    : "Private session is confirmed after payment."}
              </p>
              {amount != null ? <p className="price">{money(amount)}</p> : null}
              <Link to="/membership">Memberships</Link>
            </div>
          </aside>
          <form className="form" onSubmit={submit}>
            <label>
              Full name
              <input
                name="student_name"
                value={form.student_name}
                onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </label>
            <button className="btn btn-green" type="submit">
              Pay with Cashfree
            </button>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="notice">{message}</p> : null}
            {checkout?.test_sdk ? (
              <div className="cf-test-box">
                <p>
                  <strong>Cashfree test checkout</strong>
                </p>
                <p className="muted">
                  Order {checkout.order_id} · {checkout.class_title} · {money(checkout.amount)}
                </p>
                <button
                  type="button"
                  className="btn btn-green"
                  onClick={() => verifyAndGo(checkout).catch((err) => setError(err.message))}
                >
                  Complete test payment
                </button>
              </div>
            ) : null}
          </form>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
