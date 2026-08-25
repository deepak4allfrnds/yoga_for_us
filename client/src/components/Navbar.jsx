import { NavLink, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">Y</span>
          <span
            className="serif"
            style={{
              fontSize: 28,
              fontFamily: "sans-serif",
              fontWeight: "bold",
            }}
          >
            Yoga For Us
          </span>
        </Link>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/about">About Us</NavLink>
          <NavLink to="/gallery">Gallery</NavLink>
          <NavLink to="/contact">Contact Us</NavLink>
          {isAdmin ? (
            <Link to="/admin/dashboard" className="btn btn-green">
              Admin panel
            </Link>
          ) : null}
          {user ? (
            <>
              <span className="muted">{user.name}</span>
              <button type="button" className="btn btn-outline" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <Link to="/register" className="btn btn-green">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
