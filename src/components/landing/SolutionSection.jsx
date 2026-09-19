import { Egg, Stethoscope, ShoppingBag, Package, Users } from "lucide-react";
import { useInView } from "./useInView";

// Five real, Supabase-backed parts of the app (My Farm, Ask Vet,
// Marketplace, Suppliers, Community — the same set in Layout.jsx's
// FARMER_NAV) shown as spokes around the product. x/y are percentages
// used both to place the desktop nodes and to draw the SVG connector
// lines in a matching 0-100 viewBox.
const NODES = [
  { key: "myfarm", label: "My Farm", sub: "Batches & vaccinations", icon: Egg, x: 50, y: 8 },
  { key: "vet", label: "Ask Vet", sub: "Questions & bookings", icon: Stethoscope, x: 89, y: 32 },
  { key: "marketplace", label: "Marketplace", sub: "Buy & sell birds", icon: ShoppingBag, x: 78, y: 82 },
  { key: "suppliers", label: "Suppliers", sub: "Feed, chicks & inputs", icon: Package, x: 22, y: 82 },
  { key: "community", label: "Community", sub: "Ask & share", icon: Users, x: 11, y: 32 },
];

export default function SolutionSection() {
  const [hubRef, hubInView] = useInView({ threshold: 0.25 });

  return (
    <section className="lp-solution" id="solution">
      <div className="lp-wrap">
        <div className="lp-solution-copy">
          <div className="lp-eyebrow">The solution</div>
          <h2>Meet Farmers Connect.</h2>
          <p>
            One account, five connected tools: keep your flock records
            straight in My Farm, get your questions to a vet, buy or sell
            in the Marketplace, find suppliers, and learn from other
            farmers in the Community — without switching between five
            different places.
          </p>
        </div>

        <div className={`lp-hub${hubInView ? " lp-in-view" : ""}`} ref={hubRef}>
          {/* Desktop / tablet: radial hub */}
          <div className="lp-hub-visual">
            <svg className="lp-hub-svg" viewBox="0 0 100 100" aria-hidden="true">
              {NODES.map((n) => (
                <path key={n.key} d={`M50 50 L${n.x} ${n.y}`} />
              ))}
            </svg>

            <div className="lp-hub-center">
              <span className="lp-hub-mark" aria-hidden="true">🐔</span>
              <span className="lp-hub-word">Farmers<br />Connect</span>
            </div>

            {NODES.map((n, i) => {
              const Icon = n.icon;
              return (
                <div
                  key={n.key}
                  className="lp-hub-node"
                  style={{
                    top: `${n.y}%`,
                    left: `${n.x}%`,
                    transitionDelay: `${200 + i * 90}ms`,
                  }}
                >
                  <span className="lp-hub-node-icon" aria-hidden="true">
                    <Icon size={17} />
                  </span>
                  <span>
                    <span className="lp-hub-node-label">{n.label}</span>
                    <span className="lp-hub-node-sub">{n.sub}</span>
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile: same content, vertical connected list */}
          <ul className="lp-hub-list">
            {NODES.map((n) => {
              const Icon = n.icon;
              return (
                <li key={n.key} className="lp-hub-list-item">
                  <span className="lp-hub-list-icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span>
                    <span className="lp-hub-list-label">{n.label}</span>
                    <span className="lp-hub-list-sub">{n.sub}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
