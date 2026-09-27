// Layout and accessibility checks from the launch checklist:
// no horizontal scroll, touch targets of at least 44px, and every button,
// link and form field has a name a screen reader can announce.
export async function layoutAndA11y(page) {
  return page.evaluate(() => {
    const visible = (el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]');
    const main = document.querySelector(".ss-main") || document.querySelector(".fc-main") || document.documentElement;
    const overflow = main.scrollWidth > main.clientWidth + 1 ||
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;

    const label = (el) =>
      (el.getAttribute("aria-label") || "").trim() ||
      (el.getAttribute("aria-labelledby") ? (document.getElementById(el.getAttribute("aria-labelledby"))?.textContent || "").trim() : "") ||
      (el.textContent || "").trim() ||
      (el.getAttribute("title") || "").trim() ||
      (el.querySelector("img[alt]")?.getAttribute("alt") || "").trim();

    const scope = document.querySelector("main") || document.body;
    const controls = [...scope.querySelectorAll("a, button, select, input:not([type=hidden]):not([type=file]), textarea")].filter(visible);

    const small = controls
      .filter(el => !["checkbox", "radio"].includes(el.type))
      .filter(el => el.getBoundingClientRect().height < 44)
      .map(el => `${el.tagName.toLowerCase()} "${label(el).slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`);

    const unnamed = controls
      .filter(el => {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
          return !(el.labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby"));
        }
        return !label(el);
      })
      .map(el => el.outerHTML.slice(0, 80));

    return { overflow, small, unnamed };
  });
}
