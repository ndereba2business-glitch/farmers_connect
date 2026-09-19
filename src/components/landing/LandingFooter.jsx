import { Link } from "react-router-dom";

export default function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <a href="#top" className="lp-nav-brand">
              <span className="lp-nav-mark" aria-hidden="true">🐔</span>
              <span className="lp-nav-word">
                <span>Farmers</span>
                <span className="lp-nav-word-accent">Connect</span>
              </span>
            </a>
            <p>Poultry farming, connected. Built for farms in Kenya.</p>
          </div>

          <nav aria-label="Explore" className="lp-footer-col">
            <h3>Explore</h3>
            <a href="#myfarm">My Farm</a>
            <a href="#vets">Ask a vet</a>
            <a href="#marketplace">Marketplace</a>
            <a href="#community">Community</a>
          </nav>

          <nav aria-label="Account" className="lp-footer-col">
            <h3>Account</h3>
            <Link to="/signup">Get started</Link>
            <Link to="/login">Log in</Link>
          </nav>
        </div>

        <div className="lp-footer-bottom">
          © {new Date().getFullYear()} Farmers Connect
        </div>
      </div>
    </footer>
  );
}
