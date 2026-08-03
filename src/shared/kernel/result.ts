/**
 * Result — erros esperados são valores, não exceções.
 *
 * Exceção fica reservada para o que é genuinamente excepcional (banco caiu).
 * Regra de negócio que falha ("saldo insuficiente") é um Result, e o
 * TypeScript obriga quem chama a tratar.
 */

export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}

/** Desembrulha ou lança. Use apenas onde o erro já foi comprovadamente tratado. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(
    `unwrap() em Result de erro: ${JSON.stringify(result.error)}`,
  );
}

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

// ── Taxonomia de erros ───────────────────────────────────────────────────────

export type ErrorKind =
  | "VALIDATION" // entrada malformada
  | "NOT_FOUND"
  | "FORBIDDEN" // política negou (docs/09 §3)
  | "UNAUTHENTICATED"
  | "CONFLICT" // violação de invariante do domínio
  | "RATE_LIMITED"
  | "UNAVAILABLE" // dependência externa fora do ar
  | "INTERNAL";

export interface AppError {
  readonly kind: ErrorKind;
  /** Código estável, legível por máquina: 'wallet.insufficient_funds' */
  readonly code: string;
  /** Mensagem para log — nunca exibida crua a uma criança. */
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export function appError(
  kind: ErrorKind,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return details ? { kind, code, message, details } : { kind, code, message };
}

export const validationError = (code: string, message: string, details?: Record<string, unknown>) =>
  appError("VALIDATION", code, message, details);

export const notFound = (code: string, message: string) =>
  appError("NOT_FOUND", code, message);

export const forbidden = (code: string, message: string) =>
  appError("FORBIDDEN", code, message);

export const conflict = (code: string, message: string, details?: Record<string, unknown>) =>
  appError("CONFLICT", code, message, details);
