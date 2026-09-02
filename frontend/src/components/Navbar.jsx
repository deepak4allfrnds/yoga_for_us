import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  const links = (
    <>
      <NavLink to="/" end onClick={close}>
        Home
      </NavLink>
      <NavLink to="/about" onClick={close}>
        About Us
      </NavLink>
      <NavLink to="/gallery" onClick={close}>
        Gallery
      </NavLink>
      <NavLink to="/contact" onClick={close}>
        Contact Us
      </NavLink>
      {isAdmin ? (
        <Link to="/admin/dashboard" className="btn btn-green" onClick={close}>
          Admin panel
        </Link>
      ) : null}
      {user ? (
        <>
          <span className="nav-user">{user.name}</span>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              logout();
              close();
            }}
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <NavLink to="/login" onClick={close}>
            Login
          </NavLink>
          <Link to="/register" className="btn btn-green" onClick={close}>
            Register
          </Link>
        </>
      )}
    </>
  );

  return (
    <header className={`header${open ? " is-open" : ""}`}>
      <div className="container header-inner">
        <Link to="/" className="logo" onClick={close}>
          <span className="logo-mark">Y</span>
          <span className="logo-text">Yoga For Us</span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className="nav" aria-label="Main">
          {links}
        </nav>
      </div>
    </header>
  );
}
