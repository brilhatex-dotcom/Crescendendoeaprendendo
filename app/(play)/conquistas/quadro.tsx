import type { ConquistaNoQuadro, Familia, Grau } from "@/modules/achievement";
import { cn } from "@/design-system/utils/cn";

const NOME_DA_FAMILIA: Record<Familia, string> = {
  DOMINIO: "Domínio",
  PERSISTENCIA: "Persistência",
  DESCOBERTA: "Descoberta",
  CRIACAO: "Criação",
  CUIDADO: "Cuidado",
};

const NOME_DO_GRAU: Record<Grau, string> = {
  BRONZE: "Bronze",
  PRATA: "Prata",
  OURO: "Ouro",
  LENDARIA: "Lendária",
};

const COR_DO_GRAU: Record<Grau, string> = {
  BRONZE: "text-[#cd7f32]",
  PRATA: "text-slate-300",
  OURO: "text-[var(--color-fagulha)]",
  LENDARIA: "text-[var(--color-aurora)]",
};

/**
 * O quadro de conquistas, agrupado por família.
 *
 * Componente de servidor: só recebe dados e desenha.
 */
export function QuadroDeConquistas({ conquistas }: { conquistas: readonly ConquistaNoQuadro[] }) {
  if (conquistas.length === 0) {
    return (
      <p className="max-w-lg text-lg text-slate-300 text-pretty">
        Ainda não há nenhuma conquista para buscar por aqui. Elas aparecem
        conforme o Arquipélago cresce.
      </p>
    );
  }

  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;

  /*
   * Conquista oculta e ainda não desbloqueada não carrega `familia` — o
   * domínio não revela nada além do `code` (mesma regra da figurinha não
   * descoberta). Sem família para agrupar, ela fica numa faixa própria, fora
   * do agrupamento por família — nunca dentro de uma família inventada.
   */
  const ocultas = conquistas.filter((c) => !c.desbloqueada && c.oculta);
  const visiveis = conquistas.filter((c) => c.desbloqueada || !c.oculta);

  const porFamilia = new Map<Familia, (ConquistaNoQuadro & { readonly familia: Familia })[]>();
  for (const conquista of visiveis) {
    if (!("familia" in conquista)) continue;
    const lista = porFamilia.get(conquista.familia) ?? [];
    lista.push(conquista);
    porFamilia.set(conquista.familia, lista);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <p className="text-sm text-slate-400">
        {desbloqueadas} de {conquistas.length}{" "}
        {conquistas.length === 1 ? "conquista" : "conquistas"}
      </p>

      {[...porFamilia.entries()].map(([familia, lista]) => (
        <section key={familia} className="flex flex-col gap-3">
          <h2 className="text-left text-sm font-semibold text-slate-300">
            {NOME_DA_FAMILIA[familia]}
          </h2>
          <ul className="flex flex-col gap-3">
            {lista.map((conquista) => (
              <li key={conquista.code}>
                <CartaoDaConquista conquista={conquista} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {ocultas.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-left text-sm font-semibold text-slate-300">Segredos</h2>
          <ul className="flex flex-col gap-3">
            {ocultas.map((conquista) => (
              <li key={conquista.code}>
                <CartaoDaConquista conquista={conquista} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function CartaoDaConquista({ conquista }: { conquista: ConquistaNoQuadro }) {
  if (!conquista.desbloqueada && conquista.oculta) {
    return (
      <div className="flex min-h-[var(--touch-target-play)] w-full flex-col justify-center gap-1 rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--glass-border)] px-6 py-4 text-left">
        <span aria-hidden="true" className="text-2xl text-slate-500">
          ❔
        </span>
        <span className="text-sm text-slate-500">Conquista secreta — continue jogando.</span>
      </div>
    );
  }

  const estilo = cn(
    "flex min-h-[var(--touch-target-play)] w-full flex-col justify-center gap-1 rounded-[var(--radius-lg)] border-2 px-6 py-4 text-left",
    conquista.desbloqueada
      ? "border-[var(--color-folha)] bg-[var(--color-folha)]/10"
      : "border-[var(--glass-border)] bg-[var(--color-play-raised)]",
  );

  return (
    <div className={estilo}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-bold">{conquista.nome}</span>
        <span className={cn("shrink-0 text-xs font-bold uppercase tracking-wide", COR_DO_GRAU[conquista.grau])}>
          {NOME_DO_GRAU[conquista.grau]}
        </span>
      </div>

      <p className="text-sm text-slate-400">{conquista.descricao}</p>

      {conquista.desbloqueada ? (
        <p className="mt-1 text-sm font-semibold text-[var(--color-folha)]">✓ Conquistada</p>
      ) : (
        <BarraDeProgresso progresso={conquista.progresso} />
      )}
    </div>
  );
}

function BarraDeProgresso({ progresso }: { progresso: number }) {
  const percentual = Math.round(Math.min(1, Math.max(0, progresso)) * 100);

  return (
    <div className="mt-2 flex flex-col gap-1">
      <div
        role="progressbar"
        aria-valuenow={percentual}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-[var(--color-corrente)] transition-[width] duration-[var(--duration-expressive)]"
          style={{ width: `${percentual}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">{percentual}%</span>
    </div>
  );
}
