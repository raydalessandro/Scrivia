import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Il motore Python (cartella seme/) resta come riferimento di parità:
  // non viene incluso nel bundle. La verità è nel grafo, qui la rendiamo.
  outputFileTracingExcludes: {
    "*": ["./seme/**"],
  },
};

export default nextConfig;
