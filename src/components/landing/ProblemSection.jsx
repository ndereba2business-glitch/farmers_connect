import { useInView } from "./useInView";

// Real friction points, matched one-to-one to what the app actually
// builds for: MyFarm (records), Bookings (vet Q&A + appointments),
// Marketplace/Suppliers, and Community. No invented statistics.
const PROBLEMS = [
  {
    title: "Farm records live in your head, or a notebook",
    body: "Which batch was vaccinated, which one wasn't, how many birds you lost last month — it's easy to lose track when it's all memory and scraps of paper.",
  },
  {
    title: "Getting a vet's opinion takes too long",
    body: "A sick bird can't wait for the next time a vet happens to pass through. Most farmers are left guessing, or asking around, until someone qualified is free.",
  },
  {
    title: "Buyers and suppliers are hard to find",
    body: "Selling ready birds or sourcing feed and chicks usually means relying on whoever you already know — not necessarily the best price or the closest option.",
  },
  {
    title: "Every farmer is solving the same problems alone",
    body: "The farmer two villages over has probably already dealt with your exact issue. There's rarely an easy way to ask them, or to learn from what they found.",
  },
];

function ProblemItem({ title, body, index }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  return (
    <div
      ref={ref}
      className={`lp-problem-item${inView ? " lp-in-view" : ""}`}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export default function ProblemSection() {
  return (
    <section className="lp-problem" id="problem">
      <div className="lp-wrap">
        <div className="lp-section-head">
          <div className="lp-eyebrow">The problem</div>
          <h2>Farming comes with enough challenges.</h2>
          <p>
            None of these are new problems — they're just the everyday
            friction of running a poultry farm without a shared place for
            records, support and connections.
          </p>
        </div>

        <div className="lp-problem-list">
          {PROBLEMS.map((p, i) => (
            <ProblemItem key={p.title} title={p.title} body={p.body} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
