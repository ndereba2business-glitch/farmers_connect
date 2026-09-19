import { MessageSquarePlus, MessageSquare, Users } from "lucide-react";
import Reveal from "./Reveal";

const CARDS = [
  {
    icon: MessageSquarePlus,
    title: "Ask and share",
    body: "Post a question, or share what worked on your farm.",
  },
  {
    icon: MessageSquare,
    title: "Comment and help",
    body: "Reply to other farmers' posts with what you've learned.",
  },
  {
    icon: Users,
    title: "Chat",
    body: "Talk with other poultry farmers in the community chat.",
  },
];

export default function CommunitySection() {
  return (
    <section className="lp-community lp-band-tint" id="community">
      <div className="lp-wrap">
        <Reveal className="lp-section-head">
          <div className="lp-eyebrow">Community</div>
          <h2>Someone has dealt with this before.</h2>
          <p>
            The farmer two villages over has probably already solved your
            problem. The community gives you a place to ask them.
          </p>
        </Reveal>

        <div className="lp-card-grid lp-card-grid--3">
          {CARDS.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal className="lp-card" key={c.title} delay={i * 80}>
                <span className="lp-feature-icon" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
