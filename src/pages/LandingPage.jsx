import LandingNav from "../components/landing/LandingNav";
import Hero from "../components/landing/Hero";
import ProblemSection from "../components/landing/ProblemSection";
import SolutionSection from "../components/landing/SolutionSection";
import MyFarmSection from "../components/landing/MyFarmSection";
import VetSection from "../components/landing/VetSection";
import MarketplaceSection from "../components/landing/MarketplaceSection";
import CommunitySection from "../components/landing/CommunitySection";
import TrustSection from "../components/landing/TrustSection";
import HowItWorksSection from "../components/landing/HowItWorksSection";
import FinalCTA from "../components/landing/FinalCTA";
import LandingFooter from "../components/landing/LandingFooter";
import "../components/landing/Landing.css";

// Public marketing page, shown at "/" for logged-out visitors (see the
// root route in src/App.jsx). Logged-in users never see this — they
// still land on Dashboard at the same URL, exactly as before.
export default function LandingPage() {
  return (
    <div className="lp-root">
      <LandingNav />
      <main>
        <Hero />
        <ProblemSection />
        <SolutionSection />
        <MyFarmSection />
        <VetSection />
        <MarketplaceSection />
        <CommunitySection />
        <TrustSection />
        <HowItWorksSection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
