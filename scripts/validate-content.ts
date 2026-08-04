/**
 * Valida todo o acervo de conteúdo. Roda no CI.
 *
 * Conteúdo quebrado não dá erro de compilação — ele dá uma tela travada na
 * frente de uma criança que não tem como reportar bug. Este script é o
 * compilador do conteúdo.
 *
 * Uso:  npm run content:validate
 */

import { registroPadrao } from "@/activities";

import { carregarAcervo, validarReferenciasEConfigs } from "@/content/loader";

async function main(): Promise<number> {
  const { acervo, problemas: problemasDeFormato } = await carregarAcervo();
  const problemasDeReferencia = validarReferenciasEConfigs(acervo, registroPadrao);
  const problemas = [...problemasDeFormato, ...problemasDeReferencia];

  const atividades = acervo.missoes.reduce(
    (total, m) => total + m.missao.fases.reduce((t, f) => t + f.atividades.length, 0),
    0,
  );

  console.log("");
  console.log("  Acervo de conteúdo");
  console.log("  ──────────────────");
  console.log(`  currículos ......... ${acervo.curriculos.length}`);
  console.log(`  academias .......... ${acervo.academias.length}`);
  console.log(`  disciplinas ........ ${acervo.disciplinas.length}`);
  console.log(`  níveis ............. ${acervo.niveis.length}`);
  console.log(`  módulos ............ ${acervo.modulos.length}`);
  console.log(`  missões ............ ${acervo.missoes.length}`);
  console.log(`  atividades ......... ${atividades}`);
  console.log(`  tipos jogáveis ..... ${registroPadrao.tiposDisponiveis().join(", ")}`);
  console.log("");

  if (problemas.length === 0) {
    console.log("  Nenhum problema encontrado.");
    console.log("");
    return 0;
  }

  // Agrupado por arquivo: quem vai corrigir abre um arquivo de cada vez.
  const porArquivo = new Map<string, string[]>();
  for (const problema of problemas) {
    const relativo = problema.arquivo.replace(`${process.cwd()}/`, "");
    porArquivo.set(relativo, [...(porArquivo.get(relativo) ?? []), problema.mensagem]);
  }

  console.error(`  ${problemas.length} problema(s) em ${porArquivo.size} arquivo(s):`);
  console.error("");
  for (const [arquivo, mensagens] of [...porArquivo].sort()) {
    console.error(`  ${arquivo}`);
    for (const mensagem of mensagens) console.error(`    · ${mensagem}`);
    console.error("");
  }

  return 1;
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((causa: unknown) => {
    console.error("Falha ao validar o conteúdo:", causa);
    process.exit(1);
  });
