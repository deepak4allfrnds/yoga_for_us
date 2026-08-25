import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, money, imageSrc } from "../api";

export default function Payment() {
  const { id } = useParams();
  const [data, setData] = useState({ course: null, outlets: [] });
  const [form, setForm] = useState({
    student_name: "",
    email: "",
    payment_method: "upi",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(null);

  useEffect(() => {
    api(`/api/public/classes/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const payment = await api("/api/public/enroll", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          class_id: id,
        }),
      });
      setPaid(payment);
      setMessage("Payment successful. This transaction is in the admin summary.");
    } catch (err) {
      setError(err.message);
    }
  }

  const course = data.course;

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
                <Link to={`/courses/${course.id}`}>Back to course</Link>
              </div>
            </aside>
          ) : null}

          <form className="form" onSubmit={submit}>
            <h3 className="serif" style={{ color: "var(--green-dark)", fontSize: 28 }}>
              Pay for this course
            </h3>
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
              Payment method
              <select
                name="payment_method"
                value={form.payment_method}
                onChange={update}
              >
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="netbanking">Net banking</option>
              </select>
            </label>
            <button className="btn btn-green" type="submit" disabled={Boolean(paid)}>
              {course ? `Pay ${money(course.price)}` : "Pay now"}
            </button>
            {error ? <p className="error">{error}</p> : null}
            {message ? <p className="notice">{message}</p> : null}
            {paid ? (
              <p className="muted">
                Receipt #{paid.id} · {paid.payment_method} · {paid.status}
              </p>
            ) : null}
          </form>
        </div>
      </section>
      <Footer outlets={data.outlets} />
    </>
  );
}
