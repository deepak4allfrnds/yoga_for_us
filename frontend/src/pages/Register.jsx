import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import AuthProgress from "../components/AuthProgress";
import { api } from "../api";
import { useSignInFlow } from "../useSignInFlow";

export default function Register() {
  const [params] = useSearchParams();
  const next = params.get("next");
  const flow = useSignInFlow();
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
      await flow.run(
        () =>
          api("/api/auth/register", {
            method: "POST",
            quiet: true,
            body: JSON.stringify(form),
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
          title="Creating your account…"
          steps={["Creating your account", "Signing you in", "Preparing your dashboard"]}
          active={flow.stage}
          done={flow.stage >= 3}
          doneText={`Welcome to Yoga For Us, ${flow.doneName}!`}
        />
      ) : null}
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
            <button className="btn btn-green" type="submit" disabled={flow.busy}>
              Create account
            </button>
            {error ? <p className="error">{error}</p> : null}
            <p className="muted">
              Already registered?{" "}
              <Link to={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Login</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
