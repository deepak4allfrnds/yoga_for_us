import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PaymentButtons from "../components/PaymentButtons";
import { api, money, imageSrc } from "../api";
import { useAuth } from "../AuthContext";

export default function Payment() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const mode = params.get("mode") || "";
  const [data, setData] = useState({ course: null, outlets: [] });
  const [form, setForm] = useState({
    student_name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/public/classes/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function orderBody() {
    return {
      ...form,
      class_id: id,
      mode,
      outlet_id: params.get("outlet_id") || "",
    };
  }

  const course = data.course;
  const studio = data.outlets?.find(
    (o) => String(o.id) === String(params.get("outlet_id"))
  );

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Checkout</p>
          <h1
            className="serif"
            style={{
              fontSize: 56,
              margin: "8px 0 0",
              color: "var(--green-dark)",
            }}
          >
            Payment
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container payment-layout">
          {course ? (
            <aside className="card">
              {course.image_url ? (
                <img
                  className="cover"
                  src={imageSrc(course.image_url)}
                  alt={course.title}
                />
              ) : null}
              <div className="card-body">
                <h2 style={{ marginTop: 0 }}>{course.title}</h2>
                <p className="muted">{course.duration}</p>
                <p>{course.description}</p>
                <p className="price">{money(course.price)}</p>
                <p>
                  <strong>Class mode:</strong>{" "}
                  {mode === "online"
                    ? "Online class"
                    : mode === "studio"
                      ? "Studio offline"
                      : "Not selected"}
                </p>
                {studio ? (
                  <p>
                    <strong>Studio:</strong> {studio.name}
                    <br />
                    <span className="muted">{studio.address}</span>
                  </p>
                ) : null}
                <Link to={`/courses/${course.id}`}>Back to course</Link>
              </div>
            </aside>
          ) : null}

          <form className="form" onSubmit={(e) => e.preventDefault()}>
            <h3 className="serif" style={{ color: "var(--green-dark)", fontSize: 28 }}>
              Pay securely
            </h3>
            <p className="muted">
              Pay with Paytm (UPI, cards, wallet, net banking). After a successful
              payment you will see this class in your payment history.
            </p>
            <label>
              Full name
              <input
                name="student_name"
                value={form.student_name}
                onChange={update}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={update}
                required
              />
            </label>
            <label>
              Phone
              <input
                name="phone"
                value={form.phone}
                onChange={update}
                placeholder="10-digit mobile"
                required
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            <PaymentButtons
              getBody={orderBody}
              amount={course ? course.price : null}
              email={form.email}
            />
          </form>
        </div>
      </section>
      <Footer outlets={data.outlets} />
    </>
  );
}
