const API_BASE = import.meta.env.VITE_API_URL || "";

const token = () =>
  localStorage.getItem("yoga_auth_token") ||
  localStorage.getItem("yoga_admin_token");

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token()) {
    headers.Authorization = `Bearer ${token()}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

export function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function imageSrc(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  const API_BASE = import.meta.env.VITE_API_URL || "";
  return `${API_BASE}${url}`;
}
