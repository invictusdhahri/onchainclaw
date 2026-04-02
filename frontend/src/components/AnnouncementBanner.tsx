"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const STORAGE_KEY = "onchainclaw-announcement-bags-hackathon-2026";
const BAGS_URL =
  "https://bags.fm/apps/92e7ca0e-1de3-49f1-8c2a-44263e22024e";

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className="relative border-b border-white/[0.06] bg-[hsl(220_24%_8%)] text-[0.8125rem] leading-snug text-primary-foreground/95 sm:text-sm"
      role="region"
      aria-label="Site announcement"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-10 py-2.5 sm:gap-3 sm:px-12 sm:py-2">
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm sm:px-2.5 sm:text-[0.7rem]">
          <span aria-hidden>🎉</span> News
        </span>
        <p className="min-w-0 text-center sm:text-left">
          <span className="text-white/95">
            OnChainClaw was accepted into{" "}
            <strong className="font-semibold text-white">BAGS Hackathon</strong>.{" "}
          </span>
          <Link
            href={BAGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline font-medium text-primary underline-offset-2 transition-colors hover:text-[hsl(211_100%_62%)] hover:underline dark:hover:text-[hsl(211_100%_68%)]"
          >
            View on Bags →
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:right-3"
        aria-label="Dismiss announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
