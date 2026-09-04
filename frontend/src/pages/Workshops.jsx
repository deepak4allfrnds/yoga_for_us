import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";

const LABELS = {
  workshop: "Yoga workshop",
  meditation: "Meditation session",
  retreat: "Yoga retreat",
  rishikesh: "Rishikesh trip",
  event: "Special event",
};

export default function Workshops() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [workshops, setWorkshops] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    student_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/public/workshops").then((d) => setWorkshops(d.workshops || [])).catch(console.error);
    api("/api/public/contact").then((d) => setOutlets(d.outlets || [])).catch(console.error);
  }, []);

  async function book(workshop) {
    setError("");
    if (!form.student_name || !form.email) {
      setError("Enter your name and email first.");
      return;
    }
    try {
      const data = await api("/api/public/workshop-bookings", {
        method: "POST",
        body: JSON.stringify({
          workshop_id: workshop.id,
          ...form,
        }),
      });
      navigate(`/pay?kind=workshop&ref_id=${data.booking.id}`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Community</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            Workshops & events
          </h1>
          <p>
            Yoga workshops, meditation sessions, retreats, Rishikesh trips, and special
            events. Register online, pay, and we confirm your trip or seat.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <form className="form" style={{ marginBottom: 32 }} onSubmit={(e) => e.preventDefault()}>
            <h3 className="serif" style={{ marginTop: 0 }}>
              Your details
            </h3>
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
              />
            </label>
          </form>
          {error ? <p className="error">{error}</p> : null}
          <div className="grid-3">
            {workshops.map((w) => (
              <article className="card" key={w.id}>
                {w.image_url ? (
                  <img className="cover" src={imageSrc(w.image_url)} alt={w.title} />
                ) : null}
                <div className="card-body">
                  <p className="muted">{LABELS[w.category] || w.category}</p>
                  <h3 className="serif" style={{ marginTop: 0 }}>
                    {w.title}
                  </h3>
                  <p>{w.description}</p>
                  <p className="muted">
                    {w.location}
                    {w.start_date ? ` · ${String(w.start_date).slice(0, 10)}` : ""}
                  </p>
                  <p className="price">{money(w.price)}</p>
                  <button className="btn btn-green" type="button" onClick={() => book(w)}>
                    Register & pay
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
