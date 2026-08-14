# HANDOFF — estado do trabalho

> **Leia este arquivo primeiro, antes de qualquer coisa.**
> Ele existe para que uma nova sessão continue exatamente de onde a anterior parou,
> sem refazer trabalho e sem contradizer decisões já tomadas.
>
> Última atualização: 2026-08-13 · **Etapa 3, passo 3 em curso — o conteúdo encontra o motor**

---

## 1. O que é este projeto

**Crescendo e Aprendendo** — plataforma de desenvolvimento infantil gamificada. A criança
vive uma aventura em sete ilhas do arquipélago **Crescente** e, ao jogar, desenvolve
competências escolares (BNCC), cognitivas, socioemocionais, tecnológicas, criativas,
de vida e de prosperidade.

**Primeira usuária real:** a filha do dono do produto, que está fazendo 7 anos.
Isso define a faixa etária do conteúdo da primeira fase (`SPROUT`, 6–8 anos),
**não o tamanho do sistema** — a decisão explícita do dono foi construir o sistema completo.

**Em produção:** <https://crescendendoeaprendendo.vercel.app> (Vercel + Neon, migration aplicada).

---

## 2. Hierarquia de documentos — leia nesta ordem

| Ordem | Documento | Por quê |
|---|---|---|
| 1º | [`docs/biblia/README.md`](biblia/README.md) | índice da Constituição e tabela de artigos pétreos |
| 2º | [`docs/biblia/volume-1/01-fundamentos.md`](biblia/volume-1/01-fundamentos.md) | os princípios que vetam decisões |
| 3º | [`docs/biblia/volume-1/03-universo.md`](biblia/volume-1/03-universo.md) | o mundo e o **léxico oficial** (§3.5) — vocabulário obrigatório |
| 4º | [`docs/01-arquitetura.md`](01-arquitetura.md) | camadas, módulos, motor de atividades |
| 5º | [`docs/04-modelagem-de-dados.md`](04-modelagem-de-dados.md) | contrato do banco |
| 6º | [`docs/12-roadmap.md`](12-roadmap.md) | ordem de execução técnica |
| 7º | [`docs/13-motor-de-atividades.md`](13-motor-de-atividades.md) | **o motor**: contrato de plugin, conteúdo, guias de extensão |

**A Bíblia Pedagógica é soberana.** Qualquer conflito entre ela e um documento técnico
se resolve a favor da Bíblia. Qualquer pessoa pode recusar uma decisão dizendo
*"isto contraria o Volume 1, Capítulo X"* — e quem propôs é que precisa provar que não contraria.

---

## 3. O que JÁ EXISTE — não refaça

**Etapa 0 concluída.** `npm run verify` verde (126 testes), `npm run test:integration` verde
(4 testes contra Postgres real), `npm run build` verde.

### Fundação
- `package.json` — Next.js 15, React 19, TypeScript, Tailwind 4, Prisma 6, Zod, Vitest, Argon2
- `tsconfig.json` — `strict` + `noUncheckedIndexedAccess`, aliases `@/*`
- `next.config.ts` — `typedRoutes: true` e cabeçalhos de segurança
- `.env.example` — todas as variáveis documentadas, incluindo Resend

### Banco de dados
- **`prisma/schema.prisma` — 45 modelos.** Contrato completo de `docs/04`, 16 bounded contexts.
- `prisma/migrations/` — 3 migrations, todas aplicadas:
  - `..._init` — **53 tabelas, 139 índices, 12 enums**
  - `..._chaves_naturais_de_conteudo` — `sourceRef` em `Activity`/`Chapter`/`Quest` e
    `@@unique([skillId, name])` em `Objective`. Sem chave natural estável, reimportar
    duplicaria atividade — e `Attempt` aponta para `Activity.id`
  - `..._escala_elo_cabe_no_banco` — `Decimal(6,3)` → `(7,3)` em `Activity.difficulty`,
    `Skill.difficultyRef` e `SkillMastery.ability`. A escala Elo do motor usa 800/1000/1200
    e não cabia em 999,999; só apareceu ao rodar a primeira importação de verdade
- Resolvido e **não reabrir sem ADR**: razão contábil (`LedgerEntry`), `idempotencyKey`,
  `pseudonymId` separado do `learnerId`, BKT+Elo, SM-2, `OutboxMessage`, `version`.

### Autenticação — completa (Etapa 0)
Fluxo inteiro funcionando: **cadastro → verificação de e-mail → login → perfil da criança →
PIN → área infantil → saída com PIN.**

- `src/modules/identity/` nas quatro camadas, com `index.ts` como única API pública
  - `domain/` — `Email`, `PlainPassword`, `ParentPin`, `DisplayName`, `GuardianName`,
    `Account`, faixa etária, `avatarConfig` (Zod + `schemaVersion`)
  - `application/` — 10 portas, 11 casos de uso, `policy.ts` com todos os prazos e limites
  - `infrastructure/` — 4 repositórios Prisma, `Argon2Hasher`, rate limiter, mailer, auditoria
  - `presentation/actions.ts` — 7 Server Actions, todas via `createAction`
- `src/composition/identity.ts` — composition root (singleton por instância)
- `src/server/` — `db.ts`, `mailer.ts` (Resend por `fetch`), `session.ts`, `action.ts`
- `src/shared/security/` — `tokens.ts` (geração/hash/`hashIp`), `signing.ts` (HMAC)
- `src/shared/forms/action-state.ts` — estado do formulário, **sem imports** (cliente e servidor)

**Propriedades de segurança já implementadas e testadas** (não relitigar):
resposta idêntica para e-mail inexistente / senha errada / conta excluída · `fakeVerify()`
com o mesmo custo de CPU (anti-enumeração por tempo) · token de sessão de 256 bits guardado
**em hash** · token de verificação de uso único que invalida os anteriores · cadastro com
e-mail existente responde igual e avisa o dono por e-mail · isolamento entre famílias no
`where` da consulta · auditoria sem dado de criança.

### Motor de Atividades — completo (Etapa 1)
**Leia [`docs/13-motor-de-atividades.md`](13-motor-de-atividades.md) antes de mexer aqui.**

- `src/activities/` — núcleo puro e isomórfico: `contracts.ts`, `registry.ts`, `difficulty.ts`,
  `rewards.ts`, `presentation.ts`, `session.ts`, `telemetry.ts`
- `plugins/multiple-choice/`, `plugins/order-sequence/` e `plugins/drag-match/` — o segundo prova
  extensibilidade de resposta em lista com crédito parcial; o terceiro prova correspondência
  um-para-um (pareamento) — nenhum tocou no núcleo (ver "Plugin DRAG_MATCH", nesta seção)
- `plugins/index.ts` e `renderers/index.tsx` — **os dois únicos manifestos** que ganham uma linha
  por tipo novo
- `renderers/` — telas carregadas sob demanda (`next/dynamic`), fora do núcleo
- `renderers/feedback-visual.tsx` — animação e efeito (confete, faíscas, onda de luz) em CSS,
  suprimidos por `prefers-reduced-motion`
- `content/` — acervo como dado: `schema/` (Zod de autoria), `loader.ts`, currículo BNCC de
  demonstração e a missão `missao-01-a-contagem-da-orla` (3 atividades)
- `scripts/validate-content.ts` — `npm run content:validate`, roda no CI
- Rota jogável: `(play)/missao/[slug]` com correção **no servidor**

**Feedback sensorial ligado:** animação por tom, efeito de partícula, tempo de leitura
(`segurarSegundos` trava só o botão, nunca o texto), `mostrarProgresso` e `mostrarPremio`.
**Som não toca** — ver §4.

**Propriedades travadas (não relitigar):**
resultado incorreto sem `ensino` **não compila** (união discriminada) · núcleo não importa React,
Next, Prisma nem `src/modules` (dependency-cruiser) · plugin não importa plugin · `evaluate` é
puro · telemetria não tem campo para `learnerId` · sem Fôlego a criança perde moeda, nunca XP ·
nenhuma informação existe só como movimento, som ou cor.

### Importador de conteúdo — concluído (Etapa 2, passo 1)
`content/` (git) → Postgres. É o que faz `Attempt` ter um `Activity.id` para referenciar.

- `src/modules/content/` nas quatro camadas
  - `domain/plan.ts` — **função pura**: acervo → plano de linhas. Todo o mapeamento é
    testável sem banco, e é onde moram os erros sutis de importação
  - `application/` — porta `EscritorDeConteudo` e caso de uso `importarConteudo`
  - `infrastructure/prisma-content-writer.ts` — `upsert` por chave natural, uma transação
- `src/composition/content.ts` — composition root
- `scripts/import-content.ts` — `npm run content:import` (`-- --forcar` só para diagnóstico)
- `tests/integration/content-import.integration.test.ts` — 6 testes contra Postgres real

**Correspondência entre autoria e banco** (decidida, documentada em `domain/plan.ts`):
competência → `Strand` · objetivo → `Skill` (é o objetivo que carrega código BNCC e
pré-requisito) · `Objective` sintético 1:1 · nível → `World` · módulo → `Chapter` ·
missão → `Quest` · fase → `Stage` · atividade → `Activity` + `StageActivity`.

**Propriedades travadas (não relitigar):**
importação é **tudo-ou-nada** — referência que não fecha não grava nada, porque acervo meio
importado trava a criança numa tela sem saída · é **idempotente** — reimportar preserva
`Activity.id`, e isso é o que protege o histórico de quem já jogou · nada é apagado —
despublicar é decisão editorial separada.

### Importação automática de conteúdo no deploy — concluída
Resolve a decisão em aberto que existia desde a Etapa 2: `npm run content:import` continuava
manual porque publicar em todo deploy escreveria no banco de produção a partir de deploy de
*preview* — hoje não há banco efêmero por branch, `preview` e `production` apontam para o mesmo
`DATABASE_URL` (`docs/01-arquitetura.md §7` descreve branch do Neon por ambiente como destino;
não é a configuração real deste projeto na Vercel hoje).

Foi um bug real que forçou a decisão: a tela de produção ficou meses mostrando uma pergunta sem
as conchas que ela descreve — o código já tinha o conserto (commit `c1737d9`), mas ninguém rodou
`content:import` contra produção depois de mudar o `content/`.

- `scripts/import-content-em-producao.mjs` — só chama `npm run content:import` quando
  `VERCEL_ENV === "production"`; qualquer outro valor (`preview`, `development`) ou ausência da
  variável (build local, CI) **pula com um aviso explicado no log**, nunca falha o build por
  causa disso
- `package.json` — `vercel:steps` ganhou o passo entre `prisma migrate deploy` e `next build`

**Propriedades travadas (não relitigar):**
a falta de `VERCEL_ENV` **pula a importação**, nunca assume produção — a direção do erro que
importa aqui é "na dúvida, não publica" (o oposto de `custoDeFolego`/`lerRegraDeDesbloqueio`, que
preferem liberar na dúvida — lá o custo de errar é a criança perder algo grátis; aqui é escrever
no banco real por engano) · falha do `content:import` em produção **derruba o build** — conteúdo
quebrado não é publicado pela metade, o mesmo motivo de a importação já ser tudo-ou-nada · `npm
run content:import` continua existindo e funcionando igual, para publicar fora do deploy (ex.:
depois de uma migration de dados manual).

**Armadilha:** `VERCEL_ENV` é injetada pela Vercel automaticamente, sem configuração — mas nunca
foi vista, de dentro desta sessão, batendo contra um deploy de produção de verdade. Se depois do
primeiro deploy o log mostrar "content:import pulado" **em produção**, é o primeiro lugar para
olhar (Project Settings → Environment Variables, ou confirme com `vercel env ls` autenticado).

### Avaliação — concluída (Etapa 2, passo 2)
A resposta da criança agora vira histórico, modelo e evento. O ciclo está fechado.

- `src/modules/assessment/` nas quatro camadas
  - `domain/bkt.ts` — Bayesian Knowledge Tracing com os parâmetros de `docs/08 §2`
  - `domain/elo.ts` — habilidade na escala Elo, com trilhos em [400, 2400]
  - `domain/spaced-repetition.ts` — SM-2 adaptado (teto de 120 dias; qualidade derivada do
    desfecho e das dicas, nunca perguntada à criança)
  - `domain/mastery.ts` — junta os dois e decide **quando declarar domínio**
  - `domain/events.ts` — dois tópicos, por necessidades incompatíveis (ver travadas abaixo)
  - `domain/attempt-plan.ts` — **função pura**: contexto + resultado → plano de escrita
  - `application/` — portas `RepositorioDeAvaliacao` e caso de uso `submeterTentativa`
  - `infrastructure/prisma-assessment-repository.ts` — uma transação `READ COMMITTED`
- `src/composition/assessment.ts` — composition root
- `src/server/action.ts` — **passo 5 de `docs/09 §4` implementado**: `idempotente: true` exige
  e valida `chaveDeIdempotencia`, entregue em `ctx.idempotencyKey`
- `app/(play)/missao/[slug]/` — a ação chama `submeterTentativa`; o cliente gera a chave
- `tests/policy/avaliacao.test.ts` — §12.2, §12.7, §11 e §5.2 como testes que quebram o build
- `tests/integration/submit-attempt.integration.test.ts` — 10 testes contra Postgres real
- Migration `20260804120000_versao_em_skillmastery` — `SkillMastery.version`

**Propriedades travadas (não relitigar):**
`submitAttempt` grava `Attempt`, `SkillMastery`, `ReviewCard` e as mensagens de outbox **numa
transação só** · a linha de `SkillMastery` usa **atualização condicional por `version`**, e
conflito faz **reler e recalcular** (nunca reenviar o plano) · **pular não é errar** — grava a
tentativa, não move domínio nem revisão · **domínio alcançado nunca é retirado**; quem decai é a
probabilidade, com piso 0.5 · a **sequência de acertos só conta atividade no nível de referência
ou acima** — sem isso o sistema promoveria a criança pelo que ela já sabia · o prêmio usa a
habilidade **de antes** da tentativa · **dois tópicos de outbox**: o interno leva `learnerId`
(progressão e economia precisam), o de telemetria leva só `pseudonymId` e o tipo não tem o campo
· `assessment` **calcula** o prêmio e **não credita nada**.

### Progressão, economia e entrega de efeitos — concluídas (Etapa 2, passo 3)
O ciclo fecha na tela: a criança responde, a Luz sobe, as Fagulhas entram na carteira.

- **`src/shared/kernel/unit-of-work.ts`** — `Transacao` (handle opaco) e
  `UnidadeDeTrabalho`. Resolve a tensão entre `docs/08 §11` (XP e carteira na **mesma
  transação** da tentativa) e `docs/01 §2` (módulos não se chamam): o caso de uso abre uma
  transação, e quem reage ao evento escreve dentro dela sem conhecer os outros módulos.
- **`src/server/unit-of-work.ts`** — implementação Prisma. **Único lugar** que sabe que uma
  `Transacao` é um `Prisma.TransactionClient`; dois `as unknown as` e mais nada.
- **`src/server/event-bus.ts`** — roda os manipuladores `inline` e grava o outbox, na mesma
  escrita. Nenhum evento sai pelos dois caminhos.
- **`src/modules/progression/`** — Luz, nível, tier, Fôlego, Trilha de Luz, desbloqueios.
  Manipulador `inline` de `assessment.attempt_evaluated`.
- **`src/modules/economy/`** — razão contábil (`LedgerEntry`) e projeção (`Wallet`).
  Manipulador `inline`. Chave derivada da chave da tentativa.
- **`src/server/outbox.ts`** — despachante at-least-once, com backoff e teto de tentativas.
- **`src/server/telemetry.ts`** — `LearningEvent` a partir do tópico pseudonimizado. `outbox`.
- **`app/api/outbox/route.ts`** + `vercel.json` — Cron Job 1x/dia (plano Hobby; ver seção 5, item
  4), **fail-closed**.
- **`app/(play)/hub/painel-de-progresso.tsx`** — Luz, nível, Fagulhas, Fôlego e Trilha na base.
- `tests/policy/progressao-e-economia.test.ts` — §1, §4, §5, §11 e §12 quebram o build.

**Propriedades travadas (não relitigar):**
XP e carteira são gravados **na mesma transação da tentativa**, nunca pelo outbox — pelo outbox,
a criança terminaria a atividade e não veria nada acontecer · **Luz nunca diminui e o nível nunca
desce**; o nível é sempre recalculado do total de Luz, então coluna divergente se corrige sozinha
· **responder nunca gasta Fôlego** — não existe função `gastar` no módulo, e há teste de política
guardando a ausência · o **recorde da Trilha de Luz é preservado** quando a sequência cai, e a
sequência recomeça em **1**, nunca em zero · a Trilha avança **mesmo sem prêmio**: mede presença,
não pontuação · **saldo nunca negativo** e lote de lançamentos é tudo-ou-nada · **nenhuma moeda se
compra com dinheiro real** (teste de política procura por `stripe`, `checkout`, `pagamento`…) ·
o outbox só recebe mensagem de tópico que tem consumidor `outbox` — mensagem que ninguém lê
destruiria a métrica de fila pendente.

### Missão como unidade — concluída (Etapa 3, passo 1)
Abrir, retomar e fechar uma jogada. **Fechar o app não custa mais progresso.**

- `src/modules/quest/` nas quatro camadas
  - `domain/quest-run.ts` — posição da retomada e conclusão, **derivadas das
    tentativas gravadas**, não de uma coluna de posição que pode divergir
  - `domain/energy-cost.ts` — tabela de `docs/08 §4` por `QuestKind`
  - `domain/events.ts` — `quest.started` e `quest.completed`
  - `application/play-quest.ts` — `abrirJogada` (cria **ou retoma**) e `concluirJogada`
  - `application/advance-run.ts` — manipulador `inline` que faz a corrida acompanhar
    as respostas, reagindo a `assessment.attempt_evaluated`
- `src/modules/progression/application/quest-handlers.ts` — cobra o Fôlego ao iniciar,
  credita a recompensa e **avança a Trilha de Luz** ao concluir
- `src/modules/economy/application/credit-quest.ts` — moeda da missão
- `app/(play)/missao/[slug]/` — tela de abertura, retomada e conclusão pelo servidor
- `tests/integration/quest.integration.test.ts` — 10 testes contra Postgres real

**Propriedades travadas (não relitigar):**
**iniciar e retomar são a mesma operação** — pedir para jogar devolve a corrida em andamento
se ela existir; separá-las jogaria a decisão para a tela, e um refresh cobraria Fôlego de novo ·
**retomar não custa Fôlego**; cobrar de quem volta ensinaria a criança a não fechar o app ·
a **posição da retomada vem das tentativas**, nunca de estado do cliente · **quem decide que a
missão acabou é o servidor**, contando respostas — sem isso um toque forjado concederia
`Quest.rewardXp` sem nenhuma resposta · **responder não é acertar**: "seguir em frente" é sempre
possível, então exigir acerto tornaria a missão impossível de terminar para quem mais precisa ·
a recompensa é concedida **uma vez por jogada** (`rewardsGrantedAt` em atualização condicional) ·
a cobrança de Fôlego **nunca recusa** — piso em zero, e sem Fôlego a missão abre do mesmo jeito ·
**a Trilha de Luz anda ao concluir a missão**, não ao responder (`docs/08 §6` — a divergência
anterior foi corrigida) · abrir é uma **ação**, não efeito de render: o Next pré-carrega links, e
iniciar no render cobraria Fôlego de missões nunca jogadas.

### Desbloqueio e mapa — concluídos (Etapa 3, passo 2)
A base deixou de listar arquivos e passou a mostrar o arquipélago — com tranca **e caminho**.

- `src/modules/quest/domain/unlock-rule.ts` — a gramática de `docs/08 §3`
  (`all`/`any`/`level`/`questCompleted`/`masteryAvg`) e o avaliador. **Devolve o que falta**,
  não um booleano
- `src/modules/quest/application/map.ts` — o mapa da criança: mundos → capítulos → missões,
  cada uma com jogabilidade, pendências, `concluida` e `emAndamento`
- `src/modules/quest/infrastructure/prisma-map-reader.ts` — a árvore inteira numa consulta
- `app/(play)/hub/mapa.tsx` — as pendências viram frases ("Chegue ao nível 12 — você está no 8")
- `content/schema/index.ts` — o campo `desbloqueio` passou de `z.unknown()` para a gramática
  real, **importada** do módulo que a avalia
- `tests/policy/progressao-e-economia.test.ts` — §3 entrou nos testes que quebram o build

**Propriedades travadas (não relitigar):**
o avaliador devolve **pendências estruturadas**, e a frase nasce na apresentação — o domínio diz
*o que* falta, a tela sabe *para quem* está falando · **regra ausente ou irreconhecível libera**:
na dúvida entre travar e liberar, liberar erra menos (um conteúdo liberado cedo custa uma missão
fora de hora; um travado por engano custa uma criança parada sem saber por quê) · **a tranca vale
no servidor**, em `abrirJogada` — sem isso o cadeado seria decoração · **uma jogada já aberta não
é interrompida** por regra nova · **concluída não tranca**: rejogar para praticar é livre ·
`any` sem saída mostra **um** caminho, o mais curto — listar todos faria a criança achar que
precisa de todos · **Colosso exige domínio nas competências do capítulo mesmo sem regra escrita**
(0.75), senão o primeiro chefão sem o campo preenchido viraria chefão de enfeite · competência
sem registro conta **zero** na média, nunca é ignorada · a gramática vive **num lugar só**, e a
autoria a importa.

### Seleção adaptativa de slot — concluída (Etapa 3, passo 3, item 1)
O primeiro dos três fios soltos da Etapa 3 passo 3 (`docs/08 §7`). `StageActivity` com
`activityId` nulo agora se transforma numa atividade de verdade ao abrir a jogada — e continua
sendo a mesma atividade em toda retomada.

- `src/modules/quest/domain/slot-rule.ts` — `RegraDeSlot`, união discriminada por `modo`:
  `{ modo: "objetivo", objectiveId, difficultyDelta }` (este item) e `{ modo: "revisao" }` (item 2,
  abaixo). `src/modules/quest/infrastructure/slot-rule-json.ts` lê o `Json` da mesma forma que
  `unlock-rule-json.ts`, mas a direção do erro é a oposta: regra irreconhecível **não libera
  nada** — o slot só some da missão
- `src/modules/quest/domain/quest-run.ts` — `DadosDaMissao.slotsPendentes` (vazio em toda missão
  autorada de hoje, porque `content/` ainda não tem sintaxe para declarar um slot — ver §4)
- `src/modules/quest/domain/slot-resolution.ts` — puro: `agruparSlotsPendentes` (só modo
  `objetivo`; mesmo objetivo + mesmo `difficultyDelta` cai no mesmo pedido de seleção),
  `slotsDeRevisaoPendentes` (só modo `revisao`), `faixaCompativel` (ordinal de `AgeBand`) e
  `mesclarAtividades` (junta fixa e slot resolvido numa sequência só, qualquer que seja o modo)
- `src/modules/quest/application/resolve-slots.ts` — `resolverSlotsDaMissao`: lê o que já foi
  resolvido, resolve o que falta (um caminho por modo — ver item 2) chamando
  `seletorPorProximidade` (`src/activities/difficulty.ts`), e grava. Chamado em `abrirJogada`,
  `concluirJogada` e `criarAvancoDaCorrida` — as três leituras de `missao.atividades` que
  precisavam do slot cheio
- `src/modules/quest/application/ports.ts` — `RepositorioDeSlots` (contexto da criança, candidata
  por objetivo, vistas nas últimas 48h, resolver e ler de volta — mais os dois métodos do item 2)
- `src/modules/quest/infrastructure/prisma-slot-repository.ts` — a implementação; lê `Learner`,
  `Objective`→`SkillMastery` (de `assessment`) e `Activity`, porque infraestrutura pode
- **`QuestRunSlot`** (migration `20260806223110_slot_dinamico_de_missao`) — a resolução gravada,
  chave `(questRunId, stageId, order)`
- `src/modules/quest/domain/slot-resolution.test.ts`, `application/resolve-slots.test.ts` —
  puros e com dublê. `tests/integration/slot-selection.integration.test.ts` — Postgres real, com
  árvore de conteúdo própria (o acervo de demonstração não tem slot do modo `objetivo`)

**Propriedades travadas (não relitigar):**
a resolução é gravada na primeira abertura e **nunca recalculada** — retomar com a habilidade já
diferente não pode trocar a atividade que a criança já estava vendo, senão a posição da retomada
(que conta `Attempt` por `activityId`) perde o sentido · **habilidade ausente usa o centro da
escala** (`ELO.centro`, 1000), nunca lança erro · `difficultyDelta` desloca a **habilidade** antes
do alvo (`habilidade + 60` continua sendo o cálculo do seletor), na mesma unidade Elo de "reduzir
alvo em 100" (`docs/08 §7.6`) · **decisão de mesclagem**: o slot resolvido entra ao final da fase,
nunca na posição declarada em `StageActivity.order` — preservar a posição exata exigiria carregar
a ordem de cada atividade fixa também, e nenhum conteúdo intercala hoje · slot com regra
irreconhecível, sem criança encontrada ou sem candidata **nunca lança exceção** — só não entra na
missão, e é tentado de novo na próxima abertura · duas abas resolvendo o mesmo slot ao mesmo
tempo não é corrida perigosa: `createMany` com `skipDuplicates` mais leitura de volta garante que
as duas saiam com a mesma resposta · a mesma atividade não repete dentro da mesma missão (fixa ou
slot de outro grupo).

> ⚠️ **Achado importante, dos dois itens acima**: o motor resolve o slot e grava certo — provado
> pelos testes de integração —, mas **a tela de jogo ainda não consegue exibir uma atividade
> resolvida por slot**. Ver o alerta grande em §4, "a UI real não toca em slot". Enquanto isso não
> for corrigido, os dois modos só são jogáveis pela camada de aplicação (o que os testes de
> integração exercitam), não pelo navegador.

### Fila de revisão — concluída (Etapa 3, passo 3, item 2)
`ReviewCard.dueAt` é escrito a cada tentativa desde a Etapa 2 e ninguém lia. Agora existe uma
missão que lê: "Fila de Revisão", do modo `revisao` do slot, preenchida com a competência mais
vencida da criança — e cada resposta ainda atualiza o SM-2 normalmente, fechando o ciclo.

- `src/modules/quest/domain/slot-rule.ts` — modo `{ modo: "revisao" }`: sem objetivo declarado,
  porque quem escolhe é a fila, não o conteúdo
- `src/modules/quest/domain/slot-resolution.ts` — `slotsDeRevisaoPendentes`
- `src/modules/quest/application/resolve-slots.ts` — cada slot de revisão pendente recebe uma
  competência da fila vencida (`filaDeRevisaoVencida`, ordenada por `dueAt` — a mais vencida no
  primeiro slot livre), busca candidata por **competência** (`candidatasPorCompetencia`, porque a
  fila não sabe qual objetivo específico, só a competência) e **não aplica a exclusão de 48h**
  (docs/08 §7.2 isenta o item vencido — é o próprio ponto de revisar)
- `src/modules/quest/application/ports.ts` — `ItemDaFilaDeRevisao`, e os dois métodos novos de
  `RepositorioDeSlots`: `filaDeRevisaoVencida` e `candidatasPorCompetencia`
- **A missão "Fila de Revisão" não vem de `content/`** — vem de uma migration de dados
  (`prisma/migrations/20260806234721_fila_de_revisao_fixture`): `Academy` "sistema" → `World` →
  `Chapter` → `Quest` (`kind: REVIEW`, `sourceRef: "sistema/fila-de-revisao"`, 20 XP, 5 moedas) →
  `Stage` → 5 `StageActivity` (todas slot, modo `revisao`). Não é conteúdo pedagógico autorado —
  é dado de sistema, e por isso não segue o caminho do importador (docs/HANDOFF.md, esta seção)
- `src/modules/quest/infrastructure/prisma-map-reader.ts` — a academia "sistema" é excluída da
  lista de ilhas do mapa (`where: { academy: { slug: { not: "sistema" } } }`): é prateleira, não
  ilha
- `tests/integration/review-queue.integration.test.ts` — Postgres real. `garantirFixtureDeRevisao`
  refaz a fixture por `upsert` no `beforeAll`, porque os outros arquivos de integração apagam a
  tabela `Quest` inteira nos próprios `beforeAll`/`afterAll` (rebuild do acervo a partir de
  `content/`) — e esta fixture, ao contrário do acervo, não é reimportável

**Propriedades travadas (não relitigar):**
custo de Fôlego continua 3 (`CUSTO_DE_FOLEGO.REVIEW`, docs/08 §4 "3 por revisão") — não criei um
`QuestKind` novo para isto; **cada slot de revisão busca uma competência diferente da fila** —
`filaDeRevisaoVencida` já devolve uma linha por competência, então dois slots nunca competem pela
mesma · **slot de revisão e slot de objetivo compartilham a lista de atividades já usadas na
missão** — a mesma atividade não sai duas vezes mesmo que os dois modos apontem para a mesma
competência · fila mais curta que os slots disponíveis deixa slot sem dono, sem erro — o mesmo
destino de sempre · fila vazia (nada vencido) abre a missão sem nenhuma atividade — ver a
consequência disso, abaixo.

**Decisões em aberto — precisam do dono:**
1. **Tamanho da fila (5 slots) e recompensa (20 XP, 5 moedas)** são valores razoáveis, não
   calibrados — não há especificação numérica em `docs/08` para uma sessão de revisão dedicada
   (só para item individual: "5 XP" por item em dia). Ajustar é editar a migration com uma nova
   migration de dados (`UPDATE`), já que a fixture não vem de `content/`.
2. **Abrir a fila sem nada vencido cobra Fôlego e abre uma jogada sem nenhuma atividade**, que
   nunca conclui (`missaoConcluida` exige `atividades.length > 0`). Não é bug do motor — é a
   ausência do card de hub que só mostraria o botão quando a fila não estiver vazia (ver §4). Até
   esse card existir, quem chamar `abrirJogada("sistema/fila-de-revisao")` precisa checar a fila
   antes.

### O conteúdo encontra a tela — concluído (Etapa 3, passo 3, item 0)
O alerta que abria a seção 4 desde a etapa anterior: o motor resolvia o slot certo, mas a criança
nunca via — `content-bridge.ts` só lia `content/` do disco, e a Fila de Revisão nem tinha onde
ser encontrada. Verificado em navegador de verdade (Playwright, sessão completa: cadastro →
verificação → criança → PIN → missão real do início ao fim → Fila de Revisão do início ao fim,
com `ReviewCard` fechando o ciclo do SM-2 na tela — screenshots na sessão, não versionados).

- `src/activities/content-bridge.ts` — `carregarMissaoParaSessao(slug, learnerId?)`. **`learnerId`
  é opcional de propósito**: sem ele, a função nunca toca o banco — é o caminho que
  `tests/motor/jornada-da-missao.test.ts` (suíte rápida, sem Postgres) continua exercitando, e é
  a prova de que o motor não ganhou uma dependência nova. Com ele:
  - busca a árvore `Quest`/`Stage`/`StageActivity` (por `sourceRef`, ou por sufixo de `slug`
    quando a missão não existe em `content/`)
  - sem slot pendente na árvore, devolve a missão de `content/` sem mudar nada (caminho rápido,
    zero risco para as três atividades que já existem)
  - com slot, busca a jogada mais recente da criança, lê `QuestRunSlot` e completa cada fase com
    a atividade resolvida — **slug sintético** (`Activity.id`, porque nunca existiu slug de
    autoria) e `ref` real (`Activity.sourceRef`, o que `submeterTentativa` precisa para achá-la)
  - sem `content/` nenhum (a Fila de Revisão), monta a missão inteira do banco:
    `narrative.introducao/conclusao` viram texto, cada `Stage` vira uma fase (sem slug/nome
    próprios — `Stage` não guarda isso — sintéticos, nunca lidos por ninguém)
- `app/(play)/missao/[slug]/page.tsx` — resolve a sessão (mesmo padrão de `/hub`) e passa
  `learnerId` ao bridge
- `app/(play)/missao/[slug]/actions.ts` — `abrirMissaoAction` relê a missão **depois** de
  `abrirJogada` (é só aí que um slot criado agora tem atividade) e devolve `missao` no payload;
  `concluirMissaoAction` e `responderAtividadeAction` passam `learnerId`
- `app/(play)/missao/[slug]/missao-runner.tsx` — `missaoAtual` (estado) substitui a `missao`
  (prop) assim que `abrirMissaoAction` devolve a versão resolvida; a ordem dos dois primeiros
  `if` foi invertida — **abertura antes de "sem atividade"** — porque antes do primeiro
  "Começar" `missaoAtual.fases` pode estar vazia (a Fila de Revisão sempre começa assim), e
  checar isso primeiro mostraria "missão concluída" para quem nunca jogou

**Propriedades travadas (não relitigar):**
sem `learnerId`, `carregarMissaoParaSessao` **nunca** consulta o banco — é a garantia que mantém
o motor testável sem infraestrutura · missão sem slot é **byte a byte** o que já existia antes
desta mudança (testado: `comLearner` e `semLearner` são `toEqual`) · atividade resolvida por
slot nunca ganha `recompensa` própria (o banco não guarda essa regra — é conceito só de
autoria); a criança ainda ganha domínio (BKT/Elo/`ReviewCard`) e o prêmio de missão ao concluir,
só não ganha XP por aquela resposta isolada · a resolução do slot acontece **dentro** de
`abrirJogada` (chamado pela ação), nunca no render da página — `abrir é uma ação` continua valendo
inteiro.

**Armadilha nova, registrada em §9**: rodar `npm run test:integration` contra um Postgres que
também tem a fixture da Fila de Revisão pode apagá-la — os arquivos de integração mais antigos
limpam `Quest`/`Academy`/etc. sem filtro. Nunca aconteceria em produção (a suíte não roda no
deploy), mas apagou a fixture deste ambiente de teste duas vezes durante esta sessão.

### Mais conteúdo em Números até 10 — duas missões novas
Pedido do dono: mais tarefas, mais lúdico. `modulo-01-numeros-ate-10` tinha só uma missão (3
atividades) — agora tem três (9 atividades), encadeadas por `desbloqueio: { questCompleted }` na
mesma ordem em que a criança joga, dando continuidade à história da ORLA pela praia.

- `missao-02-os-caranguejos-da-mare.json` — contar (🦀 × 6), comparar (🦀 vs ⭐) e **ordenar
  decrescente** (novidade: a missão 1 só tinha ordem crescente; `ordenar-numeros-ate-10` cobre os
  dois sentidos desde o currículo).
- `missao-03-o-recife-dos-peixinhos.json` — mesma estrutura, números mais altos (até 10) e 5 itens
  na ordenação em vez de 4.
- Cada `desbloqueio` aponta para o `sourceRef` da missão anterior
  (`conhecimento/matematica/SPROUT/nivel-01/modulo-01-numeros-ate-10/missao-0N-...`).

**Verificado em navegador de verdade** (Playwright): cadastro → criança → as três missões jogadas
em sequência, confirmando que a 2 e a 3 aparecem bloqueadas no mapa até a anterior terminar, que
o apoio visual renderiza em cada uma, e que a tela final mostra a recompensa certa.

**Achado, não corrigido (fora de escopo desta mudança):** a mensagem de bloqueio no mapa
(`app/(play)/hub/mapa.tsx`, `descrever()`) mostra o *slug* da missão pendente deslugificado
("termine antes: missao 02 os caranguejos da mare"), não o `nome` autorado ("Os Caranguejos da
Maré") — o comentário no código já reconhece isso ("slug de arquivo não é texto de criança").
Corrigir exige o avaliador de desbloqueio carregar o `nome` da `Quest` referenciada, não só o
`ref`; ficou visível agora porque antes só havia uma missão, então a pendência nunca aparecia.

### Sistema de figurinhas — concluído
Pedido do dono, continuação do mesmo "mais lúdico": `Premio.colecionaveis` (`src/activities/
rewards.ts`) já existia desde a sessão anterior, mas era um código opaco que não ia a lugar
nenhum — nada persistia, nada mostrava. Agora existe de ponta a ponta.

- **`prisma/migrations/…_colecionaveis`** + **`…_colecionaveis_na_missao`** — `Collectible`
  (catálogo) + `LearnerCollectible` (posse, chave composta `learnerId, collectibleId` — é ela
  que garante a idempotência, não uma checagem em código) espelhando exatamente o par
  `Achievement`/`LearnerAchievement` que já existia. `Quest` ganhou `rewardCollectibles
  String[]`.
- **`content/colecionaveis.json`** — catálogo autorado (`code`, `nome`, `simbolo` emoji — mesma
  decisão de `stimulus.ts`: zero upload de asset). Validado em `content/loader.ts`: todo `code`
  citado numa `colecionaveis` de missão ou atividade **precisa** existir aqui, senão
  `content:validate` falha. Publicado por `content:import` como qualquer outro conteúdo.
- **`src/modules/collection`** — módulo novo. `domain/gallery.ts` (puro): `montarGaleria`
  cruza catálogo com o que a criança já ganhou, e **esconde nome e símbolo de quem ainda não foi
  descoberto** (o tipo é união discriminada por `descoberta`; não sobra nem `undefined` de nome
  no objeto). `application/grant-collectibles.ts` — dois manipuladores **inline**
  (`assessment.attempt_evaluated` e `quest.completed`), registrados em
  `src/composition/assessment.ts` junto dos de progressão/economia.
- **`app/(play)/colecao`** — a tela. Link a partir do `/hub` ("Sua coleção"). Grade com a
  figurinha revelada (emoji + nome) ou um "❔ Ainda não descoberta" para quem falta.

**Por que inline, e não outbox (como conquista, que ainda nem existe).** O outbox agora só
desperta 1x/dia (`vercel.json`, decisão desta mesma sessão — ver "Cron do outbox" em §5). Um
efeito que a criança precisa ver *na hora* — a figurinha aparecendo depois de vencer o desafio —
não pode esperar até 24h. Achievements (`Achievement`/`LearnerAchievement`, item 3 da seção 5)
podem continuar `outbox` quando forem escritos: reconhecimento que chega um pouco depois ainda é
reconhecimento; figurinha que demora um dia inteiro para "aparecer" não é o que a criança
experimentou ao ganhar.

**Achado corrigido no caminho, não cosmético:** `recompensaDaMissao.colecionaveis` (autoria) nunca
tinha chegado ao banco — `plan.ts`/`prisma-content-writer.ts` só extraíam `xp`/`moedas`/`cristais`
de `Quest`, e `PremioDaMissao` (o evento `quest.completed`) nem tinha o campo. As três missões
desta sessão declaram colecionável **na missão**, não na atividade — sem esse conserto, "Concha
da Orla", "Caranguejo da Maré" e "Peixinho do Recife" nunca teriam sido concedidos a ninguém, silenciosamente. `Quest.rewardCollectibles` fecha esse caminho.

**Verificado em navegador de verdade** (Playwright): álbum com as 3 figurinhas como "❔" antes de
jogar → missão 1 completa → `/colecao` mostra "1 de 3" com "Concha da Orla" revelada (emoji +
nome).

**Propriedades travadas:** `Collectible.code` é a mesma chave natural declarada em `content/` —
nunca o `id` opaco do banco, para o motor de atividades continuar sem saber o que é uma
figurinha · conceder um `code` que não existe no catálogo não falha a resposta nem grava nada
(o validador de conteúdo já impede isso de chegar à `main`) · a galeria nunca mostra número
inventado — sem figurinha nenhuma, "0 de 3" é a verdade, mesmo padrão do resto do produto
(ver `hub/page.tsx`).

### Plugin DRAG_MATCH (parear) — concluído
Terceira frente do mesmo pedido do dono ("mais lúdico"). `DRAG_MATCH` já estava reservado em
`ACTIVITY_TYPES` (`contracts.ts`) e no enum do banco desde o desenho original — só faltava o
plugin. Zero migration, zero alteração no núcleo: a prova viva de `docs/13`.

- `src/activities/plugins/drag-match/` — `schema.ts` (pares `{id, esquerda, direita}`, ambos
  os lados texto/emoji, sem upload de asset), `evaluate.ts` (crédito parcial por fração de pares
  certos, mesma lógica de `ORDER_SEQUENCE`; probabilidade de chute `1/n!`, mesma matemática —
  **duplicada**, não importada, porque "plugin não importa plugin").
- `src/activities/renderers/drag-match-renderer.tsx` — **toque-e-toque, não arrastar de
  verdade**: mesma decisão de acessibilidade do `order-sequence-renderer` (arrastar não funciona
  por teclado nem leitor de tela, e uma criança de seis anos perde o item no meio do caminho).
  Tocar um item da esquerda, depois um da direita, forma o par; tocar um par já feito desfaz.
- Registrado nos dois manifestos (`plugins/index.ts`, `renderers/index.tsx`) e coberto pela
  política PP5 (`tests/policy/motor-de-atividades.test.ts` — todo plugin precisa declarar como
  errar nele, ou o build quebra).
- **Conteúdo real**: `missao-04-o-bau-da-orla.json` — combinar número (1–4) com a quantidade de
  conchas certa, encadeada depois da missão 3. Colecionável novo: "Baú da Orla" (🗝️), em
  `content/colecionaveis.json`.

**Verificado em navegador de verdade** (Playwright): as quatro missões jogadas em sequência,
pareamento por toque testado par a par (todos corretos), mensagem de acerto exibida, e a galeria
mostrando "4 de 4" com a chave revelada.

**Propriedades travadas:** os dois lados de um par certo compartilham o mesmo `id` no conteúdo —
o `id` nunca aparece na tela, só `esquerda`/`direita`, então a correção é `pareamento[id] === id`
sem indireção nenhuma e sem vazar a resposta na inspeção do DOM.

### Plugin MULTI_SELECT (seleção múltipla) — concluído
Quarta frente de plugin, mesmo caminho de `DRAG_MATCH`: `MULTI_SELECT` já estava reservado em
`ACTIVITY_TYPES`, zero mudança no núcleo. "Toque em todos os que servem" — diferente de
`MULTIPLE_CHOICE` (uma resposta certa) por poder ter várias opções corretas ao mesmo tempo.

- `src/activities/plugins/multi-select/` — `schema.ts` (3 a 6 opções, exige **ao menos duas
  corretas**; com só uma, o schema recusa e aponta para `MULTIPLE_CHOICE` em vez de deixar a
  criança jogar um seletor múltiplo que só tem uma resposta certa), `evaluate.ts` (crédito
  parcial por **acurácia de matriz de confusão**: cada opção conta como acerto se
  "marcada == correta", contando também as erradas corretamente deixadas em branco — decisão
  deliberadamente diferente de `DRAG_MATCH`, que só conta pares que a criança de fato tentou,
  porque uma checkbox não tem estado "intocado"; probabilidade de chute `1/2ⁿ`, cada opção é
  uma moeda independente).
- `src/activities/renderers/multi-select-renderer.tsx` — **checkboxes reais**, `role="group"` +
  `role="checkbox"` + `aria-checked` (não `radiogroup`/`radio`, porque o leitor de tela precisa
  anunciar "marcado"/"não marcado" por opção, não "1 de N selecionada"). Toque alterna; mesmos
  estados visuais de `MultipleChoiceRenderer` (grade para opções curtas, ✓/↺ ao revelar).
- Registrado nos dois manifestos e coberto pela política PP5 — inclusive o caso "faltou marcar
  uma correta" para provar que crédito parcial também nunca sai sem `ensino`.
- **Conteúdo real**: nova quarta fase em `missao-02-os-caranguejos-da-mare.json` ("O abrigo da
  maré") — marcar todos os grupos com 6 bichinhos ou mais, dentro do objetivo já existente
  `comparar-quantidades`. Nenhum objetivo novo de currículo foi inventado para caber a atividade.

**Verificado em navegador de verdade** (Playwright): missão 1 até o fim para destravar a 2, as
quatro fases da missão 2 jogadas em sequência, os 4 checkboxes clicados e o `aria-checked`
conferido diretamente, resposta com uma correta marcada e uma correta em branco, mensagem de
acerto exibida, checkboxes desabilitados após revelar.

**Propriedades travadas:** um `MULTI_SELECT` com menos de duas opções corretas não passa no
schema — a mensagem de erro aponta para `MULTIPLE_CHOICE` em vez de deixar alguém autorar um
seletor múltiplo de resposta única · a ordem de marcação nunca importa (é conjunto, não
sequência) · a mesma resposta avaliada duas vezes produz o mesmo resultado (`evaluate` é puro).

### Plugin TRUE_FALSE (verdadeiro ou falso) — concluído
Quinta frente de plugin, mesmo caminho zero-mudança-no-núcleo. O caso mais simples de todos: uma
afirmação, a criança diz se é verdadeira. Diferente de `MULTIPLE_CHOICE` com duas opções, quem
autora **não escreve rótulo nenhum** — "Verdadeiro"/"Falso" são fixos no renderer, sempre no
mesmo lugar da tela, então o schema só pede a afirmação e se ela é verdadeira.

- `src/activities/plugins/true-false/` — `schema.ts` (sem lista de opções: só `enunciado`,
  `correta: boolean`, `ensino`), `evaluate.ts` (binário — sem `PARTIAL`, não existe "quase
  verdadeiro"; probabilidade de chute **fixa em 0.5**, sem calcular a partir de opções porque
  não há lista nenhuma para contar).
- `src/activities/renderers/true-false-renderer.tsx` — dois botões grandes (✅/❌), mesmo
  `role="radiogroup"`/`role="radio"` e as mesmas regras de acessibilidade de
  `MultipleChoiceRenderer` (nunca só cor, alvo de toque de 56px).
- Registrado nos dois manifestos e coberto pela política PP5 — a única resposta errada possível
  (a negação da afirmação) precisa vir com `ensino`.
- **Conteúdo real**: nova segunda fase em `missao-04-o-bau-da-orla.json` ("A chave está certa?")
  — afirmar uma contagem de conchas, dentro do objetivo já existente `contar-ate-10`.

**Verificado em navegador de verdade** (Playwright): missões 1 a 3 até o fim para destravar a 4,
a fase de pareamento (`DRAG_MATCH`) seguida da nova fase `TRUE_FALSE`, os 2 botões localizados e
o `aria-checked` conferido diretamente, mensagem de acerto exibida, botões desabilitados após
revelar.

### Plugin FILL_BLANK (completar a lacuna) — concluído
Sexta e última frente de plugin desta sessão, mesmo caminho zero-mudança-no-núcleo. Uma frase com
um espaço vazio (`enunciado` precisa conter o marcador `___`) e um banco de palavras para tocar —
**nunca digitação livre**: quem ainda está aprendendo a ler não pode ser avaliado pela própria
datilografia, o produto testa se a criança sabe qual palavra completa a frase.

- `src/activities/plugins/fill-blank/` — `schema.ts` (mesma forma de `MULTIPLE_CHOICE`: banco de
  opções com exatamente uma correta, cada errada com `ensino` obrigatório — **duplicado, não
  importado**, porque "plugin não importa plugin"; `superRefine` extra recusa conteúdo sem o
  marcador `___`), `evaluate.ts` (mesma lógica de crédito de `MULTIPLE_CHOICE`; probabilidade de
  chute `1/n` opções do banco).
- `src/activities/renderers/fill-blank-renderer.tsx` — a frase aparece inteira, com a lacuna
  numa caixa tracejada que se preenche com a palavra escolhida **antes** de responder — a criança
  lê a frase completa para conferir se faz sentido, o que uma lista de opções solta não oferece.
  A escolha em si continua um `radiogroup`/`radio` de verdade no banco de palavras.
- Registrado nos dois manifestos e coberto pela política PP5.
- **Conteúdo real**: nova quarta fase em `missao-03-o-recife-dos-peixinhos.json` ("O relatório
  do recife") — completar "Aqui tem ___ corais.", dentro do objetivo já existente
  `contar-ate-10`.

**Verificado em navegador de verdade** (Playwright): missões 1 e 2 até o fim, as quatro fases da
missão 3 jogadas em sequência (incluindo a nova `FILL_BLANK`), a lacuna conferida vazia (`___`)
antes de escolher e preenchida com "cinco" depois de tocar na opção — **antes** de responder —,
mensagem de acerto exibida, banco de palavras desabilitado após revelar.

Com este plugin, todos os cinco tipos de atividade da lista original de `docs/12`
(`MULTIPLE_CHOICE`, `MULTI_SELECT`, `TRUE_FALSE`, `DRAG_MATCH`, `ORDER_SEQUENCE`, `FILL_BLANK` —
seis, na verdade) estão implementados, exceto `WORD_BUILD` e o resto da "Fases seguintes" de
`docs/01 §3`.

### Segunda disciplina: Português — concluída
Pedido do dono, depois de perceber que só havia Matemática. Português entra como **disciplina
nova dentro da mesma Academia do Conhecimento** (não uma academia própria) — é assim que a
Bíblia já descrevia a Praça das Letras, um distrito ao lado da Ladeira dos Números (`docs/
biblia/volume-1/04-as-sete-academias.md §4.1`).

- `content/curriculo/portugues.json` — competência "Alfabetização", 3 objetivos (reconhecer
  letras, identificar letra inicial, contar sílabas). **`codigoBncc` foi omitido em todos**: o
  campo é opcional de propósito (`content/schema/index.ts`), e adivinhar um código BNCC errado
  seria pior que não declarar nenhum — uma alegação de conformidade curricular falsa é mais
  grave que a ausência da alegação.
- `content/academias/conhecimento/portugues/` — `disciplina.json` (aponta pro currículo
  acima), `SPROUT/nivel-01/nivel.json` ("A Praça Muda"), `modulo-01-alfabeto/`.
- `missao-01-o-alfabeto-da-virgula.json` — primeira missão de Português, com VÍRGULA (a gata
  da Praça das Letras, já descrita na Bíblia). Três atividades, uma de cada tipo de plugin que
  o motor tem hoje: `MULTIPLE_CHOICE` (letra inicial), `MULTIPLE_CHOICE` (contar sílabas),
  `DRAG_MATCH` (combinar letra com palavra). Colecionável novo: "Pegada da Vírgula" (🐾).

**Bug real encontrado e corrigido no caminho — nível/módulo colidindo entre disciplinas.**
`plan.ts` montava `nivelPorSlug`/`moduloPorSlug` como mapas chaveados só pelo `slug` do
`nivel.json`/`modulo.json` (ex.: `"nivel-01"`). Como toda disciplina naturalmente chama seu
primeiro nível de "nivel-01" (é a convenção esperada, não um erro de autoria), a SEGUNDA
disciplina importada pisava no mapa da primeira — e o nome do mundo de Matemática no `/hub`
passou a mostrar "A Praça Muda" (o nome do nível de Português) em vez de "A Orla Apagada". Só
apareceu agora porque antes desta sessão só existia uma disciplina.

- `content/loader.ts` — `Acervo.niveis`/`Acervo.modulos` agora carregam `NivelCarregado`/
  `ModuloCarregado` (o `nivel.json`/`modulo.json` acompanhado de academia/disciplina/faixa e do
  nome da pasta), não mais o objeto cru.
- `plan.ts` — os mapas de lookup usam a chave completa
  (`academia/disciplina/faixa/pastaDoNivel[/pastaDoModulo]`), igual ao que `MissaoCarregada` já
  fazia. Duas disciplinas com "nivel-01" cada não colidem mais.
- Teste de regressão em `plan.test.ts`: duas disciplinas com o mesmo slug de nível, cada mundo
  fica com o nome certo.

**Verificado em navegador de verdade** (Playwright): hub mostra os dois mundos com o nome
correto cada um (confirmado o bug ANTES da correção, e a correção DEPOIS) · as três atividades
de Português jogadas até o fim, incluindo o pareamento por toque · galeria mostrando a Pegada
da Vírgula revelada.

### Português ganha uma segunda missão — concluído
Trabalho de conteúdo puro (decisão nº 3 da seção 5: "o gargalo agora é conteúdo, não código"),
sem tocar em nenhum arquivo de `src/`. Português tinha só uma missão desde que a disciplina foi
criada; Matemática já tinha quatro.

- `missao-02-a-cesta-de-palavras-da-virgula.json` — continuação de VÍRGULA e a Praça das Letras.
  Reaproveita os **3 objetivos de currículo já existentes** (`identificar-letra-inicial`,
  `contar-silabas`, `reconhecer-letras-do-alfabeto`) — nenhum objetivo novo, nenhum código BNCC
  inventado — mas com três tipos de plugin diferentes dos da missão 1: `MULTIPLE_CHOICE` (letra
  inicial de SAPO), **`MULTI_SELECT`** (marcar as palavras com exatamente 2 sílabas — primeiro
  uso desse plugin fora de Matemática), `DRAG_MATCH` (parear letra com palavra, conjunto de
  letras novo: C/F/L/R, sem repetir os pares da missão 1).
- `nivel.json` (Português) — segundo nó no `mapa`, com aresta ligando a missão 1 à 2.
- `content/colecionaveis.json` — novo colecionável "Fita da Vírgula" (🎀), concedido na
  conclusão da missão 2.

**Verificado em navegador de verdade** (Playwright): missão 1 até o fim para destravar a 2, as
três fases da missão 2 jogadas em sequência (incluindo o `MULTI_SELECT` com crédito conferido
via `aria-checked`), galeria mostrando a Fita da Vírgula, e o mapa de "A Praça Muda" mostrando os
dois nós concluídos e conectados.

### Script de operador: redefinir senha — concluído
Pedido do dono ao perceber, jogando em produção, que não existe fluxo de "esqueci minha senha"
pelo site — só `/criar-conta`, `/entrar`, `/verificar-email`.

- `scripts/redefinir-senha.ts` (`npm run conta:redefinir-senha`) — mesmo padrão de
  `scripts/verificar-conta.ts`: exige `DATABASE_URL`, nunca é rota nem Server Action, registra
  a ação em `AuditLog`. Reaproveita `PlainPassword.create` (mesma validação do cadastro —
  mínimo 6 caracteres, decisão do dono registrada na tabela da seção 6) e `Argon2Hasher` (mesmo
  hash) — login volta a funcionar exatamente como se a troca tivesse sido feita pela tela.
  Revoga toda sessão ativa da conta.
- **Isto é um atalho, não substitui um fluxo de verdade.** O fluxo de verdade (token por
  e-mail, mesma arquitetura da verificação de cadastro) ainda não existe — ver item novo em
  "Ordem sugerida", seção 5.
- Testado contra Postgres local: senha trocada, sessões revogadas, log de auditoria gravado, e
  login confirmado em navegador real com a senha nova.

### Fluxo de verdade de "esqueci minha senha" — concluído
Pedido do dono: quem joga sozinho, sem VS Code nem terminal, não consegue usar o script de
operador acima. Fecha o item 7 da "Ordem sugerida" (seção 5).

- Reaproveita `VerificationTokenRepository`/tabela `VerificationToken` em vez de criar modelo e
  migração próprios — o identificador ganha o prefixo `pwreset:` (`accountId` puro continua sendo
  o de verificação de e-mail). Como `issue()` só apaga tokens do **mesmo** identificador, pedir
  redefinição de senha não invalida um link de verificação pendente, e vice-versa — coberto por
  teste de integração (`identity.integration.test.ts`, "token de verificação de e-mail e token de
  redefinição convivem sem colidir").
- `pedirRedefinicaoDeSenha` (`use-cases/reset-password.ts`) segue exatamente o padrão de
  `reenviarVerificacao`: resposta idêntica para e-mail existente, inexistente e conta só-OAuth
  (`hasPassword: false` — nada a redefinir), rate limit de 3/h por conta, `fakeVerify` não é
  necessário porque nenhum hash é comparado neste caminho.
- Link vale **1 hora**, não 24 como o de verificação — quem consegue ler o e-mail do responsável
  nas últimas 24h já poderia trocar a senha; a janela mais curta reduz essa superfície.
- `redefinirSenha` grava o hash novo (`AccountRepository.updatePasswordHash`, método novo),
  **revoga toda sessão ativa da conta** e consome o token — mesmíssimo comportamento do script de
  operador, agora acessível pela própria pessoa.
- Telas novas em `(auth)`: `/esqueci-a-senha` (pede o e-mail) e `/redefinir-senha?token=...`
  (escolhe a senha nova; sem token na URL, manda pedir um link novo). `/entrar` ganhou o link
  "Esqueceu sua senha?".
- Verificado de ponta a ponta em navegador real: cadastro → pedir redefinição → capturar o link no
  e-mail simulado (console, sem `RESEND_API_KEY`) → trocar a senha → sessão antiga derrubada →
  login com a senha nova funciona, com a antiga é recusado → reusar o mesmo link falha
  ("uso único").

### Mapa desenhado — concluído (item 4 da "Ordem sugerida")
Pedido do dono: "quero mais lúdico possível para as crianças". `World.mapLayout` existia no
schema desde a Etapa 3 mas nunca foi autorado nem lido — o mapa era uma lista vertical de
cartões. Agora é geografia de verdade: nós posicionados por `x`/`y` (percentual), ligados por
caminhos, com névoa sobre o que ainda não abriu.

- **Domínio novo**: `src/modules/quest/domain/map-layout.ts` — `LayoutDoMapa` (`nos`: cada um
  com `missaoRef` + `x`/`y` de 0 a 100; `arestas`: pares `de`/`para`) e `layoutDoMapaSchema`.
  Puro, sem I/O — mesmo padrão de `unlock-rule.ts`. `LAYOUT_VAZIO` é o valor de "mundo sem mapa
  desenhado ainda", e é ele quem faz a tela cair de volta pra lista.
- **Leitura tolerante**: `infrastructure/map-layout-json.ts` (`lerLayoutDoMapa`) — mesmo
  raciocínio de `lerRegraDeDesbloqueio`: layout irreconhecível ou o placeholder do importador
  (`{nos:[]}`) nunca travam a tela, só fazem o mundo cair na lista.
- **Autoria em `content/`**: `nivel.json` ganhou o campo opcional `mapa` (`content/schema/
  index.ts` reaproveita `layoutDoMapaSchema` — a mesma gramática do banco, sem uma segunda
  definição pra divergir). `missaoRef` é a referência completa, o mesmo formato de
  `desbloqueio.questCompleted`.
- **Integridade referencial** (`content/loader.ts`, `validarReferenciasEConfigs`): todo nó
  precisa apontar pra uma missão real do mesmo nível; toda missão do nível precisa ter nó (mapa
  incompleto nunca é publicado — ou cobre tudo, ou o mundo fica sem mapa); toda aresta liga nós
  existentes. Pego no `npm run content:validate`, antes de chegar no banco.
- **`plan.ts`/`prisma-content-writer.ts`**: `LinhaMundo.mapa` viaja do nível pro mundo e é
  gravado em `World.mapLayout` como está (sem transformação — a mesma forma do domínio até o
  Postgres).
- **`map.ts`/`prisma-map-reader.ts`**: `MundoDoMapa.mapa` (novo, `MapaVisual | null`) traduz o
  layout bruto (referências) na `MissaoDoMapa` já avaliada (jogabilidade, concluída, em
  andamento) — a mesma instância que a lista usa, não recalculada duas vezes. Nó cujo
  `missaoRef` não bate mais com nenhuma missão (conteúdo mudou, banco não foi reimportado) é
  descartado em silêncio, e aresta órfã também — defensivo, nunca quebra a tela.
- **Tela** (`app/(play)/hub/mapa.tsx`): quando `mundo.mapa` existe, desenha um `<svg>` com as
  arestas (caminho já andado acende em `--color-corrente`, o resto fica pontilhado e apagado) e
  os nós como `Link`/`div[aria-disabled]` posicionados por `left`/`top` percentual sobre o svg —
  não dentro dele, pelo mesmo motivo de `ORDER_SEQUENCE`/`DRAG_MATCH` não usarem drag nativo:
  foco de teclado e leitor de tela precisam do elemento real. Nó bloqueado continua mostrando
  toda pendência por extenso (`docs/08 §3` — "o mapa mostra o caminho, nunca só um cadeado"),
  não só um cadeado. Mundo sem `mapa` autorado cai de volta pra lista de sempre — zero regressão
  pra conteúdo futuro que ainda não tiver geografia.
- **Conteúdo real**: os dois mundos existentes (Matemática nível 1, Português nível 1) ganharam
  layout — a Orla em trilha de 4 nós subindo da praia ao baú, a Praça com o único nó de Vírgula.
- Testes novos: `map-layout.test.ts` (schema), `map-layout-json.test.ts` (leitura tolerante),
  `map.test.ts` (tradução layout → mapa visual, incluindo nó/aresta órfãos), casos novos em
  `loader.test.ts` e `plan.test.ts` (integridade referencial, transporte do `mapa`, e a
  garantia de que o formato de `missaoRef` duplicado em `content/loader.ts` bate com
  `refDeMissao` de `plan.ts`).
- **Verificado em navegador real** (Playwright): os dois mapas desenhados corretamente — nó 1
  de Matemática jogável (★), nós 2–4 bloqueados com a pendência certa por extenso, arestas
  pontilhadas entre eles; clique no nó jogável abre `/missao/[slug]`; nó alcançável no primeiro
  Tab da página (acessibilidade por teclado confirmada).

### Conquistas — concluído (item 3 da "Ordem sugerida")
`Achievement`/`LearnerAchievement` existiam no schema desde a Etapa 0, sem nenhum manipulador
escrito — o par serviu de modelo estrutural para `Collectible`/`LearnerCollectible` (figurinhas),
não o contrário (ver seção 3, "Sistema de figurinhas"). Este item fecha o círculo.

**Escopo deliberadamente menor que a visão de produto — leia antes de estranhar.** A Bíblia
(Vol. 1 Cap. 6 §6.15) descreve cinco famílias — Domínio, Persistência, Descoberta, Criação,
Cuidado — quatro graus cada, e cita a "Medalha da Virada" (voltar a uma competência já errada
e dominá-la) como exemplo. **Só Domínio e Persistência têm mecânica hoje.** Descoberta, Criação
e Cuidado exigem eventos que o motor não publica ainda (segredo encontrado, obra criada, ajuda a
personagem) — não inventados aqui, mesmo raciocínio de deixar `codigoBncc` de fora quando não dá
para ter certeza. Nenhum documento de `docs/` tem uma lista concreta de conquistas com nome e
critério — as seis abaixo são autoria desta sessão, não uma tradução de spec existente.

- **`src/modules/achievement/domain/criteria.ts`** — só dois tipos de critério,
  `competenciasDominadas` e `missoesConcluidas`, e de propósito: são os únicos que dá para avaliar
  **recomputando de uma fonte de verdade já persistida** (`SkillMastery.masteredAt`,
  `QuestRun.status = COMPLETED`) em vez de acumular "+1 por evento". Isso é o que torna o avanço
  de progresso **idempotente de graça** — sem tabela de deduplicação de evento nenhuma: reprocessar
  o mesmo evento (o outbox é *at-least-once*, nunca *exactly-once* — `src/server/outbox.ts`)
  recalcula a mesma contagem e grava o mesmo resultado. Testado explicitamente (ver abaixo).
- **`domain/board.ts`** — ao contrário da galeria de figurinhas, conquista **não esconde** nome e
  descrição por padrão: mostra o quanto falta (`progresso` 0–1), mesmo princípio de `docs/08 §3`
  ("o mapa mostra o caminho"). Só quando o catálogo marca `oculta: true` (campo `hidden` do banco,
  já existia, nunca tinha sido usado) é que ela fica secreta até desbloquear.
- **`application/grant-achievements.ts`** — dois `EventHandler`, **`outbox`, não `inline`**: é
  a decisão que já estava registrada na seção 3 ("Sistema de figurinhas") antes de este módulo
  existir — "reconhecimento que chega um pouco depois ainda é reconhecimento". Reagem a
  `assessment.attempt_evaluated` (`dominio.dominouAgora`) e `quest.completed`.
- **`infrastructure/prisma-achievement-repository.ts`** — `avancarProgresso` busca TODAS as
  conquistas do tipo de critério pedido, recomputa a contagem uma vez e faz upsert em cada uma que
  ainda não desbloqueou — inclusive as longe do fim (é o que faz "3 de 10" fazer sentido na barra).
  Critério irreconhecível (`Json` defasado) não trava as demais — mesmo raciocínio de
  `lerRegraDeDesbloqueio`/`lerLayoutDoMapa`.
- **`rewardXp` não está creditado.** A coluna existe (`Achievement.rewardXp`), o conteúdo não a
  usa ainda e fica em 0. Creditar exigiria o módulo publicar um evento próprio
  (`achievement.unlocked`) para `progression` reagir — módulos não se chamam direto — e isso não
  foi feito nesta sessão por prudência de escopo numa noite sem o dono para validar o desenho da
  cascata de eventos. Fica registrado como o próximo passo natural.
- `content/conquistas.json` — catálogo com 6 conquistas (3 graus × 2 famílias), reaproveitando
  `criterioDeConquistaSchema` do módulo `achievement` em `content/schema/index.ts` (mesmo
  raciocínio de `regraDeDesbloqueioSchema`/`layoutDoMapaSchema` — uma gramática, um dono).
- Tela nova `/conquistas` (`app/(play)/conquistas/`), agrupada por família, com selo de grau
  colorido e barra de progresso; link "Suas conquistas" ao lado de "Sua coleção" no hub.
- **Testado com Postgres real** (`tests/integration/achievement.integration.test.ts`): pipeline
  completo (missão concluída → outbox → despachante → conquista desbloqueada); despachar duas
  vezes não desbloqueia de novo; **chamar `avancarProgresso` duas vezes com o mesmo estado —
  simulando duas execuções concorrentes do despachante processando a mesma mensagem — não muda
  nada na segunda chamada**, a prova direta da idempotência por recomputação; critério
  irreconhecível não trava as demais conquistas; leitura do quadro junta catálogo e progresso.
- **Verificado em navegador real** (Playwright): quadro em 0% antes de jogar → missão concluída
  → despachante rodado manualmente (sem `CRON_SECRET` local) → "A Primeira Vitória" aparece com
  borda verde e "✓ Conquistada", as de 5/10 mostram 20%/10% de progresso real.

### Design System
- `tokens/` — cor e tipografia (já existiam)
- `primitives/` — `Button` (+ `buttonStyles`), `Field`, `Alert`, `Card`; `utils/cn.ts`

### Rotas
- `(marketing)` — `/`, `/para-pais` (CTA de cadastro **recolocado**)
- `(auth)` — `/criar-conta`, `/entrar`, `/verificar-email`, `/esqueci-a-senha`, `/redefinir-senha`
- `(guardian)` — `/familia` (seletor, criar criança, definir PIN)
- `(play)` — `/hub` (mapa das missões), `/missao/[slug]` (jogável), `/colecao` (figurinhas),
  `/conquistas` (quadro de conquistas)

### Barreiras de qualidade
- `.dependency-cruiser.cjs` — 10 regras de fronteira, 3 delas do motor (0 erros)
- `eslint.config.mjs` — sem `TODO`, `any`, `dangerouslySetInnerHTML`; fronteiras por camada
- `tests/policy/` — tokens de design **e** motor de atividades
- `.github/workflows/ci.yml` — 3 jobs: verify (+ validação de conteúdo) · integração com Postgres · build
- `vitest.config.ts` (rápido) e `vitest.integration.config.ts` (com banco)

---

## 4. O que NÃO existe ainda

> ✅ **Resolvido:** a UI real já toca em slot — objetivo e revisão, os dois. Era o alerta desta
> seção; agora é a seção 3, "O conteúdo encontra a tela". Verificado em navegador de verdade, não
> só em teste.

- **`content/` ainda não autora slot do modo `objetivo`.** O motor sabe preencher
  `StageActivity.activityId` nulo, e a tela já sabe mostrar o resultado (seção 3, acima) — falta
  só a autoria: o schema (`content/schema/`) não tem campo para declarar um slot, todo
  `fase.atividades` de hoje é fixo. Escrever a primeira missão com slot desse modo exige estender
  `content/schema/index.ts` e o importador (`domain/plan.ts`) para reconhecer o tipo "slot" e
  gravar `slotRule` com o `Objective.id` já resolvido
- **Desbloqueio por nível** (Academia da Inteligência no 10, Prosperidade no 15…) — a tabela de
  `docs/08 §1` não está implementada. O que funciona é o desbloqueio **declarado no conteúdo**
  (`premio.desbloqueios` → linhas em `Unlock`). O gate por nível precisa da declaração no lado do
  conteúdo primeiro; pôr os números no código violaria "balanceamento fica em `content/`"
- `LearnerProgress.minutesToday` — fica em 0. `QuestRun` já dá o marco de início e fim; falta
  decidir se "tempo de sessão" conta a jogada inteira ou só o tempo com atividade na tela.
  Preferi zero honesto a um número inventado
- **Missão abandonada** — `QuestRunStatus.ABANDONED` existe no enum e nada o usa. Uma corrida
  aberta fica aberta para sempre, e retomá-la é sempre possível. É o comportamento gentil; se um
  dia precisar de expiração, é aqui
- Talentos, notificações e relatórios — o outbox e o barramento já estão prontos (conquistas já
  usam os dois, ver seção 3); falta escrever os manipuladores
- Calibração de dificuldade por telemetria (`docs/08 §2`, job noturno com ≥ 200 tentativas)
- 18 dos 20 tipos de atividade — por decisão explícita
- **Som do feedback** — o vocabulário está no schema e o conteúdo já pode declarar, mas nada toca.
  Faltam os arquivos em `public/sfx/` (identidade sonora, decisão de design) e o respeito a
  `LearnerSettings.soundEnabled`, que exige as preferências da criança chegarem à sessão de missão.
  Ver `docs/13 §10.1`. O resto do feedback sensorial (animação, efeito, tempo de leitura) **está
  funcionando**.
- `prisma/seed/` — sem seeds
- `tests/e2e/` — sem Playwright
- OAuth (Google/Apple) — `OAuthAccount` existe no schema, sem implementação
- Redis — o rate limiter é em memória; ver §9

---

## 5. PRÓXIMA TAREFA — Etapa 3, passo 3: o conteúdo encontra o motor

O sistema está fechado: a criança abre uma missão, responde, o modelo aprende, a Luz sobe, a
missão fecha e o mapa mostra o que vem. **O que falta agora é o motor usar tudo que ele já sabe.**

Os itens 1 (seleção adaptativa), 2 (fila de revisão) e 0 (a tela sabe mostrar os dois) estão
feitos — banco, aplicação **e navegador**, verificado de verdade. Ver seção 3.

### Ordem sugerida
3. ~~Conquistas~~ — **concluído nesta sessão**. Ver seção 3, "Conquistas". Só Domínio e
   Persistência têm mecânica; Descoberta/Criação/Cuidado e o crédito de `rewardXp` ficam para
   depois (registrado no mesmo lugar).
4. ~~Mapa desenhado~~ — **concluído nesta sessão**. Ver seção 3, "Mapa desenhado".
5. **Perfil de talentos** (`docs/08 §9`) — **investigado nesta sessão, não iniciado de propósito**.
   Ver decisão nº 5 abaixo: ao contrário de Conquistas e Mapa, este item não tem como ser
   escopado sem inventar regra de produto que não está documentada em lugar nenhum.
6. ~~Novo tipo de atividade mais lúdico (`DRAG_MATCH`, `MULTI_SELECT`, `TRUE_FALSE`,
   `FILL_BLANK`)~~ — **concluído nesta sessão**. Ver seção 3, "Plugin DRAG_MATCH (parear)",
   "Plugin MULTI_SELECT (seleção múltipla)", "Plugin TRUE_FALSE (verdadeiro ou falso)" e "Plugin
   FILL_BLANK (completar a lacuna)". Falta ainda `WORD_BUILD` e o resto da "Fases seguintes" de
   `docs/01 §3` — mesmo caminho, plugin novo sem tocar no núcleo.
7. ~~Fluxo de verdade de "esqueci minha senha"~~ — **concluído nesta sessão**. Ver seção 3,
   "Fluxo de verdade de 'esqueci minha senha'".

### Decisões em aberto — precisam do dono
**1. `CRON_SECRET` na Vercel.** Sem ele, `/api/outbox` responde 503 e a **telemetria nunca é
gravada**. Luz, Fagulhas e Fôlego continuam funcionando, porque são `inline`.

**2. Fuso do responsável.** A Trilha de Luz conta dias em `America/Sao_Paulo`, fixo em
`prisma-progress-repository.ts`. Não há campo de fuso em `Account`.

**3. O gargalo agora é conteúdo, não código.** Seis missões, dezenove atividades, seis tipos
de atividade implementados (`MULTIPLE_CHOICE`, `ORDER_SEQUENCE`, `DRAG_MATCH`, `MULTI_SELECT`,
`TRUE_FALSE`, `FILL_BLANK`) — duas disciplinas (Matemática com quatro missões, Português com
duas), ainda um único módulo em cada. Todo o resto do sistema está pronto para receber muito mais — e
conteúdo vive em `content/`, que cresce sem deploy de código. **Esta é a decisão mais
importante da lista**: quanto conteúdo escrever antes de abrir mais motor.

**4. ⚠️ Cron do `/api/outbox` está em 1x/dia — plano Hobby da Vercel não permite mais frequente.**
Decisão do dono, 2026-08-13: como só há uma pessoa usando o site, telemetria com até 24h de
atraso é aceitável, e um upgrade de plano não se justifica ainda. **Quando o site for exposto
para mais gente, revisitar isto** — ou fazer upgrade pra Vercel Pro (libera cron a cada minuto),
ou tirar o despacho de dentro do pulso do cron (chamar `despachante.despachar()` direto após a
ação que gerou o evento). Ver `app/api/outbox/route.ts` e `vercel.json`.

**5. Perfil de talentos exige decisão de produto antes de qualquer código.** Investigado a fundo
nesta sessão (schema `TalentProfile`/`Recommendation` já existe e está migrado; nunca foi lido
nem escrito por código nenhum). O que falta **não é engenharia**, é regra de produto que não
está escrita em lugar nenhum — `docs/08 §9` lista sinais em prosa, não fórmula:
- **A fórmula do score por talento.** Não existe em `docs/08` nem na Bíblia.
- **O mapeamento competência → talento.** A Bíblia nomeia 12 talentos (Matemático, Cientista,
  Artista, Inventor, Programador, Escritor, Naturalista, Líder, Comunicador, Músico,
  Estrategista, Empreendedor); nenhum documento diz qual `Skill`/`Subject` alimenta qual.
- **3 dos 5 sinais não são coletados hoje** ("tempo voluntário", "escolha livre de missão", "uso
  de atividade criativa" — `ActivityType` nem tem flag de "criativa"). Só 2 de 5 têm dado pronto
  (`SkillMastery` para acerto por área e persistência).
- **A semântica de `Recommendation`** (`kind: QUEST | REVIEW | PROJECT | BREAK`, `refId` livre) —
  o que decide o que aparece no hub, como o teto de 40%/mínimo-1-fora-do-perfil se aplica na
  prática (por sessão? por dia corrido? em que fuso — mesma pergunta em aberto da decisão nº 2) —
  não está implementado nem especificado.
- **Onde exibir.** Não existe tela `/perfil` nem painel do responsável; a Bíblia sugere que o
  destino é o responsável, não a criança, mas isso também não está confirmado em código nenhum.
- Fabricar essas cinco coisas sem o dono seria o mesmo erro que inventar código BNCC — só que numa
  escala muito maior (um sistema de recomendação inteiro, não um campo opcional). Por isso este
  item fica **investigado e documentado, não implementado**, até vir a decisão.

> A antiga decisão nº 1 desta lista — "a importação de conteúdo deve rodar no deploy?" — está
> resolvida. Ver seção 3, "Importação automática de conteúdo no deploy".

## 6. Decisões já tomadas — não relitigar

| Decisão | Onde está registrada |
|---|---|
| **Sete** Academias, não seis. Prosperidade é autônoma | Bíblia Cap. 4 e 5 |
| Criança nunca tem conta própria | ADR 0003 |
| Monólito modular + Clean Architecture | ADR 0001 |
| Motor de atividades por plugins tipados | ADR 0002 |
| **Sessão de primeira parte, não Auth.js** | **ADR 0004** |
| **Conteúdo é dado; o motor interpreta, não contém** | ADR 0002 · `docs/13` |
| **Erro incorreto sem `ensino` não compila** | `docs/13 §4` |
| **E-mail transacional: Resend** | decisão do dono, 2026-08-03 |
| Currículo é dado, não código | `docs/01 §4` |
| Fôlego (energia) jamais impede aprender | Bíblia Cap. 6 §6.4 |
| Nenhuma moeda se compra com dinheiro real | Bíblia Cap. 6 §6.5 |
| Nenhuma notificação push vai para criança | Bíblia Cap. 1 PSI3 |
| Erro nunca é vermelho — é coral | Bíblia Cap. 11 §11.2 |
| Modelo do tutor: `claude-sonnet-5` | `src/config/env.ts` |
| Fase 1 = faixa `SPROUT` (6–8 anos) | Bíblia Cap. 2 §2.1 |
| **Chave de idempotência mora na tabela que ela protege, não numa tabela genérica** | `src/server/action.ts` |
| **Uma transação atravessa módulos; quem a abre é o caso de uso** | `src/shared/kernel/unit-of-work.ts` |
| **XP e carteira são `inline`; telemetria é `outbox`** | `src/shared/kernel/domain-event.ts` |
| **`assessment` mede; quem credita reage ao evento** | `src/modules/assessment/domain/events.ts` |
| **Telemetria e evento interno são tópicos separados** | `src/modules/assessment/domain/events.ts` |
| **Iniciar e retomar uma missão são a mesma operação** | `src/modules/quest/application/play-quest.ts` |
| **Slot resolvido entra ao final da fase, não na posição declarada** | `src/modules/quest/domain/slot-resolution.ts` |
| **Resolução de slot é gravada na primeira abertura; retomada só lê** | `src/modules/quest/application/resolve-slots.ts` |
| **Slot de revisão não exclui atividade vista nas últimas 48h** (revisar é o ponto) | `docs/08 §7.2` · `application/resolve-slots.ts` |
| **Fila de Revisão é dado de sistema (migration), não conteúdo de `content/`** | `prisma/migrations/20260806234721_fila_de_revisao_fixture` |
| **Custo de Fôlego da Fila de Revisão é o mesmo de qualquer `REVIEW`** (3, não criei kind novo) | `src/modules/quest/domain/energy-cost.ts` |
| **Quem decide que a missão acabou é o servidor** | `src/modules/quest/domain/quest-run.ts` |
| **Desbloqueio devolve o caminho, não um cadeado** | `src/modules/quest/domain/unlock-rule.ts` |
| **`content:import` só roda sozinho quando `VERCEL_ENV=production`; sem a variável, pula** | `scripts/import-content-em-producao.mjs` |
| Cron do `/api/outbox` em 1x/dia, não a cada 5 min (limite do plano Hobby) | decisão do dono, 2026-08-13 |
| **Figurinha é concedida `inline`, não `outbox`** (precisa aparecer na hora; outbox só roda 1x/dia) | `src/modules/collection/application/grant-collectibles.ts` |
| **`Collectible.code` é a chave natural em toda parte — nunca o `id` opaco** (motor não sabe o que é figurinha) | `content/colecionaveis.json` · `src/modules/collection` |
| **Senha da conta: mínimo 6 caracteres, não 10** — decisão do dono, ciente do custo de segurança (6 dígitos = 1 milhão de combinações) | `src/modules/identity/domain/password.ts` |

---

## 7. Regras inegociáveis ao escrever código

1. **Sem código provisório.** Nada de `TODO`, `FIXME`, mock em produção ou função vazia.
   Funcionalidade não pronta fica atrás de feature flag desligada.
2. **`npm run verify` tem que continuar verde.** Sempre. Antes de qualquer commit.
3. **`typedRoutes` está ligado.** Link para rota inexistente é erro de compilação.
4. **Fronteiras de camada são verificadas.** `domain/` não importa Prisma, Next nem React.
5. **Léxico obrigatório na área infantil** (Bíblia Cap. 3 §3.5): Luz, Fagulhas, Fôlego, Missão,
   Colosso Adormecido, "quase". A palavra **"estudar" não existe** no mundo da criança.
6. **Todo `Json` no schema tem schema Zod correspondente** e `schemaVersion`.
7. **Toda escrita com efeito econômico precisa de `idempotencyKey`.**
8. **Nenhum dado identificável de criança vai para o provedor de IA** — só `pseudonymId`.
9. **Nenhuma Server Action é escrita solta** — sempre por `createAction` (`docs/09 §4`).
10. **Estado de formulário vem de `@/shared/forms/action-state`**, nunca de `@/server/action`:
    importar do segundo arrasta `next/headers` para o cliente e quebra o build.

---

## 8. Comandos

```bash
npm install
cp .env.example .env          # preencher DATABASE_URL e AUTH_SECRET
npx prisma generate
npm run dev                   # http://localhost:3000

npm run verify                # tipos + lint + fronteiras + testes — o que o CI roda
npm run test:integration      # testes com Postgres real (precisa de banco)
npm run content:validate      # valida todo o acervo de conteúdo
npm run build                 # build de produção
npx prisma migrate deploy     # aplica as migrations existentes

# Verificação manual de e-mail — ação de operador, enquanto não há provedor.
# Exige DATABASE_URL; não é acionável pela web; fica na auditoria como SYSTEM.
npm run conta:verificar -- ola@exemplo.com --motivo "primeira conta"
```

### Destravar a própria conta sem provedor de e-mail

Enquanto `RESEND_API_KEY` não estiver configurada, o cadastro cria a conta mas o
e-mail de verificação não sai — e sem verificação não se cria perfil de criança.
Para a conta do dono do produto, use o comando acima:

```bash
npx vercel env pull .env.producao
DATABASE_URL="$(grep '^DATABASE_URL=' .env.producao | cut -d= -f2- | tr -d '"')" \
  npm run conta:verificar -- ola@exemplo.com
```

**Isto vale para a primeira família e mais nada.** A partir da segunda conta,
configure o Resend: e-mail de verificação de verdade é a única prova de
consentimento que vale para uma conta que não é a sua (docs/09 §6).

**Postgres local para os testes de integração**, sem Docker:

```bash
export PGDATA=/var/lib/postgresql/e2e
mkdir -p $PGDATA && chown postgres:postgres $PGDATA && chmod 700 $PGDATA
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $PGDATA -U postgres --auth=trust"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGDATA -o '-p 55432' -l /tmp/pg.log start"
psql "postgresql://postgres@127.0.0.1:55432/postgres" -c "CREATE DATABASE crescendo;"
export DATABASE_URL="postgresql://postgres@127.0.0.1:55432/crescendo"
export DIRECT_DATABASE_URL="$DATABASE_URL"
npx prisma migrate deploy && npm run test:integration
```

---

## 9. Armadilhas conhecidas

- **Rate limit é em memória, por instância.** `InMemoryRateLimiter` segura o caso comum (o mesmo
  navegador insistindo) e **não** segura ataque distribuído: com N instâncias quentes na Vercel, o
  limite efetivo é até N × o configurado. A porta `RateLimiter` já está pronta para Redis — quando
  `REDIS_URL` existir, troque a implementação em `src/composition/identity.ts` e mais nada.
- **`RESEND_API_KEY` ainda não está na Vercel.** Sem ela, em produção o envio falha com
  `mail.not_configured` e ninguém consegue verificar e-mail. Passos: criar chave em
  resend.com/api-keys, **verificar o domínio do remetente** (SPF + DKIM) e ajustar `EMAIL_FROM`.
  Sem domínio verificado, o Resend só entrega para o endereço da própria conta.
- **`NEXT_PUBLIC_APP_URL` precisa estar correta na Vercel** — é ela que monta o link de
  verificação. Errada, o e-mail sai com link para `localhost`.
- **`no-warning-comments` usa `location: "start"`**, não `"anywhere"`. Foi mudado de propósito:
  "todo/toda" é palavra corrente em português e a regra proibia prosa legítima. `// TODO:` no
  início do comentário continua barrado — verificado.
- `npm run boundaries` emite 2 **warnings** de "órfão" para os arquivos de token. Esperado:
  eles são consumidos por teste e por CSS, não por import. Warning não quebra o build; erro sim.
- **Jogar exige o acervo importado.** Desde a Etapa 2 passo 2, responder uma atividade lê
  `Activity` pelo `sourceRef`. Num banco sem `npm run content:import`, a criança recebe
  "esta atividade ainda não está publicada". O erro é explícito de propósito — o alternativo
  seria gravar tentativa órfã e descobrir o problema num relatório vazio.
- **`/api/outbox` é fail-closed.** Sem `CRON_SECRET`, responde 503 e a telemetria nunca é
  gravada. Luz e Fagulhas **não** dependem dele — são `inline`, na transação da tentativa. Se
  `LearningEvent` estiver vazio em produção, o segredo é o primeiro lugar para olhar.
- **Mensagem de outbox parada é sintoma, não ruído.** `processedAt` nulo com `attempts` no teto
  significa que um manipulador falha sempre; `lastError` diz qual. A linha não é apagada de
  propósito: mensagem que some é um efeito que ninguém sabe que faltou.
- **Abrir a missão é uma ação, nunca efeito de render.** O Next pré-carrega links; iniciar no
  render cobraria Fôlego por missões que a criança nunca jogou. Se alguém mover `abrirJogada`
  para dentro de um Server Component, é este o defeito que aparece — e ele aparece como "o
  Fôlego dela some sozinho".
- **Pergunta que aponta para objetos precisa mostrar os objetos.** A primeira atividade do
  acervo perguntava "quantas são **estas** conchas?" e não mostrava nenhuma — impossível de
  responder, e nenhum teste pegou porque nenhum perguntava "dá para responder?". Hoje
  `tests/policy/pergunta-respondivel.test.ts` quebra o build. Ao autorar, declare `apoio`
  (ver `src/activities/stimulus.ts`).
- **Estado de renderer não sobrevive à troca de atividade** — o executor passa
  `key={slug:tentativa}`. Sem isso, a opção marcada numa atividade continuava marcada na
  seguinte, com "Responder" aceso e um id que nem existia ali.
- **`crypto.randomUUID()` exige contexto seguro.** O executor de missão gera a chave de
  idempotência no navegador. Em `http://` que não seja `localhost` a função não existe e o
  envio falha. Em produção é HTTPS; num túnel de teste por HTTP, não.
- `prisma format` reordena o arquivo. Rode antes de commitar para evitar diff sujo.
- O `package.json` tem `prisma.seed`, que o Prisma 7 vai depreciar → `prisma.config.ts`.
- `npm audit` acusa 3 vulnerabilidades **altas** em dependências transitivas do Next
  (`sharp`/libvips, `postcss`). A correção exige Next 16 — mudança de major, fora do escopo
  desta etapa. Avaliar ao planejar a Etapa 1.
- **`npm run test:integration` pode apagar a fixture da Fila de Revisão.** Os arquivos mais
  antigos (`quest.integration.test.ts`, `slot-selection.integration.test.ts`) limpam `Academy`,
  `Quest`, `Stage`, `StageActivity` **sem filtro** no próprio `beforeAll`/`afterAll`, para
  reconstruir o acervo a partir de `content/`. Isso apaga `Academy` "sistema" e tudo debaixo dela
  junto — e ela não volta sozinha, porque não é conteúdo reimportável. Cada arquivo que precisa da
  fixture já se defende com `garantirFixtureDeRevisao` (upsert no próprio `beforeAll` — ver
  `review-queue.integration.test.ts` e `content-bridge.integration.test.ts`), então a suíte
  inteira passa mesmo assim; o que pode faltar é a fixture **depois** da suíte rodar, se algo de
  fora dela (uma sessão manual, por exemplo) contar com ela ter sobrevivido. Nunca acontece em
  produção — a suíte de integração não roda no deploy — mas aconteceu duas vezes rodando local
  nesta sessão. Se precisar dela fora de teste, reaplique
  `psql "$DATABASE_URL" -f prisma/migrations/20260806234721_fila_de_revisao_fixture/migration.sql`.

---

## 10. Ao terminar uma etapa

1. Rode `npm run verify`, `npm run test:integration` e `npm run build`.
2. **Atualize este arquivo** — mova o que foi feito da seção 5 para a seção 3,
   e escreva a próxima tarefa. Um handoff desatualizado é pior que nenhum.
3. Commit com mensagem descritiva; push na branch de trabalho.
