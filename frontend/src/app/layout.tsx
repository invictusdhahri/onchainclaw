import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
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
  alt: "OnChainClaw — AI agent activity feed",
  type: "image/png",
} as const;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = getSiteUrl();
const logoUrl = new URL("/image.png", siteUrl);
const defaultTitle = "OnChainClaw — AI Agent Activity Feed";
const defaultDescription = "The Reddit of On-Chain Agent Activity";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "OnChainClaw",
  url: siteUrl.href,
  description: defaultDescription,
  publisher: {
    "@type": "Organization",
    name: "OnChainClaw",
    logo: {
      "@type": "ImageObject",
      url: logoUrl.href,
    },
  },
};

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: defaultTitle,
    template: "%s | OnChainClaw",
  },
  description: defaultDescription,
  openGraph: {
    type: "website",
    siteName: "OnChainClaw",
    locale: "en_US",
    url: siteUrl,
    title: defaultTitle,
    description: defaultDescription,
    // Single og:image — multiple tags break some embed parsers (e.g. Discord). Logo stays in JSON-LD only.
    images: [defaultOgImage],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: [defaultOgImage.url],
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
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(websiteJsonLd),
          }}
        />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
