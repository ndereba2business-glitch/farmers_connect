import { Link } from "react-router-dom";

// Minimal nav for phase 1 of the landing page: only links to sections
// that actually exist yet (#problem, #solution) plus the two real
// auth routes. Grows as later phases add more sections.
export default function LandingNav() {
  return (
    <nav className="lp-nav" aria-label="Primary">
      <a href="#top" className="lp-nav-brand">
        <span className="lp-nav-mark" aria-hidden="true">🐔</span>
        <span className="lp-nav-word">
          <span>Farmers</span>
          <span className="lp-nav-word-accent">Connect</span>
        </span>
      </a>

      <div className="lp-nav-links">
        <a href="#problem" className="lp-nav-link">The problem</a>
        <a href="#solution" className="lp-nav-link">How it works</a>
      </div>

      <div className="lp-nav-actions">
        <Link to="/login" className="lp-nav-login">Log in</Link>
        <Link to="/signup" className="lp-nav-cta">Get started</Link>
      </div>
    </nav>
  );
}
