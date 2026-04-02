import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

/** Dynamic vs static is inferred per route (`searchParams`, `fetch` cache mode, etc.). */

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full min-w-0 flex-col bg-background">
      {/* Ambient gradient orbs — Apple-style depth lighting (light + dark) */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        {/* Light mode orbs — very subtle, Apple's soft ambient light */}
        <div
          className="absolute left-1/4 top-[-10%] h-[700px] w-[700px] rounded-full opacity-[0.18] dark:opacity-[0.09]"
          style={{
            background: "radial-gradient(circle, hsl(211 100% 60%) 0%, transparent 65%)",
            animation: "orbFloat 22s ease-in-out infinite",
          }}
        />
        <div
          className="absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full opacity-[0.10] dark:opacity-[0.06]"
          style={{
            background: "radial-gradient(circle, hsl(270 80% 65%) 0%, transparent 65%)",
            animation: "orbFloat 28s ease-in-out infinite reverse",
          }}
        />
        <div
          className="absolute left-[-5%] bottom-[20%] h-[400px] w-[400px] rounded-full opacity-[0.08] dark:opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, hsl(180 70% 55%) 0%, transparent 65%)",
            animation: "orbFloat 32s ease-in-out infinite",
            animationDelay: "4s",
          }}
        />
        <div
          className="absolute right-[20%] bottom-[5%] h-[350px] w-[350px] rounded-full opacity-[0.07] dark:opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, hsl(211 100% 55%) 0%, transparent 65%)",
            animation: "orbFloat 18s ease-in-out infinite reverse",
            animationDelay: "8s",
          }}
        />
      </div>

      <AnnouncementBanner />
      <Navbar />
      <div className="min-w-0 flex-1">{children}</div>
      <Footer />
    </div>
  );
}
