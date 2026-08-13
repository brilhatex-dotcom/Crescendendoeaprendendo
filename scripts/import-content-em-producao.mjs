#!/usr/bin/env node
/**
 * Publica o acervo no deploy — e só quando o deploy é de produção.
 *
 * ── Por que a guarda, e não `npm run content:import` direto em `vercel:steps` ──
 * Os deploys de *preview* (todo PR) e o `vercel-build` local compartilham o
 * mesmo `DATABASE_URL` de produção — não há banco efêmero por branch (a
 * decisão está registrada em `docs/HANDOFF.md`, "Decisões já tomadas"). Sem
 * esta guarda, abrir um PR com uma mudança de conteúdo em rascunho publicaria
 * essa mudança no banco real antes de qualquer revisão.
 *
 * `VERCEL_ENV` é injetada pela Vercel em todo build, sem precisar de nenhuma
 * configuração — "production" só em deploy de produção; "preview" em todo
 * PR; "development" com `vercel dev`. Fora da Vercel (build local, CI de PR)
 * a variável não existe, e o padrão é pular: a direção do erro que importa
 * aqui é "na dúvida, não publica", nunca o contrário.
 */

import { spawnSync } from "node:child_process";

const AMARELO = "\x1b[33m";
const CINZA = "\x1b[90m";
const VERDE = "\x1b[32m";
const FIM = "\x1b[0m";

const ambiente = process.env.VERCEL_ENV;

if (ambiente !== "production") {
  process.stdout.write(
    `${CINZA}→ content:import pulado neste deploy (VERCEL_ENV=${JSON.stringify(ambiente ?? null)}).${FIM}\n` +
      `${AMARELO}  Deploys de preview e builds fora da Vercel compartilham o banco de\n` +
      `  produção — publicar conteúdo de um deploy que não é "production" escreveria\n` +
      `  no banco real a partir de uma branch em rascunho (docs/HANDOFF.md).\n` +
      `  Para publicar de propósito fora deste fluxo: npm run content:import${FIM}\n`,
  );
  process.exit(0);
}

process.stdout.write(`${VERDE}→ VERCEL_ENV=production — publicando o acervo de content/…${FIM}\n`);

const resultado = spawnSync("npm", ["run", "content:import"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(resultado.status ?? 1);
