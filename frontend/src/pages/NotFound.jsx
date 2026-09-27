import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <section className="section">
        <div className="container">
          <p className="muted">404</p>
          <h1 className="serif" style={{ color: "var(--green-dark)" }}>
            Page not found
          </h1>
          <p>The page you opened does not exist or has moved.</p>
          <div className="mode-row">
            <Link className="btn btn-green" to="/">
              Go to home
            </Link>
            <Link className="btn btn-outline" to="/contact">
              Contact us
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
