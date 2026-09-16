import LandingNav from "../components/landing/LandingNav";
import Hero from "../components/landing/Hero";
import ProblemSection from "../components/landing/ProblemSection";
import SolutionSection from "../components/landing/SolutionSection";
import "../components/landing/Landing.css";

// Public marketing page, shown at "/" for logged-out visitors (see the
// root route in src/App.jsx). Logged-in users never see this — they
// still land on Dashboard at the same URL, exactly as before.
//
// Phase 1: design system + Nav + Hero + Problem + Solution. More
// sections (MyFarm showcase, vet, suppliers/marketplace, community,
// trust, how-it-works, final CTA, footer) land in later phases.
export default function LandingPage() {
  return (
    <div className="lp-root">
      <LandingNav />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
      </main>
    </div>
  );
}
