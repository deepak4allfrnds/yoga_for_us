import { Link } from "react-router-dom";
import { money, imageSrc } from "../api";
import { CLASS_CATEGORIES, classCategories } from "../classCategories";


// One class in a listing. Buttons follow the categories the admin picked.
export default function ClassCard({ course: c }) {
  const cats = classCategories(c);
  return (
    <article className="card">
      {c.image_url ? <img className="cover" src={imageSrc(c.image_url)} alt={c.title} /> : null}
      <div className="card-body">
        <h3 className="serif" style={{ fontSize: 26, margin: "0 0 8px" }}>
          {c.title}
        </h3>
        <p className="category-tags">
          {CLASS_CATEGORIES.filter((k) => cats.includes(k.id)).map((k) => (
            <span key={k.id} className="badge paid">
              {k.label}
            </span>
          ))}
        </p>
        <p className="muted">{c.description}</p>
        <p className="muted">{c.duration}</p>
        <Link className="btn btn-green price-btn" to={`/courses/${c.id}`}>
          {money(c.price)}
        </Link>
        <div className="mode-row">
          {c.title === "Personal/Private Yoga" ? (
            <Link className="btn btn-green" to="/private">
              Book private session
            </Link>
          ) : (
            <>
              {cats.includes("studio") ? (
                <Link className="btn btn-outline" to={`/courses/${c.id}?mode=studio`}>
                  Studio offline
                </Link>
              ) : null}
              {cats.includes("online") ? (
                <Link className="btn btn-outline" to={`/courses/${c.id}?mode=online`}>
                  Online class
                </Link>
              ) : null}
              {cats.includes("home") ? (
                <Link className="btn btn-outline" to={`/home-visit?class_id=${c.id}`}>
                  Book home visit
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </article>
  );
}
