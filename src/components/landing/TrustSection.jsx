import { ShieldCheck, Lock, Smartphone } from "lucide-react";
import Reveal from "./Reveal";

// Each claim was checked against the live schema/code:
// vet_profiles verification + RLS, owner-scoped farm records, Signup.jsx
// (email or phone), and the app being a plain web app.
const ITEMS = [
  {
    icon: ShieldCheck,
    title: "Vets are verified",
    body: "A vet has to be approved by our team before they show up in the app or can answer emergency questions.",
  },
  {
    icon: Lock,
    title: "Your records stay yours",
    body: "Your batch, expense and sales records are tied to your account. Other farmers and suppliers can't see them.",
  },
  {
    icon: Smartphone,
    title: "Nothing to install",
    body: "It runs in the browser on your phone. Sign up with the email or phone number you already use.",
  },
];

export default function TrustSection() {
  return (
    <section className="lp-trust lp-band-dark" id="trust">
      <div className="lp-wrap">
        <Reveal className="lp-section-head">
          <div className="lp-eyebrow lp-eyebrow--on-dark">Trust</div>
          <h2>Built to be relied on.</h2>
        </Reveal>

        <div className="lp-trust-grid">
          {ITEMS.map((t, i) => {
            const Icon = t.icon;
            return (
              <Reveal className="lp-trust-item" key={t.title} delay={i * 80}>
                <span className="lp-feature-icon" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
