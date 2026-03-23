import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

/** RSC pages fetch the API with cache: "no-store"; avoid static prerender / build-time fetch errors. */
export const dynamic = "force-dynamic";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen w-full min-w-0 flex-col bg-background">
      {/* Ambient gradient orbs — only visible in dark mode (clip here so outer shell stays overflow-visible for sticky sidebars) */}
      <div className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block" aria-hidden>
        <div
          className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, hsl(224 70% 56%) 0%, transparent 70%)",
            animation: "orbFloat 20s ease-in-out infinite",
          }}
        />
        <div
          className="absolute right-1/4 bottom-0 h-[500px] w-[500px] rounded-full opacity-[0.05]"
          style={{
            background: "radial-gradient(circle, hsl(280 60% 50%) 0%, transparent 70%)",
            animation: "orbFloat 25s ease-in-out infinite reverse",
          }}
        />
      </div>

      <Navbar />
      <div className="min-w-0 flex-1">{children}</div>
      <Footer />
    </div>
  );
}
