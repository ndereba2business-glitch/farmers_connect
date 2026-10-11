// The Farmers Connect mark: an "F" whose two arms are leaf blades growing
// off a stem, with a seed beside it. The letter is the name; the blades
// are what is grown; the seed, set apart but belonging to the shape, is
// the thing passed between people. It is drawn from four shapes so it
// stays readable at 16px (browser tab) and scales to a home-screen icon.
//
// Colours are fixed (brand green tile, warm white letter, maize seed): the
// mark must look the same wherever it appears. The same artwork is in
// public/favicon.svg and the PNG icons in public/icons; change all of them
// together (the PNGs are generated from the SVG).
export default function BrandMark({ size = 36, title = "Farmers Connect", className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width="64" height="64" rx="14" fill="#14532d" />
      <rect x="17" y="14" width="9" height="36" rx="4.5" fill="#f7f5ec" />
      <path d="M21 14 H47 C45 20 38.5 23.5 30 23.5 H21 Z" fill="#f7f5ec" />
      <path d="M21 29 H35 C34 34.5 30 38 25.5 38 H21 Z" fill="#f7f5ec" />
      <ellipse cx="44.5" cy="35" rx="4.6" ry="5.8" fill="#f2b01e" />
    </svg>
  );
}

// The mark with the name beside it, for navigation bars and sign-in.
// `tone="light"` is for dark backgrounds.
export function BrandLockup({ size = 36, tone = "dark", className }) {
  const ink = tone === "light" ? "#ffffff" : "#111827";
  const second = tone === "light" ? "#86efac" : "#15803d";
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.28) }}>
      <BrandMark size={size} title="" />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, fontWeight: 700, fontSize: Math.round(size * 0.44), letterSpacing: "-0.02em" }}>
        <span style={{ color: ink }}>Farmers</span>
        <span style={{ color: second }}>Connect</span>
      </span>
    </span>
  );
}
