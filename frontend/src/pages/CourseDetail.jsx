import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import WeeklySchedule from "../components/WeeklySchedule";
import AttendanceCalendar from "../components/AttendanceCalendar";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";

export default function CourseDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const mode = params.get("mode") || "";
  const [data, setData] = useState({
    course: null,
    outlets: [],
    schedules: [],
  });
  const [outletId, setOutletId] = useState("");
  const [whatsapp, setWhatsapp] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [enrollment, setEnrollment] = useState(null);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    api(`/api/public/classes/${id}`)
      .then((d) => {
        setData(d);
        if (d.outlets[0] && !outletId) setOutletId(String(d.outlets[0].id));
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    api("/api/user/enrollments")
      .then((rows) => {
        const match = rows.find(
          (r) => String(r.class_id) === String(id) && (!mode || r.mode === mode)
        );
        if (match) {
          setEnrollment(match);
          if (match.whatsapp) setWhatsapp(match.whatsapp);
          if (match.outlet_id) setOutletId(String(match.outlet_id));
        }
      })
      .catch(() => {});
  }, [user, id, mode]);

  useEffect(() => {
    if (!user || !id) return;
    api(`/api/user/attendance?class_id=${id}`)
      .then(setAttendance)
      .catch(() => {});
  }, [user, id]);

  const studioSlots = useMemo(
    () =>
      data.schedules.filter(
        (s) => s.mode === "studio" && String(s.outlet_id) === String(outletId)
      ),
    [data.schedules, outletId]
  );
  const onlineSlots = useMemo(
    () => data.schedules.filter((s) => s.mode === "online"),
    [data.schedules]
  );

  const course = data.course;

  function setMode(next) {
    setNotice("");
    setError("");
    const nextParams = new URLSearchParams(params);
    nextParams.set("mode", next);
    setParams(nextParams);
  }

  async function saveChoice(e) {
    e.preventDefault();
    if (!user) {
      navigate("/login");
      return;
    }
    setError("");
    setNotice("");
    try {
      const dataRes = await api("/api/user/choose-class", {
        method: "POST",
        body: JSON.stringify({
          class_id: id,
          mode,
          outlet_id: mode === "studio" ? outletId : null,
          whatsapp: mode === "online" ? whatsapp : null,
        }),
      });
      setEnrollment(dataRes.enrollment);
      setWhatsappUrl(dataRes.whatsapp_url || "");
      setNotice(
        mode === "online"
          ? "Online class saved. A Google Meet link is ready to send on WhatsApp."
          : "Studio class saved. Use the calendar to mark attendance."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleAttendance(session_date, present) {
    if (!user) {
      navigate("/login");
      return;
    }
    const row = await api("/api/user/attendance", {
      method: "POST",
      body: JSON.stringify({
        class_id: id,
        outlet_id: mode === "studio" ? outletId : null,
        session_date,
        present,
      }),
    });
    setAttendance((prev) => {
      const rest = prev.filter(
        (r) => String(r.session_date).slice(0, 10) !== session_date
      );
      return [...rest, row];
    });
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Course information</p>
          <h1
            className="serif"
            style={{
              fontSize: 56,
              margin: "8px 0 0",
              color: "var(--green-dark)",
            }}
          >
            {course?.title || "Course"}
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container">
          {error ? <p className="error">{error}</p> : null}
          {course ? (
            <>
              <article className="course-detail">
                {course.image_url ? (
                  <img
                    src={imageSrc(course.image_url)}
                    alt={course.title}
                    className="course-hero"
                  />
                ) : null}
                <div>
                  <p className="muted">{course.duration}</p>
                  <p>{course.description}</p>
                  <p className="price">{money(course.price)}</p>
                  <p>Choose how you want to take this class:</p>
                  <div className="mode-row">
                    <button
                      type="button"
                      className={`btn ${mode === "studio" ? "btn-green" : "btn-outline"}`}
                      onClick={() => setMode("studio")}
                    >
                      Studio offline class
                    </button>
                    <button
                      type="button"
                      className={`btn ${mode === "online" ? "btn-green" : "btn-outline"}`}
                      onClick={() => setMode("online")}
                    >
                      Online class
                    </button>
                  </div>
                  {course.title === "Personal/Private Yoga" ? (
                    <Link className="btn btn-green" to="/private">
                      Pick date & time, then pay
                    </Link>
                  ) : (
                    <Link
                      className="btn btn-outline"
                      to={`/courses/${course.id}/pay?mode=${encodeURIComponent(mode)}&outlet_id=${encodeURIComponent(outletId)}`}
                    >
                      Continue to payment
                    </Link>
                  )}
                </div>
              </article>

              {mode === "studio" ? (
                <div className="panel">
                  <form className="form" onSubmit={saveChoice}>
                    <label>
                      Choose studio
                      <select
                        value={outletId}
                        onChange={(e) => setOutletId(e.target.value)}
                      >
                        {data.outlets.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="btn btn-green" type="submit">
                      Confirm studio class
                    </button>
                  </form>
                  <WeeklySchedule
                    title="Weekly classes at this studio"
                    slots={studioSlots}
                  />
                  <h3 className="serif" style={{ color: "var(--green-dark)" }}>
                    Attendance calendar
                  </h3>
                  <AttendanceCalendar
                    slots={studioSlots}
                    records={attendance}
                    onToggle={toggleAttendance}
                    disabled={!user}
                  />
                  {!user ? (
                    <p className="muted">
                      <Link to="/login">Login</Link> to mark attendance.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {mode === "online" ? (
                <div className="panel">
                  <WeeklySchedule
                    title="Weekly online class times"
                    slots={onlineSlots}
                  />
                  <form className="form" onSubmit={saveChoice}>
                    <label>
                      WhatsApp number
                      <input
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        placeholder="9198XXXXXXXX"
                        required
                      />
                    </label>
                    <button className="btn btn-green" type="submit">
                      Generate Google Meet link
                    </button>
                  </form>
                  {enrollment?.meet_link ? (
                    <p>
                      Meet link:{" "}
                      <a href={enrollment.meet_link} target="_blank" rel="noreferrer">
                        {enrollment.meet_link}
                      </a>
                    </p>
                  ) : null}
                  {whatsappUrl || enrollment?.meet_link ? (
                    <a
                      className="btn btn-green"
                      href={
                        whatsappUrl ||
                        `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                          `Yoga For Us online class. Join Google Meet: ${enrollment.meet_link}`
                        )}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      Send Meet link to WhatsApp
                    </a>
                  ) : null}
                  <h3 className="serif" style={{ color: "var(--green-dark)" }}>
                    Attendance calendar
                  </h3>
                  <AttendanceCalendar
                    slots={onlineSlots}
                    records={attendance}
                    onToggle={toggleAttendance}
                    disabled={!user}
                  />
                </div>
              ) : null}
              {notice ? <p className="notice">{notice}</p> : null}
            </>
          ) : null}
        </div>
      </section>
      <Footer outlets={data.outlets} />
    </>
  );
}
