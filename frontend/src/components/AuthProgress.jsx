import { useEffect, useState } from "react";

// Full-screen progress shown while signing in / signing up and preparing the
// dashboard. `steps` is a list of labels; `active` is the index in progress
// (steps.length means everything is done).
export default function AuthProgress({ title, steps, active, done, doneText }) {
  // Which step has been running "too long" (null = none).
  const [slowStep, setSlowStep] = useState(null);
  const slow = slowStep === active;

  // A sleeping server (e.g. Render free plan) can take a while on the first
  // request of the day, so explain the wait instead of looking frozen.
  useEffect(() => {
    if (done) return undefined;
    const timer = setTimeout(() => setSlowStep(active), 7000);
    return () => clearTimeout(timer);
  }, [active, done]);

  return (
    <div className="auth-progress" role="status" aria-live="polite" aria-busy={!done}>
      <div className="auth-progress-card">
        <span className="logo-mark auth-progress-mark" aria-hidden="true">
          Y
        </span>
        <h2 className="serif">{done ? doneText : title}</h2>
        <ol className="auth-steps">
          {steps.map((label, i) => {
            const state = done || i < active ? "done" : i === active ? "active" : "todo";
            return (
              <li key={label} className={`auth-step is-${state}`}>
                <span className="auth-step-icon" aria-hidden="true">
                  {state === "done" ? "✓" : state === "active" ? <span className="spinner small" /> : ""}
                </span>
                <span>{label}</span>
                <span className="visually-hidden">
                  {state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
        {slow && !done ? (
          <p className="muted auth-slow">
            Waking up the studio server — the first sign-in of the day can take up
            to a minute. Please keep this page open.
          </p>
        ) : null}
      </div>
    </div>
  );
}
