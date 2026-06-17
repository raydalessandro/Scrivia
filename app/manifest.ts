import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Scrivia — far crescere una storia",
    short_name: "Scrivia",
    description:
      "Tu pianti il seme e organizzi la storia. Da lì in poi lavorano le IA. Il processo, chiaro, con i tempi.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3e9",
    theme_color: "#f7f3e9",
    categories: ["productivity", "books", "education"],
    lang: "it",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
