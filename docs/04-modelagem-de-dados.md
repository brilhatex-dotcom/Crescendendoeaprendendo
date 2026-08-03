# 04 — Modelagem de Dados (Prisma + Neon PostgreSQL)

> Este documento é o **contrato do schema**. A implementação em `prisma/schema.prisma` deve
> corresponder a ele; divergência exige ADR.

## 1. Decisões transversais

| Decisão | Escolha | Motivo |
|---|---|---|
| Chaves primárias | `String @id @default(cuid(2))` para entidades de domínio; `BigInt` autoincrement para tabelas de evento | cuid2 é opaco (não vaza volume/ordem) e amigável a sharding; eventos priorizam escrita sequencial |
| Timestamps | `createdAt`/`updatedAt` em toda entidade, `timestamptz` | auditoria e ordenação estáveis |
| Exclusão | *soft delete* (`deletedAt`) em dados de pessoa; hard delete no fluxo LGPD | reversibilidade operacional sem violar direito de exclusão |
| Enums | `enum` nativo do Postgres para conjuntos estáveis; tabela de referência quando o produto edita | performance vs. flexibilidade |
| Dados variáveis | `Json` **sempre** com schema Zod correspondente e `schemaVersion` | flexibilidade sem perder validação |
| Dinheiro/moeda | `Int` (unidades inteiras), nunca `Float` | evita erro de ponto flutuante |
| Domínio/probabilidade | `Decimal(5,4)` | precisão determinística em BKT/Elo |
| Multi-tenant | `organizationId` nulo = conta familiar; preenchido = escola | um modelo, dois mercados |
| Escrita de evento | append-only, particionada por mês | volume alto, leitura analítica |

Extensões Postgres: `pg_trgm` (busca em conteúdo administrativo), `pgcrypto` (hashing/UUID),
`btree_gin` (índices compostos em filtros de conteúdo).

---

## 2. Identidade, RBAC e consentimento

```prisma
enum AccountRole { GUARDIAN TEACHER SCHOOL_ADMIN CONTENT_AUTHOR MODERATOR PLATFORM_ADMIN }
enum AccountStatus { PENDING_VERIFICATION ACTIVE SUSPENDED DELETED }

model Account {                          // SEMPRE adulto. Criança nunca é Account.
  id             String   @id @default(cuid(2))
  email          String   @unique
  emailVerifiedAt DateTime?
  passwordHash   String?                  // null = apenas OAuth
  name           String
  locale         String   @default("pt-BR")
  status         AccountStatus @default(PENDING_VERIFICATION)
  parentPinHash  String?                  // step-up para área adulta e troca de perfil
  mfaSecret      String?                  // TOTP, obrigatório para SCHOOL_ADMIN/PLATFORM_ADMIN
  lastLoginAt    DateTime?
  deletedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  roles          AccountRoleAssignment[]
  guardianships  GuardianLink[]
  sessions       Session[]
  consents       Consent[]

  @@index([status, createdAt])
  @@index([deletedAt])
}

model AccountRoleAssignment {             // RBAC: papel é sempre escopado
  id             String   @id @default(cuid(2))
  accountId      String
  role           AccountRole
  organizationId String?                  // null = escopo pessoal/familiar
  grantedById    String?
  createdAt      DateTime @default(now())

  account        Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  organization   Organization? @relation(fields: [organizationId], references: [id])

  @@unique([accountId, role, organizationId])
  @@index([organizationId, role])
}

model Organization {                      // escola/rede
  id        String @id @default(cuid(2))
  name      String
  slug      String @unique
  plan      String @default("school_basic")
  settings  Json                          // schemaVersion + políticas da escola
  createdAt DateTime @default(now())
  deletedAt DateTime?
}

model Session {                           // sessões adultas (estratégia de banco)
  id           String   @id @default(cuid(2))
  accountId    String
  tokenHash    String   @unique           // guardamos hash, nunca o token
  ipHash       String?                    // pseudonimizado
  userAgent    String?
  activeLearnerId String?                 // sub-sessão de criança em vigor
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())

  account      Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([accountId, expiresAt])
  @@index([expiresAt])                    // limpeza periódica
}

model Consent {                           // LGPD: prova de consentimento parental
  id           String @id @default(cuid(2))
  accountId    String
  learnerId    String?
  type         ConsentType                // PARENTAL_DATA, AI_TUTOR, ANALYTICS, MEDIA_UPLOAD
  version      String                     // versão do texto aceito
  granted      Boolean
  ipHash       String
  createdAt    DateTime @default(now())

  account      Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  @@index([learnerId, type, createdAt])
}

enum ConsentType { PARENTAL_DATA AI_TUTOR ANALYTICS MEDIA_UPLOAD CLASSROOM_ENROLL }
```

Tabelas do Auth.js (`Account` OAuth, `VerificationToken`) são mapeadas com nomes próprios
(`OAuthAccount`) para não colidir com o `Account` de domínio.

---

## 3. Criança (Learner)

```prisma
enum AgeBand { SPROUT EXPLORER PIONEER VANGUARD }

model Learner {
  id             String  @id @default(cuid(2))
  displayName    String                     // apelido, NUNCA nome completo obrigatório
  birthYear      Int                        // ano apenas — minimização de dados
  ageBand        AgeBand
  avatarConfig   Json                       // camadas do avatar (schemaVersion)
  locale         String  @default("pt-BR")
  organizationId String?
  pseudonymId    String  @unique @default(cuid(2))  // id usado em telemetria/IA
  deletedAt      DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  settings       LearnerSettings?
  guardians      GuardianLink[]
  progress       LearnerProgress?
  wallet         Wallet?
  masteries      SkillMastery[]
  attempts       Attempt[]
  enrollments    ClassroomEnrollment[]

  @@index([organizationId])
  @@index([ageBand])
}

model LearnerSettings {
  learnerId       String  @id
  soundEnabled    Boolean @default(true)
  musicEnabled    Boolean @default(true)
  reducedMotion   Boolean @default(false)
  dyslexiaFont    Boolean @default(false)
  highContrast    Boolean @default(false)
  textToSpeech    Boolean @default(true)     // padrão true em SPROUT
  aiTutorEnabled  Boolean @default(true)
  captionsEnabled Boolean @default(true)
  learner         Learner @relation(fields: [learnerId], references: [id], onDelete: Cascade)
}

model GuardianLink {
  id         String @id @default(cuid(2))
  accountId  String
  learnerId  String
  relation   String                          // mãe, pai, responsável…
  isPrimary  Boolean @default(false)
  createdAt  DateTime @default(now())

  account    Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  learner    Learner @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  @@unique([accountId, learnerId])
  @@index([learnerId])
}
```

---

## 4. Currículo (grafo de competências)

```prisma
model Subject {                              // Língua Portuguesa, Matemática, Xadrez, Finanças…
  id        String @id @default(cuid(2))
  code      String @unique                   // 'PT', 'MA', 'CI', 'FIN', 'PROG'
  name      String
  academyId String
  order     Int
  strands   Strand[]
  academy   Academy @relation(fields: [academyId], references: [id])
}

model Strand {                               // unidade temática (BNCC) ou eixo
  id        String @id @default(cuid(2))
  subjectId String
  code      String
  name      String
  order     Int
  skills    Skill[]
  subject   Subject @relation(fields: [subjectId], references: [id], onDelete: Cascade)
  @@unique([subjectId, code])
}

model Skill {                                // habilidade/competência — nó do DAG
  id            String @id @default(cuid(2))
  strandId      String
  bnccCode      String?                      // 'EF04MA05' quando aplicável
  name          String
  description   String
  minAgeBand    AgeBand
  maxAgeBand    AgeBand
  difficultyRef Decimal @db.Decimal(6,3)     // dificuldade de referência (escala Elo)
  order         Int

  strand        Strand @relation(fields: [strandId], references: [id], onDelete: Cascade)
  objectives    Objective[]
  prerequisites SkillPrerequisite[] @relation("dependent")
  unlocks       SkillPrerequisite[] @relation("prerequisite")
  masteries     SkillMastery[]

  @@unique([strandId, name])
  @@index([bnccCode])
  @@index([minAgeBand, maxAgeBand])
}

model SkillPrerequisite {                    // aresta do DAG (ciclo barrado em validação de conteúdo)
  skillId        String
  prerequisiteId String
  strength       Decimal @db.Decimal(3,2) @default(1.0)  // 1 = obrigatório, <1 = recomendado
  skill          Skill @relation("dependent", fields: [skillId], references: [id], onDelete: Cascade)
  prerequisite   Skill @relation("prerequisite", fields: [prerequisiteId], references: [id], onDelete: Cascade)
  @@id([skillId, prerequisiteId])
  @@index([prerequisiteId])
}

model Objective {                            // objetivo verificável dentro da competência
  id       String @id @default(cuid(2))
  skillId  String
  name     String
  order    Int
  skill    Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)
  activities Activity[]
}
```

---

## 5. Conteúdo e atividades

```prisma
enum ActivityType {
  MULTIPLE_CHOICE MULTI_SELECT TRUE_FALSE FILL_BLANK WORD_BUILD DRAG_MATCH
  ORDER_SEQUENCE NUMBER_LINE GRID_PUZZLE MEMORY_PAIRS SPEED_TAP STORY_BRANCH
  CHESS_PUZZLE CODE_BLOCKS DRAWING_CANVAS AUDIO_RECORD FREE_TEXT PHOTO_PROOF SIMULATION BUILD_3D
}
enum ContentStatus { DRAFT IN_REVIEW APPROVED PUBLISHED ARCHIVED }
enum ContentOrigin { CURATED AI_GENERATED AI_ASSISTED IMPORTED }

model ContentPack {                          // unidade de publicação e cache
  id        String @id @default(cuid(2))
  slug      String @unique
  version   Int    @default(1)
  status    ContentStatus @default(DRAFT)
  publishedAt DateTime?
  activities Activity[]
  @@index([status, publishedAt])
}

model Activity {
  id            String @id @default(cuid(2))
  packId        String?
  objectiveId   String
  type          ActivityType
  config        Json                          // validado pelo configSchema do plugin
  schemaVersion Int    @default(1)
  difficulty    Decimal @db.Decimal(6,3)      // escala Elo, calibrada por telemetria
  estimatedSec  Int
  minAgeBand    AgeBand
  maxAgeBand    AgeBand
  origin        ContentOrigin @default(CURATED)
  status        ContentStatus @default(DRAFT)
  reviewedById  String?
  locale        String @default("pt-BR")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  objective     Objective @relation(fields: [objectiveId], references: [id])
  pack          ContentPack? @relation(fields: [packId], references: [id])
  stageLinks    StageActivity[]
  attempts      Attempt[]

  @@index([objectiveId, status, difficulty])
  @@index([type, status])
  @@index([minAgeBand, maxAgeBand, status])
  @@index([origin, status])                   // auditoria de conteúdo gerado por IA
}

model Asset {                                 // mídia no Vercel Blob
  id        String @id @default(cuid(2))
  url       String
  kind      String                            // image, audio, lottie, sprite
  bytes     Int
  checksum  String @unique
  altText   String?                           // acessibilidade obrigatória para imagem
  createdAt DateTime @default(now())
}
```

---

## 6. Mundo, missões e mapa

```prisma
model Academy {                               // Conhecimento, Inteligência, Vida, Tecnologia, Criatividade, Descobertas
  id      String @id @default(cuid(2))
  slug    String @unique
  name    String
  theme   Json                                // tokens de tema do mundo
  order   Int
  worlds  World[]
  subjects Subject[]
}

model World {
  id         String @id @default(cuid(2))
  academyId  String
  slug       String
  name       String
  mapLayout  Json                             // nós, arestas, coordenadas, decoração
  minLevel   Int    @default(1)
  order      Int
  academy    Academy @relation(fields: [academyId], references: [id], onDelete: Cascade)
  chapters   Chapter[]
  @@unique([academyId, slug])
}

model Chapter {
  id       String @id @default(cuid(2))
  worldId  String
  name     String
  story    Json                                // roteiro, personagens, diálogos
  order    Int
  world    World @relation(fields: [worldId], references: [id], onDelete: Cascade)
  quests   Quest[]
}

enum QuestKind { STORY PRACTICE CHALLENGE BOSS REVIEW PROJECT FAMILY DAILY }

model Quest {
  id            String @id @default(cuid(2))
  chapterId     String
  kind          QuestKind
  name          String
  narrative     Json
  rewardXp      Int
  rewardCoins   Int
  rewardCrystals Int @default(0)
  requiredSkills String[]                      // ids de Skill que o chefão cobra
  unlockRule    Json                           // regra declarativa avaliada pelo motor
  order         Int
  chapter       Chapter @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  stages        Stage[]
  runs          QuestRun[]
  @@index([chapterId, order])
  @@index([kind])
}

model Stage {
  id        String @id @default(cuid(2))
  questId   String
  order     Int
  rule      Json                                // nº de atividades, critério de aprovação
  quest     Quest @relation(fields: [questId], references: [id], onDelete: Cascade)
  activities StageActivity[]
  @@unique([questId, order])
}

model StageActivity {                           // atividade fixa OU slot dinâmico
  stageId    String
  activityId String?                            // null = slot preenchido por seleção adaptativa
  slotRule   Json?                              // ex.: { objectiveId, difficultyDelta: 0.3 }
  order      Int
  stage      Stage @relation(fields: [stageId], references: [id], onDelete: Cascade)
  activity   Activity? @relation(fields: [activityId], references: [id])
  @@id([stageId, order])
}
```

O **slot dinâmico** é o que permite que a mesma missão seja diferente para cada criança sem
duplicar conteúdo: a narrativa é fixa, as atividades vêm da seleção adaptativa.

---

## 7. Avaliação, domínio e revisão

```prisma
enum AttemptOutcome { CORRECT PARTIAL INCORRECT SKIPPED TIMEOUT }

model QuestRun {                                // uma "jogada" de missão (retomável)
  id         String @id @default(cuid(2))
  learnerId  String
  questId    String
  status     String                             // IN_PROGRESS, COMPLETED, ABANDONED
  stageIndex Int    @default(0)
  score      Int    @default(0)
  startedAt  DateTime @default(now())
  completedAt DateTime?
  rewardsGrantedAt DateTime?                    // idempotência de recompensa
  quest      Quest @relation(fields: [questId], references: [id])
  attempts   Attempt[]
  @@index([learnerId, status, startedAt(sort: Desc)])
  @@unique([learnerId, questId, startedAt])
}

model Attempt {
  id             BigInt @id @default(autoincrement())
  learnerId      String
  activityId     String
  questRunId     String?
  answer         Json
  outcome        AttemptOutcome
  scoreRatio     Decimal @db.Decimal(4,3)
  hintsUsed      Int     @default(0)
  durationMs     Int
  misconception  String?                        // código do equívoco diagnosticado
  idempotencyKey String  @unique                // dedupe de sync offline
  clientEvaluated Boolean @default(false)
  createdAt      DateTime @default(now())

  learner        Learner  @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  activity       Activity @relation(fields: [activityId], references: [id])
  questRun       QuestRun? @relation(fields: [questRunId], references: [id])

  @@index([learnerId, createdAt(sort: Desc)])
  @@index([activityId, outcome])                // calibração de dificuldade
  @@index([learnerId, activityId])
}
// Particionada por RANGE(createdAt) mensal — ver §12.

model SkillMastery {
  learnerId     String
  skillId       String
  probability   Decimal @db.Decimal(5,4)        // BKT: P(domínio)
  ability       Decimal @db.Decimal(6,3)        // Elo do jogador nesta competência
  attemptsCount Int     @default(0)
  correctCount  Int     @default(0)
  streak        Int     @default(0)
  masteredAt    DateTime?
  lastAttemptAt DateTime?
  updatedAt     DateTime @updatedAt

  learner       Learner @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  skill         Skill   @relation(fields: [skillId], references: [id], onDelete: Cascade)
  @@id([learnerId, skillId])
  @@index([learnerId, masteredAt])
  @@index([skillId, probability])
}

model ReviewCard {                              // repetição espaçada (SM-2 adaptado)
  id         String @id @default(cuid(2))
  learnerId  String
  skillId    String
  intervalDays Int     @default(1)
  easeFactor Decimal @db.Decimal(4,2) @default(2.5)
  dueAt      DateTime
  lapses     Int     @default(0)
  @@unique([learnerId, skillId])
  @@index([learnerId, dueAt])                   // fila diária de revisão
}
```

---

## 8. Progressão, economia e coleção

```prisma
enum LevelTier { APRENDIZ EXPLORADOR INVENTOR GUARDIAO MESTRE GENIO SABIO LENDA }

model LearnerProgress {
  learnerId       String @id
  totalXp         Int    @default(0)
  level           Int    @default(1)
  tier            LevelTier @default(APRENDIZ)
  energy          Int    @default(100)
  energyUpdatedAt DateTime @default(now())       // regeneração calculada, não agendada
  streakDays      Int    @default(0)
  streakShields   Int    @default(1)             // "escudo" evita punição ansiogênica
  lastActiveDate  Date?
  minutesToday    Int    @default(0)
  learner         Learner @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  @@index([level])
}

model Unlock {
  id        String @id @default(cuid(2))
  learnerId String
  kind      String                               // WORLD, ACADEMY, POWER, COMPANION, VEHICLE
  refId     String
  createdAt DateTime @default(now())
  @@unique([learnerId, kind, refId])
  @@index([learnerId, kind])
}

enum CurrencyKind { COIN CRYSTAL DIAMOND }

model Wallet {
  learnerId String @id
  coins     Int @default(0)
  crystals  Int @default(0)
  diamonds  Int @default(0)
  updatedAt DateTime @updatedAt
  learner   Learner @relation(fields: [learnerId], references: [id], onDelete: Cascade)
}

model LedgerEntry {                              // razão contábil: saldo é derivável e auditável
  id           BigInt @id @default(autoincrement())
  learnerId    String
  currency     CurrencyKind
  amount       Int                                // positivo = crédito, negativo = débito
  balanceAfter Int
  reason       String                             // QUEST_REWARD, SHOP_PURCHASE, ADJUSTMENT…
  refType      String?
  refId        String?
  idempotencyKey String @unique
  createdAt    DateTime @default(now())
  @@index([learnerId, currency, createdAt(sort: Desc)])
}

model ShopOffer {
  id        String @id @default(cuid(2))
  sku       String @unique
  name      String
  currency  CurrencyKind
  price     Int
  itemKind  String
  payload   Json
  minLevel  Int @default(1)
  activeFrom DateTime?
  activeTo   DateTime?
  @@index([activeFrom, activeTo])
}

model InventoryItem {
  id         String @id @default(cuid(2))
  learnerId  String
  sku        String
  quantity   Int    @default(1)
  equipped   Boolean @default(false)
  acquiredAt DateTime @default(now())
  @@unique([learnerId, sku])
  @@index([learnerId, equipped])
}

model Companion {                                 // mascote
  id         String @id @default(cuid(2))
  learnerId  String @unique
  species    String
  name       String
  stage      Int    @default(1)
  affinityXp Int    @default(0)
  cosmetics  Json
}

model Achievement {
  id          String @id @default(cuid(2))
  code        String @unique
  name        String
  description String
  tier        String                              // BRONZE, PRATA, OURO, LENDÁRIA
  criteria    Json                                // regra declarativa avaliada por evento
  rewardXp    Int @default(0)
  hidden      Boolean @default(false)
}

model LearnerAchievement {
  learnerId     String
  achievementId String
  progress      Decimal @db.Decimal(5,4) @default(0)
  unlockedAt    DateTime?
  @@id([learnerId, achievementId])
  @@index([learnerId, unlockedAt])
}
```

**Por que razão contábil (`LedgerEntry`) e não só saldo:** com milhões de transações e sincronização
offline, "saldo mágico" é impossível de auditar ou corrigir. Com razão, `Wallet` é cache do
somatório; qualquer divergência é detectável por job de reconciliação e corrigível com uma entrada
de ajuste rastreável.

---

## 9. Tutor IA e talentos

```prisma
model TutorSession {
  id          String @id @default(cuid(2))
  learnerId   String
  context     Json                                // skill, questRun, misconception
  tokensIn    Int @default(0)
  tokensOut   Int @default(0)
  costCents   Int @default(0)                     // controle de custo por criança/dia
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  turns       TutorTurn[]
  @@index([learnerId, startedAt(sort: Desc)])
}

model TutorTurn {
  id         BigInt @id @default(autoincrement())
  sessionId  String
  role       String                               // LEARNER, TUTOR, SYSTEM
  content    String
  flagged    Boolean @default(false)
  flagReason String?
  modelId    String?
  latencyMs  Int?
  createdAt  DateTime @default(now())
  session    TutorSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@index([sessionId, createdAt])
  @@index([flagged, createdAt])                   // revisão de segurança
}

model TalentProfile {
  learnerId  String @id
  scores     Json                                 // { MATEMATICO: 0.72, ARTISTA: 0.51, ... }
  dominant   String?
  confidence Decimal @db.Decimal(4,3)
  computedAt DateTime @default(now())
}

model Recommendation {
  id         String @id @default(cuid(2))
  learnerId  String
  kind       String                               // QUEST, REVIEW, PROJECT, BREAK
  refId      String?
  reason     String                               // explicável ao responsável
  score      Decimal @db.Decimal(4,3)
  consumedAt DateTime?
  createdAt  DateTime @default(now())
  @@index([learnerId, consumedAt, score(sort: Desc)])
}
```

---

## 10. Escola, responsável e notificação

```prisma
model Classroom {
  id             String @id @default(cuid(2))
  organizationId String
  teacherId      String
  name           String
  grade          String
  joinCode       String @unique                   // código curto, rotacionável
  archivedAt     DateTime?
  enrollments    ClassroomEnrollment[]
  assignments    Assignment[]
  @@index([organizationId, archivedAt])
}

model ClassroomEnrollment {
  classroomId String
  learnerId   String
  joinedAt    DateTime @default(now())
  @@id([classroomId, learnerId])
  @@index([learnerId])
}

model Assignment {
  id          String @id @default(cuid(2))
  classroomId String
  questId     String?
  skillIds    String[]
  title       String
  dueAt       DateTime?
  createdAt   DateTime @default(now())
  submissions Submission[]
  @@index([classroomId, dueAt])
}

model Submission {
  assignmentId String
  learnerId    String
  status       String                             // PENDING, COMPLETED, LATE
  score        Decimal? @db.Decimal(5,2)
  completedAt  DateTime?
  @@id([assignmentId, learnerId])
  @@index([learnerId, status])
}

model ScreenTimeRule {
  id          String @id @default(cuid(2))
  learnerId   String
  dailyMinutes Int?
  allowedWindows Json                             // [{ dow:1, from:"15:00", to:"18:00" }]
  blockedAcademies String[]
  updatedById String
  updatedAt   DateTime @updatedAt
  @@unique([learnerId])
}

model Notification {
  id        BigInt @id @default(autoincrement())
  accountId String?
  learnerId String?
  kind      String
  payload   Json
  readAt    DateTime?
  sentAt    DateTime?
  createdAt DateTime @default(now())
  @@index([accountId, readAt, createdAt(sort: Desc)])
}
```

---

## 11. Plataforma: auditoria, eventos, outbox, flags

```prisma
model AuditLog {
  id          BigInt @id @default(autoincrement())
  actorType   String                              // ACCOUNT, LEARNER, SYSTEM, AI
  actorId     String?
  action      String                              // learner.settings.update, wallet.adjust…
  targetType  String
  targetId    String
  diff        Json?
  ipHash      String?
  createdAt   DateTime @default(now())
  @@index([targetType, targetId, createdAt(sort: Desc)])
  @@index([actorId, createdAt(sort: Desc)])
}

model LearningEvent {                             // telemetria pseudonimizada (usa pseudonymId)
  id           BigInt @id @default(autoincrement())
  pseudonymId  String
  name         String
  properties   Json
  occurredAt   DateTime
  createdAt    DateTime @default(now())
  @@index([name, occurredAt])
  @@index([pseudonymId, occurredAt])
}

model OutboxMessage {                             // entrega confiável de efeitos assíncronos
  id           BigInt @id @default(autoincrement())
  topic        String
  payload      Json
  availableAt  DateTime @default(now())
  attempts     Int      @default(0)
  processedAt  DateTime?
  lastError    String?
  createdAt    DateTime @default(now())
  @@index([processedAt, availableAt])
}

model FeatureFlag {
  key        String @id
  enabled    Boolean @default(false)
  rollout    Int     @default(0)                  // 0-100 %
  conditions Json?
  updatedAt  DateTime @updatedAt
}
```

---

## 12. Estratégia para milhões de usuários

1. **Particionamento por tempo** em `Attempt`, `LearningEvent`, `TutorTurn`, `AuditLog`,
   `LedgerEntry` (RANGE mensal, criada por job). Consultas quentes tocam 1–2 partições.
2. **Tabelas quentes enxutas:** `LearnerProgress`, `Wallet`, `SkillMastery` são de linha curta e
   atualização frequente — sem `Json` grande, `fillfactor` reduzido para HOT updates.
3. **Índices desenhados a partir das consultas reais** (não "por via das dúvidas"): cada índice
   acima corresponde a uma query listada em `10 §3`. Índice sem query dona é removido.
4. **Sem N+1:** leitura de mapa/mundo é uma query com `include` planejado + cache por tag; o
   progresso do jogador vem de uma segunda query agregada por `learnerId`.
5. **Snapshots de leitura:** relatórios de pais/professores leem `LearnerWeeklySnapshot`
   (materializado por job noturno), não varrem `Attempt`.
6. **Conexões:** Prisma sobre string *pooled* do Neon (PgBouncer, `pgbouncer=true`), `connection_limit`
   baixo por instância serverless; migrations pela string direta.
7. **Idempotência em toda escrita com efeito econômico** (`idempotencyKey`) — pré-requisito para
   sincronização offline e para retry de fila.
8. **Retenção:** telemetria bruta 18 meses → agregada; transcrições do tutor 12 meses (ou o que o
   responsável definir, mínimo 30 dias para segurança); auditoria 5 anos.

## 13. Seeds

| Seed | Conteúdo | Uso |
|---|---|---|
| `seed:core` | Academias, mundos, níveis, conquistas base, ofertas de loja, flags | todos os ambientes |
| `seed:curriculum` | Árvore BNCC de Português e Matemática (1º–5º ano) | todos |
| `seed:content` | Pacotes de atividades da Fase 1 | dev/preview/prod |
| `seed:demo` | Família demo com 2 crianças, 60 dias de histórico realista | preview, vendas, testes |
| `seed:load` | Gerador de 100k learners e 10M attempts | teste de carga |

Seeds são **determinísticos** (semente fixa) para que E2E e snapshots visuais sejam estáveis.
