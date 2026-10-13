import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Flag, ImagePlus, MessagesSquare, Reply } from "lucide-react";
import Reveal from "./Reveal";
import LandingPhoto from "./LandingPhoto";

// What the community is today: ONE group chat for everyone on the app
// (src/pages/Community.jsx). Each line below is something that screen
// really does. There are no member counts, quotes or success stories
// here because none have been collected; do not add any that are not real.
const BENEFITS = [
  {
    icon: MessagesSquare,
    title: "Ask the people who keep the same birds",
    body: "Put a question to the whole group: a brooder that is too cold, layers that have stopped laying, where to find day-old chicks this month."
  },
  {
    icon: Reply,
    title: "Get an answer you can follow",
    body: "Replies quote the message they answer, so a conversation about your problem stays readable even when the group is busy."
  },
  {
    icon: ImagePlus,
    title: "Show it, don't describe it",
    body: "Add a photo of the droppings, the comb or the house. A picture gets you a better answer than a paragraph."
  },
  {
    icon: BadgeCheck,
    title: "Know who is a vet and who is a supplier",
    body: "Vets and suppliers our team has reviewed and approved carry a badge beside their name, so you can tell professional advice from a neighbour's experience."
  },
  {
    icon: Flag,
    title: "Kept to poultry farming",
    body: "Clear rules, a report button on every message, and administrators who can remove what does not belong. You can block anyone you would rather not hear from."
  }
];

export default function CommunitySection() {
  return (
    <section className="lp-community lp-band-tint" id="community">
      <div className="lp-wrap">
        <div className="lp-community-top">
          <Reveal className="lp-section-head">
            <div className="lp-eyebrow">Community</div>
            <h2>Someone has dealt with this before.</h2>
            <p>
              The farmer two villages over has probably already solved your
              problem. The community is one group where every farmer, vet and
              supplier on Farmers Connect can ask, answer and share what worked.
            </p>
          </Reveal>

          <Reveal className="lp-community-photo" delay={100}>
            <LandingPhoto id="chick-drinking" sizes="(min-width: 900px) 420px, 92vw" />
          </Reveal>
        </div>

        <ul className="lp-benefits">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <Reveal as="li" className="lp-benefit" key={b.title} delay={i * 60}>
                <span className="lp-feature-icon" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <div>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </div>
              </Reveal>
            );
          })}
        </ul>

        <Reveal className="lp-community-cta">
          <p>The group opens as soon as you have an account. It is free to join.</p>
          <div className="lp-hero-ctas">
            <Link to="/signup" className="lp-btn lp-btn-primary">
              Join the community
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/login?next=/community" className="lp-btn lp-btn-ghost">
              I already have an account
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
