import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, Egg, Calculator, CheckSquare, Stethoscope,
  ShoppingBag, Image, Bot, Users, MessageCircle,
  UserCircle, ChevronRight
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./OnboardingTour.css";

const STEPS = [
  {
    icon: Egg,
    color: "#16a34a",
    title: "My Farm — Track Your Batches",
    body: "Start by adding your chick batch. Tell the app how many birds you have, their type (broiler, layer, etc.) and when they hatched.",
    tip: "✅ The app will automatically create a vaccination schedule for your birds!",
  },
  {
    icon: Calculator,
    color: "#ea580c",
    title: "Feed Calculator — Never Overfeed or Underfeed",
    body: "Enter your batch details to get the exact amount of feed your birds need every day, and a total estimate of bags to buy before maturity.",
    tip: "💡 Feed costs are the biggest expense — getting this right saves money!",
  },
  {
    icon: CheckSquare,
    color: "#2563eb",
    title: "Farm Tasks — Stay Organized",
    body: 'Add daily and future tasks like "Clean the coop", "Buy feed", or "Vaccinate birds". Tick them off when done so nothing falls through the cracks.',
    tip: "📋 Set a due date and priority so you always know what's urgent.",
  },
  {
    icon: Stethoscope,
    color: "#dc2626",
    title: "Ask a Vet — Get Expert Help",
    body: 'If your birds look sick or you have questions, tap "Ask Vet" to find a verified veterinarian near you, book a consultation, or ask a question for free.',
    tip: "🚨 There's an emergency button for urgent situations!",
  },
  {
    icon: ShoppingBag,
    color: "#9333ea",
    title: "Marketplace — Buy & Sell",
    body: "Sell your chickens, eggs, or feed to other farmers nearby. You can also buy from verified suppliers and hatcheries.",
    tip: "📸 Listings with photos sell faster — add clear pictures!",
  },
  {
    icon: Image,
    color: "#0d9488",
    title: "Farm Gallery — Document Your Farm",
    body: "Take photos of your birds regularly to track their growth, spot health issues early, and keep a visual record of your farm progress.",
    tip: "📷 Tag photos by batch or date so you can easily find them later.",
  },
  {
    icon: Bot,
    color: "#6366f1",
    title: "Clucky AI — Your Smart Assistant",
    body: "Clucky is an AI expert that answers any poultry farming question — disease symptoms, feeding tips, profit advice, and more. Available 24/7!",
    tip: '🤖 Ask Clucky anything like "Why are my chickens losing feathers?"',
  },
  {
    icon: Users,
    color: "#ea580c",
    title: "Community — Learn from Others",
    body: "Join other farmers, share experiences, ask questions and get answers from the farming community. You're not alone on this journey!",
    tip: "🌍 Post a photo of your farm to introduce yourself.",
  },
  {
    icon: MessageCircle,
    color: "#db2777",
    title: "Messages — Chat With Farmers",
    body: "Message other farmers or marketplace buyers directly. Negotiate a sale, ask a quick question, or follow up on an order — all in real time.",
    tip: "💬 Fast replies build trust and close more marketplace deals.",
  },
  {
    icon: UserCircle,
    color: "#0891b2",
    title: "Profile — Your Farm Identity",
    body: "Add your farm name, location and a profile photo so buyers and other farmers know who they're dealing with.",
    tip: "📸 A complete profile with a photo gets more marketplace inquiries.",
  },
];

export default function OnboardingTour({ open, onClose }) {
  // -1 = welcome screen, STEPS.length = closing screen
  const [stepIndex, setStepIndex] = useState(-1);
  const { completeOnboarding } = useAuth();
  const navigate = useNavigate();

  // Always restart at the welcome screen whenever the tour is opened —
  // this component stays mounted (Layout renders it unconditionally
  // and just toggles `open`), so without this the "Replay Tour" button
  // would resume wherever the user last left off instead of restarting.
  useEffect(() => {
    if (open) setStepIndex(-1);
  }, [open]);

  if (!open) return null;

  const isWelcome = stepIndex === -1;
  const isClosing = stepIndex === STEPS.length;
  const step = !isWelcome && !isClosing ? STEPS[stepIndex] : null;
  const Icon = step?.icon;

  const totalDots = STEPS.length + 2;
  const activeDot = stepIndex + 1;

  async function finish(shouldNavigate) {
    await completeOnboarding();
    onClose();
    if (shouldNavigate) navigate("/my-farm");
  }

  return (
    <div className="ot-overlay">
      <div className="ot-card">

        {/* HEADER */}
        <div
          className="ot-header"
          style={{
            background: isWelcome || isClosing
              ? "linear-gradient(135deg,#22c55e,#16a34a)"
              : step.color
          }}
        >
          <div className="ot-header-top">
            <div className="ot-icon-box">
              {isWelcome ? "🐔" : isClosing ? "🎉" : <Icon size={26} color="#fff" />}
            </div>
            <div>
              <p className="ot-eyebrow">
                {isWelcome || isClosing ? "GETTING STARTED" : `STEP ${stepIndex + 1} OF ${STEPS.length}`}
              </p>
              <h2 className="ot-title">
                {isWelcome ? "Welcome to Farmers Connect!"
                  : isClosing ? "You're All Set!"
                  : step.title}
              </h2>
            </div>
          </div>

          <button className="ot-close" onClick={() => finish(false)} aria-label="Close tour">
            <X size={16} />
          </button>

          {!isWelcome && (
            <div className="ot-progress-track">
              <div
                className="ot-progress-fill"
                style={{ width: `${isClosing ? 100 : ((stepIndex + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* BODY */}
        <div className="ot-body">
          <p className="ot-text">
            {isWelcome
              ? "Your complete poultry farming companion. This quick guide will show you how to get the most out of the app — it only takes 2 minutes!"
              : isClosing
              ? "You now know the key features of Farmers Connect. Start by adding your first chicken batch — the app will guide you from there.You can always replay this tour later from your profile."
              : step.body}
          </p>

          {step?.tip && <div className="ot-tip">{step.tip}</div>}

          <div className="ot-dots">
            {Array.from({ length: totalDots }).map((_, i) => (
              <span
                key={i}
                className={`ot-dot ${i === activeDot ? "ot-dot--active" : ""}`}
              />
            ))}
          </div>

          <div className="ot-actions">
            {isWelcome ? (
              <button
                className="ot-btn ot-btn--primary ot-btn--full"
                onClick={() => setStepIndex(0)}
              >
                Start Tour <ChevronRight size={16} />
              </button>
            ) : (
              <>
                <button
                  className="ot-btn ot-btn--ghost"
                  onClick={() => setStepIndex(i => i - 1)}
                >
                  <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /> Back
                </button>
                {isClosing ? (
                  <button className="ot-btn ot-btn--primary" onClick={() => finish(true)}>
                    ✓ Go to My Farm
                  </button>
                ) : (
                  <button
                    className="ot-btn ot-btn--primary"
                    onClick={() => setStepIndex(i => i + 1)}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                )}
              </>
            )}
          </div>

          {!isClosing && (
            <button className="ot-skip" onClick={() => finish(false)}>
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}