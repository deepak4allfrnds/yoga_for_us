import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, imageSrc } from "../api";
import MediaGrid from "../components/MediaGrid";
import { SocialLinks } from "../components/SocialLinks";

export default function Gallery() {
  const [data, setData] = useState({
    trainers: [],
    outlets: [],
    media: [],
    settings: null,
    maps_embed: "",
    maps_link: "",
  });

  useEffect(() => {
    api("/api/public/gallery").then(setData).catch(console.error);
  }, []);

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Photos and videos</p>
          <h1
            className="serif"
            style={{
              fontSize: 56,
              margin: "8px 0 0",
              color: "var(--green-dark)",
            }}
          >
            Gallery
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">Studio life</p>
              <h2>Yoga photos and videos</h2>
            </div>
          </div>
          <MediaGrid items={data.media || []} />
        </div>
      </section>
      <section className="section alt">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">Teachers</p>
              <h2>Meet the faculty</h2>
            </div>
          </div>
          <div
            className="grid-3"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
          {data.trainers.map((t) => (
            <article className="card" key={t.id}>
              {t.image_url ? (
                <img
                  className="trainer-photo"
                  src={imageSrc(t.image_url)}
                  alt={t.name}
                />
              ) : null}
              <div className="card-body">
                <h2 style={{ marginTop: 0 }}>{t.name}</h2>
                <p className="muted">{t.specialization}</p>
                <p>{t.bio}</p>
              </div>
            </article>
          ))}
          </div>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="muted">Find us</p>
              <h2>Studio location</h2>
            </div>
          </div>
          {(data.outlets || []).map((o) => (
            <p key={o.id}>
              <strong>{o.name}</strong>
              <br />
              {o.address}
              <br />
              {o.phone} · {o.timings}
            </p>
          ))}
          <SocialLinks settings={data.settings} />
          {data.maps_link ? (
            <p>
              <a href={data.maps_link} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </p>
          ) : null}
          {data.maps_embed ? (
            <iframe
              className="maps-embed"
              title="Studio map"
              src={data.maps_embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : null}
        </div>
      </section>
      <Footer outlets={data.outlets} settings={data.settings} />
    </>
  );
}
