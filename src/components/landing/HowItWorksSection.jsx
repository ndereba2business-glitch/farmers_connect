import Reveal from "./Reveal";

const STEPS = [
  {
    title: "Create your account",
    body: "Sign up with your email or phone number and choose whether you're a farmer, a vet or a supplier.",
  },
  {
    title: "Set up your farm",
    body: "Add your first batch and its vaccination schedule, so your records start from day one.",
  },
  {
    title: "Connect",
    body: "Ask a vet, list or find products in the marketplace, and join the conversation with other farmers.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="lp-how" id="how">
      <div className="lp-wrap">
        <Reveal className="lp-section-head">
          <div className="lp-eyebrow">How it works</div>
          <h2>Three steps to get going.</h2>
        </Reveal>

        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <Reveal as="li" className="lp-step" key={s.title} delay={i * 90}>
              <span className="lp-step-num" aria-hidden="true">{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
