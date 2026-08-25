import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";

export default function About() {
  const [data, setData] = useState({ site: null, outlets: [] });

  useEffect(() => {
    api("/api/public/about").then(setData).catch(console.error);
  }, []);

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Who we are</p>
          <h1 className="serif" style={{ fontSize: 56, margin: "8px 0 0", color: "var(--green-dark)" }}>
            About us
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container grid-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <article className="card">
            <div className="card-body">
              <h2>Our mission</h2>
              <p>{data.site?.mission}</p>
            </div>
          </article>
          <article className="card">
            <div className="card-body">
              <h2>Yoga center information</h2>
              <p>{data.site?.center_info}</p>
            </div>
          </article>
        </div>
      </section>
      <Footer outlets={data.outlets} />
    </>
  );
}
