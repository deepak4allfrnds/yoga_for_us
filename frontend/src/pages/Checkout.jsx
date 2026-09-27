import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PaymentButtons from "../components/PaymentButtons";
import { api, money } from "../api";
import { useAuth } from "../AuthContext";

export default function Checkout() {
  const [params] = useSearchParams();
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
      const home = params.get("type") === "home";
      setTitle(home ? "Private home visit yoga" : "Private yoga session");
      api("/api/public/private-pricing")
        .then((d) => {
          const row = home ? d.home : d.private;
          if (row) setAmount(row.price);
        })
        .catch(() => {});
    }
  }, [kind, refId, params]);

  function orderBody() {
    return { ...form, kind, ref_id: refId };
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
                    : "Your private or home-visit session is confirmed after payment."}
              </p>
              {amount != null ? <p className="price">{money(amount)}</p> : null}
              <Link to="/membership">Memberships</Link>
            </div>
          </aside>
          <form className="form" onSubmit={(e) => e.preventDefault()}>
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
            <PaymentButtons getBody={orderBody} amount={amount} email={form.email} />
          </form>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
