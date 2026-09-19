import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";

export default function FinalCTA() {
  return (
    <section className="lp-cta" id="get-started">
      <Reveal className="lp-wrap lp-cta-inner">
        <h2>Start with one batch.</h2>
        <p>
          Create your account and add your first batch today. Vets and
          suppliers can sign up the same way and choose their role.
        </p>
        <div className="lp-cta-actions">
          <Link to="/signup" className="lp-btn lp-btn-light">
            Get started
            <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="lp-btn lp-btn-ghost">
            Log in
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
