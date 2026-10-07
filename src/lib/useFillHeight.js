import { useEffect } from "react";

// Makes a chat-style screen fill the space below the app's top bar, like a
// chat app, instead of growing down the page. Measured rather than
// hard-coded because the two layout shells have different bars and
// paddings, and re-measured when the on-screen keyboard resizes the view.
//
// A screen that cancels the layout's side padding to run edge to edge on
// phones sets the CSS variable --fill-bleed to that padding; the same
// amount is then reclaimed at the bottom.
export function useFillHeight(ref, minHeight = 360) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    function fit() {
      const main = el.closest("main");
      const bleed = parseFloat(getComputedStyle(el).getPropertyValue("--fill-bleed")) || 0;
      const padding = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      const viewport = window.visualViewport?.height || window.innerHeight;
      const height = viewport - el.getBoundingClientRect().top - Math.max(0, padding - bleed);
      el.style.height = `${Math.max(minHeight, height)}px`;
    }
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
  }, [ref, minHeight]);
}
