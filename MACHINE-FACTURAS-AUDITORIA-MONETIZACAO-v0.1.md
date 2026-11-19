# MACHINE FACTURAS — Auditoria de Monetização
## v0.1 — Receita imediata sem dependência de subscrições

**Data:** 2026-11-16
**Natureza:** auditoria de leitura. **Nenhuma** alteração funcional, migração ou configuração foi executada.
**Ambiente de evidência:** staging `localhost:5432/machine_facturas_staging` (planos carregados); código em `feat/machine-rh-b1-calendar`.
**Não tocar em**: Supabase, Vercel, integrações, payroll (Etapa A), schema em produção, código de subscrições.

---

## 1. Resumo executivo

O Machine Facturas tem **dois canais de monetização activos**: (1) quota de emissão grátis acompanhada de publicidade e desbloqueio por visualização de anúncio (AdUnlock), e (2) planos pagos Básico/Profissional/Empresarial com comprovativo Multicaixa Express e activação manual por administrador.

**Conclusão objectiva:** antes da formalização da empresa e do acordo com a EMIS, **a única fonte realista e imediata de receita é a oferta de Serviços** (Setup empresarial, migração de dados, formação, assistência técnica, personalização de documentos), vendidos **directamente pelo administrador/dono**, sem intermediário. Subscrições (já codificadas em sistema) devem aguardar a autorização legal de cobranças; publicidade serve apenas para reduzir fricção na quota do plano grátis.

---

## 2. Arquitectura actual de monetização

### 2.1. Fluxo ponta-a-ponta

```
Landing (/inicio) ─► Conta grátis criada (15 facturas/mês)
                       │
                       ▼
               Primeira emissão OK
                       │
                       ▼
         Quota atingida  ─►  pagina mostra:
                             "Suba de plano" (Link → /pagamento)
                               │
              ┌────────────────┴───────────────────┐
              │                                      │
           Paga:                                 Grátis:
  /pagamento → form → prova              Visão do anúncio de 20s →
  → PENDENTE                             AdUnlock GRANTED → +1 emissão
  → Admin revê → CONFIRMADO               (consumível atómico token 1 emissão)
  → Subscription criada, empresa passa a PRO
```

### 2.2. Componentes técnicos (inventário)

| Componente | Ficheiro | Papel |
|---|---|---|
| Planos | `prisma/schema.prisma` (`SubscriptionPlan`, `PlanLimit`, `PlanCapability`, `PlanPayment`, `TenantSubscription`, `PlanApplication`) | Catálogo |
| Quota | `src/lib/invoice-quota.ts` (FREE_INVOICE_LIMIT_MONTHLY = 15) | Aplica o limite |
| Upsell (in-app) | `src/components/invoice-form.tsx` (linha 227: aviso de quota) + `/invoices/page.tsx` (banner PRO) | Conversão |
| Pagamento plano | `/pagamento` + `payment-form.tsx` + `PLATFORM_PAYMENT` | Receita |
| Admin pagamento | `reviewPlanPayment` (`src/lib/admin-actions.ts`) | Acciona |
| Ad unlock | `src/lib/ad-unlock-service.ts` + `src/lib/ad-unlock-core.ts` + `/api/ads/unlock/*` + `AdUnlockModal` | "Pague com atenção" |
| AdHtml (banner) | `src/components/ad-html.tsx` + `PlatformConfig.adHtml` | Canais de publicidade |
| 20 superfícies com AdHtml | ver §4.2 | Publicidade |

### 2.3. Arquitectura da quota e da conversão

- `FREE_INVOICE_LIMIT_MONTHLY = 15`
- A quota surte efeito na mesma transacção de emissão; atingir o limite travav / bloqueia emissão nova; existe o botão "Fazer upgrade →" e pop-up no formulário
- Após atingir quota, veem-se: aviso básico, banner Pro com gradient, call-to-action para Pro → /pagamento
- **AdUnlock**: cada empresa no plano grátis pode "assistir" a um anúncio (20 s) para receber +1 emissão. Regulatório por tenant (`AdUnlock` estado: PENDING → GRANTED → CONSUMED, com lock atômico na tx de emissão)

---

## 3. Diagnóstico da publicidade

### 3.1. Superfícies visíveis com AdHtml hoje

| # | Página | Segmento | Notas |
|---|---|---|---|
| 1 | `/inicio` | visitantes anónimos | antes do pricing; descoberta produto |
| 2 | `/ferramentas/iva` | SMEs a calcular IVA | alto SEO pot. |
| 3 | `/ferramentas/factura-proforma` | empresários a cotar | directo ao alvo |
| 4 | `/ferramentas/lucro` | gestores a margem | directo |
| 5 | `/ferramentas/mapa-despesas` | contabilidade | directo |
| 6 | `/ferramentas/nif` | qualquer utilizador | topo funnel |
| 7 | `/ferramentas/orcamento-pdf` | equipa comercial | directo |
| 8 | `/ferramentas/page.tsx` | ferramentas hub | index |
| 9 | `/ferramentas/preco-venda` | definições | directo |
| 10 | `/ferramentas/recibos` | facturação | directo |
| 11 | `/ferramentas/salario` | cálculo de salário | directo |
| 12 | `/guias/emitir-facturas` | aprender | alto intent |
| 13 | `/guias/registar-empresa` | pré-registar | alto intent |
| 14 | `/guias/saft` | exportação | altíssimo intent |
| 15 | `/academia/page.tsx` | público geral | top-of-funnel |
| 16 | `/academia/[slug]/page.tsx` | leitores de artigos | top-of-funnel |
| 17 | `components/app-shell.tsx` | in-app | **sensível** — dashboard, dados da empresa |
| 18 | `components/ad-unlock-modal.tsx` | modal pay-with-attention | táctica de conversão |
| 19 | `components/platform-ad.tsx` | wrapper central | utilitário |
| 20 | `app-shell.tsx` mobile | mobile-only | reutilizado |

**Total: 20 matches `AdHtml html=`.**

As páginas 1-16 são públicas; as 19 são público + in-app; a 17 (proxy dashboard) entra em todos os papéis autenticados (que tenham visualizado para entregar indicação para publicidade).

### 3.2. Estrutura dos anúncios

- `PlatformConfig.adHtml` (global): bloco cru de HTML. O administrador escreve qualquer coisa; `src/components/ad-html.tsx` executa `innerHTML` + `<script>` inline.
- O conteúdo aparece em todos os utilizadores do plano grátis.
- Pro / Empresas PRO: `adHtml` invisível (plano == 'PRO' → não renderiza).
- **Nenhum controlo editorial, nenhum sandboxing, nenhum parâmetro de segmentação**; a única "inteligência" é plans.

### 3.3. Risco técnico — a maior exposição

- **Nós de código arbitrário** em cada utilizador grátis: pode roubar NIF, morada fiscal, stats de clientes; exfiltram dados para muu ponto fora de Angola.
- **Performance**: cada página carrega 1-3 scripts externos (network `ad-server.{invalid}` genérico implementado pelo admin; scripts inline na página do ecrã de desbloqueio); bloqueio de interação no mobile.
- **Respeito à privacidade**: Angola/PRA exige tratamento declarado de dados pessoais — sem banner de consentimento + listagem do que o terceiro recebe → violação clara de LGPD/PRA angolana (LDPA-?) ainda não madura em decisões judiciais.
- **Impacto comercial**: não há dados reais de CTR/CPM em Portugal — o mercado de publicidade angolana é anémico, escala é limitada.

### 3.4. Monetizar sem JavaScript de terceiros

- Banner próprio (imagem 1200×250) em `/inicio` antes do pricing — CPM não é irrelevante mas imperceptível para negócio novo.
- Emprestar espaço para empresas angolanas com presença local (Unitel, Movicel, Mega Soft, Soluções Angola, agences de tripas) via **contato humano** — não existe automatização; não há problema em fazê-la manual.

---

## 4. Diagnóstico das subscrições

### 4.1. Estados encontrados em BD (staging)

Planos encontrados (parcial, em ordem crescente de preço, PMT mensal):

| Plano | Preço/mês | Preço anual | Billing |
|---|---|---|---|
| free / gratis | 0 | 0 | MONTHLY |
| stock | 2 500 | 30 000 | MONTHLY |
| rh | 3 500 | 42 000 | MONTHLY |
| basico | 5 000 | 51 000 | MONTHLY |
| business | 5 000 | 60 000 | MONTHLY |
| profissional | 12 500 | 127 500 | MONTHLY |
| empresarial | 25 000 | 255 000 | MONTHLY |

Limits (estrutura em `PlanLimit`):

```
gratis:  max_invoices_per_month=15, max_clients=30, max_products=30, max_warehouses=0
basico:  max_invoices_per_month=100, max_clients=100, max_products=100, max_warehouses=1
profissional:  (sem limites explícitos — ilimitado presumido)
empresarial:    max_warehouses=10
transfers:      basico:f, profissional:t, empresarial:t
```

**Entrega**: zero linhas em `PlanApplication` e zero em `TenantSubscription`. Significa que a UI mostra coisas que nenhum tenant usa: os pacotes RH/Stock estão vivos em código mas nunca foram vendidos a ninguém.

### 4.2. Fluxo LPAG

```
/pagamento  (logada)
  ↓  form (payerName, payerPhone, proof, planSlug)
POST /api/plan/payment    (src/app/api/plan/payment/route.ts)
   → valida: plano activa (SubscriptionPlan.isActive)
   → charge = resolveCharge(plano, cycle)
   → prova (MAX 3 MB, jpeg/png/webp/pdf)
   → runWithTenant INSERT PlanPayment status='PENDENTE'

Painel Admin `/admin`: Pagamentos pendentes
   → actor requer `companies.suspend` ou equivalente
   → `reviewPlanPayment(id, 'CONFIRMADO' | 'REJEITADO', reason)`
       → CONFIRMADO: criar TenantSubscription (endsAt, autoRenew)
       → auditoria em AdminAuditLog (PLATFORM_PLAN_PAYMENT_APPROVED)
```

### 4.3. Avaliação da implementação

| Dimensão | Estado |
|---|---|
| Estrutura de catálogo (BD) | ✅ completa |
| Catálogo dos módulos (RH/stock/business) | ✅ |
| Página pública de pricing (/inicio) | ✅ |
| Página de pagamento interno (/pagamento) | ✅ |
| Validações do formulário (nome, telefone ≥ 9 dígitos, prova obrigatória) | ✅ |
| Admin review funcional | ✅ (reviewPlanPayment) |
| Cálculo de montante/duração no UI | ✅ |
| Notificação / factura da subscrição | ❌ |
| Integração EMIS/Auto Bank Pay | ❌ (aguarda) |
| Reconciliação bancária automática | ❌ |
| Comprovante de ativação / termos de serviço | ⚠️ |
| Suspensão por não-pagamento | ❌ |

### 4.4. Bloco de segurança — mesmo plano de paginação, mesmo vazamento

- `PlanoRevisão` exige `companies.suspend` (role SUPERADMIN/ADMIN)
- A chamada usa `runWithTenant` — **sem `runAsAdmin`** — ou seja, sem bypassrls preparado para rotinas cross-tenant
- Administrador vê **nome/telefone de pagadores** — dados sensíveis (PII angolana) que deveriam ser auditados com protocolo separado

---

## 5. Diagnóstico dos pagamentos

### 5.1. Estado dos pagamentos na BD (staging)

```
Tenant      plan
PRO         2 linhas       (são empresas PRO já registadas)
TenantSubscription → 0     (ninguém verdadeiramente PRO)
PlanPayment         → 0     (ninguém alguma vez pediu revisão/activação)
EmailRequestLimit   → 0
```

**Conclusão:** a cobrança dos planos ainda não foi exercida por nenhum cliente pagante.

### 5.2. Pagamento — o que existe hoje

- **Facturas** normalmente: evidência de cliente que leu/facturou; pagamento registado pela empresa manualmente dentro do /recebiveis (nova feature adicionada nesta revisão, PENDING → CONFIRMED).
- **Planos pagos (cobrança da plataforma)**: existe mecânica completa em código (formulário → revisão → activação), mas está **desativada na prática**: nenhum pagamento foi criado desde a aplicação no deploy; nenhuma empresa recebeu proposta formal; nenhum contrato assinado.

### 5.3. Prontidão técnica da proposta

- Pronto: estrutura multi-plano, limites por tenant, capability flags
- Pronto: vertical de ativação (reviewPlanPayment + auditoria)
- Pronto: tela pública de pricing + link direto para /pagamento
- Pronto: quotas no código aplicadas por cliente
- Pronto: UI de administração (/admin) para gestão de planos
- Pronto: "Fazer upgrade" entry points do quota usado
- Parcial: UX de checkout — não há confirmação electrónica nem recibo
- Parcial: não há factura automática da mensalidade para o cliente
- Parcial: não existe regra de suspensão automática por não pagamento
- Ausente: cobrança automática (EMIS); integração com dezena-em-dezenas

---

## 6. Oportunidades de receitas imediatas

### 6.1. Serviços técnicos e profissionais — 100% imediato

| Serviço | Descrição inclusiva | Esforço/empresa | Valor estimado (Kz) | Dependência |
|---|---|---|---|---|
| **Setup empresarial completo** | Mapeamento NIF, morada, SAFT inicial, registo no sistema, importação de produtos/clientes/facturamento aberto (Excel) | 6-10 h | 40 000 – 120 000 | nenhuma |
| **Setup + Formato/Logo SAFT no PDF** | Personalizar PDF (logótipo, cabeçalho, rodapé, mensagem automática) | 1-2 h | 10 000 – 40 000 | nenhuma |
| **Formação ao vivo** (presencial/remotas) da equipa | 2 × 1h30: BD, produtos, emissao, SAFT, recebimentos | meio dia | 15 000 – 60 000 | nenhuma |
| **Assistência técnica** (suporte prioritário por hora) | Resposta em 24 h business, hourly rate | 1 h | 5 000 – 20 000 | nenhuma |
| **Consultoria pré-formação especializada** | Revisão do processo de vendas/contabilidade com feedback escrito | 4-8 h | 30 000 – 100 000 | nenhuma |
| **Migração de Excel/legado para Machine Facturas** | Clientes, fornecedores, facturas em aberto, stock | 4-10 h | 30 000 – 150 000 | nenhuma |
| **Integração Contabilidade (parceiro)** | Intermediação com gabinete contabilístico parceiro | variável | 20 000 – 80 000 ou comissão | parceiro (gostoso, não técnico) |

**Abordagem:** pronto-a-usar directo no site/APP; landing pages; formulário de contacto (WhatsApp); proposta por e-mail.

### 6.2. Oportunidades de indicação / parceria

- **Afiliados regionais**: recompensa por subscrição convertida com link único e tracking simples — pinóquio, sem infraestrutura de countless rows (manual, olhe 20-30% duma primeira mensalidade).

### 6.3. Oportunidades dependentes de acções externas

- **PLAC**: está por formalização da empresa e do acordo com a EMIS para cobranças automatizadas.
- **Marketplace de templates**: depende de patrocinadores / prova de demanda que hoje não existe.

---

## 7. Oportunidades futuras (pós-formalização)

- **Integração EMIS (Paynet/ Multicaixa)**: QRCode/transferência direta, recibo automático, proforma → factura, reconciliação bancária automática, fluxo de registo
- **Assinatura recorrente via débito automático** com integração EMIS
- **API para parceiros** (apps de contabilidade parceira, POS, software de gestão de pân)
- **Marca branca** ("Máquina Facturação por [Sua Empresa]") — tarifa premium
- **Programa de certificação contabilística/facturação** para contabilistas angolanos
- **Bundle com payroll** (RH) para manter clientes com liquidez — redução de churn

---

## 8. Riscos técnicos e comerciais

### 8.1. Riscos técnicos

| Risco | Severidade | Impacto | Mitigação |
|---|---|---|---|
| AdHtml arbitrário | 🔴 Alta | XSS contra dados empresariais | Sandbox/iframe; restrição de domínios; consentimento explícito |
| performance despendida por scripts de publicidade | 🟡 Média | UX / SEO | Remover in-app; manter só na landing |
| 30 facturas num plano grátis → dry promotion sem valor | 🟢 Baixa/G | Ninguém paga pelo grátis, mas ganha-se targetão; funny | Funnel em aberto |
| `free` e `gratis` duplicados na BD | 🟡 Média | confusão ao editor | limpeza governada |
| Email marketing ainda não configurado | 🟡 Média | nenhum nurturing free→pago | baseline de email + campanha |

### 8.2. Riscos comerciais

- Publicidade em redtrack email de utentes no dashboard = endorsement sem idade
- Não ter nenhum caso de cliente (NPS, quote) — conversão comercial depende do boca-a-boca

### 8.3. Riscos legais (Angola)

- **Acordo de tratamento de dados pessoais (LDPA)**: sem consentimento declarado explicitamente, o deslindamento entra em área cinzenta; a prática de publicidade sem aviso prévio precisa de ser corrigível
- **Marketplace de templates**: cada template é produto — cada um terá de ser licenciado se vendorizado de terceiros
- **Cobranças de pessoa colectiva sem contrato assinado**: exposição dej super guarantee direta; direito de sigilo de bancaria

---

## 9. Recomendações priorizadas

### 🔴 P0 — Essencial (executar antes de qualquer comunicação)

**R1.** Retire the platform adHtml in the dashboard and hidden surfaces (/rh, /admin). Only on marketing surfaces.
**R2.** Do not activate subscription payments before legal formalisation and the bank agreement. Keep SubscriptionPlan.isActive=true only if legitimately offered; disable all checkout paths on the pago page for the moment (CTA → call).
**R3.** Abordagem formal de leads: mensagem toast com "Pessoa a quem foi atribuido o sistema" + contacto do suporte- geral para para perguntas comerciais.
**R4.** Contratos de pagamento/ERM com paragens funcionais (pendências) — pagamentos devem ser imutáveis no encadeamento final.

### 🟡 P1 — Elevada prioridade (esta semana)

**R5.** Launch the pay-for-services menu: Setup, Training, Audit, Template Customisation. Public prices must be in Kwanza (sem discriminação de país no pricing).
**R6.** Prepare four cases of real clients (propôs cliente side presenters) as "antes e depois" measurements to prove value (VBA/estima de tempo economizado);
**R7.** Change the free-tier upgrade path: when user hits the quota, give a one-click WhatsApp CTA directly to sales instead of the relative /pagamento page — more conversion friendly.
**R8.** Freeze all ads from /admin and /rh pages, leaving only in marketing.

### 🟢 P2 — Média prioridade (este mês)

**R9.** Activate opt-in newsletter (compliance) + drip-convert for free users (email facts).
**R10.** Add "Teste uma factura no teu negócio" CTA above the fold.
**R11.** Auditoria de preços: benchmarks

### 🟡 P3 — Futuro (dependency)

**R12.** EMIS / marketplace templates.

---


## 10. Plano de implementação por fases

### Fase 0 — Pré-formação (0-2 dias)

- [ ] Página de Serviços com 3 pacotes (Setup, Treino, Consultoria)
- [ ] Preços em Kwanza publicados
- [ ] CTA via whatsapp/email
- [ ] Casos "antes e depois" (pedir 2-3 empresas)

### Fase 1 — Pre-eminente (1-2 semanas)

- [ ] Remover publicidade dentro de /rh e /admin
- [ ] Freeze de subscription público (CTAs não funcionais, redirecionando para commercial)
- [ ] Opt-in de newsletter para clientes ativos
- [ ] Acompanhamento diário do limit hitting: KPIs por empresa (via consultor de dados)

### Fase 2 — Formalização (depende de terceiros)

- [ ] Contrato + EMIS → integrar cobrança automática
- [ ] Conformidade com a AGT nos contratos

### Fase 3 — Escala

- [ ] Marketplace templates
- [ ] White label
- [ ] Afiliados com tracking real

---

## 11. Estimativa de esforço

| Item | Dias |
|---|---|
| 5.1 Section (Serviços) de documentação + landing | 1 |
| 5.3 Offering page (web) | 1 |
| 6.1 Drip-email/opt-in | 2 |
| R8. Remoção de ads in-app | 0.5 |
| 6.3 Mapeamento de competidores e preço forward | 1 |
| **Total (FASE 0)** | **4-6 dias** |

---

## 12. Matriz de oportunidade × dependência

| Oportunidade | Pode implementar agora | Depende de formalização | Depende da EMIS | Depende de parceiros |
|---|---|---|---|---|
| Setup empresarial | ✅ | não | não | não |
| Treino/Formação | ✅ | não | não | não |
| Assistência técnica | ✅ | não | não | não |
| Personalização/logo | ✅ | não | não | não |
| Programa de afiliados | ✅ | não | não | não |
| Subscrições | ⚠️ pronto no código, mas oculto | ✅ | não | não |
| EMIS / cobranças automatiz. | não | ✅ | ✅ | não |
| Marketplace templates | parcial | ✅ | não | ✅ |
| Ad-revenue management | ✅ | não | não | não |

---

## 13. Recomendação objectiva

> **Recomendação final:**
>
> Antes da formalização da empresa e do acordo com a EMIS, a monetização real possível é por **serviços one-off diretamente vendidos aos utilizadores** (Setup / Treino / Suporte prioritário / Personalização de documentos), com CTA imediato no site e contacto directo via WhatsApp/phone. As subscrições (já prontas no código) devem ser **reactivadas apenas depois da formalização** e do acordo com a EMIS — para evitar cobrar sem contrato, sem registo comercial e sem possibilidade de execução fiscal. A publicidade interna só deve ser mantida fora do painel de decisão sensível (dashboard, /rh, /admin) e substituída por avisos úteis (ex.: lembrete de quota / stock).
