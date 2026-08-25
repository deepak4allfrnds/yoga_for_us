import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [code, setCode] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setCode("");
    try {
      const data = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setInfo(data.message);
      if (data.reset_code) {
        setCode(data.reset_code);
      }
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
            Forgot password
          </h1>
          <form className="form" onSubmit={submit}>
            <label>
              Account email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-green" type="submit">
              Send reset code
            </button>
            {error ? <p className="error">{error}</p> : null}
            {info ? <p className="notice">{info}</p> : null}
            {code ? (
              <p className="notice">
                Your reset code is <strong>{code}</strong>. It expires in 15
                minutes.
              </p>
            ) : null}
            {code ? (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() =>
                  navigate("/reset-password", { state: { email, code } })
                }
              >
                Continue to reset password
              </button>
            ) : null}
            <p className="muted">
              <Link to="/login">Back to login</Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
