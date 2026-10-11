import BrandMark from "./BrandMark";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { tourFor } from "./onboardingSteps";
import "./OnboardingTour.css";

function TourCard({ tour, onFinish }) {
  // -1 = welcome screen, steps.length = closing screen
  const [stepIndex, setStepIndex] = useState(-1);
  const cardRef = useRef(null);
  const { steps } = tour;

  const isWelcome = stepIndex === -1;
  const isClosing = stepIndex === steps.length;
  const step = !isWelcome && !isClosing ? steps[stepIndex] : null;
  const Icon = step?.icon;

  // Latest onFinish without re-running the effect below on every render.
  const finishRef = useRef(onFinish);
  useEffect(() => { finishRef.current = onFinish; }, [onFinish]);

  useEffect(() => {
    cardRef.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") finishRef.current(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const title = isWelcome ? "Welcome to Farmers Connect!"
    : isClosing ? "You're all set!"
    : step.title;

  return (
    <div className="ot-overlay">
      <div
        className="ot-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ot-title"
        tabIndex={-1}
        ref={cardRef}
      >
        <div className="ot-header">
          <div className="ot-header-top">
            <div className="ot-icon-box" aria-hidden="true">
              {isWelcome ? <BrandMark size={52} title="" /> : isClosing ? <Check size={24} /> : <Icon size={24} />}
            </div>
            <div>
              <p className="ot-eyebrow">
                {step ? `STEP ${stepIndex + 1} OF ${steps.length}` : "GETTING STARTED"}
              </p>
              <h2 className="ot-title" id="ot-title">{title}</h2>
            </div>
          </div>

          <button className="ot-close" onClick={() => onFinish(false)} aria-label="Close tour">
            <X size={18} />
          </button>

          {!isWelcome && (
            <div className="ot-progress-track" aria-hidden="true">
              <div
                className="ot-progress-fill"
                style={{ width: `${isClosing ? 100 : ((stepIndex + 1) / steps.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="ot-body">
          <p className="ot-text">
            {isWelcome ? tour.welcome : isClosing ? tour.closing : step.body}
          </p>

          {step?.tip && <div className="ot-tip">{step.tip}</div>}

          <div className="ot-actions">
            {isWelcome ? (
              <button className="ot-btn ot-btn--primary ot-btn--full" onClick={() => setStepIndex(0)}>
                Start tour <ChevronRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button className="ot-btn ot-btn--ghost" onClick={() => setStepIndex(i => i - 1)}>
                  <ChevronLeft size={16} aria-hidden="true" /> Back
                </button>
                {isClosing ? (
                  <button className="ot-btn ot-btn--primary" onClick={() => onFinish(true)}>
                    {tour.cta.label}
                  </button>
                ) : (
                  <button className="ot-btn ot-btn--primary" onClick={() => setStepIndex(i => i + 1)}>
                    Next <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )}
              </>
            )}
          </div>

          {!isClosing && (
            <button className="ot-skip" onClick={() => onFinish(false)}>
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Mounted once by each layout shell. It opens by itself for a signed-in
// user whose profile says they haven't seen the tour yet, which covers
// both a first sign-in and "Replay Tour" on the profile page.
export default function OnboardingTour() {
  const { role, profile, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  const tour = tourFor(role);

  if (!tour || !profile || profile.has_seen_onboarding !== false) return null;

  function finish(goToStart) {
    completeOnboarding();
    if (goToStart) navigate(tour.cta.path);
  }

  // TourCard is only mounted while open, so every opening starts again
  // at the welcome screen.
  return <TourCard tour={tour} onFinish={finish} />;
}
