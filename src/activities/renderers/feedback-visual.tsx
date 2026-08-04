"use client";

import type { ReactNode } from "react";

import { cn } from "@/design-system/utils/cn";

import type { ApresentacaoDeFeedback } from "../presentation";

/**
 * Traduz a apresentação declarada no conteúdo em animação e efeito na tela.
 *
 * O componente é burro de propósito: ele não decide nada. Quem decidiu qual
 * animação usar foi o conteúdo (ou o padrão do tom, em `presentation.ts`). Isso
 * mantém a decisão pedagógica — "quanto celebrar" — no lugar onde ela pode ser
 * ajustada sem deploy.
 *
 * As partículas são `aria-hidden`: são enfeite, e nada do que a criança precisa
 * saber está apenas nelas.
 */

const CLASSE_DE_ANIMACAO: Readonly<Record<string, string>> = {
  NENHUMA: "",
  PULSO: "ca-anim-pulso",
  SALTO: "ca-anim-salto",
  EXPLOSAO_DE_LUZ: "ca-anim-explosao-de-luz",
  BALANCO: "ca-anim-balanco",
  BRILHO_SUAVE: "ca-anim-brilho-suave",
};

const CORES_DO_CONFETE = [
  "var(--color-aurora)",
  "var(--color-corrente)",
  "var(--color-fagulha)",
  "var(--color-folha)",
];

export function FeedbackVisual({
  apresentacao,
  children,
  className,
}: {
  apresentacao: ApresentacaoDeFeedback;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative",
        CLASSE_DE_ANIMACAO[apresentacao.animacao] ?? "",
        className,
      )}
    >
      <Efeito tipo={apresentacao.efeito} />
      {children}
    </div>
  );
}

function Efeito({ tipo }: { tipo: ApresentacaoDeFeedback["efeito"] }) {
  if (tipo === "NENHUM") return null;

  if (tipo === "ONDA_DE_LUZ") {
    return (
      <div className="ca-efeito ca-efeito-onda-de-luz" aria-hidden="true">
        <span className="ca-particula" />
      </div>
    );
  }

  if (tipo === "FAISCAS") {
    // Doze direções fixas em vez de sorteadas: sem aleatoriedade, o mesmo
    // acerto produz a mesma comemoração, e o teste visual é reproduzível.
    return (
      <div className="ca-efeito ca-efeito-faiscas" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => {
          const angulo = (i / 12) * Math.PI * 2;
          return (
            <span
              key={i}
              className="ca-particula"
              style={{
                left: "50%",
                background: CORES_DO_CONFETE[i % CORES_DO_CONFETE.length],
                animationDelay: `${i * 18}ms`,
                "--dx": `${Math.cos(angulo) * 90}px`,
                "--dy": `${Math.sin(angulo) * 70}px`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="ca-efeito ca-efeito-confete" aria-hidden="true">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="ca-particula"
          style={{
            left: `${(i * 100) / 18 + 2}%`,
            background: CORES_DO_CONFETE[i % CORES_DO_CONFETE.length],
            animationDelay: `${(i % 6) * 90}ms`,
          }}
        />
      ))}
    </div>
  );
}
