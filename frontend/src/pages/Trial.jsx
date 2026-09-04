import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Trial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    class_interest: "Regular Yoga",
    preferred_date: "",
    mode: "studio",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/public/home")
      .then((d) => {
        setClasses(d.classes || []);
        setOutlets(d.outlets || []);
        if (d.classes?.[0] && !form.class_interest) {
          setForm((f) => ({ ...f, class_interest: d.classes[0].title }));
        }
      })
      .catch(console.error);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/api/public/trial", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage("Your free trial is booked. We will confirm on WhatsApp or email.");
      setTimeout(() => navigate("/"), 1800);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Start with us</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            Book a free trial
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <form className="form" onSubmit={submit}>
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
              Phone / WhatsApp
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label>
              Class
              <select
                value={form.class_interest}
                onChange={(e) => setForm({ ...form, class_interest: e.target.value })}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.title}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Preferred date
              <input
                type="date"
                value={form.preferred_date}
                onChange={(e) => setForm({ ...form, preferred_date: e.target.value })}
              />
            </label>
            <label>
              Mode
              <select
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value })}
              >
                <option value="studio">Studio</option>
                <option value="online">Online</option>
              </select>
            </label>
            <button className="btn btn-green" type="submit">
              Book free trial
            </button>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="notice">{message}</p> : null}
          </form>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
