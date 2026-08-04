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

  /**
   * O acervo de conteúdo é lido do disco em tempo de execução (`content/loader.ts`).
   *
   * O rastreador de dependências do Next só empacota o que consegue ver por
   * `import`, e a leitura aqui é dinâmica de propósito — é o que permite
   * publicar uma missão nova sem tocar em código. Sem esta declaração, os JSON
   * ficariam de fora do pacote e o acervo apareceria vazio em produção,
   * funcionando perfeitamente em desenvolvimento.
   */
  outputFileTracingIncludes: {
    "/**": ["./content/**/*.json"],
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
