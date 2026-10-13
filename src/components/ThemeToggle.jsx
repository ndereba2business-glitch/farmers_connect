import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// The sun/moon button in every top bar. It says what it will do, not what
// is showing, so a screen reader hears "Switch to dark theme".
export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button type="button" className={`fc-theme-toggle ${className}`} onClick={toggle} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}

const CHOICES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match my phone", icon: Monitor }
];

// The full choice, on the profile page: light, dark, or follow the phone.
export function ThemeSetting() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="fc-card fc-theme-setting" aria-labelledby="fc-theme-title">
      <h2 id="fc-theme-title">Appearance</h2>
      <p>Dark is easier on the eyes at night and uses less battery on many phones. Your choice follows you to other devices.</p>
      <div className="fc-theme-choices" role="radiogroup" aria-labelledby="fc-theme-title">
        {CHOICES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={preference === value}
            className={`fc-theme-choice${preference === value ? " fc-theme-choice--on" : ""}`}
            onClick={() => setPreference(value)}
          >
            <Icon size={18} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
    </section>
  );
}
