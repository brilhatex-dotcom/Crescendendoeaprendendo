/**
 * UNIDADE DE TRABALHO — a transação como dependência, não como detalhe.
 *
 * `docs/08 §11` é explícito sobre o que precisa ser atômico com a tentativa:
 * `Attempt`, `SkillMastery`, `ReviewCard`, `LearnerProgress`, `LedgerEntry` +
 * `Wallet`, `QuestRun` e `OutboxMessage`. Isso atravessa três módulos.
 *
 * Ao mesmo tempo, `docs/01 §2` proíbe módulos de se chamarem. A saída não é
 * escolher um dos dois: é o caso de uso abrir **uma** transação e os módulos que
 * reagem escreverem dentro dela, sem nunca se conhecerem. Quem os reúne é o
 * composition root.
 *
 * Por que a criança nota a diferença: com XP saindo pelo outbox, ela terminaria
 * a atividade e não veria Luz nenhuma subir até o despachante rodar. Um minuto
 * de espera, para quem tem sete anos, é o mesmo que não ter acontecido.
 */

declare const marcaDeTransacao: unique symbol;

/**
 * Uma transação em curso. Handle **opaco** de propósito.
 *
 * A aplicação recebe e repassa; quem sabe o que existe por dentro é apenas a
 * infraestrutura, num único ponto de conversão. Sem a marca, qualquer objeto
 * seria aceito no lugar de uma transação e o erro só apareceria em produção,
 * como escrita fora do escopo transacional.
 */
export interface Transacao {
  readonly [marcaDeTransacao]: true;
}

/**
 * Uma linha quente mudou entre a leitura e a escrita.
 *
 * Mora no kernel porque atravessa módulos: a transação de uma tentativa escreve
 * em `SkillMastery`, `LearnerProgress` e `Wallet`, e a corrida pode acontecer em
 * qualquer uma das três. Quem coordena a transação precisa reconhecer o conflito
 * sem conhecer os módulos que o levantaram — a resposta é sempre a mesma:
 * desfazer, reler e recalcular.
 *
 * É diferente de um erro de negócio (`AppError`): nada está errado com o pedido.
 * Só chegou junto com outro.
 */
export class ConflitoDeConcorrencia extends Error {
  constructor(readonly onde: string) {
    super(`Escrita concorrente em ${onde}`);
    this.name = "ConflitoDeConcorrencia";
  }
}

export interface UnidadeDeTrabalho {
  /**
   * Executa o trabalho dentro de uma transação.
   *
   * Confirma ao terminar; **desfaz tudo** se qualquer coisa for lançada. É por
   * isso que os erros esperados da gravação (chave repetida, corrida de versão)
   * viajam como exceção e não como valor de retorno: um `return` confirmaria a
   * transação, e o que se quer é exatamente o contrário.
   */
  executar<T>(trabalho: (tx: Transacao) => Promise<T>): Promise<T>;
}
