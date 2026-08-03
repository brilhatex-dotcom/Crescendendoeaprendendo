/**
 * Estado devolvido por uma Server Action ao formulário que a chamou.
 *
 * Mora em `shared/` e não em `server/` porque **os dois lados o importam**: o
 * servidor para produzi-lo, o Client Component para lê-lo em `useActionState`.
 * Se ele vivesse junto do `createAction`, todo formulário arrastaria
 * `next/headers` para o pacote do cliente — e o build quebra, com razão.
 *
 * Por isso este arquivo não importa nada. É só forma de dado.
 */

export type EstadoDaAction<TSaida = undefined> =
  | { readonly status: "inicial" }
  | { readonly status: "sucesso"; readonly dados: TSaida }
  | {
      readonly status: "erro";
      readonly mensagem: string;
      /** Erros por campo, para exibir junto do input que os causou. */
      readonly campos?: Readonly<Record<string, string>>;
    };

export const ESTADO_INICIAL: EstadoDaAction<never> = { status: "inicial" };
