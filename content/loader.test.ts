import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registroPadrao } from "@/activities";

import { carregarAcervo, validarReferenciasEConfigs } from "./loader";

/**
 * O validador de conteúdo só vale se pegar conteúdo quebrado.
 *
 * Cada teste aqui monta um acervo defeituoso de verdade em disco e exige que o
 * problema seja apontado — com o arquivo e a explicação. Um validador que passa
 * em tudo é pior que nenhum: dá falsa segurança.
 */

let raiz: string;

const CURRICULO = {
  slug: "matematica",
  nome: "Matemática",
  competencias: [
    {
      slug: "numeros",
      nome: "Números",
      descricao: "Contagem e comparação de quantidades pequenas.",
      objetivos: [
        { slug: "contar-ate-10", descricao: "Contar coleções de até 10 objetos.", codigoBncc: "EF01MA01" },
      ],
    },
  ],
};

const MISSAO_BOA = {
  slug: "missao-01-teste",
  nome: "Missão de teste",
  tipo: "PRACTICE",
  ordem: 1,
  introducao: "Uma introdução com tamanho suficiente para o schema.",
  conclusao: "Terminamos por aqui.",
  fases: [
    {
      slug: "fase-01",
      nome: "Primeira fase",
      atividades: [
        {
          slug: "atividade-01",
          tipo: "MULTIPLE_CHOICE",
          objetivo: "contar-ate-10",
          faixaMinima: "SPROUT",
          faixaMaxima: "SPROUT",
          config: {
            schemaVersion: 1,
            enunciado: "Quantas conchas?",
            opcoes: [
              { id: "a", texto: "3", correta: false, ensino: "Conte de novo." },
              { id: "b", texto: "4", correta: true },
            ],
            mensagemDeAcerto: "Isso!",
          },
        },
      ],
    },
  ],
};

const NIVEL_PADRAO = { slug: "nivel-01", nome: "Nível 1", ordem: 1 };

/** Referência completa da `MISSAO_BOA` desta fixture — o mesmo formato de `questCompleted`/`mapa.nos[].missaoRef`. */
const REF_DA_MISSAO_BOA = "conhecimento/matematica/SPROUT/nivel-01/modulo-01/missao-01-teste";

async function escreverAcervo(
  missao: unknown,
  curriculo: unknown = CURRICULO,
  nivel: unknown = NIVEL_PADRAO,
): Promise<void> {
  const dirModulo = join(
    raiz,
    "academias/conhecimento/matematica/SPROUT/nivel-01/modulo-01",
  );
  await mkdir(join(raiz, "curriculo"), { recursive: true });
  await mkdir(dirModulo, { recursive: true });

  await writeFile(join(raiz, "curriculo/matematica.json"), JSON.stringify(curriculo));
  await writeFile(
    join(raiz, "academias/conhecimento/academia.json"),
    JSON.stringify({
      slug: "conhecimento",
      nome: "Conhecimento",
      ilha: "Ilha das Mil Perguntas",
      guardiao: "ORLA",
      descricao: "A primeira ilha do Arquipélago Crescente.",
      ordem: 1,
      paleta: { de: "#4F46E5", para: "#22D3EE", brilho: "rgba(79,70,229,0.45)" },
    }),
  );
  await writeFile(
    join(raiz, "academias/conhecimento/matematica/disciplina.json"),
    JSON.stringify({ slug: "matematica", nome: "Matemática", curriculo: "matematica" }),
  );
  await writeFile(
    join(raiz, "academias/conhecimento/matematica/SPROUT/nivel-01/nivel.json"),
    JSON.stringify(nivel),
  );
  await writeFile(
    join(dirModulo, "modulo.json"),
    JSON.stringify({ slug: "modulo-01", nome: "Módulo 1", ordem: 1 }),
  );
  await writeFile(join(dirModulo, "missao-01.json"), JSON.stringify(missao));
}

async function problemas(): Promise<string[]> {
  const { acervo, problemas: formato } = await carregarAcervo(raiz);
  const referencias = validarReferenciasEConfigs(acervo, registroPadrao);
  return [...formato, ...referencias].map((p) => p.mensagem);
}

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "acervo-"));
});

afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe("carregamento", () => {
  it("encontra a missão pela estrutura de pastas, sem índice central", async () => {
    await escreverAcervo(MISSAO_BOA);
    const { acervo } = await carregarAcervo(raiz);

    expect(acervo.missoes).toHaveLength(1);
    expect(acervo.missoes[0]).toMatchObject({
      academia: "conhecimento",
      disciplina: "matematica",
      faixa: "SPROUT",
      nivel: "nivel-01",
      modulo: "modulo-01",
    });
  });

  it("acervo válido não gera problema nenhum", async () => {
    await escreverAcervo(MISSAO_BOA);
    expect(await problemas()).toEqual([]);
  });
});

describe("o validador pega conteúdo quebrado", () => {
  it("opção incorreta sem ensino — a regra central do produto", async () => {
    await escreverAcervo({
      ...MISSAO_BOA,
      fases: [
        {
          ...MISSAO_BOA.fases[0],
          atividades: [
            {
              ...MISSAO_BOA.fases[0]?.atividades[0],
              config: {
                schemaVersion: 1,
                enunciado: "Quantas conchas?",
                opcoes: [
                  { id: "a", texto: "3", correta: false },
                  { id: "b", texto: "4", correta: true },
                ],
                mensagemDeAcerto: "Isso!",
              },
            },
          ],
        },
      ],
    });

    expect((await problemas()).join(" ")).toContain("ensino");
  });

  it("objetivo que não existe no currículo", async () => {
    await escreverAcervo({
      ...MISSAO_BOA,
      fases: [
        {
          ...MISSAO_BOA.fases[0],
          atividades: [
            { ...MISSAO_BOA.fases[0]?.atividades[0], objetivo: "objetivo-inventado" },
          ],
        },
      ],
    });

    expect((await problemas()).join(" ")).toContain("objetivo-inventado");
  });

  it("tipo de atividade sem plugin registrado — e diz quais existem", async () => {
    await escreverAcervo({
      ...MISSAO_BOA,
      fases: [
        {
          ...MISSAO_BOA.fases[0],
          atividades: [{ ...MISSAO_BOA.fases[0]?.atividades[0], tipo: "BUILD_3D" }],
        },
      ],
    });

    const encontrados = (await problemas()).join(" ");
    expect(encontrados).toContain("BUILD_3D");
    expect(encontrados).toContain("MULTIPLE_CHOICE");
  });

  it("pré-requisito apontando para objetivo inexistente quebraria o DAG", async () => {
    await escreverAcervo(MISSAO_BOA, {
      ...CURRICULO,
      competencias: [
        {
          ...CURRICULO.competencias[0],
          objetivos: [
            {
              slug: "contar-ate-10",
              descricao: "Contar coleções de até 10 objetos.",
              preRequisitos: ["objetivo-fantasma"],
            },
          ],
        },
      ],
    });

    expect((await problemas()).join(" ")).toContain("objetivo-fantasma");
  });

  it("fase que exige mais acertos do que tem atividades", async () => {
    await escreverAcervo({
      ...MISSAO_BOA,
      fases: [{ ...MISSAO_BOA.fases[0], minimoParaPassar: 5 }],
    });

    expect((await problemas()).join(" ")).toContain("5 acertos");
  });

  it("slug de atividade repetido dentro da mesma missão", async () => {
    const atividade = MISSAO_BOA.fases[0]?.atividades[0];
    await escreverAcervo({
      ...MISSAO_BOA,
      fases: [{ ...MISSAO_BOA.fases[0], atividades: [atividade, atividade] }],
    });

    expect((await problemas()).join(" ")).toContain("repetido");
  });

  it("JSON malformado é relatado, não derruba o carregador", async () => {
    await escreverAcervo(MISSAO_BOA);
    await writeFile(
      join(raiz, "academias/conhecimento/matematica/SPROUT/nivel-01/modulo-01/missao-02.json"),
      "{ isto não é json",
    );

    expect((await problemas()).join(" ")).toContain("JSON inválido");
  });

  it("mapa: nó apontando para missão inexistente", async () => {
    await escreverAcervo(MISSAO_BOA, CURRICULO, {
      ...NIVEL_PADRAO,
      mapa: { nos: [{ missaoRef: "missao-fantasma", x: 10, y: 10 }] },
    });

    const mensagens = await problemas();
    expect(mensagens.join(" ")).toContain("missao-fantasma");
    // A missão de verdade também fica sem nó — as duas mensagens aparecem.
    expect(mensagens.join(" ")).toContain(REF_DA_MISSAO_BOA);
  });

  it("mapa: aresta apontando para nó que não existe", async () => {
    await escreverAcervo(MISSAO_BOA, CURRICULO, {
      ...NIVEL_PADRAO,
      mapa: {
        nos: [{ missaoRef: REF_DA_MISSAO_BOA, x: 10, y: 10 }],
        arestas: [{ de: REF_DA_MISSAO_BOA, para: "no-que-nao-existe" }],
      },
    });

    expect((await problemas()).join(" ")).toContain("no-que-nao-existe");
  });

  it("mapa: missão do nível sem nó no mapa", async () => {
    await escreverAcervo(MISSAO_BOA, CURRICULO, {
      ...NIVEL_PADRAO,
      mapa: { nos: [{ missaoRef: "conhecimento/matematica/SPROUT/nivel-01/modulo-01/missao-02", x: 10, y: 10 }] },
    });
    // Missão extra que o mapa acima não cobre — só ela teria nó, faltaria a MISSAO_BOA.
    await writeFile(
      join(raiz, "academias/conhecimento/matematica/SPROUT/nivel-01/modulo-01/missao-02.json"),
      JSON.stringify({ ...MISSAO_BOA, slug: "missao-02" }),
    );

    expect((await problemas()).join(" ")).toContain(`a missão "${REF_DA_MISSAO_BOA}" não tem nó`);
  });

  it("mapa completo e correto não gera problema nenhum", async () => {
    await escreverAcervo(MISSAO_BOA, CURRICULO, {
      ...NIVEL_PADRAO,
      mapa: { nos: [{ missaoRef: REF_DA_MISSAO_BOA, x: 10, y: 10 }] },
    });

    expect(await problemas()).toEqual([]);
  });

  it("ordem correta citando id inexistente (validação do plugin, não do schema de autoria)", async () => {
    await escreverAcervo({
      ...MISSAO_BOA,
      fases: [
        {
          ...MISSAO_BOA.fases[0],
          atividades: [
            {
              ...MISSAO_BOA.fases[0]?.atividades[0],
              tipo: "ORDER_SEQUENCE",
              config: {
                schemaVersion: 1,
                enunciado: "Coloque em ordem.",
                itens: [
                  { id: "n1", texto: "1" },
                  { id: "n2", texto: "2" },
                ],
                ordemCorreta: ["n1", "n42"],
                mensagemDeAcerto: "Isso!",
                ensino: "Comece pelo menor.",
              },
            },
          ],
        },
      ],
    });

    expect((await problemas()).join(" ")).toContain("n42");
  });
});
