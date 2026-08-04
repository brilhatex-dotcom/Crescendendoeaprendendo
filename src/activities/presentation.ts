import { z } from "zod";

/**
 * APRESENTAÇÃO DO FEEDBACK — como a devolutiva aparece e soa.
 *
 * Configurável por dado, pelo mesmo motivo das recompensas: o que faz uma
 * criança de 6 anos sorrir não é o que faz uma de 12 sorrir, e descobrir isso
 * exige ajustar, ver, ajustar de novo. Se cada ajuste for deploy, ninguém
 * ajusta.
 *
 * ── Uma restrição que não é configurável ──
 * Toda animação declarada aqui é *decorativa*. Nenhuma informação existe apenas
 * como movimento, som ou cor: a criança que desligou animação, que joga sem som
 * ou que não distingue cores recebe exatamente a mesma informação por texto e
 * forma. Acessibilidade é padrão, não recurso (Bíblia Cap. 1 V6).
 */

export const animacaoSchema = z.enum([
  "NENHUMA",
  "PULSO", // leve, para reforço discreto
  "SALTO", // celebração média
  "EXPLOSAO_DE_LUZ", // celebração grande — reservada a marcos
  "BALANCO", // "quase", sem conotação de erro
  "BRILHO_SUAVE",
]);

export const somSchema = z.enum([
  "NENHUM",
  "ACERTO_CURTO",
  "ACERTO_LONGO",
  "QUASE",
  "TOQUE_NEUTRO",
  "DESBLOQUEIO",
]);

/**
 * Efeitos de partícula. `confete` é o clássico; existe separado da animação
 * porque é caro de renderizar e a primeira coisa que se desliga em aparelho
 * fraco ou com `prefers-reduced-motion`.
 */
export const efeitoSchema = z.enum(["NENHUM", "CONFETE", "FAISCAS", "ONDA_DE_LUZ"]);

export const apresentacaoDeFeedbackSchema = z.object({
  animacao: animacaoSchema.default("NENHUMA"),
  som: somSchema.default("NENHUM"),
  efeito: efeitoSchema.default("NENHUM"),
  /** Mostra a barra de progresso da missão avançando. */
  mostrarProgresso: z.boolean().default(true),
  /** Mostra o prêmio ganho subindo na tela. */
  mostrarPremio: z.boolean().default(true),
  /**
   * Segundos que a devolutiva fica na tela antes de liberar o avanço.
   * Zero = a criança controla. Existe porque devolutiva que some sozinha rápido
   * demais não é lida — e devolutiva não lida é o mesmo que não existir.
   */
  segurarSegundos: z.number().min(0).max(30).default(0),
});

export type ApresentacaoDeFeedback = z.infer<typeof apresentacaoDeFeedbackSchema>;

/**
 * Padrões por tom, usados quando o conteúdo não declara nada.
 *
 * Note a assimetria proposital: o acerto ganha efeito, o "quase" ganha um
 * balanço discreto, e a orientação não ganha nenhum efeito. Erro com fanfarra
 * negativa — som grave, tremor, vermelho — é exatamente o que ensina a criança
 * a evitar o difícil (Bíblia Cap. 11 §11.2).
 */
export const APRESENTACAO_PADRAO: Readonly<
  Record<"CELEBRA" | "QUASE" | "ORIENTA", ApresentacaoDeFeedback>
> = {
  CELEBRA: {
    animacao: "SALTO",
    som: "ACERTO_CURTO",
    efeito: "FAISCAS",
    mostrarProgresso: true,
    mostrarPremio: true,
    segurarSegundos: 0,
  },
  QUASE: {
    animacao: "BALANCO",
    som: "QUASE",
    efeito: "NENHUM",
    mostrarProgresso: true,
    mostrarPremio: true,
    // Segura três segundos: é o feedback que mais tem o que ensinar, e é
    // justamente o que a criança tende a pular para tentar de novo no impulso.
    segurarSegundos: 3,
  },
  ORIENTA: {
    animacao: "BRILHO_SUAVE",
    som: "TOQUE_NEUTRO",
    efeito: "NENHUM",
    mostrarProgresso: true,
    mostrarPremio: false,
    segurarSegundos: 3,
  },
};
