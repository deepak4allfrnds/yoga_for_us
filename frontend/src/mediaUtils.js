export function youtubeId(url) {
  if (!url) return null;
  const match = String(url).match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/
  );
  return match ? match[1] : null;
}

export function isDirectVideo(url) {
  return (
    /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url || "") ||
    String(url).includes("/uploads/") ||
    String(url).includes("/api/files/")
  );
}

export function mediaSrc(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return url;
}
