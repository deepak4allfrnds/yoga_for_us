import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@harmonyyoga.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("yoga_admin_token", data.token);
      navigate("/admin/dashboard");
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
            Admin panel
          </h1>
          <form className="form" onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="btn btn-green" type="submit">
              Sign in
            </button>
            {error ? <p className="error">{error}</p> : null}
            <p className="muted">Default: admin@harmonyyoga.com / admin123</p>
          </form>
        </div>
      </section>
    </>
  );
}
