import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";

const SESSION_TYPES = [
  { id: "home", label: "Home visit", hint: "A teacher comes to your home." },
  { id: "studio", label: "At the studio", hint: "One-to-one at one of our studios." },
  { id: "online", label: "Online", hint: "Private session on Google Meet / Zoom." },
];

export default function PrivateYoga({ defaultType = "studio" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [outlets, setOutlets] = useState([]);
  const [homeClasses, setHomeClasses] = useState([]);
  const [pricing, setPricing] = useState({ private: null, home: null });
  const [form, setForm] = useState({
    session_type: defaultType,
    student_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    preferred_date: "",
    preferred_time: "07:00",
    address: "",
    outlet_id: "",
    class_id: params.get("class_id") || "",
    notes: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/public/contact").then((d) => setOutlets(d.outlets || [])).catch(console.error);
    api("/api/public/private-pricing").then(setPricing).catch(() => {});
    api("/api/public/classes?category=home")
      .then((d) => setHomeClasses(d.classes || []))
      .catch(() => {});
  }, []);

  const isHome = form.session_type === "home";
  const chosenClass = isHome
    ? homeClasses.find((c) => String(c.id) === String(form.class_id)) || null
    : null;
  const price = isHome
    ? chosenClass?.price ?? pricing.home?.price
    : pricing.private?.price;

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (isHome && homeClasses.length && !chosenClass) {
        setError("Choose a home visit class first.");
        return;
      }
      const booking = await api("/api/public/private-bookings", {
        method: "POST",
        body: JSON.stringify({ ...form, class_id: isHome ? form.class_id : "" }),
      });
      const classPart = isHome && form.class_id ? `&class_id=${form.class_id}` : "";
      navigate(`/pay?kind=private&ref_id=${booking.id}&type=${form.session_type}${classPart}`);
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
            {isHome ? "Private home visit yoga" : "Private yoga classes"}
          </h1>
          <p>
            {isHome
              ? "A certified teacher visits your home at the time you choose. Share your address, then complete payment to confirm."
              : "Choose your preferred date and time, then complete payment to confirm the session."}
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="session-type-row" role="radiogroup" aria-label="Session type">
            {SESSION_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={form.session_type === t.id}
                className={`session-type${form.session_type === t.id ? " is-active" : ""}`}
                onClick={() => setForm({ ...form, session_type: t.id })}
              >
                <strong>{t.label}</strong>
                <span>{t.hint}</span>
                {(t.id === "home" ? pricing.home : pricing.private) ? (
                  <span className="price">
                    {money((t.id === "home" ? pricing.home : pricing.private).price)}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {isHome ? (
            <div style={{ marginBottom: 28 }}>
              <h2 className="serif" style={{ color: "var(--green-dark)" }}>
                Home visit classes
              </h2>
              {homeClasses.length ? (
                <div className="grid-3 home-class-grid" role="radiogroup" aria-label="Home visit class">
                  {homeClasses.map((c) => {
                    const active = String(form.class_id) === String(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`card home-class${active ? " is-active" : ""}`}
                        onClick={() => setForm({ ...form, class_id: String(c.id) })}
                      >
                        {c.image_url ? (
                          <img className="cover" src={imageSrc(c.image_url)} alt="" />
                        ) : null}
                        <span className="card-body">
                          <strong className="serif">{c.title}</strong>
                          <span className="muted">{c.description}</span>
                          <span className="muted">{c.duration}</span>
                          <span className="price">{money(c.price)}</span>
                          <span className="btn btn-outline">{active ? "Selected" : "Choose"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="muted">
                  Home visit classes will be listed here soon. You can still request
                  a home visit below.
                </p>
              )}
            </div>
          ) : null}
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
            {isHome ? (
              <label>
                Home address
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={3}
                  placeholder="House / flat, street, area, city, PIN code"
                  required
                />
              </label>
            ) : null}
            {form.session_type === "studio" && outlets.length ? (
              <label>
                Studio
                <select
                  value={form.outlet_id}
                  onChange={(e) => setForm({ ...form, outlet_id: e.target.value })}
                >
                  <option value="">Any studio</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Preferred date
              <input
                type="date"
                value={form.preferred_date}
                min={new Date().toISOString().slice(0, 10)}
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
                placeholder={isHome ? "Parking, floor, health notes, mats needed…" : ""}
              />
            </label>
            <button className="btn btn-green" type="submit">
              {price != null ? `Continue to payment · ${money(price)}` : "Continue to payment"}
            </button>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
