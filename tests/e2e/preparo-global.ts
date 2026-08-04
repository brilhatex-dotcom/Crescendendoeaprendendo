import { containerDeConteudo } from "@/composition/content";
import { carregarAcervo } from "@/content/loader";

/**
 * Preparo global: põe o acervo no banco antes de qualquer teste rodar.
 *
 * ── Por que isto não é opcional ──
 * Desde a Etapa 2, jogar exige o acervo importado: a missão é lida por
 * `Quest.sourceRef`, e sem a linha no banco a tela responde "esta missão ainda
 * não está publicada". Foi exatamente o que aconteceu na primeira execução
 * deste conjunto — os testes de integração limpam o conteúdo no fim, e o e2e
 * encontrou o banco vazio.
 *
 * Um conjunto de testes que depende de alguém ter rodado um comando antes é um
 * conjunto que falha no CI por motivo errado, e ensina o time a ignorar a
 * falha. Aqui ele se basta.
 *
 * A importação é idempotente por construção: rodar de novo atualiza, não
 * duplica, e preserva `Activity.id` — que é o que protege o histórico de quem
 * já jogou.
 */
export default async function preparoGlobal(): Promise<void> {
  const { acervo, problemas } = await carregarAcervo();

  if (problemas.length > 0) {
    throw new Error(
      [
        "O acervo de content/ tem problema e o e2e não tem o que jogar:",
        ...problemas.map((p) => `  · ${p.arquivo}: ${p.mensagem}`),
        "",
        "Rode `npm run content:validate` para o relatório completo.",
      ].join("\n"),
    );
  }

  const { importarConteudo } = containerDeConteudo();
  const resultado = await importarConteudo({ acervo });

  if (!resultado.ok) {
    throw new Error(`Não foi possível publicar o acervo: ${resultado.error.message}`);
  }
}
