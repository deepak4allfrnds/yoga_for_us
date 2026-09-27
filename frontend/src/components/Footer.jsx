import { useEffect, useState } from "react";
import { SocialLinks } from "./SocialLinks";
import { api } from "../api";

export default function Footer({ outlets = [], settings = null }) {
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (settings && outlets.length) return;
    api("/api/public/settings")
      .then(setFetched)
      .catch(() => {});
  }, [settings, outlets.length]);

  const list = outlets.length ? outlets : fetched?.outlets || [];
  const social = settings || fetched?.settings;
  const hasSocial = Boolean(
    social &&
      (social.whatsapp || social.instagram_url || social.facebook_url || social.youtube_url)
  );

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <h3 className="serif">Yoga For Us</h3>
          <p>
            White-and-green studios for everyday practice. Come for the asana,
            stay for the breath.
          </p>
          {hasSocial ? <h3 className="serif footer-follow">Follow us</h3> : null}
          <SocialLinks settings={social} className="social-row footer-social" />
        </div>
        <div>
          <h3 className="serif">Studio hours</h3>
          {list.slice(0, 1).map((o) => (
            <p key={o.id}>
              {o.timings}
              <br />
              {o.phone}
            </p>
          ))}
        </div>
        <div>
          <h3 className="serif">All outlets</h3>
          {list.map((o) => (
            <p key={o.id}>
              <strong>{o.name}</strong>
              <br />
              {o.address}
              <br />
              {o.timings}
            </p>
          ))}
        </div>
      </div>
      <div className="container" style={{ marginTop: 28, opacity: 0.8 }}>
        © {new Date().getFullYear()} Yoga For Us
      </div>
    </footer>
  );
}
