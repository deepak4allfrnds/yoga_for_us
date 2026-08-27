import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSession(data.token, data.user);
      navigate("/");
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
            Registration
          </h1>
          <form className="form" onSubmit={submit}>
            <label>
              Full name
              <input name="name" value={form.name} onChange={update} required />
            </label>
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
              Phone number
              <input name="phone" value={form.phone} onChange={update} />
            </label>
            <label>
              Password
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
              Create account
            </button>
            {error ? <p className="error">{error}</p> : null}
            <p className="muted">
              Already registered? <Link to="/login">Login</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
