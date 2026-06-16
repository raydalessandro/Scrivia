import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrivia — far crescere una storia",
  description:
    "Tu pianti il seme e organizzi la storia. Da lì in poi lavorano le IA. Il processo, chiaro, con i tempi.",
};

export const viewport: Viewport = {
  themeColor: "#f7f3e9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
