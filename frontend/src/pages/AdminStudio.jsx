import { useEffect, useState } from "react";
import { api, money } from "../api";

const emptyPlan = {
  id: null,
  name: "",
  duration_months: "3",
  access_type: "online",
  price: "",
  description: "",
  active: true,
};

const emptyWorkshop = {
  id: null,
  category: "workshop",
  title: "",
  description: "",
  location: "",
  start_date: "",
  end_date: "",
  price: "",
  image_url: "",
  seats: "20",
};

export default function AdminStudio({ tab, classes, outlets }) {
  const [data, setData] = useState({
    settings: {},
    trials: [],
    private_bookings: [],
    workshops: [],
    workshop_bookings: [],
    memberships: [],
    plans: [],
    qr_codes: [],
    origin: "",
  });
  const [settings, setSettings] = useState({});
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [wsForm, setWsForm] = useState(emptyWorkshop);
  const [qr, setQr] = useState({
    class_id: "",
    outlet_id: "",
    session_date: new Date().toISOString().slice(0, 10),
  });
  const [createdQr, setCreatedQr] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const d = await api("/api/admin/studio");
    setData(d);
    setSettings(d.settings || {});
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [tab]);

  async function saveSettings(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveWorkshop(e) {
    e.preventDefault();
    setError("");
    try {
      const path = wsForm.id ? `/api/admin/workshops/${wsForm.id}` : "/api/admin/workshops";
      await api(path, {
        method: wsForm.id ? "PUT" : "POST",
        body: JSON.stringify(wsForm),
      });
      setWsForm(emptyWorkshop);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePlan(e) {
    e.preventDefault();
    setError("");
    try {
      const path = planForm.id
        ? `/api/admin/membership-plans/${planForm.id}`
        : "/api/admin/membership-plans";
      await api(path, {
        method: planForm.id ? "PUT" : "POST",
        body: JSON.stringify(planForm),
      });
      setPlanForm(emptyPlan);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deletePlan(id) {
    setError("");
    try {
      await api(`/api/admin/membership-plans/${id}`, { method: "DELETE" });
      if (planForm.id === id) setPlanForm(emptyPlan);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmTrip(id, confirmed) {
    await api(`/api/admin/workshop-bookings/${id}`, {
      method: "PUT",
      body: JSON.stringify({ confirmed }),
    });
    await load();
  }

  async function makeQr(e) {
    e.preventDefault();
    setError("");
    try {
      const row = await api("/api/admin/attendance/qr", {
        method: "POST",
        body: JSON.stringify(qr),
      });
      setCreatedQr(row);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      {error ? <p className="error">{error}</p> : null}

      {tab === "settings" && (
        <>
          <h1 className="serif">Website & social links</h1>
          <form className="form" onSubmit={saveSettings}>
            <label>
              WhatsApp number
              <input
                value={settings.whatsapp || ""}
                onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
              />
            </label>
            <label>
              Instagram URL
              <input
                value={settings.instagram_url || ""}
                onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
              />
            </label>
            <label>
              Facebook URL
              <input
                value={settings.facebook_url || ""}
                onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
              />
            </label>
            <label>
              YouTube URL
              <input
                value={settings.youtube_url || ""}
                onChange={(e) => setSettings({ ...settings, youtube_url: e.target.value })}
              />
            </label>
            <label>
              Google Maps link
              <input
                value={settings.maps_link || ""}
                onChange={(e) => setSettings({ ...settings, maps_link: e.target.value })}
              />
            </label>
            <label>
              Maps embed URL (optional iframe src)
              <input
                value={settings.maps_embed_url || ""}
                onChange={(e) => setSettings({ ...settings, maps_embed_url: e.target.value })}
              />
            </label>
            <label>
              Default Google Meet / Zoom link
              <input
                value={settings.default_meet_link || ""}
                onChange={(e) => setSettings({ ...settings, default_meet_link: e.target.value })}
              />
            </label>
            <button className="btn btn-green" type="submit">
              Save settings
            </button>
          </form>
        </>
      )}

      {tab === "trials" && (
        <>
          <h1 className="serif">Free trial bookings</h1>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Class</th>
                <th>Date</th>
                <th>Mode</th>
              </tr>
            </thead>
            <tbody>
              {(data.trials || []).map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.email}</td>
                  <td>{t.phone}</td>
                  <td>{t.class_interest}</td>
                  <td>{t.preferred_date ? String(t.preferred_date).slice(0, 10) : ""}</td>
                  <td>{t.mode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "private" && (
        <>
          <h1 className="serif">Private session bookings</h1>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>When</th>
                <th>Status</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {(data.private_bookings || []).map((b) => (
                <tr key={b.id}>
                  <td>{b.student_name}</td>
                  <td>
                    {String(b.preferred_date).slice(0, 10)} {b.preferred_time}
                  </td>
                  <td>{b.status}</td>
                  <td>{b.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "workshops" && (
        <>
          <h1 className="serif">Workshops & events</h1>
          <form className="form" onSubmit={saveWorkshop}>
            <label>
              Category
              <select
                value={wsForm.category}
                onChange={(e) => setWsForm({ ...wsForm, category: e.target.value })}
              >
                <option value="workshop">Yoga workshop</option>
                <option value="meditation">Meditation</option>
                <option value="retreat">Retreat</option>
                <option value="rishikesh">Rishikesh trip</option>
                <option value="event">Special event</option>
              </select>
            </label>
            <label>
              Title
              <input
                value={wsForm.title}
                onChange={(e) => setWsForm({ ...wsForm, title: e.target.value })}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={wsForm.description}
                onChange={(e) => setWsForm({ ...wsForm, description: e.target.value })}
              />
            </label>
            <label>
              Location
              <input
                value={wsForm.location}
                onChange={(e) => setWsForm({ ...wsForm, location: e.target.value })}
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                value={wsForm.start_date || ""}
                onChange={(e) => setWsForm({ ...wsForm, start_date: e.target.value })}
              />
            </label>
            <label>
              Price
              <input
                value={wsForm.price}
                onChange={(e) => setWsForm({ ...wsForm, price: e.target.value })}
              />
            </label>
            <button className="btn btn-green" type="submit">
              {wsForm.id ? "Update event" : "Add event"}
            </button>
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data.workshops || []).map((w) => (
                <tr key={w.id}>
                  <td>{w.title}</td>
                  <td>{w.category}</td>
                  <td>{money(w.price)}</td>
                  <td>
                    <button type="button" onClick={() => setWsForm({ ...emptyWorkshop, ...w, start_date: w.start_date ? String(w.start_date).slice(0, 10) : "" })}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        api(`/api/admin/workshops/${w.id}`, { method: "DELETE" }).then(load)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2>Registrations</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Student</th>
                <th>Status</th>
                <th>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {(data.workshop_bookings || []).map((b) => (
                <tr key={b.id}>
                  <td>{b.workshop_title}</td>
                  <td>
                    {b.student_name}
                    <br />
                    {b.email}
                  </td>
                  <td>{b.status}</td>
                  <td>
                    <button type="button" onClick={() => confirmTrip(b.id, !b.confirmed)}>
                      {b.confirmed ? "Confirmed" : "Confirm trip / seat"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "members" && (
        <>
          <h1 className="serif">Membership plans</h1>
          <p className="muted">
            Add, update, or remove 3 month, 6 month, 1 year, online-only, and
            studio + online plans. Students see only active plans.
          </p>
          <form className="form" onSubmit={savePlan}>
            <label>
              Plan name
              <input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                required
              />
            </label>
            <label>
              Duration (months)
              <select
                value={planForm.duration_months}
                onChange={(e) =>
                  setPlanForm({ ...planForm, duration_months: e.target.value })
                }
              >
                <option value="1">1 month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">1 year</option>
              </select>
            </label>
            <label>
              Access type
              <select
                value={planForm.access_type}
                onChange={(e) =>
                  setPlanForm({ ...planForm, access_type: e.target.value })
                }
              >
                <option value="online">Online only</option>
                <option value="offline">Studio / offline only</option>
                <option value="both">Studio + online</option>
              </select>
            </label>
            <label>
              Price (INR)
              <input
                type="number"
                min="0"
                value={planForm.price}
                onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                required
              />
            </label>
            <label>
              Description
              <textarea
                value={planForm.description}
                onChange={(e) =>
                  setPlanForm({ ...planForm, description: e.target.value })
                }
                rows={3}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={planForm.active !== false}
                onChange={(e) =>
                  setPlanForm({ ...planForm, active: e.target.checked })
                }
              />{" "}
              Active (visible on the website)
            </label>
            <button className="btn btn-green" type="submit">
              {planForm.id ? "Update plan" : "Add plan"}
            </button>
            {planForm.id ? (
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setPlanForm(emptyPlan)}
              >
                Cancel edit
              </button>
            ) : null}
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Duration</th>
                <th>Access</th>
                <th>Price</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(data.plans || []).map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <br />
                    <span className="muted">{p.description}</span>
                  </td>
                  <td>{p.duration_months} mo</td>
                  <td>{p.access_type}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.active === false ? "Hidden" : "Yes"}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        setPlanForm({
                          ...emptyPlan,
                          ...p,
                          duration_months: String(p.duration_months),
                          price: String(p.price ?? ""),
                        })
                      }
                    >
                      Edit
                    </button>{" "}
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => deletePlan(p.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 className="serif">Student memberships</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Email</th>
                <th>Expires</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data.memberships || []).map((m) => (
                <tr key={m.id}>
                  <td>{m.plan_name}</td>
                  <td>{m.email}</td>
                  <td>{m.expires_at ? String(m.expires_at).slice(0, 10) : ""}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "qr" && (
        <>
          <h1 className="serif">Attendance QR</h1>
          <p className="muted">
            Print the QR. Students scan it, log in, and mark themselves present.
          </p>
          <form className="form" onSubmit={makeQr}>
            <label>
              Class
              <select
                value={qr.class_id}
                onChange={(e) => setQr({ ...qr, class_id: e.target.value })}
                required
              >
                <option value="">Select</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Studio
              <select
                value={qr.outlet_id}
                onChange={(e) => setQr({ ...qr, outlet_id: e.target.value })}
              >
                <option value="">Any</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Session date
              <input
                type="date"
                value={qr.session_date}
                onChange={(e) => setQr({ ...qr, session_date: e.target.value })}
                required
              />
            </label>
            <button className="btn btn-green" type="submit">
              Generate QR
            </button>
          </form>
          {createdQr ? (
            <div>
              <p>
                <a href={createdQr.attend_url} target="_blank" rel="noreferrer">
                  {createdQr.attend_url}
                </a>
              </p>
              <img src={createdQr.qr_image} alt="Attendance QR" width={220} height={220} />
            </div>
          ) : null}
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {(data.qr_codes || []).map((q) => (
                <tr key={q.id}>
                  <td>{String(q.session_date).slice(0, 10)}</td>
                  <td>{q.class_title}</td>
                  <td>
                    <a href={`${data.origin}/attend/${q.code}`} target="_blank" rel="noreferrer">
                      {q.code}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
