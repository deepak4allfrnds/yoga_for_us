import { useEffect, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";
import { DAYS } from "../scheduleUtils";
import AttendanceCalendar from "../components/AttendanceCalendar";
import AdminStudio from "./AdminStudio";

const WEEKDAYS = DAYS.filter((d) => d.id <= 5);
const ADMIN_TABS = [
  "payments",
  "classes",
  "trainers",
  "media",
  "outlets",
  "schedules",
  "attendance",
  "contacts",
  "settings",
  "trials",
  "private",
  "workshops",
  "members",
  "qr",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyWeekDays() {
  return Object.fromEntries(
    WEEKDAYS.map((d) => [
      d.id,
      {
        enabled: true,
        start_time: "07:00",
        end_time: "08:00",
        trainer_id: "",
      },
    ])
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { logout, isAdmin } = useAuth();
  const [tab, setTabState] = useState(() => {
    const next = params.get("tab");
    return ADMIN_TABS.includes(next) ? next : "payments";
  });
  function setTab(next) {
    setTabState(next);
    setParams(next === "payments" ? {} : { tab: next }, { replace: true });
  }
  const [payments, setPayments] = useState({ payments: [], summary: {} });
  const [classes, setClasses] = useState([]);
  const [trainersData, setTrainersData] = useState({ trainers: [], reviews: [] });
  const [contacts, setContacts] = useState([]);
  const [googleSettings, setGoogleSettings] = useState({
    google_place_id: "",
    has_api_key: false,
    google_review_url: "",
    google_synced_at: null,
  });
  const [scheduleData, setScheduleData] = useState({
    schedules: [],
    outlets: [],
    classes: [],
    trainers: [],
  });
  const emptyClass = {
    id: null,
    title: "",
    description: "",
    price: "",
    duration: "",
    image_url: "",
  };
  const emptyTrainer = {
    id: null,
    name: "",
    specialization: "",
    bio: "",
    image_url: "",
  };
  const emptySchedule = {
    id: null,
    outlet_id: "",
    class_id: "",
    trainer_id: "",
    day_of_week: "1",
    start_time: "07:00",
    end_time: "08:00",
    mode: "studio",
  };
  const [classForm, setClassForm] = useState(emptyClass);
  const [trainerForm, setTrainerForm] = useState(emptyTrainer);
  const emptyOutlet = {
    id: null,
    name: "",
    address: "",
    timings: "",
    phone: "",
  };
  const [outlets, setOutlets] = useState([]);
  const [outletForm, setOutletForm] = useState(emptyOutlet);
  const [attendanceFilter, setAttendanceFilter] = useState({
    outlet_id: "",
    class_id: "",
    session_date: todayIso(),
  });
  const [roster, setRoster] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [calendarStudent, setCalendarStudent] = useState(null);
  const [userCalendarRecords, setUserCalendarRecords] = useState([]);
  const [scheduleForm, setScheduleForm] = useState(emptySchedule);
  const [weekPlan, setWeekPlan] = useState({
    outlet_id: "",
    class_id: "",
    mode: "studio",
    days: emptyWeekDays(),
  });
  const [mediaItems, setMediaItems] = useState([]);
  const emptyMedia = {
    id: null,
    media_type: "image",
    title: "",
    caption: "",
    url: "",
    sort_order: "0",
  };
  const [mediaForm, setMediaForm] = useState(emptyMedia);
  const [reviewForm, setReviewForm] = useState({
    trainer_id: "",
    client_name: "",
    rating: 5,
    comment: "",
    is_home_featured: false,
  });
  const [error, setError] = useState("");
  const [weekNotice, setWeekNotice] = useState("");

  useEffect(() => {
    if (!isAdmin) {
      navigate("/login");
    }
  }, [isAdmin, navigate]);

  async function loadAll() {
    const results = await Promise.allSettled([
      api("/api/admin/payments"),
      api("/api/admin/classes"),
      api("/api/admin/trainers"),
      api("/api/admin/contacts"),
      api("/api/admin/schedules"),
      api("/api/admin/google"),
      api("/api/admin/outlets"),
      api("/api/admin/media"),
    ]);
    const [p, c, t, ct, sch, g, o, m] = results;
    const failed = results.find((r) => r.status === "rejected");
    if (failed) setError(failed.reason?.message || "Could not load some admin data");
    else setError("");
    if (p.status === "fulfilled") setPayments(p.value);
    if (c.status === "fulfilled") setClasses(c.value);
    if (t.status === "fulfilled") setTrainersData(t.value);
    if (ct.status === "fulfilled") setContacts(ct.value);
    if (sch.status === "fulfilled") setScheduleData(sch.value);
    if (g.status === "fulfilled") setGoogleSettings(g.value);
    if (o.status === "fulfilled") setOutlets(o.value);
    if (m.status === "fulfilled") setMediaItems(m.value);
    const authFail = results.find(
      (r) =>
        r.status === "rejected" &&
        String(r.reason?.message || "").includes("sign in")
    );
    if (authFail && !isAdmin) {
      navigate("/login");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (tab === "schedules") {
      api("/api/admin/schedules")
        .then(setScheduleData)
        .catch((err) => setError(err.message));
    }
    if (tab === "attendance") {
      loadAttendance();
    }
  }, [tab]);

  useEffect(() => {
    if (!weekPlan.outlet_id || !weekPlan.class_id) return;
    const next = emptyWeekDays();
    (scheduleData.schedules || [])
      .filter(
        (s) =>
          String(s.outlet_id) === String(weekPlan.outlet_id) &&
          String(s.class_id) === String(weekPlan.class_id) &&
          s.mode === weekPlan.mode &&
          Number(s.day_of_week) <= 5
      )
      .forEach((s) => {
        next[s.day_of_week] = {
          enabled: true,
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
          trainer_id: s.trainer_id ? String(s.trainer_id) : "",
        };
      });
    setWeekPlan((prev) => ({ ...prev, days: next }));
  }, [weekPlan.outlet_id, weekPlan.class_id, weekPlan.mode, scheduleData.schedules]);

  async function uploadImage(file, setter) {
    const body = new FormData();
    body.append("image", file);
    const data = await api("/api/admin/upload", { method: "POST", body });
    setter((prev) => ({ ...prev, image_url: data.image_url }));
  }

  async function uploadMediaFile(file) {
    const body = new FormData();
    body.append("file", file);
    const data = await api("/api/admin/upload-media", { method: "POST", body });
    setMediaForm((prev) => ({
      ...prev,
      url: data.url,
      title: prev.title || file.name.replace(/\.[^.]+$/, ""),
    }));
  }

  async function saveMedia(e) {
    e.preventDefault();
    setError("");
    const path = mediaForm.id
      ? `/api/admin/media/${mediaForm.id}`
      : "/api/admin/media";
    await api(path, {
      method: mediaForm.id ? "PUT" : "POST",
      body: JSON.stringify(mediaForm),
    });
    setMediaForm(emptyMedia);
    loadAll();
  }

  async function saveClass(e) {
    e.preventDefault();
    const path = classForm.id
      ? `/api/admin/classes/${classForm.id}`
      : "/api/admin/classes";
    await api(path, {
      method: classForm.id ? "PUT" : "POST",
      body: JSON.stringify(classForm),
    });
    setClassForm(emptyClass);
    loadAll();
  }

  async function saveTrainer(e) {
    e.preventDefault();
    const path = trainerForm.id
      ? `/api/admin/trainers/${trainerForm.id}`
      : "/api/admin/trainers";
    await api(path, {
      method: trainerForm.id ? "PUT" : "POST",
      body: JSON.stringify(trainerForm),
    });
    setTrainerForm(emptyTrainer);
    loadAll();
  }

  async function saveWeekPlan(e) {
    e.preventDefault();
    setWeekNotice("");
    setError("");
    try {
      const slots = WEEKDAYS.map((d) => ({
        day_of_week: d.id,
        ...weekPlan.days[d.id],
      }));
      await api("/api/admin/schedules/week", {
        method: "POST",
        body: JSON.stringify({
          outlet_id: weekPlan.outlet_id,
          class_id: weekPlan.class_id,
          mode: weekPlan.mode,
          slots,
        }),
      });
      setWeekNotice("Monday–Friday schedule saved for this studio.");
      loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  function updateWeekDay(dayId, field, value) {
    setWeekPlan({
      ...weekPlan,
      days: {
        ...weekPlan.days,
        [dayId]: { ...weekPlan.days[dayId], [field]: value },
      },
    });
  }

  function applyTeacherToWeek(trainer_id) {
    const days = { ...weekPlan.days };
    WEEKDAYS.forEach((d) => {
      days[d.id] = { ...days[d.id], trainer_id };
    });
    setWeekPlan({ ...weekPlan, days });
  }

  async function saveSchedule(e) {
    e.preventDefault();
    const path = scheduleForm.id
      ? `/api/admin/schedules/${scheduleForm.id}`
      : "/api/admin/schedules";
    await api(path, {
      method: scheduleForm.id ? "PUT" : "POST",
      body: JSON.stringify(scheduleForm),
    });
    setScheduleForm(emptySchedule);
    loadAll();
  }

  async function saveOutlet(e) {
    e.preventDefault();
    setError("");
    const path = outletForm.id
      ? `/api/admin/outlets/${outletForm.id}`
      : "/api/admin/outlets";
    await api(path, {
      method: outletForm.id ? "PUT" : "POST",
      body: JSON.stringify(outletForm),
    });
    setOutletForm(emptyOutlet);
    loadAll();
  }

  async function loadAttendance() {
    setError("");
    const { outlet_id, class_id, session_date } = attendanceFilter;
    const recordQs = new URLSearchParams();
    if (outlet_id) recordQs.set("outlet_id", outlet_id);
    if (class_id) recordQs.set("class_id", class_id);
    try {
      const records = await api(`/api/admin/attendance?${recordQs.toString()}`);
      setAttendanceRecords(records);
      if (outlet_id && class_id && session_date) {
        const students = await api(
          `/api/admin/attendance/roster?outlet_id=${outlet_id}&class_id=${class_id}&session_date=${session_date}`
        );
        setRoster(students);
      } else {
        setRoster([]);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function markStudent(user_id, present) {
    setError("");
    try {
      await api("/api/admin/attendance", {
        method: "POST",
        body: JSON.stringify({
          user_id,
          class_id: attendanceFilter.class_id,
          outlet_id: attendanceFilter.outlet_id,
          session_date: attendanceFilter.session_date,
          present,
        }),
      });
      await loadAttendance();
      if (calendarStudent?.user_id === user_id) {
        await viewStudentCalendar(calendarStudent);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewStudentCalendar(student) {
    setError("");
    setCalendarStudent(student);
    try {
      const qs = new URLSearchParams({ user_id: student.user_id });
      if (attendanceFilter.class_id) qs.set("class_id", attendanceFilter.class_id);
      if (attendanceFilter.outlet_id) qs.set("outlet_id", attendanceFilter.outlet_id);
      const rows = await api(`/api/admin/attendance?${qs.toString()}`);
      setUserCalendarRecords(rows);
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveReview(e) {
    e.preventDefault();
    await api("/api/admin/reviews", {
      method: "POST",
      body: JSON.stringify(reviewForm),
    });
    setReviewForm({
      trainer_id: "",
      client_name: "",
      rating: 5,
      comment: "",
      is_home_featured: false,
    });
    loadAll();
  }

  function signOut() {
    logout();
    navigate("/");
  }

  const s = payments.summary || {};

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <h2 className="serif" style={{ marginTop: 0 }}>
          Studio Admin
        </h2>
        {[
          ["payments", "Payments"],
          ["classes", "Yoga classes"],
          ["trainers", "Teachers"],
          ["media", "Photos & videos"],
          ["outlets", "Studios"],
          ["schedules", "Studio schedule"],
          ["attendance", "Attendance"],
          ["contacts", "Contact leads"],
          ["settings", "Social & maps"],
          ["trials", "Free trials"],
          ["private", "Private bookings"],
          ["workshops", "Workshops & trips"],
          ["members", "Memberships"],
          ["qr", "Attendance QR"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <NavLink to="/">View website</NavLink>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </aside>
      <main className="admin-main">
        {error ? <p className="error">{error}</p> : null}

        {tab === "payments" && (
          <>
            <h1 className="serif">Payment transaction summary</h1>
            <div className="stats">
              <div className="stat">
                <p className="muted">Transactions</p>
                <strong>{s.total_count || 0}</strong>
              </div>
              <div className="stat">
                <p className="muted">Paid</p>
                <strong>{money(s.paid_amount)}</strong>
                <p className="muted">{s.paid_count || 0} payments</p>
              </div>
              <div className="stat">
                <p className="muted">Pending</p>
                <strong>{money(s.pending_amount)}</strong>
              </div>
              <div className="stat">
                <p className="muted">Failed</p>
                <strong>{money(s.failed_amount)}</strong>
              </div>
            </div>
            <table className="table" style={{ marginTop: 22 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Chosen type</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                    <td>
                      {p.student_name}
                      <br />
                      <span className="muted">{p.email}</span>
                    </td>
                    <td>
                      {p.class_title || "—"}
                      <br />
                      <span className="muted">{p.class_duration}</span>
                    </td>
                    <td>
                      {p.mode === "online"
                        ? "Online"
                        : p.mode === "studio"
                          ? "Studio"
                          : "—"}
                      {p.outlet_name ? (
                        <>
                          <br />
                          <span className="muted">{p.outlet_name}</span>
                        </>
                      ) : null}
                    </td>
                    <td>{money(p.amount)}</td>
                    <td>{p.payment_method}</td>
                    <td>
                      <span className={`badge ${p.status}`}>{p.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "classes" && (
          <>
            <h1 className="serif">
              {classForm.id ? "Edit yoga class" : "Add yoga class"}
            </h1>
            <form className="admin-form" onSubmit={saveClass}>
              <label>
                Title
                <input
                  value={classForm.title}
                  onChange={(e) =>
                    setClassForm({ ...classForm, title: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Price (INR)
                <input
                  type="number"
                  value={classForm.price}
                  onChange={(e) =>
                    setClassForm({ ...classForm, price: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Duration
                <input
                  value={classForm.duration}
                  onChange={(e) =>
                    setClassForm({ ...classForm, duration: e.target.value })
                  }
                />
              </label>
              <label>
                Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files[0] &&
                    uploadImage(e.target.files[0], setClassForm)
                  }
                />
              </label>
              <label className="full">
                Description
                <textarea
                  rows={3}
                  value={classForm.description}
                  onChange={(e) =>
                    setClassForm({ ...classForm, description: e.target.value })
                  }
                />
              </label>
              <button className="btn btn-green" type="submit">
                {classForm.id ? "Update class" : "Add class"}
              </button>
              {classForm.id ? (
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setClassForm(emptyClass)}
                >
                  Cancel edit
                </button>
              ) : null}
            </form>
            <div className="grid-3">
              {classes.map((c) => (
                <article className="card" key={c.id}>
                  {c.image_url ? (
                    <img className="cover" src={imageSrc(c.image_url)} alt="" />
                  ) : null}
                  <div className="card-body">
                    <h3>{c.title}</h3>
                    <p>{c.description}</p>
                    <p className="price">{money(c.price)}</p>
                    <div className="mode-row">
                      <button
                        className="btn btn-green"
                        type="button"
                        onClick={() => setClassForm({ ...c })}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={async () => {
                          await api(`/api/admin/classes/${c.id}`, {
                            method: "DELETE",
                          });
                          if (classForm.id === c.id) setClassForm(emptyClass);
                          loadAll();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "trainers" && (
          <>
            <h1 className="serif">
              {trainerForm.id ? "Edit teacher" : "Add teacher"}
            </h1>
            <form
              className="admin-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const saved = await api("/api/admin/google", {
                  method: "PUT",
                  body: JSON.stringify({
                    google_place_id: googleSettings.google_place_id,
                  }),
                });
                setGoogleSettings({ ...googleSettings, ...saved });
              }}
            >
              <label className="full">
                Google Place ID (to fetch Google reviews)
                <input
                  value={googleSettings.google_place_id || ""}
                  onChange={(e) =>
                    setGoogleSettings({
                      ...googleSettings,
                      google_place_id: e.target.value,
                    })
                  }
                  placeholder="ChIJ..."
                />
              </label>
              <p className="muted full">
                {googleSettings.has_api_key
                  ? "Places API key is set. Save the Place ID, then sync."
                  : "Add GOOGLE_PLACES_API_KEY to server/.env, then sync Google reviews."}
              </p>
              <button className="btn btn-green" type="submit">
                Save Place ID
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={async () => {
                  const result = await api("/api/admin/google/sync", {
                    method: "POST",
                  });
                  setError(
                    result.reason ||
                      `Fetched ${result.synced} Google review(s).`
                  );
                  loadAll();
                }}
              >
                Fetch Google reviews
              </button>
            </form>
            <form className="admin-form" onSubmit={saveTrainer}>
              <label>
                Name
                <input
                  value={trainerForm.name}
                  onChange={(e) =>
                    setTrainerForm({ ...trainerForm, name: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Specialization
                <input
                  value={trainerForm.specialization}
                  onChange={(e) =>
                    setTrainerForm({
                      ...trainerForm,
                      specialization: e.target.value,
                    })
                  }
                />
              </label>
              <label className="full">
                Bio
                <textarea
                  rows={3}
                  value={trainerForm.bio}
                  onChange={(e) =>
                    setTrainerForm({ ...trainerForm, bio: e.target.value })
                  }
                />
              </label>
              <label>
                Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files[0] &&
                    uploadImage(e.target.files[0], setTrainerForm)
                  }
                />
              </label>
              <button className="btn btn-green" type="submit">
                {trainerForm.id ? "Update teacher" : "Add teacher"}
              </button>
              {trainerForm.id ? (
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setTrainerForm(emptyTrainer)}
                >
                  Cancel edit
                </button>
              ) : null}
            </form>

            <form className="admin-form" onSubmit={saveReview}>
              <label>
                Teacher
                <select
                  value={reviewForm.trainer_id}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, trainer_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select</option>
                  {trainersData.trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Client name
                <input
                  value={reviewForm.client_name}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      client_name: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Rating
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={reviewForm.rating}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, rating: e.target.value })
                  }
                />
              </label>
              <label>
                Show on home
                <select
                  value={reviewForm.is_home_featured ? "yes" : "no"}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      is_home_featured: e.target.value === "yes",
                    })
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </label>
              <label className="full">
                Review
                <textarea
                  rows={3}
                  value={reviewForm.comment}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, comment: e.target.value })
                  }
                />
              </label>
              <button className="btn btn-green" type="submit">
                Save review
              </button>
            </form>

            <div className="grid-3">
              {trainersData.trainers.map((t) => (
                <article className="card" key={t.id}>
                  {t.image_url ? (
                    <img className="cover" src={imageSrc(t.image_url)} alt="" />
                  ) : null}
                  <div className="card-body">
                    <h3>{t.name}</h3>
                    <p className="muted">{t.specialization}</p>
                    <p>{t.bio}</p>
                    <div className="mode-row">
                      <button
                        className="btn btn-green"
                        type="button"
                        onClick={() => setTrainerForm({ ...t })}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={async () => {
                          await api(`/api/admin/trainers/${t.id}`, {
                            method: "DELETE",
                          });
                          if (trainerForm.id === t.id) {
                            setTrainerForm(emptyTrainer);
                          }
                          loadAll();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "schedules" && (
          <>
            <h1 className="serif">Studio week schedule</h1>
            <p className="muted">
              Pick a studio address and class, then set Mon–Fri time and teacher
              (for example Downtown Monday 7–8 Ankur, Tuesday 7–8 Ankur Tomer).
            </p>
            <form className="admin-form" onSubmit={saveWeekPlan}>
              <label className="full">
                Studio address
                <select
                  value={weekPlan.outlet_id}
                  onChange={(e) =>
                    setWeekPlan({ ...weekPlan, outlet_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select studio</option>
                  {(scheduleData.outlets || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.address}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Yoga class
                <select
                  value={weekPlan.class_id}
                  onChange={(e) =>
                    setWeekPlan({ ...weekPlan, class_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select class</option>
                  {(scheduleData.classes || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Type
                <select
                  value={weekPlan.mode}
                  onChange={(e) =>
                    setWeekPlan({ ...weekPlan, mode: e.target.value })
                  }
                >
                  <option value="studio">Studio offline</option>
                  <option value="online">Online</option>
                </select>
              </label>
              <label>
                Same teacher all week
                <select
                  value=""
                  onChange={(e) =>
                    e.target.value && applyTeacherToWeek(e.target.value)
                  }
                >
                  <option value="">Apply to Mon–Fri</option>
                  {(scheduleData.trainers || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="full">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Day</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Teacher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {WEEKDAYS.map((d) => {
                      const row = weekPlan.days[d.id] || {
                        enabled: true,
                        start_time: "07:00",
                        end_time: "08:00",
                        trainer_id: "",
                      };
                      return (
                        <tr key={d.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={Boolean(row.enabled)}
                              onChange={(e) =>
                                updateWeekDay(d.id, "enabled", e.target.checked)
                              }
                            />
                          </td>
                          <td>
                            <strong>{d.label}</strong>
                          </td>
                          <td>
                            <input
                              type="time"
                              value={row.start_time || "07:00"}
                              onChange={(e) =>
                                updateWeekDay(d.id, "start_time", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              value={row.end_time || "08:00"}
                              onChange={(e) =>
                                updateWeekDay(d.id, "end_time", e.target.value)
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={row.trainer_id || ""}
                              onChange={(e) =>
                                updateWeekDay(d.id, "trainer_id", e.target.value)
                              }
                            >
                              <option value="">Select teacher</option>
                              {(scheduleData.trainers || []).map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-green" type="submit">
                Save Mon–Fri schedule
              </button>
              {weekNotice ? <p className="notice full">{weekNotice}</p> : null}
            </form>

            <h2 className="serif">Add or edit one extra class</h2>
            <form className="admin-form" onSubmit={saveSchedule}>
              <label>
                Studio address
                <select
                  value={scheduleForm.outlet_id}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      outlet_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select studio</option>
                  {(scheduleData.outlets || []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} — {o.address}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Yoga class
                <select
                  value={scheduleForm.class_id}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      class_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select class</option>
                  {(scheduleData.classes || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Teacher
                <select
                  value={scheduleForm.trainer_id}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      trainer_id: e.target.value,
                    })
                  }
                >
                  <option value="">Select teacher</option>
                  {(scheduleData.trainers || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Day
                <select
                  value={scheduleForm.day_of_week}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      day_of_week: e.target.value,
                    })
                  }
                >
                  {DAYS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Start
                <input
                  type="time"
                  value={scheduleForm.start_time}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      start_time: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                End
                <input
                  type="time"
                  value={scheduleForm.end_time}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      end_time: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <label>
                Type
                <select
                  value={scheduleForm.mode}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, mode: e.target.value })
                  }
                >
                  <option value="studio">Studio offline</option>
                  <option value="online">Online</option>
                </select>
              </label>
              <button className="btn btn-green" type="submit">
                {scheduleForm.id ? "Update schedule" : "Add schedule"}
              </button>
              {scheduleForm.id ? (
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setScheduleForm(emptySchedule)}
                >
                  Cancel edit
                </button>
              ) : null}
            </form>
            <table className="table">
              <thead>
                <tr>
                  <th>Studio / address</th>
                  <th>Day</th>
                  <th>Time</th>
                  <th>Class</th>
                  <th>Teacher</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(scheduleData.schedules || []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.outlet_name}
                      <br />
                      <span className="muted">{row.outlet_address}</span>
                    </td>
                    <td>
                      {DAYS.find((d) => d.id === Number(row.day_of_week))
                        ?.label || row.day_of_week}
                    </td>
                    <td>
                      {row.start_time}–{row.end_time}
                    </td>
                    <td>{row.class_title}</td>
                    <td>{row.trainer_name}</td>
                    <td>{row.mode}</td>
                    <td>
                      <div className="mode-row">
                        <button
                          className="btn btn-green"
                          type="button"
                          onClick={() =>
                            setScheduleForm({
                              id: row.id,
                              outlet_id: row.outlet_id,
                              class_id: row.class_id,
                              trainer_id: row.trainer_id || "",
                              day_of_week: String(row.day_of_week),
                              start_time: String(row.start_time).slice(0, 5),
                              end_time: String(row.end_time).slice(0, 5),
                              mode: row.mode,
                            })
                          }
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-outline"
                          type="button"
                          onClick={async () => {
                            await api(`/api/admin/schedules/${row.id}`, {
                              method: "DELETE",
                            });
                            loadAll();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "media" && (
          <>
            <h1 className="serif">
              {mediaForm.id ? "Edit photo or video" : "Add yoga photo or video"}
            </h1>
            <form className="admin-form" onSubmit={saveMedia}>
              <label>
                Type
                <select
                  value={mediaForm.media_type}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, media_type: e.target.value })
                  }
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label>
                Title
                <input
                  value={mediaForm.title}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, title: e.target.value })
                  }
                  required
                />
              </label>
              <label className="full">
                Caption
                <input
                  value={mediaForm.caption}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, caption: e.target.value })
                  }
                />
              </label>
              <label className="full">
                Image / video file
                <input
                  type="file"
                  accept={
                    mediaForm.media_type === "video"
                      ? "video/mp4,video/webm,video/*"
                      : "image/*"
                  }
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMediaFile(file);
                  }}
                />
              </label>
              <label className="full">
                Or paste URL (Unsplash, YouTube, or uploaded file path)
                <input
                  value={mediaForm.url}
                  onChange={(e) =>
                    setMediaForm({ ...mediaForm, url: e.target.value })
                  }
                  placeholder="https://... or /uploads/..."
                  required
                />
              </label>
              <div className="full" style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-green" type="submit">
                  {mediaForm.id ? "Update media" : "Add media"}
                </button>
                {mediaForm.id ? (
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setMediaForm(emptyMedia)}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
            <table className="table" style={{ marginTop: 28 }}>
              <thead>
                <tr>
                  <th>Preview</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mediaItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.media_type === "image" ? (
                        <img
                          src={imageSrc(item.url)}
                          alt={item.title}
                          style={{ width: 88, height: 64, objectFit: "cover", borderRadius: 8 }}
                        />
                      ) : (
                        <span className="badge paid">Video</span>
                      )}
                    </td>
                    <td>
                      {item.title}
                      <br />
                      <span className="muted">{item.caption}</span>
                    </td>
                    <td>{item.media_type}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setMediaForm({ ...item, sort_order: String(item.sort_order || 0) })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={async () => {
                            if (!window.confirm(`Delete ${item.title}?`)) return;
                            await api(`/api/admin/media/${item.id}`, {
                              method: "DELETE",
                            });
                            if (mediaForm.id === item.id) setMediaForm(emptyMedia);
                            loadAll();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "outlets" && (
          <>
            <h1 className="serif">
              {outletForm.id ? "Edit studio" : "Add studio"}
            </h1>
            <form className="admin-form" onSubmit={saveOutlet}>
              <label>
                Studio name
                <input
                  value={outletForm.name}
                  onChange={(e) =>
                    setOutletForm({ ...outletForm, name: e.target.value })
                  }
                  required
                />
              </label>
              <label>
                Phone
                <input
                  value={outletForm.phone}
                  onChange={(e) =>
                    setOutletForm({ ...outletForm, phone: e.target.value })
                  }
                />
              </label>
              <label className="full">
                Address
                <input
                  value={outletForm.address}
                  onChange={(e) =>
                    setOutletForm({ ...outletForm, address: e.target.value })
                  }
                  required
                />
              </label>
              <label className="full">
                Timings
                <input
                  value={outletForm.timings}
                  onChange={(e) =>
                    setOutletForm({ ...outletForm, timings: e.target.value })
                  }
                  placeholder="Mon–Sat 6:00 AM – 9:00 PM"
                  required
                />
              </label>
              <div className="full" style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-green" type="submit">
                  {outletForm.id ? "Update studio" : "Add studio"}
                </button>
                {outletForm.id ? (
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setOutletForm(emptyOutlet)}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
            <table className="table" style={{ marginTop: 28 }}>
              <thead>
                <tr>
                  <th>Studio</th>
                  <th>Address</th>
                  <th>Timings</th>
                  <th>Phone</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{o.address}</td>
                    <td>{o.timings}</td>
                    <td>{o.phone || "—"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setOutletForm(o)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Delete ${o.name}? Schedules at this studio will also be removed.`
                              )
                            ) {
                              return;
                            }
                            await api(`/api/admin/outlets/${o.id}`, {
                              method: "DELETE",
                            });
                            if (outletForm.id === o.id) setOutletForm(emptyOutlet);
                            loadAll();
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "attendance" && (
          <>
            <h1 className="serif">Mark and view attendance</h1>
            <p className="muted">
              Choose a studio, class, and date. Students appear after they enroll
              in a studio class. Then mark Present or Absent. Records stay in the
              table below.
            </p>
            <form
              className="admin-form"
              onSubmit={(e) => {
                e.preventDefault();
                loadAttendance();
              }}
            >
              <label>
                Studio
                <select
                  value={attendanceFilter.outlet_id}
                  onChange={(e) =>
                    setAttendanceFilter({
                      ...attendanceFilter,
                      outlet_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select studio</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Class
                <select
                  value={attendanceFilter.class_id}
                  onChange={(e) =>
                    setAttendanceFilter({
                      ...attendanceFilter,
                      class_id: e.target.value,
                    })
                  }
                  required
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={attendanceFilter.session_date}
                  onChange={(e) =>
                    setAttendanceFilter({
                      ...attendanceFilter,
                      session_date: e.target.value,
                    })
                  }
                  required
                />
              </label>
              <div className="full">
                <button className="btn btn-green" type="submit">
                  Load students
                </button>
              </div>
            </form>

            <h2 className="serif" style={{ marginTop: 32 }}>
              Students for {attendanceFilter.session_date || "this date"}
            </h2>
            {roster.length === 0 ? (
              <p className="muted">
                No enrolled studio students for this studio and class. A student
                must log in and choose Studio offline for this class first.
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Mark</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s.user_id}>
                      <td>
                        {s.name}
                        <br />
                        <span className="muted">{s.email}</span>
                      </td>
                      <td>{s.phone || "—"}</td>
                      <td>
                        {s.present === true ? (
                          <span className="badge paid">Present</span>
                        ) : s.present === false ? (
                          <span className="badge failed">Absent</span>
                        ) : (
                          <span className="muted">Not marked</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-green"
                            onClick={() => markStudent(s.user_id, true)}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => markStudent(s.user_id, false)}
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => viewStudentCalendar(s)}
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {calendarStudent ? (
              <div className="attendance-calendar-panel">
                <div className="section-head">
                  <div>
                    <p className="muted">Student calendar</p>
                    <h3 className="serif" style={{ margin: 0, fontSize: 28 }}>
                      {calendarStudent.name}
                    </h3>
                    <p className="muted">
                      All marked days for this student
                      {attendanceFilter.class_id
                        ? " in the selected class"
                        : ""}
                      .
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setCalendarStudent(null);
                      setUserCalendarRecords([]);
                    }}
                  >
                    Close
                  </button>
                </div>
                <AttendanceCalendar
                  viewOnly
                  slots={(scheduleData.schedules || []).filter(
                    (row) =>
                      row.mode === "studio" &&
                      String(row.outlet_id) ===
                        String(attendanceFilter.outlet_id) &&
                      String(row.class_id) === String(attendanceFilter.class_id)
                  )}
                  records={userCalendarRecords}
                />
              </div>
            ) : null}

            <h2 className="serif" style={{ marginTop: 36 }}>
              Attendance records
            </h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Studio</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{String(r.session_date).slice(0, 10)}</td>
                    <td>
                      {r.student_name || "—"}
                      <br />
                      <span className="muted">{r.student_email}</span>
                    </td>
                    <td>{r.class_title || "—"}</td>
                    <td>{r.outlet_name || "—"}</td>
                    <td>
                      {r.present ? (
                        <span className="badge paid">Present</span>
                      ) : (
                        <span className="badge failed">Absent</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() =>
                            viewStudentCalendar({
                              user_id: r.user_id,
                              name: r.student_name,
                            })
                          }
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={async () => {
                            await api(`/api/admin/attendance/${r.id}`, {
                              method: "DELETE",
                            });
                            loadAttendance();
                            if (calendarStudent?.user_id === r.user_id) {
                              viewStudentCalendar({
                                user_id: r.user_id,
                                name: r.student_name,
                              });
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "contacts" && (
          <>
            <h1 className="serif">Contact form submissions</h1>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>{c.address}</td>
                    <td>{new Date(c.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {["settings", "trials", "private", "workshops", "members", "qr"].includes(tab) ? (
          <AdminStudio tab={tab} classes={classes} outlets={outlets} />
        ) : null}
      </main>
    </div>
  );
}
