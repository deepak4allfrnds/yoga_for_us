import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WeeklySchedule from "../components/WeeklySchedule";
import ReviewForm from "../components/ReviewForm";
import MediaGrid from "../components/MediaGrid";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";

function MemberHome() {
  const { user, isAdmin } = useAuth();
  const [dash, setDash] = useState(null);

  useEffect(() => {
    if (!user || isAdmin) return;
    api("/api/user/dashboard")
      .then(setDash)
      .catch(() => setDash(null));
  }, [user, isAdmin]);

  if (!user) return null;

  const expiry = dash?.active_membership?.expires_at
    ? String(dash.active_membership.expires_at).slice(0, 10)
    : null;
  const present = (dash?.attendance || []).filter((a) => a.present).length;

  return (
    <section className="member-home">
      <div className="container member-home-inner">
        <div>
          <p className="kicker">Welcome back</p>
          <h2>Hello, {user.name?.split(" ")[0] || "friend"}</h2>
          <p>
            {isAdmin
              ? "You are signed in as studio admin. Manage classes, payments, and attendance from the panel."
              : expiry
                ? `Your membership is active until ${expiry}.`
                : "Your studio space is ready — membership, classes, attendance, and Meet links live here."}
          </p>
        </div>
        <div className="member-home-cards">
          {isAdmin ? (
            <Link className="member-chip" to="/admin/dashboard">
              Open admin panel
            </Link>
          ) : (
            <>
              <Link className="member-chip" to="/dashboard">
                Dashboard
                {present ? <span>{present} classes attended</span> : null}
              </Link>
              <Link className="member-chip" to="/membership">
                Membership
              </Link>
              <Link className="member-chip" to="/private">
                Book private class
              </Link>
              <Link className="member-chip" to="/workshops">
                Workshops
              </Link>
              {dash?.meet_link ? (
                <a className="member-chip" href={dash.meet_link} target="_blank" rel="noreferrer">
                  Join Google Meet
                </a>
              ) : null}
              {dash?.whatsapp_url ? (
                <a className="member-chip" href={dash.whatsapp_url} target="_blank" rel="noreferrer">
                  WhatsApp studio
                </a>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [data, setData] = useState({
    classes: [],
    reviews: [],
    outlets: [],
    schedules: [],
    trainers: [],
    media: [],
    google_review_url: null,
  });
  const [studioId, setStudioId] = useState("");

  useEffect(() => {
    api("/api/public/home")
      .then((d) => {
        setData(d);
        if (d.outlets?.[0]) setStudioId(String(d.outlets[0].id));
      })
      .catch(console.error);
  }, []);

  const studioSlots = useMemo(
    () =>
      (data.schedules || []).filter(
        (s) => s.mode === "studio" && String(s.outlet_id) === String(studioId)
      ),
    [data.schedules, studioId]
  );

  return (
    <>
      <Navbar />
      <MemberHome />
      <section className="banner">
        <div className="banner-copy">
          <p className="kicker">Move with care</p>
          <h1>Yoga that meets you where you are</h1>
          <p>
            Morning sun salutations, evening restore, and teacher-led courses
            across our green studios.
          </p>
          <div className="banner-actions">
            <Link className="btn btn-green" to="/trial">
              Book free trial
            </Link>
            <Link className="btn btn-outline" to="/membership">
              Premium membership
            </Link>
          </div>
        </div>
      </section>

      <section className="section" id="classes">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">Programs</p>
              <h2>All yoga courses</h2>
            </div>
          </div>
          <div className="grid-3">
            {data.classes.map((c) => (
              <article className="card" key={c.id}>
                {c.image_url ? (
                  <img className="cover" src={imageSrc(c.image_url)} alt={c.title} />
                ) : null}
                <div className="card-body">
                  <h3 className="serif" style={{ fontSize: 26, margin: "0 0 8px" }}>
                    {c.title}
                  </h3>
                  <p className="muted">{c.description}</p>
                  <p className="muted">{c.duration}</p>
                  <Link
                    className="btn btn-green price-btn"
                    to={`/courses/${c.id}`}
                  >
                    {money(c.price)}
                  </Link>
                  <div className="mode-row">
                    {c.title === "Personal/Private Yoga" ? (
                      <Link className="btn btn-green" to="/private">
                        Book private session
                      </Link>
                    ) : (
                      <>
                        <Link className="btn btn-outline" to={`/courses/${c.id}?mode=studio`}>
                          Studio offline
                        </Link>
                        <Link className="btn btn-outline" to={`/courses/${c.id}?mode=online`}>
                          Online class
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="online">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">Live from home</p>
              <h2>Online yoga classes</h2>
            </div>
            <Link className="btn btn-green" to="/online">
              Class timetable
            </Link>
          </div>
          <div className="grid-3">
            <article className="card">
              <div className="card-body">
                <h3>Live classes</h3>
                <p>Join scheduled sessions on Zoom or Google Meet.</p>
              </div>
            </article>
            <article className="card">
              <div className="card-body">
                <h3>Monthly / quarterly / yearly</h3>
                <p>3 month, 6 month, and 1 year online or studio + online plans.</p>
                <Link to="/membership">See memberships</Link>
              </div>
            </article>
            <article className="card">
              <div className="card-body">
                <h3>Access after payment</h3>
                <p>
                  Meet links and WhatsApp messages unlock automatically once
                  Cashfree confirms payment.
                </p>
                <Link to="/workshops">Workshops & trips</Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {(data.media || []).length > 0 ? (
        <section className="section alt" id="media">
          <div className="container">
            <div className="section-head">
              <div>
                <p className="muted">Studio life</p>
                <h2>Yoga photos and videos</h2>
              </div>
              <Link className="btn btn-outline" to="/gallery">
                View gallery
              </Link>
            </div>
            <MediaGrid items={data.media} />
          </div>
        </section>
      ) : null}

      <section className="section alt" id="schedule">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">This week</p>
              <h2>Studio class schedule</h2>
            </div>
            <label>
              Studio{" "}
              <select
                value={studioId}
                onChange={(e) => setStudioId(e.target.value)}
              >
                {data.outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <WeeklySchedule slots={studioSlots} title="" />
        </div>
      </section>

      <section className="section" id="reviews">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">Community</p>
              <h2>Client reviews</h2>
            </div>
          </div>
          {data.reviews.length > 0 ? (
            <div className="grid-3">
              {data.reviews.map((r) => (
                <article className="review" key={`${r.source || "web"}-${r.id}`}>
                  <div className="stars">{"★".repeat(r.rating || 5)}</div>
                  <p>{r.comment}</p>
                  <strong>{r.client_name}</strong>
                  <p className="muted">
                    {r.source === "google" ? "Google review" : r.trainer_name || "Website review"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No reviews yet. Be the first to share your experience.</p>
          )}
          <div style={{ marginTop: 28 }}>
            <ReviewForm
              trainers={data.trainers}
              googleReviewUrl={data.google_review_url}
              onCreated={(review) =>
                setData((prev) => ({
                  ...prev,
                  reviews: [review, ...prev.reviews],
                }))
              }
            />
          </div>
        </div>
      </section>
      <Footer outlets={data.outlets} settings={data.settings} />
    </>
  );
}
