#!/usr/bin/env node
/**
 * Executa um comando do Prisma com DIRECT_DATABASE_URL já resolvido.
 *
 * Por que isto existe: migrations precisam de conexão DIRETA. O pooler do Neon
 * roda PgBouncer em modo transação, que não suporta os comandos que uma
 * migration usa (locks consultivos, DDL em transação longa).
 *
 * O problema é que cada integração batiza essa conexão de um jeito, e o nome
 * muda entre versões. Em vez de exigir que alguém crie a variável na mão — e
 * descubra o erro só quando o deploy quebra — descobrimos o nome aqui.
 *
 * Uso:  node scripts/with-direct-db.mjs prisma migrate deploy
 */

import { spawnSync } from "node:child_process";

/** Em ordem de preferência. O último é a rede de segurança. */
const ALIASES = [
  "DIRECT_DATABASE_URL", // nosso nome canônico
  "DATABASE_URL_UNPOOLED", // integração Neon ↔ Vercel
  "POSTGRES_URL_NON_POOLING", // Vercel Postgres (legado)
  "POSTGRES_URL_NO_SSL",
];

function resolveDirectUrl() {
  for (const alias of ALIASES) {
    const value = process.env[alias];
    if (value && value.trim() !== "") {
      return { url: value, source: alias };
    }
  }

  const pooled = process.env.DATABASE_URL;
  if (!pooled || pooled.trim() === "") return null;

  // Sem conexão direta declarada: derivamos removendo o sufixo do pooler.
  // O host com pooling do Neon é "<algo>-pooler.<região>.neon.tech".
  const derived = pooled.replace("-pooler.", ".");
  return {
    url: derived,
    source: derived === pooled ? "DATABASE_URL" : "DATABASE_URL (sem -pooler)",
  };
}

const command = process.argv.slice(2);

if (command.length === 0) {
  console.error("Uso: node scripts/with-direct-db.mjs <comando> [args...]");
  process.exit(1);
}

const resolved = resolveDirectUrl();

if (!resolved) {
  console.error(
    "\n✖ Nenhuma conexão de banco encontrada.\n\n" +
      "  Defina DATABASE_URL no ambiente. Se o banco foi provisionado pela\n" +
      "  Vercel, confira em Settings → Environment Variables se a integração\n" +
      "  do Neon está conectada a este projeto.\n",
  );
  process.exit(1);
}

console.log(`→ conexão direta resolvida a partir de ${resolved.source}`);

const result = spawnSync(command[0], command.slice(1), {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, DIRECT_DATABASE_URL: resolved.url },
});

process.exit(result.status ?? 1);
