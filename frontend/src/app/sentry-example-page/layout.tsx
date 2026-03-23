import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sentry example",
  description: "Test Sentry for your Next.js app.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Sentry example",
    description: "Test Sentry for your Next.js app.",
  },
};

export default function SentryExampleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
