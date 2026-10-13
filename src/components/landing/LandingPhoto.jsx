import { PHOTO_WIDTHS, photoById } from "./photos";

// One photograph from photos.js, served from this site in three sizes.
//
// The browser picks the smallest file that fills the space (`sizes`), so
// a phone on mobile data downloads about 40 KB, not the desktop file. The
// width and height are written on the <img>, so the page reserves the
// space before the photograph arrives and nothing jumps. Photographs
// below the first screen load only as the reader approaches them.
export default function LandingPhoto({ id, sizes, eager = false, className = "" }) {
  const photo = photoById(id);
  if (!photo) return null;
  const width = PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
  const height = Math.round(width / photo.ratio);

  return (
    <picture className={`lp-photo ${className}`}>
      <source
        type="image/webp"
        srcSet={PHOTO_WIDTHS.map(w => `/landing/${photo.id}-${w}.webp ${w}w`).join(", ")}
        sizes={sizes}
      />
      <img
        src={`/landing/${photo.id}.jpg`}
        alt={photo.alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}
