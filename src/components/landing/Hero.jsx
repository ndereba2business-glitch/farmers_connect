import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// Words only, on the page colour. No backdrop is drawn here on purpose:
// the place for a picture is a real photograph of a real farm, and until
// there is one the headline does the work.
export default function Hero() {
  return (
    <header className="lp-hero" id="top">
      <div className="lp-wrap lp-hero-inner">
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
    </header>
  );
}
