import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Attend() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    api(`/api/public/attend/${code}`)
      .then(setSession)
      .catch((err) => setError(err.message));
  }, [code]);

  async function mark() {
    setError("");
    if (!user) {
      navigate(`/login?next=/attend/${code}`);
      return;
    }
    try {
      await api(`/api/user/attend/${code}`, { method: "POST" });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="serif" style={{ color: "var(--green-dark)" }}>
            Mark attendance
          </h1>
          {session ? (
            <p>
              {session.class_title} · {String(session.session_date).slice(0, 10)}
              {session.outlet_name ? ` · ${session.outlet_name}` : ""}
            </p>
          ) : null}
          {done ? (
            <p className="notice">Attendance marked. Thank you.</p>
          ) : (
            <button className="btn btn-green" type="button" onClick={mark}>
              {user ? "Mark me present" : "Login and mark present"}
            </button>
          )}
          {error ? <p className="error">{error}</p> : null}
          <p>
            <Link to="/dashboard">Student dashboard</Link>
          </p>
        </div>
      </section>
      <Footer />
    </>
  );
}
