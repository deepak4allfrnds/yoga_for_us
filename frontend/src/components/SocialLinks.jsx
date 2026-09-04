export function SocialLinks({ settings, className = "social-row" }) {
  if (!settings) return null;
  const items = [
    settings.whatsapp
      ? {
          href: `https://wa.me/${String(settings.whatsapp).replace(/\D/g, "")}`,
          label: "WhatsApp",
          icon: "wa",
        }
      : null,
    settings.instagram_url
      ? { href: settings.instagram_url, label: "Instagram", icon: "ig" }
      : null,
    settings.facebook_url
      ? { href: settings.facebook_url, label: "Facebook", icon: "fb" }
      : null,
    settings.youtube_url
      ? { href: settings.youtube_url, label: "YouTube", icon: "yt" }
      : null,
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <div className={className}>
      {items.map((item) => (
        <a
          key={item.label}
          className="social-icon"
          href={item.href}
          target="_blank"
          rel="noreferrer"
          aria-label={item.label}
          title={item.label}
        >
          {item.icon === "wa" ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.83 14.24c-.24.68-1.4 1.26-1.94 1.34-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.78-4.17-4.93-4.37-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.15.31-.3.48-.15.16-.31.37-.44.49-.15.14-.3.29-.13.56.17.27.76 1.25 1.63 2.03 1.12 1 2.07 1.31 2.36 1.46.29.14.46.12.63-.07.17-.19.73-.85.93-1.14.2-.29.39-.24.66-.14.27.1 1.71.81 2 .95.29.15.49.22.56.34.07.12.07.7-.17 1.38z"
              />
            </svg>
          ) : null}
          {item.icon === "ig" ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zM17.5 6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"
              />
            </svg>
          ) : null}
          {item.icon === "fb" ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v7h3v-7h3l1-3h-4V10c0-.6.4-1 1-1z"
              />
            </svg>
          ) : null}
          {item.icon === "yt" ? (
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path
                fill="currentColor"
                d="M23 12.2s0-3.2-.4-4.6c-.2-.9-.9-1.6-1.8-1.8C18.9 5.4 12 5.4 12 5.4s-6.9 0-8.8.4c-.9.2-1.6.9-1.8 1.8C1 9 1 12.2 1 12.2s0 3.2.4 4.6c.2.9.9 1.6 1.8 1.8 1.9.4 8.8.4 8.8.4s6.9 0 8.8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.4.4-4.6.4-4.6zM9.8 15.6V8.8l6.4 3.4-6.4 3.4z"
              />
            </svg>
          ) : null}
          <span>{item.label}</span>
        </a>
      ))}
    </div>
  );
}
