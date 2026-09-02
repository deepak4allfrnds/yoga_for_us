import { useEffect, useState } from "react";
import { subscribeLoader } from "../api";

export default function PageLoader() {
  const [pending, setPending] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeLoader(setPending), []);

  useEffect(() => {
    if (pending <= 0) {
      setVisible(false);
      return undefined;
    }
    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, [pending]);

  if (!visible) return null;

  return (
    <div className="page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="page-loader-card">
        <span className="spinner" aria-hidden="true" />
        <p>Loading data…</p>
      </div>
    </div>
  );
}
