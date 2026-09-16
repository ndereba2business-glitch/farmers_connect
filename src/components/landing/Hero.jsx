import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  const heroRef = useRef(null);
  const farRef = useRef(null);
  const nearRef = useRef(null);

  // Lightweight scroll-linked parallax — two CSS layers translated at
  // different rates. Plain rAF-throttled scroll listener, no library,
  // and it's a no-op under prefers-reduced-motion (see Landing.css,
  // which also collapses the transition/animation durations globally).
  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let ticking = false;

    function update() {
      const rect = heroRef.current?.getBoundingClientRect();
      if (!rect) { ticking = false; return; }
      const progress = Math.min(Math.max(-rect.top, 0), rect.height);
      if (farRef.current) farRef.current.style.transform = `translateY(${progress * 0.12}px)`;
      if (nearRef.current) nearRef.current.style.transform = `translateY(${progress * 0.22}px)`;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(update);
        ticking = true;
      }
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="lp-hero" ref={heroRef} id="top">
      <div className="lp-hero-scene" aria-hidden="true">
        <div className="lp-hero-layer lp-hero-hills-far" ref={farRef} />
        <div className="lp-hero-layer lp-hero-hills-near" ref={nearRef} />
      </div>

      <div className="lp-wrap lp-hero-inner">
        <div className="lp-eyebrow lp-eyebrow--on-dark">Poultry farming, connected</div>

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
            <ArrowRight size={16} />
          </Link>
          <a href="#solution" className="lp-btn lp-btn-ghost">
            See how it works
          </a>
        </div>

        <div className="lp-hero-roles" role="list" aria-label="Who Farmers Connect is for">
          <span className="lp-role-chip" role="listitem">
            <span className="lp-dot" aria-hidden="true" /> Farmers
          </span>
          <span className="lp-role-chip" role="listitem">
            <span className="lp-dot" aria-hidden="true" /> Vets
          </span>
          <span className="lp-role-chip" role="listitem">
            <span className="lp-dot" aria-hidden="true" /> Suppliers
          </span>
        </div>
      </div>
    </header>
  );
}
