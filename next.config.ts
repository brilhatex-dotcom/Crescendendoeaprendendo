import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança aplicados a toda resposta.
 * Bíblia Vol. 1 Cap. 1 §1.9 · docs/09-autenticacao-e-seguranca.md §5
 *
 * A CSP com nonce por requisição é aplicada no middleware (precisa de valor
 * dinâmico); aqui ficam apenas os cabeçalhos estáticos.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // Câmera e microfone só são liberados por atividade, com consentimento (PSI4).
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Links para rotas inexistentes viram erro de compilação, não 404 em produção.
  typedRoutes: true,

  images: {
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
