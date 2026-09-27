import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money } from "../api";

export default function Membership() {
  const [plans, setPlans] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api("/api/public/memberships")
      .then((d) => setPlans(d.plans || []))
      .catch(console.error)
      .finally(() => setLoaded(true));
    api("/api/public/contact").then((d) => setOutlets(d.outlets || [])).catch(console.error);
  }, []);

  const online = plans.filter((p) => p.access_type === "online");
  const offline = plans.filter((p) => p.access_type === "offline");
  const both = plans.filter((p) => p.access_type === "both");

  // Only list access types the admin has actually added plans for.
  const groups = [
    { title: "Online-only", list: online },
    { title: "Studio / offline only", list: offline },
    { title: "Studio + online", list: both },
  ].filter((g) => g.list.length > 0);

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
          {groups.length ? (
            <p>
              Available plans: {groups.map((g) => g.title).join(" · ")}. Access
              starts automatically after payment.
            </p>
          ) : null}
        </div>
      </section>
      <section className="section">
        <div className="container">
          {groups.map((g) => (
            <Group key={g.title} title={g.title} list={g.list} />
          ))}
          {loaded && !groups.length ? (
            <p className="muted">
              Membership plans will be available soon. Please contact the studio
              for current offers.
            </p>
          ) : null}
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
