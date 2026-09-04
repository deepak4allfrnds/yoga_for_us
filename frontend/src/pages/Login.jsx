import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(data.token, data.user);
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="serif" style={{ color: "var(--green-dark)" }}>
            Login
          </h1>
          <form className="form" onSubmit={submit}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-green" type="submit">
              Sign in
            </button>
            {error ? <p className="error">{error}</p> : null}
            <p>
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
            <p className="muted">
               New here?  <Link to="/register">Create an account</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
