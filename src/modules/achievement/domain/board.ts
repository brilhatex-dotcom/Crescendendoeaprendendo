/**
 * QUADRO DE CONQUISTAS — regras puras.
 *
 * Ao contrário da galeria de figurinhas (`collection/domain/gallery.ts`), uma
 * conquista **não oculta** o que falta por padrão: a criança vê o nome, a
 * descrição e o quanto já andou — é o mesmo princípio de `docs/08 §3` ("o
 * mapa mostra o caminho, nunca só um cadeado") aplicado aqui. Só quando o
 * catálogo marca `oculta: true` (campo `hidden` do banco) é que a conquista
 * fica escondida até desbloquear — reservado para as poucas que devem
 * surpreender.
 */

export type Familia = "DOMINIO" | "PERSISTENCIA" | "DESCOBERTA" | "CRIACAO" | "CUIDADO";
export type Grau = "BRONZE" | "PRATA" | "OURO" | "LENDARIA";

export interface ItemDoCatalogoDeConquista {
  readonly code: string;
  readonly nome: string;
  readonly descricao: string;
  readonly familia: Familia;
  readonly grau: Grau;
  readonly oculta: boolean;
}

export type ConquistaNoQuadro =
  | {
      readonly code: string;
      readonly desbloqueada: true;
      readonly nome: string;
      readonly descricao: string;
      readonly familia: Familia;
      readonly grau: Grau;
      readonly desbloqueadaEm: Date;
    }
  | {
      readonly code: string;
      readonly desbloqueada: false;
      /** `true`: nada além do `code` sobrevive — é a "figurinha" secreta. */
      readonly oculta: true;
    }
  | {
      readonly code: string;
      readonly desbloqueada: false;
      readonly oculta: false;
      readonly nome: string;
      readonly descricao: string;
      readonly familia: Familia;
      readonly grau: Grau;
      /** 0 a 1. */
      readonly progresso: number;
    };

export function montarQuadro(
  catalogo: readonly ItemDoCatalogoDeConquista[],
  progresso: ReadonlyMap<string, { readonly progresso: number; readonly desbloqueadaEm: Date | null }>,
): readonly ConquistaNoQuadro[] {
  return catalogo.map((item): ConquistaNoQuadro => {
    const linha = progresso.get(item.code);

    if (linha?.desbloqueadaEm) {
      return {
        code: item.code,
        desbloqueada: true,
        nome: item.nome,
        descricao: item.descricao,
        familia: item.familia,
        grau: item.grau,
        desbloqueadaEm: linha.desbloqueadaEm,
      };
    }

    if (item.oculta) {
      return { code: item.code, desbloqueada: false, oculta: true };
    }

    return {
      code: item.code,
      desbloqueada: false,
      oculta: false,
      nome: item.nome,
      descricao: item.descricao,
      familia: item.familia,
      grau: item.grau,
      progresso: linha?.progresso ?? 0,
    };
  });
}
