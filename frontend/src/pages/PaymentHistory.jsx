import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";

export default function PaymentHistory() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(
    user?.email || sessionStorage.getItem("yoga_pay_email") || ""
  );
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const highlight = params.get("order_id");

  async function load(nextEmail = email) {
    setError("");
    try {
      if (user) {
        const data = await api("/api/user/payments");
        setRows(data);
        return;
      }
      if (!nextEmail) {
        setRows([]);
        return;
      }
      const qs = new URLSearchParams({ email: nextEmail });
      if (highlight) qs.set("order_id", highlight);
      const data = await api(`/api/payments/history?${qs.toString()}`);
      setRows(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [user, highlight]);

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Account</p>
          <h1
            className="serif"
            style={{
              fontSize: 56,
              margin: "8px 0 0",
              color: "var(--green-dark)",
            }}
          >
            Payment history
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {!user ? (
            <form
              className="form"
              onSubmit={(e) => {
                e.preventDefault();
                sessionStorage.setItem("yoga_pay_email", email.trim().toLowerCase());
                load(email.trim().toLowerCase());
              }}
            >
              <label>
                Email used at checkout
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <button className="btn btn-green" type="submit">
                Show my payments
              </button>
            </form>
          ) : (
            <p className="muted">Payments for {user.email}</p>
          )}
          {error ? <p className="error">{error}</p> : null}
          <div className="history-list">
            {rows.length === 0 ? (
              <p className="muted">No payments found yet.</p>
            ) : (
              rows.map((p) => (
                <article
                  className={`card history-card${
                    highlight && p.cf_order_id === highlight ? " is-latest" : ""
                  }`}
                  key={p.id}
                >
                  {p.class_image ? (
                    <img
                      className="cover"
                      src={imageSrc(p.class_image)}
                      alt={p.class_title || "Class"}
                    />
                  ) : null}
                  <div className="card-body">
                    <p className="muted">
                      {new Date(p.created_at).toLocaleString()} ·{" "}
                      <span className={`badge ${p.status}`}>{p.status}</span>
                    </p>
                    <h2 className="serif" style={{ margin: "6px 0" }}>
                      {p.class_title || "Yoga class"}
                    </h2>
                    <p>{p.class_description}</p>
                    <p className="muted">{p.class_duration}</p>
                    <p>
                      <strong>Chosen class type:</strong>{" "}
                      {p.mode === "online"
                        ? "Online class"
                        : p.mode === "studio"
                          ? "Studio offline"
                          : "—"}
                    </p>
                    {p.outlet_name ? (
                      <p>
                        <strong>Studio:</strong> {p.outlet_name}
                      </p>
                    ) : null}
                    <p className="price">{money(p.amount)}</p>
                    <p className="muted">
                      Paid by {p.student_name} · {p.email}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </p>
                    <p className="muted">
                      {p.payment_method}
                      {p.cf_order_id ? ` · Order ${p.cf_order_id}` : ""}
                    </p>
                    {p.class_id ? (
                      <Link to={`/courses/${p.class_id}`}>View class</Link>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
      <Footer outlets={[]} />
    </>
  );
}
