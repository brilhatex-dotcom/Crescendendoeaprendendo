import { cookies, headers } from "next/headers";

import { isProduction, serverEnv } from "@/config/env";
import { hashIp } from "@/shared/security/tokens";
import { sign, verify } from "@/shared/security/signing";

/**
 * Cookies de sessão.
 *
 * Dois cookies, dois papéis (docs/09 §2):
 *
 * - **sessão adulta** — token opaco de 256 bits, 30 dias. O servidor guarda
 *   só o hash; o cookie é a única cópia em claro que existe.
 * - **sub-sessão de criança** — carga assinada com `{ sessionId, learnerId, exp }`,
 *   4 horas. Não é um segundo login: é um *escopo reduzido* dentro da sessão
 *   do adulto, que continua viva por baixo.
 *
 * Por que dois mecanismos diferentes? A sub-sessão precisa caducar sozinha em
 * 4h sem depender de coluna nova, e precisa ser revogável pelo servidor. O
 * cookie assinado dá a expiração; o `activeLearnerId` no banco dá a revogação.
 * Só vale quem passa nos dois.
 */

/**
 * O prefixo `__Host-` é o que impede um subdomínio de escrever o cookie de
 * sessão do domínio principal. Ele exige `Secure`, que exige HTTPS — e por
 * isso o navegador recusaria o cookie em `http://localhost`. Em
 * desenvolvimento caímos no nome sem prefixo; em produção o prefixo é regra.
 */
export const COOKIE_SESSAO = isProduction ? "__Host-ca_session" : "ca_session";
export const COOKIE_CRIANCA = isProduction ? "__Host-ca_play" : "ca_play";

const OPCOES_BASE = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
} as const;

export async function lerTokenDeSessao(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE_SESSAO)?.value ?? null;
}

export async function gravarCookieDeSessao(
  token: string,
  expiraEm: Date,
): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, { ...OPCOES_BASE, expires: expiraEm });
}

export async function limparCookieDeSessao(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
  jar.delete(COOKIE_CRIANCA);
}

// ── Sub-sessão de criança ────────────────────────────────────────────────────

interface CargaDeCrianca {
  /** Sessão adulta a que esta sub-sessão pertence. */
  readonly s: string;
  readonly l: string;
  /** Expiração em segundos desde a época. */
  readonly exp: number;
}

export async function abrirSubSessaoDeCrianca(
  sessionId: string,
  learnerId: string,
  expiraEm: Date,
): Promise<void> {
  const carga: CargaDeCrianca = {
    s: sessionId,
    l: learnerId,
    exp: Math.floor(expiraEm.getTime() / 1000),
  };
  const jar = await cookies();
  jar.set(COOKIE_CRIANCA, sign(JSON.stringify(carga), serverEnv.AUTH_SECRET), {
    ...OPCOES_BASE,
    expires: expiraEm,
  });
}

export async function fecharSubSessaoDeCrianca(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_CRIANCA);
}

/**
 * Id da criança ativa, ou null.
 *
 * Confere as três coisas que precisam bater: a assinatura, o prazo e o vínculo
 * com **esta** sessão adulta. O último é o que impede colar o cookie de criança
 * de uma sessão em outra.
 *
 * O chamador ainda precisa conferir contra `activeLearnerId` do banco — é isso
 * que faz "trocar de criança" revogar a sub-sessão anterior de imediato.
 */
export async function lerSubSessaoDeCrianca(
  sessionId: string,
  agora: Date,
): Promise<string | null> {
  const jar = await cookies();
  const assinado = jar.get(COOKIE_CRIANCA)?.value;
  if (!assinado) return null;

  const carga = verify(assinado, serverEnv.AUTH_SECRET);
  if (!carga) return null;

  let dados: CargaDeCrianca;
  try {
    dados = JSON.parse(carga) as CargaDeCrianca;
  } catch {
    return null;
  }

  if (typeof dados.s !== "string" || typeof dados.l !== "string") return null;
  if (typeof dados.exp !== "number") return null;
  if (dados.s !== sessionId) return null;
  if (dados.exp * 1000 <= agora.getTime()) return null;

  return dados.l;
}

// ── Contexto da requisição ───────────────────────────────────────────────────

/**
 * IP pseudonimizado do cliente.
 *
 * Atrás do proxy da Vercel, `x-forwarded-for` é uma lista e o **primeiro**
 * item é o cliente original. Guardamos apenas o hash com sal do segredo da
 * aplicação: serve para rate limit e para a coluna `ipHash`, e não é um
 * endereço rastreável se o banco vazar (docs/09 §7).
 */
export async function ipHashDaRequisicao(): Promise<string | null> {
  const cabecalhos = await headers();
  const encaminhado = cabecalhos.get("x-forwarded-for");
  const ip = encaminhado?.split(",")[0]?.trim() ?? cabecalhos.get("x-real-ip");
  return ip ? hashIp(ip, serverEnv.AUTH_SECRET) : null;
}

export async function userAgentDaRequisicao(): Promise<string | null> {
  const cabecalhos = await headers();
  return cabecalhos.get("user-agent")?.slice(0, 255) ?? null;
}
