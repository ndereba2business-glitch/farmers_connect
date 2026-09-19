import { Link } from "react-router-dom";

// Only links to sections that exist on the page, plus the two real auth
// routes. Kept to four links so it still fits at the 860px breakpoint.
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
        <a href="#vets" className="lp-nav-link">Ask a vet</a>
        <a href="#marketplace" className="lp-nav-link">Marketplace</a>
        <a href="#how" className="lp-nav-link">How it works</a>
      </div>

      <div className="lp-nav-actions">
        <Link to="/login" className="lp-nav-login">Log in</Link>
        <Link to="/signup" className="lp-nav-cta">Get started</Link>
      </div>
    </nav>
  );
}
