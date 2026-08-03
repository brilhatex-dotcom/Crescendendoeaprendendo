import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Segredos opacos: tokens de sessão, de verificação de e-mail e de recuperação.
 *
 * Regra de docs/09 §5: **o banco guarda o hash, nunca o token**. Vazamento de
 * dump de banco não pode virar sessão válida nem conta verificada.
 *
 * Aqui usamos SHA-256, não Argon2 — de propósito. Argon2 existe para resistir a
 * força bruta sobre segredos de baixa entropia (senha humana). Estes tokens têm
 * 256 bits de entropia real: não há o que forçar, e o custo do Argon2 a cada
 * requisição autenticada seria desperdício puro.
 */

/** 32 bytes de aleatoriedade criptográfica em base64url — 256 bits. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Código curto para digitação humana (verificação por e-mail em 6 dígitos).
 * Alfabeto sem 0/O e 1/I: criança e adulto cansado confundem, e um código
 * ambíguo vira ticket de suporte.
 */
export function generateShortCode(length = 6): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i += 1) {
    // `bytes` tem exatamente `length` posições; o índice é sempre válido.
    const byte = bytes[i] ?? 0;
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Comparação em tempo constante. Comparar hashes com `===` vaza, pelo tempo,
 * quantos caracteres iniciais bateram — o suficiente para reconstruir um token
 * byte a byte.
 */
export function tokensMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Pseudonimização de IP para a coluna `ipHash` (docs/09 §7: logs sem PII).
 * O sal é o segredo da aplicação, então o hash não é reversível por quem
 * apenas tem o banco — e continua servindo para "mesmo IP?" em rate limit.
 */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`, "utf8").digest("hex");
}
