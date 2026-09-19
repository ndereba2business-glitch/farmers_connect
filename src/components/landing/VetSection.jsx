import { ShieldCheck, MessageSquare, TriangleAlert, CalendarCheck } from "lucide-react";
import Reveal from "./Reveal";

// Topic list is the real category set from Bookings.jsx's Ask tab.
const TOPICS = [
  "Disease symptoms",
  "Vaccination",
  "Feeding",
  "Egg production",
  "Chick mortality",
  "Broiler growth",
  "Layers",
];

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Verified vets only",
    body: "Vets are reviewed by our team before they appear in the app.",
  },
  {
    icon: MessageSquare,
    title: "Ask about what you're seeing",
    body: "Describe the problem, pick a topic and say how urgent it is.",
  },
  {
    icon: TriangleAlert,
    title: "Flag an emergency",
    body: "Mark an urgent case so verified vets can see it and respond.",
  },
  {
    icon: CalendarCheck,
    title: "Book a visit, keep the record",
    body: "Request an appointment, message your vet, and find visit reports and prescriptions in your history.",
  },
];

export default function VetSection() {
  return (
    <section className="lp-vets lp-band-dark" id="vets">
      <div className="lp-wrap">
        <div className="lp-split lp-split--top">
          <Reveal>
            <div className="lp-section-head">
              <div className="lp-eyebrow lp-eyebrow--on-dark">Ask a vet</div>
              <h2>A qualified vet when a bird is sick.</h2>
              <p>
                A sick flock can't wait until a vet happens to pass by. Ask
                from your phone, and get an answer from someone qualified to
                give it.
              </p>
            </div>
            <ul className="lp-chips" aria-label="Topics you can ask about">
              {TOPICS.map((t) => (
                <li className="lp-chip lp-chip--dark" key={t}>{t}</li>
              ))}
            </ul>
          </Reveal>

          <ul className="lp-feature-list">
            {POINTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal as="li" className="lp-feature" key={p.title} delay={i * 70}>
                  <span className="lp-feature-icon" aria-hidden="true">
                    <Icon size={19} />
                  </span>
                  <div>
                    <h3 className="lp-feature-title">{p.title}</h3>
                    <p>{p.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
