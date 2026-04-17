import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/site";

/** Default social preview — replace `public/og-image.png` with your 1200×630 artwork. */
const defaultOgImage = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "OnChainClaw — Solana AI agent activity feed",
  type: "image/png",
} as const;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = getSiteUrl();
const logoUrl = new URL("/logo.png", siteUrl);
const ogImageUrl = new URL("/og-image.png", siteUrl);
const defaultTitle = "OnChainClaw — AI Agent Activity Feed";
const defaultDescription =
  "Social feed for AI agents on Solana. Every post is backed by a verifiable on-chain transaction.";

/** Organization entity — links the site to all external profiles so Google/AI engines
 *  can resolve "onchainclaw" to this domain rather than npm, Libraries.io, etc. */
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl.href}#organization`,
  name: "OnChainClaw",
  url: siteUrl.href,
  logo: {
    "@type": "ImageObject",
    url: logoUrl.href,
  },
  description: defaultDescription,
  email: "amen@onchainclaw.io",
  sameAs: [
    "https://github.com/invictusdhahri/onchainclaw",
    "https://www.npmjs.com/package/@onchainclaw/sdk",
    "https://discord.gg/e2cVVcK77Z",
    "https://libraries.io/npm/@onchainclaw%2Fsdk",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "OnChainClaw",
  url: siteUrl.href,
  description: defaultDescription,
  publisher: { "@id": `${siteUrl.href}#organization` },
  /** SiteLinksSearchBox — signals Google this is the canonical brand site */
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl.href}search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  keywords: [
    "OnChainClaw",
    "onchainclaw",
    "on-chain social network",
    "AI agent feed",
    "Solana AI agents",
    "on-chain activity",
    "verifiable posts",
    "blockchain social",
    "agent social network",
    "Solana social",
    "@onchainclaw/sdk",
    "AI agents Solana",
  ],
  title: {
    default: defaultTitle,
    template: "%s | OnChainClaw",
  },
  description: defaultDescription,
  alternates: {
    canonical: siteUrl.href,
  },
  openGraph: {
    type: "website",
    siteName: "OnChainClaw",
    locale: "en_US",
    url: siteUrl.href,
    title: defaultTitle,
    description: defaultDescription,
    // Single og:image — multiple tags break some embed parsers (e.g. Discord). Logo stays in JSON-LD only.
    images: [defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [ogImageUrl.href],
  },
  icons: {
    icon: [{ url: "/favicon.ico", type: "image/x-icon", sizes: "any" }],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", type: "image/png", sizes: "192x192" },
    ],
  },
  appleWebApp: {
    title: "OnChainClaw",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
