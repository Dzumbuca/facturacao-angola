# PWA — instalação em Android e iPhone

**Data:** 2026-11-10 · **Sem alterações de facturação, autenticação, pagamentos ou base de dados.**

## Auditoria inicial

O projeto já tinha PWA parcial:

- `public/manifest.json` com `display: standalone` e `start_url: "/"`, mas **os ícones eram o `logo.png` (800×600)** declarado como 192×192/512×512, e `logo.png` não tem zona segura maskable.
- Cores fora da identidade: `theme_color: #2563eb`, `background_color: #0f172a` (o azul institucional é `#021f87`).
- `public/sw.js` com cache v1, sem os ícones no precache e a pré-cachear `/` (HTML autenticado).
- Registo do SW já existia (`<Script id="sw-register">` no layout) — **mantido**.
- Sem `appleWebApp`, sem `apple-touch-icon`, sem botão de instalação, sem detecção de standalone.

## O que foi implementado

### Manifest
- `id`, `scope`, `start_url`, `display: standalone` + `display_override`, `orientation: any`.
- `theme_color: #021f87`, `background_color: #ffffff`, `lang: pt-AO`.
- 4 ícones: 192/512 `any` e 192/512 `maskable`.
- Atalhos: Nova factura, Clientes, Armazém.

### Ícones oficiais
- `scripts/generate-pwa-icons.py` recorta o conteúdo do **`public/logo.png` oficial** e centra-o em fundo branco; **não há redesenho nem logótipo alternativo**.
- Gerados: `public/icons/icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180).
- Splash iOS: `splash-1170x2532.png`, `splash-1290x2796.png`, `splash-2048x2732.png`.

### Metadados
- `metadata.icons` (PWA + Apple), `metadata.appleWebApp` (`capable`, `title`, `statusBarStyle`, `startupImage`).
- `viewport.themeColor = #021f87` e `viewportFit: cover` (safe areas no standalone).

### Service Worker
- **O mesmo `sw.js`**, versão `machine-facturas-static-v3`.
- Precache: `/offline`, manifest, logo e todos os ícones.
- Removido `/` do precache (HTML autenticado); navegação continua network-first com fallback offline.
- Endpoints sensíveis continuam fora da cache.

### Instalação
- `src/lib/pwa.ts` — deteção de standalone, iPhone/iPad (incl. iPadOS como Mac com toque), Safari iOS, dispensa de 30 dias.
- `src/components/pwa-install.tsx`:
  - `beforeinstallprompt` guardado e usado no botão;
  - iOS/Safari: folha com os 3 passos (Partilhar → Adicionar ao ecrã principal → Adicionar);
  - se não for Safari no iPhone, avisa para abrir no Safari;
  - deteta `display-mode: standalone`, `navigator.standalone` e `appinstalled`;
  - botão flutuante acima da bottom nav, só em mobile (`md:hidden`), com dispensa de 30 dias;
  - ignora a aplicação desktop Electron.
- Integrado no `AppShell`; `main` passou a `pb-36` para o botão não cobrir conteúdo.

## Ficheiros

| Tipo | Ficheiros |
|---|---|
| Novos | `src/lib/pwa.ts`, `src/lib/pwa.test.ts`, `src/components/pwa-install.tsx`, `e2e/pwa.spec.ts`, `scripts/generate-pwa-icons.py`, `public/icons/*` |
| Alterados | `public/manifest.json`, `public/sw.js`, `src/app/layout.tsx`, `src/components/app-shell.tsx`, `src/components/nav-icons.tsx` |

## Testes

| Teste | Resultado |
|---|---|
| Unitários (`pwa.test.ts`) | deteção iOS/standalone/dispensa ✅ |
| Manifest + ícones (HTTP) | 200, `image/png`, campos corretos ✅ |
| Service Worker | regista e ativa ✅ |
| Desktop | botão de instalação ausente ✅ |
| iPhone/Safari | botão + instruções “Adicionar ao ecrã principal” ✅ |
| Android | handler `beforeinstallprompt` e ocultação após aceitar ✅ |
| Build de produção | OK |

**Limitação:** o prompt nativo real do Chrome Android só pode ser validado num dispositivo/Chrome com critérios de instalação; o teste cobre o handler e o fluxo, não o diálogo do sistema.

### Execução local (2026-11-10)

- PostgreSQL 18 descartável em `127.0.0.1:5441` (`wms_e2e_disposable`) com roles RLS.
- **329 unitários · 36 E2E HTTP · 18 Playwright** (13 no projeto desktop + 5 no mobile), incluindo os 5 testes PWA.
- Build de produção OK.
