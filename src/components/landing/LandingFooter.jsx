import BrandMark from "../BrandMark";
import { Link } from "react-router-dom";
import { POLICIES_PUBLISHED } from "../../config/features";
import { PHOTOS } from "./photos";

export default function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <a href="#top" className="lp-nav-brand">
              <BrandMark size={38} title="" />
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

          <nav aria-label="Policies" className="lp-footer-col">
            <h3>Policies</h3>
            {POLICIES_PUBLISHED && <Link to="/privacy">Privacy Policy</Link>}
            {POLICIES_PUBLISHED && <Link to="/terms">Terms and Community Rules</Link>}
            <Link to="/delete-account">Delete your account</Link>
          </nav>
        </div>

        {/* Credit is a condition of the photographs' licences (CC BY-SA),
            so it is printed here for every one, from photos.js. */}
        <div className="lp-credits">
          <h3>Photographs</h3>
          <ul>
            {PHOTOS.map(photo => (
              <li key={photo.id}>
                <a href={photo.source} target="_blank" rel="noopener noreferrer">{photo.commonsTitle.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")}</a>
                {" "}by {photo.author}, via Wikimedia Commons,{" "}
                <a href={photo.licenceUrl} target="_blank" rel="noopener noreferrer license">{photo.licence}</a>
                {" "}({photo.changes}).
              </li>
            ))}
          </ul>
        </div>

        <div className="lp-footer-bottom">
          © {new Date().getFullYear()} Farmers Connect
        </div>
      </div>
    </footer>
  );
}
