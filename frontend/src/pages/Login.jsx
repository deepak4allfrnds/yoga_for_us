import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import AuthProgress from "../components/AuthProgress";
import { api } from "../api";
import { useSignInFlow } from "../useSignInFlow";

export default function Login() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const flow = useSignInFlow();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await flow.run(
        () =>
          api("/api/auth/login", {
            method: "POST",
            quiet: true,
            body: JSON.stringify({ email, password }),
          }),
        next
      );
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Navbar />
      {flow.busy ? (
        <AuthProgress
          title="Signing you in…"
          steps={["Checking your details", "Signing you in", "Preparing your dashboard"]}
          active={flow.stage}
          done={flow.stage >= 3}
          doneText={`Welcome back, ${flow.doneName}!`}
        />
      ) : null}
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
            <button className="btn btn-green" type="submit" disabled={flow.busy}>
              Sign in
            </button>
            {error ? <p className="error">{error}</p> : null}
            <p>
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
            <p className="muted">
               New here?  <Link to={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}>
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
