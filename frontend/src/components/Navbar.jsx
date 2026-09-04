import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";

function Drop({ label, children, openId, setOpenId, id }) {
  const open = openId === id;
  return (
    <div className={`nav-drop${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="nav-drop-btn"
        aria-expanded={open}
        onClick={() => setOpenId(open ? null : id)}
      >
        {label}
        <span className="nav-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div className="nav-drop-menu">
        {children}
      </div>
    </div>
  );
}

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    setMenuOpen(false);
    setOpenId(null);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function close() {
    setMenuOpen(false);
    setOpenId(null);
  }

  return (
    <header className={`header${menuOpen ? " is-open" : ""}`}>
      <div className="container header-inner">
        <Link to="/" className="logo" onClick={close}>
          <span className="logo-mark">Y</span>
          <span className="logo-text">Yoga For Us</span>
        </Link>
        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className="nav" aria-label="Main">
          <div className="nav-links">
            <NavLink to="/" end onClick={close}>
              Home
            </NavLink>
            <NavLink to="/about" onClick={close}>
              About
            </NavLink>
            <NavLink to="/gallery" onClick={close}>
              Gallery
            </NavLink>
            <Drop label="Classes" openId={openId} setOpenId={setOpenId} id="classes">
              <NavLink to="/online" onClick={close}>
                Online classes
              </NavLink>
              <NavLink to="/membership" onClick={close}>
                Membership
              </NavLink>
              <NavLink to="/private" onClick={close}>
                Private yoga
              </NavLink>
              <NavLink to="/workshops" onClick={close}>
                Workshops & trips
              </NavLink>
              <NavLink to="/trial" onClick={close}>
                Book free trial
              </NavLink>
            </Drop>
            <NavLink to="/contact" onClick={close}>
              Contact
            </NavLink>
          </div>
          <div className="nav-actions">
            {user ? (
              <>
                {isAdmin ? (
                  <Link to="/admin/dashboard" className="btn btn-green nav-cta" onClick={close}>
                    Admin
                  </Link>
                ) : (
                  <Link to="/dashboard" className="btn btn-green nav-cta" onClick={close}>
                    My studio
                  </Link>
                )}
                <span className="nav-user">
                  <span className="nav-avatar" aria-hidden="true">
                    {(user.name || "S").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="nav-user-name">{user.name?.split(" ")[0]}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-outline nav-signout"
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
                <NavLink to="/login" className="nav-login" onClick={close}>
                  Login
                </NavLink>
                <Link to="/register" className="btn btn-green nav-cta" onClick={close}>
                  Join free
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
