import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IP Intelligence — Understand Every IP. Explore Every Network.",
  description:
    "Look up any public IPv4 or IPv6 address: geolocation, ISP, ASN, network range, RDAP registration, DNS diagnostics and available security indicators.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
