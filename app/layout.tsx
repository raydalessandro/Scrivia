import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWA } from "@/components/PWA";

export const metadata: Metadata = {
  title: "Scrivia — far crescere una storia",
  description:
    "Tu pianti il seme e organizzi la storia. Da lì in poi lavorano le IA. Il processo, chiaro, con i tempi.",
  applicationName: "Scrivia",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Scrivia",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f7f3e9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="min-h-screen antialiased">
        {children}
        <PWA />
      </body>
    </html>
  );
}
