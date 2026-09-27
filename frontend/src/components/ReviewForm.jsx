import { useState } from "react";
import { api } from "../api";

// Reviews are about the studio / website experience, not individual teachers.
export default function ReviewForm({ onCreated, googleReviewUrl }) {
  const [form, setForm] = useState({
    client_name: "",
    rating: 5,
    comment: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const review = await api("/api/public/reviews", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setNotice("Thank you. Your review is now on the website.");
      setForm({
        client_name: "",
        rating: 5,
        comment: "",
      });
      onCreated?.(review);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel">
      <h3 className="serif" style={{ color: "var(--green-dark)", marginTop: 0 }}>
        Review Yoga For Us
      </h3>
      <p className="muted">Tell others about your experience with our studio and website.</p>
      <form className="form" onSubmit={submit}>
        <label>
          Your name
          <input
            name="client_name"
            value={form.client_name}
            onChange={update}
            required
          />
        </label>
        <label>
          Rating
          <select name="rating" value={form.rating} onChange={update}>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
        </label>
        <label>
          Your review
          <textarea
            name="comment"
            rows={4}
            value={form.comment}
            onChange={update}
            required
          />
        </label>
        <button className="btn btn-green" type="submit">
          Publish review
        </button>
        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}
      </form>
      {googleReviewUrl ? (
        <p>
          Or leave a Google review. After you post it, we pull it onto this
          site.{" "}
          <a href={googleReviewUrl} target="_blank" rel="noreferrer">
            Write a Google review
          </a>
        </p>
      ) : (
        <p className="muted">
          Google reviews appear here once the studio Place ID and API key are
          set in admin.
        </p>
      )}
    </div>
  );
}
