# 07 — Componentes Reutilizáveis e Contratos

Regra geral: **componente não busca dado e não conhece regra de negócio.** Ele recebe props tipadas.
Quem busca é a rota (RSC) ou um container do módulo. Isso mantém o DS testável, reutilizável e
livre de acoplamento (SRP + DIP na camada visual).

## 1. Hierarquia

```
design-system/primitives   → sem domínio, reutilizável em qualquer produto
design-system/game         → conhece conceitos genéricos (xp, moeda, nó de mapa), não conhece módulos
modules/<x>/presentation   → conhece o domínio de X, compõe os dois acima
app/**                     → só compõe e passa dados
```

## 2. Primitivos (base shadcn + tokens Aurora)

| Componente | Variantes | Observações |
|---|---|---|
| `Button` | `primary · secondary · ghost · danger · play` | `play` = maior, com brilho e som; alvo ≥ 56px |
| `IconButton` | idem | `aria-label` obrigatório (tipo exige) |
| `Input`/`Textarea` | com máscara e voz | integra React Hook Form |
| `Select`/`Combobox` | | teclado completo |
| `Checkbox`/`Radio`/`Switch` | | rótulo clicável obrigatório |
| `Card` | `flat · raised · glass` | `glass` aplica tint de contraste automaticamente |
| `Dialog`/`Sheet`/`Drawer` | | foco preso, `Esc`, restauração de foco |
| `Tabs`/`Accordion` | | ARIA correta |
| `Progress`/`ProgressRing` | | `aria-valuenow` |
| `Toast` | `info · success · warn` | fila máx. 2 simultâneos |
| `Skeleton` | | forma igual ao conteúdo final (evita CLS) |
| `EmptyState`/`ErrorState` | | sempre com ação de saída |
| `DataTable` | | virtualizada, ordenação, exportação (painéis) |

## 3. Componentes de jogo (contratos)

```ts
// Exemplos de contratos — puros, sem fetch
interface XpBarProps { current: number; toNextLevel: number; level: number; gainPreview?: number; }
interface EnergyMeterProps { value: number; max: number; nextRegenAt?: Date; }
interface MapNodeProps {
  state: 'locked' | 'available' | 'inProgress' | 'completed' | 'mastered' | 'boss';
  kind: QuestKind; title: string; stars: 0|1|2|3; onSelect(): void;
}
interface FeedbackBannerProps {
  outcome: 'correct' | 'partial' | 'incorrect';
  teaching: TeachingFeedback;   // OBRIGATÓRIO quando outcome !== 'correct' (união discriminada)
  onContinue(): void;
}
interface RewardBurstProps { rewards: Reward[]; onDone(): void; reducedMotion?: boolean; }
```

`FeedbackBannerProps` é o exemplo do princípio P4 codificado no tipo: **não existe** forma de
renderizar erro sem ensino — o TypeScript recusa.

Lista completa: `SessionHud`, `XpBar`, `LevelBadge`, `EnergyMeter`, `CurrencyChip`, `StreakFlame`,
`MascotStage`, `WorldMap`, `MapNode`, `PathTrail`, `RegionCard`, `QuestCard`, `QuestIntro`,
`StageProgress`, `AnswerTile`, `DragSlot`, `DropZone`, `NumberPad`, `WordBank`, `HintBubble`,
`FeedbackBanner`, `BossHealthBar`, `TimerRing`, `RewardBurst`, `CelebrationOverlay`, `MedalShelf`,
`CollectionGrid`, `AvatarBuilder`, `HouseCanvas`, `ShopCard`, `DailyChallengeCard`, `PauseScreen`.

## 4. Componentes de painel

`MetricTile`, `TrendChart`, `MasteryHeatmap`, `SkillTreeView`, `TimeBudgetGauge`, `InsightCard`,
`EvidenceList`, `LearnerSwitcher`, `GoalTracker`, `WeeklyDigest`, `ReportExportButton`,
`ClassRoster`, `AssignmentBoard`, `SubmissionTable`, `CoverageMatrix` (cobertura BNCC),
`HealthyRankingList`.

Gráficos: biblioteca leve baseada em SVG (Recharts ou visx), sempre com **tabela equivalente**
acessível (`<figure>` + `<table class="sr-only">`) — gráfico sozinho não é AA.

## 5. Renderers de atividade (um por plugin)

Todos implementam a mesma interface, o que permite trocar/adicionar minigames sem tocar na sessão:

```ts
interface ActivityRendererProps<TConfig, TAnswer> {
  config: TConfig;
  ageBand: AgeBand;
  a11y: LearnerA11ySettings;
  onAnswer(answer: TAnswer): void;        // dispara avaliação otimista
  onRequestHint(): void;
  disabled: boolean;                       // durante feedback
}
```

Requisitos de todo renderer (checklist de aceite):
1. Funciona com teclado e com leitor de tela, ou expõe modo alternativo equivalente.
2. Respeita `reducedMotion` e `soundEnabled`.
3. Nenhuma dependência > 30 kB gzip sem ADR; carregado por `next/dynamic`.
4. `evaluate` puro correspondente com 100% de cobertura de teste.
5. Funciona offline (sem chamada de rede durante a interação).
6. Renderiza corretamente de 320px a 1920px, retrato e paisagem.

## 6. Hooks e utilitários compartilhados

| Hook | Função |
|---|---|
| `useOptimisticAttempt` | feedback imediato + reconciliação com o servidor |
| `useSessionEngine` | máquina de estados da missão (etapa, dica, tentativa, resultado) |
| `useSound` | pool de áudio, respeita preferências, pré-carrega |
| `useHaptics` | vibração curta em acerto (quando disponível) |
| `useReducedMotion` | preferência do SO + configuração da criança |
| `useOfflineQueue` | fila IndexedDB + sincronização |
| `useCountdownFriendly` | temporizador sem estética ansiogênica |
| `useLearnerSettings` | contexto de acessibilidade |
| `useServerAction` | estado `pending/error/success` tipado para Server Actions |

Máquina de estados da sessão (XState-like, implementada com reducer tipado):

```
idle → intro → presenting → answering → evaluating
        ↑                        ↓            ↓
        └──── hinting ←── incorrect ←─────────┘
                                 ↓ (sem tentativas)
                              teaching → nextStage | result
```

## 7. Padrões de composição

- **Slots, não flags booleanas.** `<QuestCard media={...} footer={...}/>` em vez de `hasMedia`.
- **Compound components** para grupos (`Tabs.Root/List/Trigger/Content`).
- **Zero prop drilling** além de 2 níveis: acima disso, contexto do módulo.
- **Server Components por padrão**; `"use client"` apenas na folha que precisa de interatividade
  (o mapa é servidor; o nó clicável é cliente).
- **Nenhum componente duplicado**: antes de criar, buscar no Storybook. Duplicata detectada em
  review é bloqueio de merge.
