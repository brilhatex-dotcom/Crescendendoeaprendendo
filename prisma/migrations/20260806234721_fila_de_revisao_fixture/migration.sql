-- Fixture de sistema: a missão "Fila de Revisão" (docs/08 §7).
--
-- É a única missão do acervo que usa slot dinâmico do modo "revisao"
-- (`StageActivity.slotRule = {"modo":"revisao"}`) — e por isso não vem de
-- `content/` como o resto: ela não é conteúdo pedagógico autorado, é a mesma
-- competência que o SM-2 (`ReviewCard.dueAt`) já escolheu, preenchida em
-- tempo de jogo por `resolverSlotsDaMissao`. Dado de sistema, não de
-- currículo — por isso entra numa migration, não num arquivo de `content/`
-- (ver docs/HANDOFF.md).
--
-- Cinco slots: teto razoável de uma sessão de revisão diária. Fila vencida
-- mais curta que isso deixa slot sem dono, e a mesclagem já sabe descartar
-- (o mesmo destino de qualquer slot sem candidata — nada quebra).
--
-- A academia "sistema" existe só para satisfazer a cadeia de chaves
-- estrangeiras que toda `Quest` precisa (Chapter → World → Academy); o leitor
-- do mapa a exclui da lista de ilhas (`prisma-map-reader.ts`) — é
-- infraestrutura, não uma ilha do arquipélago.

INSERT INTO "Academy" (id, slug, name, "islandName", guardian, theme, "order", "minLevel", "createdAt", "updatedAt")
VALUES ('sys_academia_revisao', 'sistema', 'Sistema', 'Farol', 'SISTEMA', '{}', 9999, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "World" (id, "academyId", slug, name, "mapLayout", "minLevel", "order", "createdAt", "updatedAt")
VALUES ('sys_mundo_revisao', 'sys_academia_revisao', 'fila-de-revisao', 'Fila de Revisão', '{"schemaVersion":1,"nos":[],"arestas":[]}', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "Chapter" (id, "worldId", name, story, "order")
VALUES ('sys_capitulo_revisao', 'sys_mundo_revisao', 'Revisão', '{}', 0);

INSERT INTO "Quest" (id, "chapterId", kind, name, narrative, "rewardXp", "rewardCoins", "rewardCrystals", "requiredSkills", "unlockRule", "order", "createdAt", "updatedAt", "sourceRef")
VALUES (
  'sys_missao_revisao',
  'sys_capitulo_revisao',
  'REVIEW',
  'Fila de Revisão',
  '{"introducao":"Hora de olhar de novo para o que você já aprendeu — antes que escape.","conclusao":"Isso ficou guardado. Até a próxima revisão!"}',
  20,
  5,
  0,
  ARRAY[]::TEXT[],
  '{}',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'sistema/fila-de-revisao'
);

INSERT INTO "Stage" (id, "questId", "order", rule)
VALUES ('sys_fase_revisao', 'sys_missao_revisao', 0, '{}');

INSERT INTO "StageActivity" ("stageId", "activityId", "slotRule", "order")
VALUES
  ('sys_fase_revisao', NULL, '{"modo":"revisao"}', 0),
  ('sys_fase_revisao', NULL, '{"modo":"revisao"}', 1),
  ('sys_fase_revisao', NULL, '{"modo":"revisao"}', 2),
  ('sys_fase_revisao', NULL, '{"modo":"revisao"}', 3),
  ('sys_fase_revisao', NULL, '{"modo":"revisao"}', 4);
