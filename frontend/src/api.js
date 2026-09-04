const API_BASE = import.meta.env.VITE_API_URL || "";

const token = () =>
  localStorage.getItem("yoga_auth_token") ||
  localStorage.getItem("yoga_admin_token");

let pending = 0;
const loaderListeners = new Set();

function notifyLoader() {
  loaderListeners.forEach((fn) => fn(pending));
}

export function subscribeLoader(fn) {
  loaderListeners.add(fn);
  fn(pending);
  return () => loaderListeners.delete(fn);
}

export async function api(path, options = {}) {
  pending += 1;
  notifyLoader();
  try {
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
      const err = new Error(
        res.status === 404
          ? data.error || "Not found. Restart the API so new admin routes are loaded."
          : data.error || "Request failed"
      );
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    pending = Math.max(0, pending - 1);
    notifyLoader();
  }
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
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  const base = import.meta.env.VITE_API_URL || "";
  if (url.startsWith("/")) return `${base}${url}`;
  return `${base}/${url}`;
}
