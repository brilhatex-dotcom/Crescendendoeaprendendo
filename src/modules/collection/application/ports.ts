import type { Transacao } from "@/shared/kernel";

import type { ItemDoCatalogo } from "../domain/gallery";

export interface RepositorioDeColecionaveis {
  /**
   * Concede os colecionáveis pelos `code`, na transação recebida.
   *
   * Idempotente pela própria chave primária composta de `LearnerCollectible`
   * (learnerId, collectibleId) — repetir a concessão não duplica nem falha.
   * Um `code` que não existe no catálogo é ignorado, não é erro: o validador
   * de conteúdo já barra isso antes de qualquer deploy (`content/loader.ts`).
   */
  conceder(learnerId: string, codes: readonly string[], tx: Transacao): Promise<void>;

  /** Leitura para tela — fora de transação. Catálogo inteiro + o que já foi ganho. */
  galeria(learnerId: string): Promise<{
    readonly catalogo: readonly ItemDoCatalogo[];
    readonly ganhas: ReadonlyMap<string, Date>;
  }>;
}

export interface CollectionDeps {
  readonly repositorio: RepositorioDeColecionaveis;
}
