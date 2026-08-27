import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("yoga_user") || "null");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const token = localStorage.getItem("yoga_auth_token");
    if (!token) return;
    api("/api/auth/me")
      .then((data) => {
        setUser(data.user);
        localStorage.setItem("yoga_user", JSON.stringify(data.user));
      })
      .catch(() => {
        localStorage.removeItem("yoga_auth_token");
        localStorage.removeItem("yoga_user");
        localStorage.removeItem("yoga_admin_token");
        setUser(null);
      });
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      setSession(token, nextUser) {
        localStorage.setItem("yoga_auth_token", token);
        localStorage.setItem("yoga_user", JSON.stringify(nextUser));
        localStorage.removeItem("yoga_admin_token");
        setUser(nextUser);
      },
      logout() {
        localStorage.removeItem("yoga_auth_token");
        localStorage.removeItem("yoga_user");
        localStorage.removeItem("yoga_admin_token");
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
