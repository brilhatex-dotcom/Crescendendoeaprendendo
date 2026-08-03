import { err, ok, validationError, type Result } from "@/shared/kernel";

/**
 * Faixas etárias do Arquipélago (Bíblia Vol. 1 Cap. 2 §2.1).
 *
 * Repetimos aqui a união de valores em vez de importar o enum do Prisma: a
 * camada `domain` é TypeScript puro e não conhece o banco (docs/01 §1). O
 * mapeamento entre os dois é responsabilidade da infraestrutura.
 */
export type AgeBand = "SPROUT" | "EXPLORER" | "PIONEER" | "VANGUARD";

/** Faixas com conteúdo autorado hoje. As demais existem no modelo, não no produto. */
export const FAIXAS_DISPONIVEIS: readonly AgeBand[] = ["SPROUT", "EXPLORER"];

/**
 * Guardamos apenas o ANO de nascimento (PSI4 — minimização de dados). A
 * consequência honesta é que a idade tem ±1 ano de imprecisão: quem faz 7 em
 * dezembro é tratado como tendo 7 desde janeiro. Para escolher faixa etária
 * isso é irrelevante, e evita pedir data completa de uma criança.
 */
export function idadeAproximada(birthYear: number, hoje: Date): number {
  return hoje.getUTCFullYear() - birthYear;
}

export function faixaParaIdade(idade: number): AgeBand | undefined {
  if (idade >= 6 && idade <= 8) return "SPROUT";
  if (idade >= 9 && idade <= 12) return "EXPLORER";
  if (idade >= 13 && idade <= 15) return "PIONEER";
  if (idade >= 16 && idade <= 17) return "VANGUARD";
  return undefined;
}

export interface FaixaResolvida {
  readonly ageBand: AgeBand;
  readonly idade: number;
}

/**
 * Resolve a faixa e recusa o que ainda não sabemos atender. Recusar com
 * clareza ("ainda não temos conteúdo para essa idade") é melhor que aceitar o
 * cadastro e entregar um mundo vazio.
 */
export function resolverFaixaEtaria(
  birthYear: number,
  hoje: Date,
): Result<FaixaResolvida> {
  const anoAtual = hoje.getUTCFullYear();

  if (!Number.isInteger(birthYear)) {
    return err(validationError("learner.birth_year_invalid", "Informe o ano de nascimento."));
  }
  if (birthYear > anoAtual) {
    return err(
      validationError("learner.birth_year_future", "O ano de nascimento não pode ser no futuro."),
    );
  }

  const idade = idadeAproximada(birthYear, hoje);
  const faixa = faixaParaIdade(idade);

  if (!faixa) {
    return err(
      validationError(
        "learner.age_out_of_range",
        idade < 6
          ? "O Arquipélago foi desenhado para crianças a partir de 6 anos."
          : "O Arquipélago atende crianças e adolescentes até 17 anos.",
        { idade },
      ),
    );
  }

  if (!FAIXAS_DISPONIVEIS.includes(faixa)) {
    return err(
      validationError(
        "learner.age_band_unavailable",
        "Ainda não temos conteúdo para essa idade. Estamos construindo — avisaremos quando abrir.",
        { idade, faixa },
      ),
    );
  }

  return ok({ ageBand: faixa, idade });
}
