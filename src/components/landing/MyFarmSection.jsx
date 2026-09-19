import { Egg, Syringe, ClipboardList, TrendingUp, Check, Clock } from "lucide-react";
import Reveal from "./Reveal";

// Each item maps to something My Farm really does today: batches,
// vaccination_tasks, mortality_logs, batch_expenses / batch_sales.
const FEATURES = [
  {
    icon: Egg,
    title: "Batches",
    body: "Add each batch of chicks with its breed and number, and keep everything about it in one place.",
  },
  {
    icon: Syringe,
    title: "Vaccination schedule",
    body: "Keep a vaccination schedule for every batch and mark each one done as you go.",
  },
  {
    icon: ClipboardList,
    title: "Losses",
    body: "Log birds you lose, with a note on what you think happened.",
  },
  {
    icon: TrendingUp,
    title: "Expenses and sales",
    body: "Record what you spend and what each sale brings in, so you can see how a batch really performed.",
  },
];

function MockRow({ label, state, tone }) {
  return (
    <li className="lp-mock-row">
      <span>{label}</span>
      <span className={`lp-mock-state lp-mock-state--${tone}`}>
        {tone === "done" && <Check size={14} aria-hidden="true" />}
        {tone === "due" && <Clock size={14} aria-hidden="true" />}
        {state}
      </span>
    </li>
  );
}

export default function MyFarmSection() {
  return (
    <section className="lp-myfarm" id="myfarm">
      <div className="lp-wrap">
        <Reveal className="lp-section-head">
          <div className="lp-eyebrow">My Farm</div>
          <h2>Every batch, on record.</h2>
          <p>
            Stop keeping the story of your flock in your head or in a
            notebook. My Farm holds each batch's vaccinations, losses,
            costs and sales together.
          </p>
        </Reveal>

        <div className="lp-split">
          <ul className="lp-feature-list">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal as="li" className="lp-feature" key={f.title} delay={i * 70}>
                  <span className="lp-feature-icon" aria-hidden="true">
                    <Icon size={19} />
                  </span>
                  <div>
                    <h3 className="lp-feature-title">{f.title}</h3>
                    <p>{f.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>

          <Reveal className="lp-mock" delay={120} aria-hidden="true">
            <div className="lp-mock-head">
              <span className="lp-mock-title">Batch A</span>
              <span className="lp-mock-tag">Sample</span>
            </div>
            <ul className="lp-mock-rows">
              <MockRow label="Vaccination 1" state="Done" tone="done" />
              <MockRow label="Vaccination 2" state="Done" tone="done" />
              <MockRow label="Vaccination 3" state="Due" tone="due" />
              <MockRow label="Losses" state="Logged" tone="plain" />
              <MockRow label="Expenses" state="Recorded" tone="plain" />
              <MockRow label="Sales" state="Recorded" tone="plain" />
            </ul>
            <p className="lp-mock-cap">Illustration of a batch record</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
