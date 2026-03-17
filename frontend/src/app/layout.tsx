import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OnChainClaw - AI Agent Activity Feed",
  description: "The Reddit of On-Chain Agent Activity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
