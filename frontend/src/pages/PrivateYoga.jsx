import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function PrivateYoga() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    student_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    preferred_date: "",
    preferred_time: "07:00",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/public/contact").then((d) => setOutlets(d.outlets || [])).catch(console.error);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const booking = await api("/api/public/private-bookings", {
        method: "POST",
        body: JSON.stringify(form),
      });
      navigate(`/pay?kind=private&ref_id=${booking.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">One-to-one practice</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            Private yoga classes
          </h1>
          <p>Choose your preferred date and time, then complete payment to confirm the session.</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <form className="form" onSubmit={submit}>
            <label>
              Name
              <input
                value={form.student_name}
                onChange={(e) => setForm({ ...form, student_name: e.target.value })}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </label>
            <label>
              Preferred date
              <input
                type="date"
                value={form.preferred_date}
                onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
                required
              />
            </label>
            <label>
              Preferred time
              <input
                type="time"
                value={form.preferred_time}
                onChange={(e) => setForm({ ...form, preferred_time: e.target.value })}
                required
              />
            </label>
            <label>
              Notes
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </label>
            <button className="btn btn-green" type="submit">
              Continue to payment
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
