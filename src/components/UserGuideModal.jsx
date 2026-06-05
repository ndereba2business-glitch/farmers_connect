import { useState, useEffect } from "react";
import { 
  Tractor, 
  Egg, 
  ShoppingBag, 
  Users, 
  Syringe, 
  CheckCircle2 
} from "lucide-react";

export default function UserGuideModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Check if the user has already seen the guide
  useEffect(() => {
    const hasSeenGuide = localStorage.getItem("hasSeenFarmersGuide");
    if (!hasSeenGuide) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenFarmersGuide", "true");
    setIsOpen(false);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // The simplified, farmer-friendly steps
  const steps = [
    {
      title: "Welcome to Farmers Connect",
      description: "Your digital farm assistant. Manage your poultry, track your expenses, and connect with other farmers all in one place.",
      icon: <Tractor size={80} color="#22c55e" />,
      bgColor: "#edf9f1"
    },
    {
      title: "Track Your Flocks",
      description: "Easily add new batches of birds, log daily records, and track your total expenses so you always know your profit.",
      icon: <Egg size={80} color="#f59e0b" />,
      bgColor: "#fff7e6"
    },
    {
      title: "Stay on Top of Health",
      description: "Get automatic alerts for overdue vaccinations and keep track of mortality rates to ensure a healthy farm.",
      icon: <Syringe size={80} color="#ef4444" />,
      bgColor: "#fef2f2"
    },
    {
      title: "Buy & Sell Safely",
      description: "Use the Marketplace to list your mature birds and eggs for sale, or buy verified feeds from trusted suppliers.",
      icon: <ShoppingBag size={80} color="#f97316" />,
      bgColor: "#fff0eb"
    },
    {
      title: "Learn from the Community",
      description: "Chat with fellow farmers, ask for quick advice, and share your daily farming journey in our active community.",
      icon: <Users size={80} color="#3b82f6" />,
      bgColor: "#edf5ff"
    },
    {
      title: "You're All Set!",
      description: "Let's get started. Click the button below to explore your new farm dashboard.",
      icon: <CheckCircle2 size={80} color="#22c55e" />,
      bgColor: "#edf9f1"
    }
  ];

  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999, padding: "20px"
    }}>
      <div style={{
        background: "white", width: "100%", maxWidth: "450px",
        borderRadius: "24px", overflow: "hidden",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        display: "flex", flexDirection: "column"
      }}>
        
        {/* Top Illustration Area */}
        <div style={{
          height: "220px", background: steps[currentStep].bgColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.3s ease"
        }}>
          <div style={{
            animation: "fadeIn 0.5s ease-in-out"
          }}>
            {steps[currentStep].icon}
          </div>
        </div>

        {/* Text Area */}
        <div style={{ padding: "32px 24px", textAlign: "center", flex: 1 }}>
          <h2 style={{ margin: "0 0 12px 0", fontSize: "22px", fontWeight: "800", color: "#111827" }}>
            {steps[currentStep].title}
          </h2>
          <p style={{ margin: 0, fontSize: "15px", color: "#6b7280", lineHeight: "1.6" }}>
            {steps[currentStep].description}
          </p>
        </div>

        {/* Bottom Controls Area */}
        <div style={{ padding: "0 24px 24px 24px" }}>
          
          {/* Progress Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
            {steps.map((_, idx) => (
              <div key={idx} style={{
                height: "8px", borderRadius: "4px",
                width: currentStep === idx ? "24px" : "8px",
                backgroundColor: currentStep === idx ? "#22c55e" : "#e5e7eb",
                transition: "all 0.3s ease"
              }} />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button 
              onClick={handleClose}
              style={{
                background: "none", border: "none", color: "#9ca3af",
                fontWeight: "600", fontSize: "14px", cursor: "pointer",
                padding: "8px", visibility: currentStep === steps.length - 1 ? "hidden" : "visible"
              }}
            >
              Skip
            </button>

            <div style={{ display: "flex", gap: "12px" }}>
              {currentStep > 0 && (
                <button 
                  onClick={prevStep}
                  style={{
                    background: "#f3f4f6", border: "none", color: "#374151",
                    fontWeight: "600", fontSize: "14px", cursor: "pointer",
                    padding: "12px 20px", borderRadius: "12px"
                  }}
                >
                  Back
                </button>
              )}
              <button 
                onClick={nextStep}
                style={{
                  background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", color: "white",
                  fontWeight: "700", fontSize: "14px", cursor: "pointer",
                  padding: "12px 24px", borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(34,197,94,0.3)"
                }}
              >
                {currentStep === steps.length - 1 ? "Get Started" : "Next"}
              </button>
            </div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}