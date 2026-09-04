import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WeeklySchedule from "../components/WeeklySchedule";
import { api } from "../api";

export default function OnlineClasses() {
  const [data, setData] = useState({ schedules: [], outlets: [], classes: [] });

  useEffect(() => {
    Promise.all([api("/api/public/home"), api("/api/public/schedules")])
      .then(([home, sch]) => {
        setData({
          schedules: sch.schedules || home.schedules || [],
          outlets: home.outlets || [],
          classes: home.classes || [],
        });
      })
      .catch(console.error);
  }, []);

  const online = useMemo(
    () => (data.schedules || []).filter((s) => s.mode === "online"),
    [data.schedules]
  );

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Practice from home</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            Online yoga classes
          </h1>
          <p>
            Live classes on Zoom / Google Meet, a weekly timetable, and monthly,
            quarterly, or yearly plans. Access unlocks automatically after payment.
          </p>
          <div className="banner-actions" style={{ marginTop: 16 }}>
            <Link className="btn btn-green" to="/membership">
              View plans
            </Link>
            <Link className="btn btn-outline" to="/trial">
              Book free trial
            </Link>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <WeeklySchedule title="Live class timetable" slots={online} />
          <div className="grid-3" style={{ marginTop: 32 }}>
            <article className="card">
              <div className="card-body">
                <h3>Live classes</h3>
                <p>Join from your phone or laptop at the scheduled time.</p>
              </div>
            </article>
            <article className="card">
              <div className="card-body">
                <h3>Zoom / Google Meet</h3>
                <p>
                  After payment, Meet links appear on your dashboard and can be sent
                  on WhatsApp.
                </p>
              </div>
            </article>
            <article className="card">
              <div className="card-body">
                <h3>Plans</h3>
                <p>Monthly-style 3 month, 6 month, and 1 year online memberships.</p>
                <Link to="/membership">Premium membership</Link>
              </div>
            </article>
          </div>
        </div>
      </section>
      <Footer outlets={data.outlets} />
    </>
  );
}
