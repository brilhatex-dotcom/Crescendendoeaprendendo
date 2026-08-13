import type { FigurinhaDaGaleria } from "@/modules/collection";
import { cn } from "@/design-system/utils/cn";

/**
 * A grade de figurinhas.
 *
 * Não descoberta mostra um "?" no lugar do símbolo — nunca o nome. Um álbum
 * que revela tudo antes de a criança ganhar tira a graça de descobrir; é
 * essa mesma decisão que `montarGaleria` já protege no domínio (o objeto nem
 * carrega nome nem símbolo quando `descoberta` é `false`).
 *
 * Componente de servidor: só recebe dados e desenha.
 */
export function Galeria({ figurinhas }: { figurinhas: readonly FigurinhaDaGaleria[] }) {
  if (figurinhas.length === 0) {
    return (
      <p className="max-w-lg text-lg text-slate-300 text-pretty">
        Ainda não há nenhuma figurinha para descobrir por aqui. Quando a primeira
        missão trouxer uma, ela vai aparecer nesta página.
      </p>
    );
  }

  const descobertas = figurinhas.filter((f) => f.descoberta).length;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <p className="text-sm text-slate-400">
        {descobertas} de {figurinhas.length}{" "}
        {figurinhas.length === 1 ? "figurinha" : "figurinhas"}
      </p>

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {figurinhas.map((figurinha) => (
          <li key={figurinha.code}>
            <CartaoDaFigurinha figurinha={figurinha} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CartaoDaFigurinha({ figurinha }: { figurinha: FigurinhaDaGaleria }) {
  return (
    <div
      className={cn(
        "flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border-2 px-2 py-3 text-center",
        figurinha.descoberta
          ? "border-[var(--glass-border)] bg-[var(--color-play-raised)]"
          : "border-dashed border-[var(--glass-border)] bg-transparent",
      )}
    >
      {figurinha.descoberta ? (
        <>
          <span aria-hidden="true" className="text-3xl">
            {figurinha.simbolo}
          </span>
          <span className="text-xs font-semibold text-balance">{figurinha.nome}</span>
        </>
      ) : (
        <>
          <span aria-hidden="true" className="text-3xl text-slate-500">
            ❔
          </span>
          <span className="text-xs text-slate-500">Ainda não descoberta</span>
        </>
      )}
    </div>
  );
}
