import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./AuthContext";
import { safeNext } from "./safeNext";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs login / sign-up with visible progress, then opens the dashboard.
// `stage` is the active step index for <AuthProgress>, or null when idle.
export function useSignInFlow() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [stage, setStage] = useState(null);
  const [doneName, setDoneName] = useState("");

  async function run(request, next) {
    setStage(0);
    try {
      const data = await request();
      setStage(1);
      setSession(data.token, data.user);
      await pause(250);
      setStage(2);

      const isAdmin = data.user.role === "admin";
      const target = isAdmin
        ? safeNext(next?.startsWith("/admin") ? next : null, "/admin/dashboard")
        : safeNext(next, "/dashboard");
      // Load the student dashboard now so it opens already filled in.
      const prefetched =
        !isAdmin && target === "/dashboard"
          ? await api("/api/user/dashboard", { quiet: true }).catch(() => null)
          : null;

      setDoneName(data.user.name?.split(" ")[0] || "friend");
      setStage(3);
      await pause(700);
      navigate(target, { replace: true, state: prefetched ? { prefetched } : undefined });
    } catch (err) {
      setStage(null);
      throw err;
    }
  }

  return { stage, doneName, busy: stage !== null, run };
}
