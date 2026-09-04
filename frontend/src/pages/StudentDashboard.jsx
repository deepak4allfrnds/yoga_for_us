import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WeeklySchedule from "../components/WeeklySchedule";
import { api, money } from "../api";
import { DAYS } from "../scheduleUtils";

function dayName(id) {
  return DAYS.find((d) => d.id === Number(id))?.label || `Day ${id}`;
}

export default function StudentDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/user/dashboard")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const onlineSlots = useMemo(
    () => (data?.upcoming || []).filter((s) => s.mode === "online"),
    [data]
  );
  const studioSlots = useMemo(
    () => (data?.upcoming || []).filter((s) => s.mode === "studio"),
    [data]
  );

  const m = data?.active_membership;

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Student area</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            My dashboard
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {error ? <p className="error">{error}</p> : null}
          {!data ? (
            <p className="muted">Loading…</p>
          ) : (
            <>
              <div className="grid-3 dash-grid">
                <article className="card">
                  <div className="card-body">
                    <p className="muted">Membership expiry</p>
                    <h3 className="serif" style={{ marginTop: 0 }}>
                      {m?.expires_at
                        ? String(m.expires_at).slice(0, 10)
                        : "No active plan"}
                    </h3>
                    <p>{m?.plan_name || "Choose a membership to unlock live classes."}</p>
                    <Link className="btn btn-green" to="/membership">
                      Memberships
                    </Link>
                  </div>
                </article>
                <article className="card">
                  <div className="card-body">
                    <p className="muted">Online class access</p>
                    {data.meet_link ? (
                      <>
                        <p>
                          <a href={data.meet_link} target="_blank" rel="noreferrer">
                            Open Google Meet
                          </a>
                        </p>
                        <p className="muted">Zoom / Meet links unlock after payment.</p>
                      </>
                    ) : (
                      <p>Pay for a class or membership to receive Meet links.</p>
                    )}
                    {data.whatsapp_url ? (
                      <a className="btn btn-outline" href={data.whatsapp_url} target="_blank" rel="noreferrer">
                        WhatsApp studio
                      </a>
                    ) : null}
                  </div>
                </article>
                <article className="card">
                  <div className="card-body">
                    <p className="muted">Attendance</p>
                    <p>
                      {(data.attendance || []).filter((a) => a.present).length} sessions marked
                    </p>
                    <Link className="btn btn-outline" to="/">
                      Mark via class calendar
                    </Link>
                    <p className="muted" style={{ marginTop: 12 }}>
                      Or scan the studio QR code, then login.
                    </p>
                  </div>
                </article>
              </div>

              <div className="section-head" style={{ marginTop: 40 }}>
                <div>
                  <p className="muted">Timetable</p>
                  <h2>Upcoming classes</h2>
                </div>
              </div>
              <WeeklySchedule title="Online live classes" slots={onlineSlots} />
              <ul>
                {onlineSlots.slice(0, 8).map((s) => (
                  <li key={s.id}>
                    {dayName(s.day_of_week)} {s.start_time} · {s.class_title}
                    {s.locked ? (
                      " (pay to unlock Meet)"
                    ) : s.meet_link ? (
                      <>
                        {" "}
                        <a href={s.meet_link} target="_blank" rel="noreferrer">
                          Meet
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              <WeeklySchedule title="Studio classes" slots={studioSlots} />

              <h2>Recent attendance</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Class</th>
                    <th>Present</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.attendance || []).map((a) => (
                    <tr key={a.id}>
                      <td>{String(a.session_date).slice(0, 10)}</td>
                      <td>{a.class_title}</td>
                      <td>{a.present ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <h2>Payments</h2>
              {(data.payments || []).map((p) => (
                <p key={p.id} className="muted">
                  {p.kind} · {money(p.amount)} · {p.status}
                </p>
              ))}
              <Link to="/payments/history">Full payment history</Link>
            </>
          )}
        </div>
      </section>
      <Footer />
    </>
  );
}
