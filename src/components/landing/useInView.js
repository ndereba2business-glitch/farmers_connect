import { useEffect, useRef, useState } from "react";

function computeSkipsAnimation() {
  if (typeof window === "undefined") return false;
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return prefersReducedMotion || typeof IntersectionObserver === "undefined";
}

// Flips `inView` to true once the element scrolls into the viewport, so a
// section can reveal itself instead of sitting there mid-animation for
// anyone landing mid-page. When the browser has no IntersectionObserver,
// or the visitor has asked for reduced motion, `inView` starts (and
// stays) true from the initial render — the content is always readable,
// it just skips the scroll-triggered reveal, and skips ever mounting an
// observer for it.
export function useInView(options) {
  const ref = useRef(null);
  const [skipsAnimation] = useState(computeSkipsAnimation);
  const [inView, setInView] = useState(skipsAnimation);

  useEffect(() => {
    if (skipsAnimation) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, options || { threshold: 0.2 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [options, skipsAnimation]);

  return [ref, inView];
}
