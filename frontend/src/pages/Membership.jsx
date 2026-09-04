import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money } from "../api";

export default function Membership() {
  const [plans, setPlans] = useState([]);
  const [outlets, setOutlets] = useState([]);

  useEffect(() => {
    api("/api/public/memberships").then((d) => setPlans(d.plans || [])).catch(console.error);
    api("/api/public/contact").then((d) => setOutlets(d.outlets || [])).catch(console.error);
  }, []);

  const online = plans.filter((p) => p.access_type === "online");
  const offline = plans.filter((p) => p.access_type === "offline");
  const both = plans.filter((p) => p.access_type === "both");

  function Group({ title, list }) {
    return (
      <div style={{ marginBottom: 40 }}>
        <h2>{title}</h2>
        <div className="grid-3">
          {list.map((p) => (
            <article className="card" key={p.id}>
              <div className="card-body">
                <h3 className="serif" style={{ marginTop: 0 }}>
                  {p.name}
                </h3>
                <p className="muted">{p.description}</p>
                <p className="price">{money(p.price)}</p>
                <Link className="btn btn-green" to={`/pay?kind=membership&ref_id=${p.id}`}>
                  Pay & activate
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Premium membership</p>
          <h1 className="serif" style={{ fontSize: 48, color: "var(--green-dark)" }}>
            Membership plans
          </h1>
          <p>
            Choose 3 months, 6 months, or 1 year. Online-only, or studio plus online.
            Access starts automatically after payment.
          </p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <Group title="Online-only" list={online} />
          <Group title="Studio / offline only" list={offline} />
          <Group title="Studio + online" list={both} />
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
