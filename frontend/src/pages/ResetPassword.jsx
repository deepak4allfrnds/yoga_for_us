import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: location.state?.email || "",
    code: location.state?.code || "",
    password: "",
  });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      const data = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setInfo(data.message);
      setTimeout(() => navigate("/login"), 1200);
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
            Reset password
          </h1>
          <form className="form" onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={update}
                required
              />
            </label>
            <label>
              Reset code
              <input name="code" value={form.code} onChange={update} required />
            </label>
            <label>
              New password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={update}
                required
                minLength={6}
              />
            </label>
            <button className="btn btn-green" type="submit">
              Update password
            </button>
            {error ? <p className="error">{error}</p> : null}
            {info ? <p className="notice">{info}</p> : null}
            <p className="muted">
              <Link to="/login">Back to login</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
