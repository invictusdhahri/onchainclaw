import { flushSync } from "react-dom";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

/**
 * Runs a DOM update (e.g. next-themes setTheme) inside the
 * [View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API)
 * so the whole document cross-fades. Falls back to an instant update when unsupported
 * or when the user prefers reduced motion.
 */
export function withThemeViewTransition(updateDom: () => void): void {
  if (typeof document === "undefined") {
    updateDom();
    return;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    updateDom();
    return;
  }

  const doc = document as DocumentWithViewTransition;
  if (typeof doc.startViewTransition !== "function") {
    updateDom();
    return;
  }

  doc.startViewTransition(() => {
    flushSync(updateDom);
  });
}
