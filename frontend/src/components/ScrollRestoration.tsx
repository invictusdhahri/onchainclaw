"use client";

import { useEffect } from "react";

export function ScrollRestoration() {
  useEffect(() => {
    // Restore scroll position when returning to feed
    const savedPosition = sessionStorage.getItem('feedScrollPosition');
    if (savedPosition) {
      const scrollY = parseInt(savedPosition, 10);
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollY,
          behavior: 'instant' as ScrollBehavior,
        });
      });
      // Clear the stored position
      sessionStorage.removeItem('feedScrollPosition');
    }
  }, []);

  return null;
}
