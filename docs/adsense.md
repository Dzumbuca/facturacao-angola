# Google AdSense — Machine Facturas (machinefaturas.shop)

Integração do Google AdSense nas páginas **públicas** do site, respeitando as políticas do Google e sem tocar na área de gestão.

## O que está implementado

| Peça | Ficheiro | Papel |
| --- | --- | --- |
| Client ID oficial (única fonte) | `src/lib/adsense.ts` | `ca-pub-9283668518139905` — mesmo valor já presente no projeto (`public/ads.txt`) |
| Loader do AdSense | `src/components/site-footer.tsx` | `next/script` (id fixo `adsense-loader`, `afterInteractive`) — carrega **apenas para visitantes**, em todas as páginas públicas com rodapé |
| Bloco de anúncio manual | `src/components/adsense-unit.tsx` | `<ins class="adsbygoogle">` com padrão oficial `(adsbygoogle=window.adsbygoogle||[]).push({})`, com guardas anti-duplicação |
| Espaço publicitário | `src/components/adsense-slot.tsx` | Env-gate + rótulo «Publicidade» + altura reservada (evita CLS); **nunca** renderiza para clientes autenticados |
| `ads.txt` | `public/ads.txt` | Já correto: `google.com, pub-9283668518139905, DIRECT, f08c47fec0942fa0` |

### Colocações (todas env-gated — sem env definida, nada renderiza)

1. **`/inicio`** — entre as secções de funcionalidades e preços → `NEXT_PUBLIC_ADSENSE_SLOT_INICIO_MID`
2. **Acima do rodapé** — todas as páginas públicas com `SiteFooter` (`/inicio`, `/ferramentas*`, `/guias/*`, `/privacidade`, `/termos`) → `NEXT_PUBLIC_ADSENSE_SLOT_INPAGE`

## Onde NÃO há anúncios AdSense (garantido por construção)

- Painel privado dos clientes (`AppShell`, dashboard, facturas, documentos, clientes, produtos, relatórios, empresa)
- Emissão/consulta de facturas e documentos empresariais, incluindo os links públicos `/f/[token]` e `/r/[token]`
- Formulários e fluxos de autenticação (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding`, …)
- Área administrativa (`/admin/*`) e páginas de pagamento (`/pagamento`)

O loader do AdSense é renderizado **só quando não existe sessão** — mesmo nas páginas de ferramentas vistas por clientes autenticados (cujo rodapé público é escondido por CSS), o script deixou de ser transferido.

> Nota: o anúncio de plataforma no topo das ferramentas/guias públicas e na sidebar FREE (Adsterra, gerido em `/admin/configuracoes` via `platformConfig.adHtml`) é funcionalidade **existente** e não foi alterado. O `AdHtml` já tem guarda própria que evita carregar o loader do AdSense em duplicado caso esse HTML contenha código AdSense.

## Passos que dependem da tua conta Google AdSense

1. **Confirma o site** em [ads.google.com → AdSense → Sites](https://adsense.google.com): adiciona/verifica `https://machinefaturas.shop`. O loader já serve o código de verificação nas páginas públicas (o Google rastreia como visitante anónimo).
2. **`ads.txt`** — já publicado em `https://machinefaturas.shop/ads.txt` (o Next.js serve `public/` automaticamente). Verifica no AdSense que o estado fica "Autorizado". Se a tua conta usar valores diferentes, corrige `public/ads.txt` com os dados oficiais.
3. **Anúncios automáticos (opcional, recomendado)** — em AdSense → Anúncios → Por site, ativa os Anúncios automáticos para `machinefaturas.shop`. Com o loader presente, o Google coloca e otimiza anúncios sozinho (sem precisar de IDs de blocos).
4. **Blocos de anúncios manuais (opcional)** — cria unidades em AdSense → Anúncios → Por site/unidades, copia o **ID do bloco** (só o número de `data-ad-slot="…"`) e define as variáveis de ambiente no Vercel (ou `.env.local` em dev):
   ```bash
   NEXT_PUBLIC_ADSENSE_SLOT_INICIO_MID="1234567890"
   NEXT_PUBLIC_ADSENSE_SLOT_INPAGE="9876543210"
   ```
   Faz redeploy. Enquanto não definires, os espaços ficam vazios (a página fica exactamente igual a hoje).
5. **Políticas** — não cliques nos teus próprios anúncios; deixa o Google moderar as colocações (os espaços estão longe de botões/links e com rótulo «Publicidade»).

## Verificação pós-deploy

- `https://machinefaturas.shop/ads.txt` devolve a linha do ficheiro
- View-source de `/inicio` contém `adsbygoogle.js?client=ca-pub-9283668518139905` **apenas como visitante** (sem sessão)
- Painel privado (com sessão): view-source **não** contém `adsbygoogle`
- Consola do browser sem erros `adsbygoogle` nos blocos activos
