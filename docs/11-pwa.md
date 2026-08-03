# 11 — PWA, Offline e Instalação

## 1. Objetivo

A plataforma precisa funcionar como **aplicativo instalado** em Android, iOS/iPadOS, Windows, macOS,
Linux e tablets, com atualização automática e funções essenciais offline — sem app store na Fase 1.

## 2. Service Worker

**Serwist** (sucessor mantido do `next-pwa`, compatível com Next 15 / App Router). Estratégias:

| Recurso | Estratégia | Motivo |
|---|---|---|
| Shell do app, DS, fontes, ícones | *Precache* no install | abertura instantânea |
| Assets de conteúdo (sprites, áudio, Lottie) | *Cache first*, versionado por hash | imutáveis |
| Dados de mundo/mapa | *Stale-while-revalidate* | joga já, atualiza depois |
| Dados do jogador | *Network first* com fallback ao último estado | precisão importa |
| Server Actions / mutações | **nunca cacheadas** — vão para a fila offline | integridade |
| Navegação sem rede | fallback `/offline` com missões baixadas | continuidade |

Atualização: novo SW instala em background, e a UI mostra um aviso discreto ("Nova versão pronta —
tocar para atualizar"). Atualização **nunca** interrompe uma missão em andamento; aplica ao final.

## 3. Offline real (não só "abre a tela")

O que funciona sem rede:
- Jogar as **próximas 3 missões da trilha**, pré-baixadas junto com seus assets.
- Fila de revisão do dia.
- Coleções, perfil, mascote, casa (somente leitura + customização local sincronizada depois).
- Avaliação de respostas — a mesma função `evaluate` pura do plugin roda no cliente.

O que exige rede: tutor IA, loja, painéis adultos, turmas, conteúdo novo.

**Sincronização** (`useOfflineQueue` + Background Sync quando disponível):
1. Tentativa salva em IndexedDB com `idempotencyKey` (uuid v7 gerado no cliente).
2. Ao reconectar, envio em lote ordenado por tempo.
3. Servidor reavalia com a função pura autoritativa e responde com o estado canônico.
4. Divergência (relógio adiantado, versão antiga de conteúdo, adulteração) → servidor vence, ajuste
   entra no razão contábil com motivo `OFFLINE_RECONCILE` e o caso vai para auditoria.
5. Recompensas obtidas offline aparecem marcadas como "sincronizando" até confirmação.

Limite: máximo 200 tentativas na fila offline e 72h de janela; além disso, a UI pede conexão.
Isso limita a superfície de exploit sem atrapalhar uso legítimo (viagem, escola sem Wi-Fi).

## 4. Manifest

```jsonc
{
  "name": "Crescendo e Aprendendo",
  "short_name": "Crescendo",
  "id": "/hub",
  "start_url": "/hub?source=pwa",
  "scope": "/",
  "display": "standalone",
  "display_override": ["window-controls-overlay", "standalone"],
  "orientation": "any",
  "background_color": "#0B0620",
  "theme_color": "#7C5CFF",
  "categories": ["education", "kids", "games"],
  "lang": "pt-BR",
  "dir": "ltr",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/mono-512.png", "sizes": "512x512", "type": "image/png", "purpose": "monochrome" }
  ],
  "screenshots": [
    { "src": "/screens/hub-wide.png", "sizes": "1280x720", "form_factor": "wide" },
    { "src": "/screens/map-narrow.png", "sizes": "720x1280", "form_factor": "narrow" }
  ],
  "shortcuts": [
    { "name": "Missão do dia", "url": "/hub?quick=daily" },
    { "name": "Tutor", "url": "/tutor" },
    { "name": "Painel dos pais", "url": "/painel" }
  ],
  "prefer_related_applications": false
}
```

Gerado por Route Handler (`app/manifest.webmanifest/route.ts`) para variar `lang`, atalhos e
`theme_color` por locale e por perfil ativo.

## 5. Ícones e splash

- Fonte única: um SVG mestre → script `scripts/generate-icons.ts` gera todos os tamanhos, incluindo
  *maskable* com zona segura de 20% e variante monocromática.
- iOS: `apple-touch-icon` + telas de splash por tamanho de dispositivo (geradas pelo mesmo script);
  `apple-mobile-web-app-status-bar-style` e `viewport-fit=cover` para telas com *notch*.
- Windows/macOS: instalação via navegador; janela com `window-controls-overlay`.

## 6. Instalação e engajamento

- Prompt de instalação (`beforeinstallprompt`) **adiado**: só é oferecido após a criança concluir a
  primeira missão com sucesso, e o convite aparece para o **responsável**, não para a criança.
- iOS não expõe o evento: instruções ilustradas em `/ajuda/instalar` acionadas de forma contextual.
- Push: **somente para contas adultas** (`Notification` com `accountId`), com consentimento explícito.
  Nenhuma push é enviada a `Learner` (regra de política testada, `08 §12`).

## 7. Restrições e verificação

- Armazenamento: `navigator.storage.persist()` solicitado após instalação; monitoramento de cota,
  limpeza LRU dos assets de missões já concluídas.
- iOS limita quota e pode descartar dados de sites não instalados — por isso a fila offline é
  sincronizada de forma agressiva assim que há rede, sem esperar o fim da sessão.
- Testes obrigatórios: instalação e uso offline validados em Android/Chrome, iOS/Safari,
  Windows/Edge e macOS/Chrome a cada release, com um roteiro de verificação versionado em
  `tests/e2e/pwa.spec.ts` (modo offline do Playwright) + checklist manual para iOS.
