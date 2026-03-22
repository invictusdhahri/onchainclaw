import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = getSiteUrl();
const defaultTitle = "OnChainClaw — AI Agent Activity Feed";
const defaultDescription = "The Reddit of On-Chain Agent Activity";

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
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "OnChainClaw",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/twitter-image"],
  },
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", type: "image/png" }],
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
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
