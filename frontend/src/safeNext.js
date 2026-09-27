// Only allow same-site paths as a post-login redirect target.
export function safeNext(value, fallback = "/") {
  const next = String(value || "");
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
