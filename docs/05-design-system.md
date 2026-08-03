# 05 — Design System "Aurora"

Um único sistema serve três públicos muito diferentes (criança, responsável, professor). A solução
não é três designs: é **um sistema de tokens com três modos de superfície**.

| Modo | Onde | Caráter |
|---|---|---|
| `play` | área da criança | mundo, cor saturada, movimento, profundidade, glass |
| `care` | painel dos pais | calmo, denso em dado, alto contraste, movimento discreto |
| `class` | painel do professor | produtivo, tabelas, densidade alta, zero decoração supérflua |

Os três compartilham tokens primitivos; mudam os tokens **semânticos**. Isso evita o pior erro
possível: um painel de pais infantilizado ou uma área infantil "corporativa".

---

## 1. Arquitetura de tokens (3 camadas)

```
Primitivos  →  Semânticos  →  Componentes
  blue-500     surface.raised    button.primary.bg
```

Implementação: tokens em TypeScript (fonte da verdade) → geram CSS custom properties → consumidos
pelo Tailwind via `@theme`. Uma definição, três consumidores, zero divergência (DRY).

```ts
// design-system/tokens/color.ts (conceitual)
export const primitive = { violet: { 50:'#F5F3FF', /* … */ 500:'#8B5CF6', 900:'#4C1D95' }, /* … */ };
export const semantic = {
  play: { 'surface/base':'var(--violet-950)', 'text/primary':'var(--white)', /* … */ },
  care: { 'surface/base':'var(--slate-50)',   'text/primary':'var(--slate-900)', /* … */ },
};
```

---

## 2. Cor

### Marca
| Papel | Cor | Uso |
|---|---|---|
| Primária | **Violeta Aurora** `#7C5CFF` | ações principais, XP, identidade |
| Secundária | **Turquesa** `#22D3EE` | progresso, dicas, tutor |
| Acento | **Âmbar** `#FFB020` | moedas, recompensa, destaque |
| Sucesso | **Verde Folha** `#34D399` | acerto, domínio |
| Atenção | **Coral** `#FB7185` | erro **suave** — nunca vermelho agressivo |
| Neutros | Escala `slate` 50→950 | texto, superfícies |

**Decisão pedagógica:** o feedback de erro usa coral + ícone + microtexto de apoio, nunca vermelho
puro com "X". Vermelho intenso ativa resposta de ameaça e prejudica retenção em crianças.

### Cor por Academia (identidade de mundo)
| Academia | Hue | Gradiente |
|---|---|---|
| Conhecimento | Azul-índigo | `#4F46E5 → #22D3EE` |
| Inteligência | Violeta-magenta | `#7C5CFF → #EC4899` |
| Vida | Verde-esmeralda | `#10B981 → #84CC16` |
| Tecnologia | Ciano-elétrico | `#06B6D4 → #3B82F6` |
| Criatividade | Laranja-rosa | `#FB923C → #F472B6` |
| Descobertas | Turquesa-dourado | `#14B8A6 → #FDE047` |

Cada academia expõe `--academy-from`, `--academy-to`, `--academy-glow`. Trocar de mundo troca
apenas estas variáveis — nenhum componente conhece nomes de academia (Open/Closed no visual).

### Regras de contraste (não negociáveis)
- Texto normal ≥ **4.5:1**, texto grande ≥ 3:1, elementos de UI ≥ 3:1 (WCAG AA).
- **Glassmorphism nunca carrega texto sozinho:** todo painel de vidro tem camada de tint sólido
  (`rgba` do neutro do tema, ≥ 72% de opacidade efetiva) atrás do texto. Um teste automatizado
  calcula contraste dos tokens em CI; token reprovado quebra o build.
- Nada comunicado **só** por cor (acerto/erro sempre têm ícone + forma + texto).
- Paleta validada para deuteranopia, protanopia e tritanopia.

---

## 3. Tipografia

| Papel | Fonte | Uso |
|---|---|---|
| Display / mundo | **Baloo 2** | títulos de missão, números de XP, HUD |
| Interface | **Nunito** | corpo, botões, painéis |
| Dado / código | **JetBrains Mono** | relatórios numéricos, Academia da Tecnologia |
| Acessível | **Atkinson Hyperlegible** (opção) | ativável em `LearnerSettings.dyslexiaFont` |

Carregadas por `next/font` (self-host, `display: swap`, subset latin-ext). Escala fluida:

| Token | SPROUT | EXPLORER | care/class |
|---|---|---|---|
| `text/xs` | 14px | 13px | 12px |
| `text/base` | **20px** | 17px | 15px |
| `text/lg` | 24px | 20px | 17px |
| `display/1` | 44px | 40px | 30px |

Corpo mínimo de **20px** para 6–8 anos e altura de linha 1.6 são requisitos de legibilidade
infantil, não preferência estética.

---

## 4. Espaçamento, raio, elevação

- **Espaço:** escala 4px (`0.5,1,2,3,4,6,8,12,16,20,24`). Alvo de toque mínimo **56×56px** em
  `play` (mão de criança, motricidade em desenvolvimento) e 44×44 em `care`/`class`.
- **Raio:** `sm 8 · md 14 · lg 20 · xl 28 · pill 999`. Área de jogo usa `lg+` — cantos suaves são
  percebidos como amigáveis e reduzem sensação de "formulário".
- **Elevação:** 5 níveis, sombra colorida derivada do hue da academia (`0 8px 24px -6px var(--academy-glow)`),
  nunca preto puro.
- **Glass:** `--glass-blur: 16px`, `--glass-tint`, `--glass-border` — encapsulado no componente
  `<GlassPanel>`; ninguém escreve `backdrop-filter` solto.

---

## 5. Movimento

| Token | Duração | Easing | Uso |
|---|---|---|---|
| `motion/instant` | 80ms | `ease-out` | feedback de toque |
| `motion/quick` | 160ms | `cubic-bezier(.2,.8,.2,1)` | hover, seleção |
| `motion/base` | 260ms | idem | entrada de card, modal |
| `motion/expressive` | 420ms | spring (`stiffness 260, damping 22`) | recompensa, level up |
| `motion/scene` | 650ms | spring suave | transição de mundo |

Regras: nada acima de 700ms bloqueia interação; toda animação é interrompível; `prefers-reduced-motion`
(ou `LearnerSettings.reducedMotion`) troca movimento por *fade* de 120ms — **jamais** remove o
feedback, só a translação/escala. Partículas e confete são limitados a 60 elementos e desligados em
dispositivos com `deviceMemory < 4`.

---

## 6. Componentes do sistema

**Primitivos (base shadcn, re-estilizados):** Button, IconButton, Input, Textarea, Select, Checkbox,
Radio, Switch, Slider, Card, Dialog, Sheet, Drawer, Popover, Tooltip, Tabs, Accordion, Progress,
Avatar, Badge, Toast, Skeleton, Table, Pagination, EmptyState, ErrorState.

**Componentes de jogo (`design-system/game`):**
`XpBar`, `LevelBadge`, `EnergyMeter`, `CurrencyChip`, `StreakFlame`, `MascotStage`, `WorldMap`,
`MapNode`, `PathTrail`, `QuestCard`, `RewardBurst`, `AnswerTile`, `DragSlot`, `FeedbackBanner`,
`HintBubble`, `BossHealthBar`, `MedalShelf`, `CollectionGrid`, `AvatarBuilder`, `SessionHud`,
`ProgressRing`, `TimerRing`, `CelebrationOverlay`.

**Componentes de painel:** `MetricTile`, `TrendChart`, `MasteryHeatmap`, `TimeBudgetGauge`,
`InsightCard`, `LearnerSwitcher`, `ReportSection`, `GoalTracker`, `ClassRoster`, `AssignmentBoard`.

### Estados obrigatórios
Todo componente interativo implementa e tem *story*/teste para: `default · hover · focus-visible ·
active · disabled · loading · error · empty · selected · reduced-motion · RTL-safe`.
Componente sem `focus-visible` visível não passa em review.

---

## 7. Acessibilidade (WCAG 2.1 AA como piso)

- Navegação completa por teclado, inclusive nos minigames (setas + Enter + Espaço); todo minigame
  tem **modo alternativo acessível** documentado no plugin (ex.: labirinto navegável por teclado com
  descrição textual da rota).
- Leitor de tela: landmarks, `aria-live="polite"` para feedback, rótulos em português natural.
- Texto para fala em toda instrução (Web Speech API com fallback de áudio pré-gravado nos conteúdos
  de SPROUT).
- Legendas em todo vídeo/áudio narrativo.
- Sem *timers* que causem ansiedade em conteúdo de aprendizagem; tempo só em minigames de agilidade
  cognitiva, e sempre com opção "sem cronômetro".
- Modo alto contraste e fonte para dislexia por criança.

## 8. Governança do DS

- Storybook com *visual regression* (Chromatic ou Playwright screenshots) — mudança visual não
  intencional quebra o CI.
- Token novo exige justificativa; **valor cru (hex, px) em componente é erro de lint**.
- Todo componente do DS é *server-safe* por padrão; `"use client"` só quando há estado/efeito.
- Ícones: **Lucide** para interface; ilustração e mascote como SVG/Lottie próprios, com `altText`
  obrigatório no `Asset`.
