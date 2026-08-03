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
export const serverEnv: ServerEnv = parseOrThrow(
  serverSchema,
  process.env,
  "servidor",
);

export const clientEnv: ClientEnv = parseOrThrow(
  clientSchema,
  { NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL },
  "cliente",
);

export const isProduction = serverEnv.NODE_ENV === "production";
export const isDevelopment = serverEnv.NODE_ENV === "development";
