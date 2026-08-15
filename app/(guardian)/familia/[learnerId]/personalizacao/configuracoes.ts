import type { ConfiguracoesDoAprendiz } from "@/modules/identity";

/**
 * Cada configuração de acessibilidade, com o rótulo e a explicação de uma
 * linha que o responsável vê — nunca o nome de uma condição médica ou
 * psicológica (`tests/policy/personalizacao-da-aprendizagem.test.ts` garante
 * isso em toda string abaixo, mesma disciplina de
 * `domain/accessibility-recommendation.ts`).
 *
 * Módulo próprio, separado de `page.tsx`, só para que o teste de política
 * importe sem precisar renderizar React.
 */
export const CONFIGURACOES: readonly {
  readonly campo: keyof ConfiguracoesDoAprendiz;
  readonly rotulo: string;
  readonly descricao: string;
}[] = [
  {
    campo: "pictogramsEnabled",
    rotulo: "Apoio visual",
    descricao: "Imagens e ícones aparecem com mais frequência junto das perguntas.",
  },
  {
    campo: "stepByStepInstructions",
    rotulo: "Instruções em passos",
    descricao:
      "As instruções das atividades vêm divididas em passos curtos, em vez de um texto só.",
  },
  {
    campo: "textToSpeech",
    rotulo: "Ler em voz alta",
    descricao: "As perguntas são lidas em voz alta, além de aparecerem escritas.",
  },
  {
    campo: "oneTaskAtATime",
    rotulo: "Uma tarefa de cada vez",
    descricao: "A tela mostra só uma coisa para fazer por vez, sem distrações ao lado.",
  },
  {
    campo: "simplifiedInterface",
    rotulo: "Interface simplificada",
    descricao: "Menos elementos na tela — só o essencial para responder.",
  },
  {
    campo: "extraTimeEnabled",
    rotulo: "Tempo extra",
    descricao: "Mais tempo para responder, sem pressa.",
  },
  {
    campo: "reducedMotion",
    rotulo: "Reduzir animações",
    descricao: "Menos movimento na tela, mantendo a devolutiva de cada resposta.",
  },
  {
    campo: "highContrast",
    rotulo: "Alto contraste",
    descricao: "Cores mais fortes entre texto e fundo, para enxergar com mais facilidade.",
  },
  {
    campo: "dyslexiaFont",
    rotulo: "Fonte de leitura facilitada",
    descricao: "Troca o tipo de letra do texto por um desenhado para ser mais fácil de ler.",
  },
  {
    campo: "captionsEnabled",
    rotulo: "Legendas",
    descricao: "Textos narrados também aparecem escritos na tela.",
  },
  {
    campo: "soundEnabled",
    rotulo: "Sons do jogo",
    descricao: "Efeitos sonoros ao acertar, errar e navegar.",
  },
  {
    campo: "musicEnabled",
    rotulo: "Música de fundo",
    descricao: "Trilha sonora tocando enquanto a criança joga.",
  },
  {
    campo: "aiTutorEnabled",
    rotulo: "Tutor de IA",
    descricao: "A criança pode pedir ajuda a um tutor virtual durante as atividades.",
  },
];
