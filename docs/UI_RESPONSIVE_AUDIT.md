# Auditoria visual e responsiva — Machine Facturas

**Data:** 2026-11-09 · **Âmbito:** área autenticada (tenant) + landing pública
**Sem alterações de regras de negócio, autenticação, base de dados ou integrações.**

---

## 1. Problemas encontrados

### Navegação
- Não existia navegação móvel própria: só um *hamburger* que abria a mesma sidebar do desktop.
- Sidebar duplicava funcionalidades no telemóvel e escondia o menu inteiro atrás de um clique.
- Sem identificação da página activa na navegação móvel.
- Conteúdo podia ficar sob a barra inferior (não existia reserva de espaço).
- Sem suporte a *safe areas* (iPhone com notch/home indicator).

### Design system
- Tabelas largas dependiam de `overflow-x-auto` página a página; qualquer contentor sem `min-width: 0` podia empurrar o layout.
- Campos com `font-size` < 16px provocavam zoom automático no iOS ao focar.
- Dimensões de botões/inputs variavam (uns 36px, outros 44px).
- Cabeçalhos e espaçamentos inconsistentes entre módulos.
- Preços desactualizados na landing (`9.900`/`19.900`) e textos antigos ("20 facturas").
- Gradientes/sombras decorativas em excesso na sidebar e cartões de plano.

### Responsividade
- Risco de overflow horizontal em páginas com grelhas/flex sem `min-w-0`.
- Modais já usavam `max-h`/bottom-sheet em parte dos casos, mas sem padrão global.
- Landing com 3 planos desactualizados e tabela comparativa de 3 colunas.

---

## 2. Alterações implementadas

### Componentes novos
| Ficheiro | Função |
|---|---|
| `src/components/nav-icons.tsx` | Ícones SVG partilhados (home, receipt, users, box, more, layers, wallet, etc.) |
| `src/components/mobile-bottom-nav.tsx` | Bottom navigation fixa (Início · Operações · Clientes · Produtos · Mais) + folha "Mais" |
| `docs/UI_RESPONSIVE_AUDIT.md` | Este documento |

### Componentes globais alterados
| Ficheiro | Alteração |
|---|---|
| `src/components/app-shell.tsx` | Removido o drawer móvel duplicado; sidebar só em `md+`; cabeçalho sticky compacto; conteúdo com `pb-28`; bottom nav integrada; WMS respeitado no menu "Mais" |
| `src/app/(dashboard)/layout.tsx` | Passa `wmsEnabled` ao shell (menu móvel só mostra armazém quando o módulo está activo) |
| `src/app/globals.css` | `overflow-x: clip`, `min-width: 0` em conteúdo/grelhas, `max-width` de media, `.table-scroll`, animação da folha, `font-size:16px` em mobile para evitar zoom iOS |
| `src/app/inicio/page.tsx` | Preços e planos actualizados (Grátis/Básico/Profissional/Empresarial), grelha responsiva de 4 planos e tabela comparativa de 5 colunas |

### Navegação móvel
- **Início** `/`, **Operações** `/invoices`, **Clientes** `/customers`, **Produtos** `/produtos`, **Mais**.
- **Mais** agrupa: Documentos, Ferramentas, Armazém e stock + Armazéns (só com WMS), Relatórios, Aplicações, Empresa, Plano e pagamento.
- Ligações de plataforma (`/admin`) só para administradores.
- Estado activo com barra superior, ícone em pílula e `aria-current`.
- `aria-expanded`/`aria-controls`, `role="dialog"`, fecho por `Escape`, bloqueio de scroll e reposição de foco.
- Safe area: `env(safe-area-inset-bottom)` na barra e na folha.
- Conteúdo nunca fica sob a barra: `main { padding-bottom: 7rem }` em mobile (112px).

---

## 3. Páginas verificadas

Dashboard, Facturas (lista/nova/detalhe), Clientes, Produtos, Armazém (`/stock` e subpáginas), Armazéns, Relatórios, Documentos, Empresa, Pagamentos, Aplicações, Ferramentas — via teste Playwright responsivo em:

- **Mobile:** 360, 375, 390, 430 px
- **Tablet:** 768, 1024 px
- **Desktop:** 1366, 1440, 1920 px

O teste verifica `scrollWidth - innerWidth <= 1` (sem scroll horizontal), visibilidade/ocultação da bottom nav e reserva de espaço no `main`.

---

## 4. Segunda iteração — limitações resolvidas

| Limitação anterior | Resolução |
|---|---|
| Tabelas só rolavam em mobile | **`ResponsiveTables`**: lê os cabeçalhos e escreve `data-label` em cada célula; no mobile a tabela vira cartões (sem duplicar markup). Reanota em paginação/filtros via `MutationObserver`. Aplica-se a toda a área autenticada e ao admin. |
| Admin sem bottom nav | **`AdminMobileNav`** com Visão geral, Empresas, Utilizadores, Pagamentos e folha Mais (Equipa, Documentos, Emails, Auditoria, Sistema, Configurações, Voltar à app, Terminar sessão), filtrada por permissões. Shell admin passou a `hidden md:flex`, cabeçalho sticky e `pb-28`. |
| Tema escuro incompleto nos novos componentes | Novos remaps para `bg-white/95`, `bg-[#f7f9fc]/95`, `bg-[#eef4ff]`, `bg-[#f2f6fb]`, `text-[#9aa8b8]`, `bg-[#c8d2de]` e cartões de tabela. |
| Validação local indisponível | Criada base PostgreSQL 18 local em `127.0.0.1:5441` (`wms_e2e_disposable`) com roles; corrida local de **324 unitários + 13 Playwright** (3 saltados por design no projecto mobile). |

### Componentes novos desta iteração
| Ficheiro | Função |
|---|---|
| `src/components/responsive-tables.tsx` | Anotador global de tabelas → cartões mobile |
| `src/components/mobile-nav-base.tsx` | Base partilhada da navegação móvel (tenant e admin) |
| `src/components/admin-mobile-nav.tsx` | Bottom nav do painel de administração |

### Limitações remanescentes
- Tabelas com mais de 5–6 colunas em ecrãs de 360px podem exigir scroll dentro do cartão; os rótulos mantêm a leitura.
- O teste responsivo cobre as páginas principais; páginas secundárias herdam o comportamento global mas não têm asserção dedicada.
- O tema escuro é um remapeamento de classes existentes, não uma reescrita de todos os ecrãs.
