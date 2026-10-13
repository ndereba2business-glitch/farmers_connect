import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import LandingPhoto from "./LandingPhoto";

// The headline, and beside it a real photograph of improved kienyeji
// chickens in Kenya (see photos.js for its source and licence). On a
// phone the words come first and the photograph follows, so the first
// thing to load and read is text.
export default function Hero() {
  return (
    <header className="lp-hero" id="top">
      <div className="lp-wrap lp-hero-inner">
        <div className="lp-hero-text">
          <div className="lp-eyebrow">Poultry farming, connected</div>

          <h1>
            Farming is better <em>when we're connected.</em>
          </h1>

          <p className="lp-hero-sub">
            Farmers Connect brings your flock records, veterinary support,
            suppliers and fellow farmers into one place — built for poultry
            farms in Kenya, on the phones farmers actually use.
          </p>

          <div className="lp-hero-ctas">
            <Link to="/signup" className="lp-btn lp-btn-primary">
              Get started
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="#how" className="lp-btn lp-btn-ghost">
              See how it works
            </a>
          </div>

          <p className="lp-hero-roles">For farmers, vets and suppliers.</p>
        </div>

        <LandingPhoto
          id="kienyeji-hens"
          className="lp-hero-photo"
          sizes="(min-width: 900px) 420px, (min-width: 600px) 60vw, 92vw"
          eager
        />
      </div>
    </header>
  );
}
