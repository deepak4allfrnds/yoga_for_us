import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, imageSrc } from "../api";

export default function Gallery() {
  const [data, setData] = useState({ trainers: [], outlets: [] });

  useEffect(() => {
    api("/api/public/gallery").then(setData).catch(console.error);
  }, []);

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Teachers</p>
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
        <div
          className="container grid-3"
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
      </section>
      <Footer outlets={data.outlets} />
    </>
  );
}
