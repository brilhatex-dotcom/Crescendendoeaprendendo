#!/usr/bin/env tsx
/**
 * Publica o acervo de `content/` no Postgres.
 *
 *   npm run content:import
 *   npm run content:import -- --forcar   (diagnóstico local; nunca no CI)
 *
 * Roda depois de `content:validate`: o validador garante que cada arquivo é
 * válido; este garante que as referências entre eles fecham e grava.
 */

import { carregarAcervo } from "@/content/loader";
import { containerDeConteudo } from "@/composition/content";

const VERDE = "[32m";
const VERMELHO = "[31m";
const AMARELO = "[33m";
const CINZA = "[90m";
const FIM = "[0m";

async function main(): Promise<number> {
  const forcar = process.argv.includes("--forcar");

  process.stdout.write(`${CINZA}Lendo content/…${FIM}\n`);
  const { acervo, problemas: problemasDeArquivo } = await carregarAcervo();

  if (problemasDeArquivo.length > 0) {
    process.stderr.write(
      `\n${VERMELHO}✖ ${problemasDeArquivo.length} arquivo(s) com problema:${FIM}\n`,
    );
    for (const problema of problemasDeArquivo) {
      process.stderr.write(`  ${problema.arquivo}\n    ${problema.mensagem}\n`);
    }
    process.stderr.write(
      `\n${CINZA}Rode 'npm run content:validate' para o relatório completo.${FIM}\n`,
    );
    return 1;
  }

  const { importarConteudo } = containerDeConteudo();
  const resultado = await importarConteudo({ acervo, forcar });

  // Discriminante direto: o `ok` estreita o tipo melhor que o type guard, que
  // descreve a variante sem os `readonly` e por isso não estreita o caminho feliz.
  if (!resultado.ok) {
    process.stderr.write(`\n${VERMELHO}✖ ${resultado.error.message}${FIM}\n\n`);

    const detalhes = resultado.error.details?.["problemas"];
    if (Array.isArray(detalhes)) {
      for (const problema of detalhes) {
        process.stderr.write(`  · ${String(problema)}\n`);
      }
    }

    process.stderr.write(
      `\n${CINZA}Nada foi gravado. Um acervo meio importado trava a criança numa\n` +
        `tela sem saída, então a importação é tudo-ou-nada.${FIM}\n`,
    );
    return 1;
  }

  const { resumo, problemas } = resultado.value;

  if (problemas.length > 0) {
    process.stdout.write(
      `\n${AMARELO}⚠ Gravado com ${problemas.length} problema(s) ignorado(s) por --forcar:${FIM}\n`,
    );
    for (const problema of problemas) {
      process.stdout.write(`  · ${problema.onde}: ${problema.mensagem}\n`);
    }
  }

  process.stdout.write(`\n${VERDE}✔ Acervo publicado no banco.${FIM}\n\n`);

  const linhas: readonly (readonly [string, number])[] = [
    ["academias", resumo.academias],
    ["disciplinas", resumo.disciplinas],
    ["eixos", resumo.eixos],
    ["competências", resumo.competencias],
    ["objetivos", resumo.objetivos],
    ["pré-requisitos", resumo.preRequisitos],
    ["mundos", resumo.mundos],
    ["capítulos", resumo.capitulos],
    ["missões", resumo.missoes],
    ["fases", resumo.fases],
    ["atividades", resumo.atividades],
    ["vínculos", resumo.vinculos],
    ["colecionáveis", resumo.colecionaveis],
    ["conquistas", resumo.conquistas],
  ];

  for (const [rotulo, quantidade] of linhas) {
    process.stdout.write(`  ${rotulo.padEnd(16)} ${String(quantidade).padStart(4)}\n`);
  }

  process.stdout.write(
    `\n${CINZA}A importação é idempotente: rodar de novo atualiza, não duplica.${FIM}\n`,
  );

  return 0;
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((causa: unknown) => {
    process.stderr.write(
      `\n${VERMELHO}✖ Falha inesperada:${FIM} ${
        causa instanceof Error ? causa.message : String(causa)
      }\n`,
    );
    process.exit(1);
  });
