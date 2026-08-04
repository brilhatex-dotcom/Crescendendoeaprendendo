import { z } from "zod";

/**
 * ESTÍMULO — o que a criança olha para responder.
 *
 * ── Por que este arquivo existe ──
 * A primeira atividade do acervo perguntava *"ORLA encontrou **estas** conchas
 * na areia. Quantas são?"* e não mostrava concha nenhuma. A pergunta apontava
 * para objetos que não estavam na tela: uma criança de sete anos não tinha como
 * responder, e a única saída era chutar entre 3, 4 e 5.
 *
 * O defeito tinha três camadas, e a do meio é a que interessa: o schema até
 * previa um campo de apoio, mas ele exigia um `assetId` — uma imagem enviada
 * para o Blob, que ninguém tinha enviado — e o renderer nem lia o campo.
 * Conteúdo que depende de upload é conteúdo que não existe até alguém subir
 * arquivo.
 *
 * **Uma coleção não depende de upload.** Quatro conchas são o símbolo `🐚`
 * quatro vezes, declarado em JSON, versionado em git, revisado em pull request
 * como todo o resto do acervo. É a forma mais barata de tornar uma atividade de
 * contagem realmente respondível — e a que mais atividades vão precisar, porque
 * contar, comparar e agrupar são o começo de toda a matemática da faixa.
 *
 * Puro: só schema. Quem desenha é o renderer.
 */

/**
 * Um grupo de objetos iguais.
 *
 * `nome` é obrigatório e está no **singular** de propósito: é o que o leitor de
 * tela anuncia em cada objeto ("concha, concha, concha"), permitindo que uma
 * criança cega conte navegando item a item. Um rótulo no plural com o número
 * dentro ("quatro conchas") entregaria a resposta.
 */
export const grupoDeObjetosSchema = z.object({
  /** Um emoji ou caractere. `🐚`, `🪨`, `⭐`. */
  simbolo: z.string().min(1).max(8),
  /**
   * Quantos desenhar. O teto é 20 porque acima disso a contagem visual deixa de
   * ser contagem e vira estimativa — outra habilidade, outra atividade.
   */
  quantidade: z.number().int().min(1).max(20),
  /** Nome no singular, para leitor de tela. Ver acima. */
  nome: z.string().min(1).max(40),
  /** Rótulo visível do grupo, quando há mais de um. Ex.: "conchas". */
  rotulo: z.string().min(1).max(60).optional(),
});

export type GrupoDeObjetos = z.infer<typeof grupoDeObjetosSchema>;

/**
 * O apoio visual de uma atividade.
 *
 * União discriminada porque as duas formas têm exigências diferentes e não
 * podem ser confundidas: a imagem precisa de texto alternativo, a coleção
 * precisa do nome no singular.
 */
export const apoioVisualSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("imagem"),
    assetId: z.string().min(1),
    /** Obrigatório. Imagem sem alternativa é informação que some (Bíblia Cap. 1 V6). */
    textoAlternativo: z.string().min(1).max(280),
  }),
  z.object({
    tipo: z.literal("colecao"),
    /**
     * Até três grupos. Mais que isso numa tela de criança de sete anos vira
     * ruído, e comparar quatro coleções não é a mesma tarefa que comparar duas.
     */
    grupos: z.array(grupoDeObjetosSchema).min(1).max(3),
    /** Frase curta acima da cena. Ex.: "na areia da praia". */
    legenda: z.string().min(1).max(120).optional(),
  }),
]);

export type ApoioVisual = z.infer<typeof apoioVisualSchema>;
