/**
 * GALERIA DE FIGURINHAS — regras puras.
 *
 * O motor de atividades só concede um código opaco (`Premio.colecionaveis`,
 * `src/activities/rewards.ts`) — ele não sabe o que é uma figurinha, só que
 * uma foi ganha. Este módulo é quem entende: cruza o catálogo autorado
 * (`content/colecionaveis.json`) com o que a criança já desbloqueou e monta
 * a galeria.
 *
 * Não descoberta esconde nome e símbolo — só o `code` sobrevive. Um álbum que
 * mostra o nome de tudo antes de a criança ganhar não é álbum, é lista.
 */

export interface ItemDoCatalogo {
  readonly code: string;
  readonly nome: string;
  readonly simbolo: string;
}

export type FigurinhaDaGaleria =
  | {
      readonly code: string;
      readonly descoberta: true;
      readonly nome: string;
      readonly simbolo: string;
      readonly ganhaEm: Date;
    }
  | {
      readonly code: string;
      readonly descoberta: false;
    };

export function montarGaleria(
  catalogo: readonly ItemDoCatalogo[],
  ganhas: ReadonlyMap<string, Date>,
): readonly FigurinhaDaGaleria[] {
  return catalogo.map((item): FigurinhaDaGaleria => {
    const ganhaEm = ganhas.get(item.code);
    return ganhaEm !== undefined
      ? { code: item.code, descoberta: true, nome: item.nome, simbolo: item.simbolo, ganhaEm }
      : { code: item.code, descoberta: false };
  });
}

/**
 * Um prêmio pode listar o mesmo código mais de uma vez (ex.: erro de autoria,
 * ou duas atividades da mesma missão concedendo o mesmo colecionável). A
 * concessão em si já é idempotente (chave primária composta no banco), mas
 * deduplicar aqui evita uma escrita por repetição à toa.
 */
export function codigosUnicos(colecionaveis: readonly string[]): readonly string[] {
  return [...new Set(colecionaveis)];
}
