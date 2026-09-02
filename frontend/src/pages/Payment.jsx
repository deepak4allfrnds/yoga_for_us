import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money, imageSrc } from "../api";
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

export default function Payment() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = params.get("mode") || "";
  const [data, setData] = useState({ course: null, outlets: [] });
  const [form, setForm] = useState({
    student_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState(null);

  useEffect(() => {
    api(`/api/public/classes/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

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
          class_id: id,
          mode,
          outlet_id: params.get("outlet_id") || "",
        }),
      });
      setCheckout(order);
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

  const course = data.course;
  const studio = data.outlets?.find(
    (o) => String(o.id) === String(params.get("outlet_id"))
  );

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Checkout</p>
          <h1
            className="serif"
            style={{
              fontSize: 56,
              margin: "8px 0 0",
              color: "var(--green-dark)",
            }}
          >
            Payment
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container payment-layout">
          {course ? (
            <aside className="card">
              {course.image_url ? (
                <img
                  className="cover"
                  src={imageSrc(course.image_url)}
                  alt={course.title}
                />
              ) : null}
              <div className="card-body">
                <h2 style={{ marginTop: 0 }}>{course.title}</h2>
                <p className="muted">{course.duration}</p>
                <p>{course.description}</p>
                <p className="price">{money(course.price)}</p>
                <p>
                  <strong>Class mode:</strong>{" "}
                  {mode === "online"
                    ? "Online class"
                    : mode === "studio"
                      ? "Studio offline"
                      : "Not selected"}
                </p>
                {studio ? (
                  <p>
                    <strong>Studio:</strong> {studio.name}
                    <br />
                    <span className="muted">{studio.address}</span>
                  </p>
                ) : null}
                <Link to={`/courses/${course.id}`}>Back to course</Link>
              </div>
            </aside>
          ) : null}

          <form className="form" onSubmit={submit}>
            <h3 className="serif" style={{ color: "var(--green-dark)", fontSize: 28 }}>
              Pay with Cashfree
            </h3>
            <p className="muted">
              Sandbox / test SDK is on. After a successful payment you will see
              this class in your payment history.
            </p>
            <label>
              Full name
              <input
                name="student_name"
                value={form.student_name}
                onChange={update}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={update}
                required
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                value={form.phone}
                onChange={update}
                placeholder="10-digit mobile"
                required
              />
            </label>
            <button className="btn btn-green" type="submit">
              {course ? `Pay ${money(course.price)} with Cashfree` : "Pay now"}
            </button>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="notice">{message}</p> : null}
            {checkout?.test_sdk ? (
              <div className="cf-test-box">
                <p>
                  <strong>Cashfree test checkout</strong>
                </p>
                <p className="muted">
                  Order {checkout.order_id} · {checkout.class_title} ·{" "}
                  {money(checkout.amount)}
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
      <Footer outlets={data.outlets} />
    </>
  );
}
