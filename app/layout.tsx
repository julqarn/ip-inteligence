import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

export const viewport: Viewport = {
  themeColor: "#04122e",
};

export const metadata: Metadata = {
  title: "IP Intelligence — Understand Every IP. Explore Every Network.",
  description:
    "Look up any public IPv4 or IPv6 address: geolocation, ISP, ASN, network range, RDAP registration, DNS diagnostics and available security indicators.",
  applicationName: "IP Intelligence",
  appleWebApp: {
    capable: true,
    title: "IP Intelligence",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/pwa-icon/192",
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
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
