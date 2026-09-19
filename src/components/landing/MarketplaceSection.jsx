import { ShoppingBag, Package } from "lucide-react";
import Reveal from "./Reveal";

// Categories are the real ones from Marketplace.jsx.
const CATEGORIES = ["Chickens", "Eggs", "Feeds", "Equipment", "Medicine"];

export default function MarketplaceSection() {
  return (
    <section className="lp-market" id="marketplace">
      <div className="lp-wrap">
        <Reveal className="lp-section-head">
          <div className="lp-eyebrow">Marketplace</div>
          <h2>Sell what you raise. Find what you need.</h2>
          <p>
            Browse listings by category, or put your own birds, eggs and
            supplies in front of other farmers, instead of relying only on
            whoever you already know.
          </p>
        </Reveal>

        <ul className="lp-chips" aria-label="Marketplace categories">
          {CATEGORIES.map((c) => (
            <li className="lp-chip" key={c}>{c}</li>
          ))}
        </ul>

        <div className="lp-card-grid lp-card-grid--2">
          <Reveal className="lp-card">
            <span className="lp-feature-icon" aria-hidden="true">
              <ShoppingBag size={19} />
            </span>
            <h3>For farmers</h3>
            <p>
              Search and browse products by category, and list your own
              chickens, eggs or other produce when you have something to
              sell.
            </p>
          </Reveal>

          <Reveal className="lp-card" delay={90}>
            <span className="lp-feature-icon" aria-hidden="true">
              <Package size={19} />
            </span>
            <h3>For suppliers</h3>
            <p>
              Sign up as a supplier and list your feed, medicine and
              equipment where poultry farmers are already looking.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
