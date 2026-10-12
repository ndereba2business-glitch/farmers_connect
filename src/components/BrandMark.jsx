import { MARK_INK, MARK_PATH, MARK_RADIUS, MARK_SCALE_SMALL, MARK_SIZE, MARK_TILE } from "./brandMarkArt";

// The Farmers Connect mark: a rooster's head on a maize-yellow tile. The
// artwork itself lives in brandMarkArt.js, shared with the favicon and the
// home-screen icons so they cannot drift apart.
//
// Colours are fixed: the mark must look the same wherever it appears, on
// white, on the cream landing page and on the green bands.
export default function BrandMark({ size = 36, title = "Farmers Connect", className }) {
  const centre = MARK_SIZE / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_SIZE} ${MARK_SIZE}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect width={MARK_SIZE} height={MARK_SIZE} rx={MARK_RADIUS} fill={MARK_TILE} />
      <path
        fill={MARK_INK}
        fillRule="evenodd"
        transform={`translate(${centre} ${centre}) scale(${MARK_SCALE_SMALL}) translate(-${centre} -${centre})`}
        d={MARK_PATH}
      />
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
