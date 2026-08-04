import { z } from "zod";

/**
 * Validação de ambiente na inicialização.
 * docs/09-autenticacao-e-seguranca.md §5 — "segredos apenas em variáveis de
 * ambiente validadas por Zod; nunca no cliente".
 *
 * Falhar rápido e alto é melhor que descobrir em produção que uma chave falta.
 */

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Banco — string pooled para o app, direta para migrations (docs/10 §4)
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url().optional(),

  // Auth.js
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET precisa de ao menos 32 caracteres"),
  AUTH_URL: z.string().url().optional(),

  // Tutor IA — o provedor de modelo (Bíblia Cap. 8)
  ANTHROPIC_API_KEY: z.string().startsWith("sk-").optional(),
  TUTOR_MODEL: z.string().default("claude-sonnet-5"),
  TUTOR_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(50),

  // E-mail transacional — verificação de conta e recuperação de senha.
  // Ausente, o mailer cai no adaptador de console (útil em dev). Em produção
  // isso não derruba o build: falha alto no envio, com erro UNAVAILABLE.
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  /**
   * Remetente. Aceita `endereco@dominio` ou `Nome Visível <endereco@dominio>`
   * — o segundo formato é o que faz a caixa de entrada mostrar "Crescendo e
   * Aprendendo" em vez de um endereço cru, e é o que os provedores esperam.
   */
  EMAIL_FROM: z
    .string()
    .regex(
      /^(?:[^<>]+\s)?<?[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+>?$/,
      "EMAIL_FROM deve ser 'endereco@dominio' ou 'Nome <endereco@dominio>'",
    )
    .default("Crescendo e Aprendendo <ola@crescendoeaprendendo.com.br>"),

  /**
   * Segredo do Cron Job da Vercel, que despacha o outbox.
   *
   * Opcional para não derrubar o build de quem ainda não configurou o cron —
   * mas a rota é **fail-closed**: sem o segredo ela recusa toda chamada. O
   * inverso (rota aberta quando o segredo falta) deixaria qualquer um na
   * internet disparar o processamento da fila.
   */
  CRON_SECRET: z.string().min(16).optional(),

  // Infra opcional em desenvolvimento
  REDIS_URL: z.string().url().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  JOB_SIGNING_SECRET: z.string().min(32).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

type ServerEnv = z.infer<typeof serverSchema>;
type ClientEnv = z.infer<typeof clientSchema>;

function parseOrThrow<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined>,
  scope: string,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variáveis de ambiente inválidas (${scope}):\n${details}\n\n` +
        `Copie .env.example para .env e preencha os valores.`,
    );
  }
  return parsed.data;
}

/**
 * Só pode ser lido no servidor. Importar isto em um Client Component é erro
 * de fronteira e será apontado pelo lint de camadas.
 */
/**
 * A integração Neon↔Vercel injeta a conexão direta com outro nome, e ele varia
 * conforme a versão da integração. Aceitamos os apelidos conhecidos para que
 * ninguém precise duplicar variável na mão.
 */
function resolveDirectDatabaseUrl(): string | undefined {
  return (
    process.env.DIRECT_DATABASE_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL
  );
}

export const serverEnv: ServerEnv = parseOrThrow(
  serverSchema,
  { ...process.env, DIRECT_DATABASE_URL: resolveDirectDatabaseUrl() },
  "servidor",
);

export const clientEnv: ClientEnv = parseOrThrow(
  clientSchema,
  { NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL },
  "cliente",
);

export const isProduction = serverEnv.NODE_ENV === "production";
export const isDevelopment = serverEnv.NODE_ENV === "development";
