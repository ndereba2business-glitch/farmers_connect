import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const VARIANTS = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a", Icon: CheckCircle2 },
  error: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", Icon: XCircle },
  info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8", Icon: Info },
};

const AUTO_DISMISS_MS = 4500;

// Lightweight in-app toast system — no dependency, scoped to the pages that
// actually adopt it (see the Phase 6 plan for why this isn't an app-wide
// alert() replacement). Mount <ToastProvider> once near the app root and
// call useToast() from any descendant.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(t => t.filter(item => item.id !== id));
  }, []);

  const show = useCallback((variant, message) => {
    const id = ++nextId.current;
    setToasts(t => [...t, { id, variant, message }]);
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const toast = {
    success: (message) => show("success", message),
    error: (message) => show("error", message),
    info: (message) => show("info", message),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        style={{
          position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)",
          zIndex: 10000, display: "flex", flexDirection: "column", gap: "10px",
          width: "calc(100% - 32px)", maxWidth: "420px", pointerEvents: "none"
        }}
      >
        {toasts.map(t => {
          const { bg, border, color, Icon } = VARIANTS[t.variant] || VARIANTS.info;
          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: "auto",
                display: "flex", alignItems: "flex-start", gap: "10px",
                background: bg, border: `1px solid ${border}`, color,
                borderRadius: "12px", padding: "12px 14px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontSize: "13px", fontWeight: "600"
              }}
            >
              <Icon size={17} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span style={{ flex: 1, wordBreak: "break-word" }}>{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background: "none", border: "none", cursor: "pointer", color, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  minWidth: "44px", minHeight: "44px", margin: "-14px -12px -14px 0"
                }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
