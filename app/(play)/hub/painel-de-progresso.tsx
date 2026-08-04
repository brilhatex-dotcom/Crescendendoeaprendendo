import { FOLEGO, apelidoDoTier, progressoNoNivel, type Tier } from "@/modules/progression";
import type { EstadoDaCarteira } from "@/modules/economy";
import type { EstadoDeProgresso } from "@/modules/progression";

/**
 * O painel da base — o que a criança conquistou, em números que ela entende.
 *
 * Léxico obrigatório (Bíblia Cap. 3 §3.5): **Luz**, **Fagulhas**, **Fôlego**,
 * **Trilha de Luz**. Não existe "pontos", "XP", "energia" nem "sequência" nesta
 * tela. As palavras do produto são o produto.
 *
 * Componente de servidor: só recebe dados e desenha. Nenhum estado, nenhum
 * efeito — e por isso nada disto entra no pacote do navegador.
 */
export function PainelDeProgresso({
  progresso,
  carteira,
}: {
  progresso: EstadoDeProgresso;
  carteira: EstadoDaCarteira;
}) {
  const { nivel, luzNoNivel, luzParaSubir } = progressoNoNivel(progresso.luzTotal);
  const percentual = luzParaSubir > 0 ? Math.round((luzNoNivel / luzParaSubir) * 100) : 0;

  return (
    <section
      aria-label="Seu progresso"
      className="flex w-full max-w-md flex-col gap-4 rounded-[var(--radius-lg)] border-2 border-[var(--glass-border)] bg-[var(--color-play-raised)] px-6 py-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold">
          Nível {nivel}
          <span className="ml-2 text-sm font-normal text-[var(--color-corrente)]">
            {apelidoDoTier(progresso.tier as Tier)}
          </span>
        </span>
        <span className="text-sm text-slate-400">
          {luzNoNivel} de {luzParaSubir} de Luz
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={luzParaSubir}
        aria-valuenow={luzNoNivel}
        aria-label={`${luzNoNivel} de ${luzParaSubir} de Luz para o próximo nível`}
        className="h-3 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--color-aurora)] to-[var(--color-corrente)] transition-[width] duration-[var(--duration-base)]"
          style={{ width: `${percentual}%` }}
        />
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <Medida rotulo="Fagulhas" valor={carteira.fagulhas} />
        <Medida rotulo="Fôlego" valor={progresso.folego} de={FOLEGO.maximo} />
        <Medida
          rotulo="Trilha de Luz"
          valor={progresso.trilha.dias}
          sufixo={progresso.trilha.dias === 1 ? "dia" : "dias"}
        />
      </dl>

      {/*
        O recorde só aparece quando é maior que a sequência atual — ou seja,
        quando ela já foi mais longe. Ali ele é memória do que ela conseguiu, e
        não uma cobrança pelo que ela perdeu: por isso "seu recorde", e nunca
        "você já teve".
      */}
      {progresso.trilha.recorde > progresso.trilha.dias ? (
        <p className="text-center text-sm text-slate-400">
          Seu recorde: {progresso.trilha.recorde} dias
        </p>
      ) : null}

      {progresso.trilha.lanternas > 0 ? (
        <p className="text-center text-sm text-slate-400">
          {progresso.trilha.lanternas === 1
            ? "Você tem 1 Lanterna guardada."
            : `Você tem ${progresso.trilha.lanternas} Lanternas guardadas.`}{" "}
          Ela segura sua Trilha num dia que você não puder vir.
        </p>
      ) : null}
    </section>
  );
}

function Medida({
  rotulo,
  valor,
  de,
  sufixo,
}: {
  rotulo: string;
  valor: number;
  de?: number;
  sufixo?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="order-2 text-xs uppercase tracking-wide text-slate-400">{rotulo}</dt>
      <dd className="font-display order-1 text-xl font-bold">
        {valor}
        {de !== undefined ? <span className="text-slate-400">/{de}</span> : null}
        {sufixo ? <span className="ml-1 text-sm font-normal text-slate-400">{sufixo}</span> : null}
      </dd>
    </div>
  );
}
