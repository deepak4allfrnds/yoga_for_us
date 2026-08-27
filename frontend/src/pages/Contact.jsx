import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";

export default function Contact() {
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/api/public/contact")
      .then((d) => setOutlets(d.outlets))
      .catch(console.error);
  }, []);

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setMessage("");
    try {
      await api("/api/public/contact", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage("Thank you. We will reach out shortly.");
      setForm({ name: "", email: "", phone: "", address: "" });
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <section className="page-hero">
        <div className="container">
          <p className="muted">Write to us</p>
          <h1 className="serif" style={{ fontSize: 56, margin: "8px 0 0", color: "var(--green-dark)" }}>
            Contact us
          </h1>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <form className="form" onSubmit={submit}>
            <label>
               Name
              <input
              type="text"
              name="name"
               value={form.name}
                onChange={update} 
                required />
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
              Phone number
              <input type="number"
               name="phone" 
               value={form.phone} 
               onChange={update} />
            </label>
            <label>
              Address
              <textarea
                name="address"
                rows={4}
                value={form.address}
                onChange={update}
              />
            </label>
            <button className="btn btn-green" type="submit">
              Send message
            </button>
            {message ? <p className="notice">{message}</p> : null}
          </form>
        </div>
      </section>
      <Footer outlets={outlets} />
    </>
  );
}
