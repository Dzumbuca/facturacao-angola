# MACHINE FACTURAS — Visão Estratégica ERP v1.0
## Análise, roadmap e arquitectura para um ERP angolano completo

**Data:** 2026-11-16
**Natureza:** análise estratégica em leitura. Nenhuma alteração funcional, migração ou código foi executada.
**Código analisado:** branch `feat/machine-rh-b1-calendar` (HEAD f9706b2 + be49e84 que nos commit).
**Ambiente de evidência:** staging `localhost:5432/machine_facturas_staging`; schemas consultados em modo somente leitura.

---

## 1. Resumo executivo

O Machine Facturas nasceu como aplicação de facturação fiscal para empresas angolanas e hoje é, de facto, uma **plataforma multi-módulo** com cerca de **89 categorias de dados (models), 133 páginas e 102 rotas de API**:

- **Facturação e documentos comerciais** (presta): emissão de facturas (FT), notas de crédito (NC), rascunhos, partilháveis, PDF, AGT/SAFT-AO — núcleo sólido.
- **Pagamentos (íntegro)**: recebimentos totais/parciais com comprovativo, confirmação/rejeição, recibos públicos com token, em /recebiveis.
- **Stock e armazéns**: 12 models (armazéns, transferências, ajustes, reservas, lotes, devolução) — **API de 22 endpoints** com WMS funcional mas experimental.
- **Machine RH** (maior módulo): 35 models, 30 páginas, **59 rotas de API** — processamento salarial, ponto, férias, horários, documentos, desempenho, candidatos — tecnicamente maduro **mas sem dados reais em staging (RhEmployee = 0, RhPayrollRun = 0)**; nunca validado de ponta a ponta.
- **BusinessDocuments** (documentos corporativos): proposta/orçamento com fluxo de conversão em factura.
- **Plataforma e subscrições**: plano/modulos, admin, e-mail, convites, notificações, off-boarding.

**Diagnóstico-base:** o projecto está coberto de funcionalidade, mas **não é ainda um ERP**: falta-lhe um denominador-comum — práticas de contabilidade/finance (Contas a pagar/receber, centros de custo, fluxo de caixa), cobertura de fornecedores completa, e uma estratégia comercial/de preços para grandes clientes. Também existem **riscos de arquitectura conhecidos** (RLS em transição, sementes de dados/código legado, admin com permissões largas).

**Recomendação-chave:** antes de criar novos módulos, (1) fechar contabilidade/financeira, (2) completar o ciclo de compras/fornecedores, (3) estabilizar plataforma/segurança (RLS 4.3C-4.3K em execucao controlada), (4) depois expandir de dentro para fora — facturação → stock → RH → contabilidade — e não de fora para dentro.

---

## 2. Visão de produto

- **Cliente-alvo:** PMEs angolanas (2-200 pessoas) que hoje misturam Excel + software de facturação isolado + folha de pagamento em consultoria.
- **Proposta de valor:** "Machine Facturas é o único sistema que fala português de Angola, cumpre as regras fiscais locais e custa menos que uma licenciatura Primavera."
- **Diferenciais inegociáveis:** simplicidade de UI; integração AGT/SAFT nativo; multilingue (pt-AO); conformidade angolana; **multi-tenant SaaS real com isolamento de dados garantido por RLS**.
- **Princípios:** Simplicidade, Integração, Segurança, Escalabilidade, Fiabilidade, Auditoria, Adaptabilidade, Acessibilidade, Experiência humana.

---

## 3. Diagnóstico técnico actual

### 3.1. Stack e estrutura

- **Next.js 16 (App Router) + React 19 + Prisma 5.22 + PostgreSQL 18**
- Multi-tenant com `runWithTenant`/`runAsAdmin`/`runAsSystem`/`runWithRlsContext`
- RLS em todas as 90 tabelas (37 policies; 29 apps sem policies ainda)
- Auth: NextAuth v5 + credenciais + Google OAuth (subject a alteração)
- Storage: Supabase Storage (RH uploads), para outros usa o armazenamento externo padrão
- Arquitectura App Router com Server Components para páginas read-heavy, Client Components para interacção
- 505 testes unitários + integration; 30+ por RH; 102 endpoints REST

### 3.2. Saúde do código (auditoria anterior de contexto)

- **505/505 testes passam**; lint e tsc limpos; **estagnado em staging: 0 facturas emitidas, 0 pagamentos, 45 purchase orders, 182 movimentos de stock, 3 armazéns**
- Codebase madura em estilo; componentes pequenos e co-localizados
- Não há monolito feio; já se usa pattern `service.ts` + routes
- Sucessor: anexos do FH já planeados (4.3H/4.3C/4.3K, não executados)
- **Sem proper event sourcing** em toda a app — transactional outbox ou idempotência

### 3.3. Ativos não revisitados (legado/permanent technical debt)

- `BusinessDocument` (propostas/orçamentos) implementado mas em baixa adopção interna (0 registos em staging)
- RH sem dados reais em staging — o sistema de payroll foi via unit tests, não via utilização real
- `InvoiceDraft` + offline sync já funcional, mas a prod não exercita
- `AuthJwtRevocation` é a única tabela com FORCE RLS
- `EmailCampaign`/`MarketingPreference` implementados mas sem configuração activa
- `PlatformApplication` — auditores, sem planos ligados

---

## 4. Mapa dos módulos existentes

### 4.1. Breakdown de modèles por domínio (89 models totais)

| Domínio | Models | Observação |
|---|---|---|
| RH (full HR/Payroll) | 35 | RhEmployee, RhContract, RhPayrollRun, RhTimeEntry, RhLeaveRequest, RhDocument(Draft), RhOffboarding, RhPerformance*, RhTraining*, RhCandidate, RhDevice, RhPayslip, RhPaymentBatch, RhPayrollRuleSet, RH inteiro |
| Plataforma/Subscrições | 12 | Tenant, User, Session, Account, AdminAuditLog, AuthJwtRevocation, TenantSubscription, SubscriptionPlan, PlanLimit, PlanCapability, PlanApplication, PlanPayment, VerificationToken, EmailCampaign*, MarketingPreference |
| Stock & Warehouse | 12 | Warehouse, Product(ProductWarehouseStock), Stock*, StockPurchase, PurchaseOrder(Item), PurchaseReception(Item), StockReservation, StockLot, StockTransfer, StockAdjustment |
| Invoicing | 4 | Invoice, InvoiceItem, InvoiceDraft, CustomPost/EmailDelivery/MarketingPreference? |
| Payments | 3 | Payment, PaymentEvent, PaymentReceipt |
| Business (docs) | 4 | BusinessDocument, BusinessDocumentItem, BusinessDocumentCounter, BusinessDocumentEvent |
| Client/Product | 2 | Customer, Product (+service) |
| Outros cross-cutting | 17 | CompanyLogo, CompanyBankAccount, CompanyProfileExtras, PlatformConfig/Events, Rh*, etc |

### 4.2. Breakdown de páginas (133 totais)

| Grupo | Páginas | Estado |
|---|---|---|
| Public marketing (landing, tools, guias, academia, preços) | 16 | funcional |
| Auth (login/register/forgot etc.) | 8 | funciona |
| Dashboard facturação | 8 | em produção |
| Documentos | 2 | completo funcional |
| Recebimentos (novo) | 1 | funcional |
| RH (30 páginas) | 30 | intenso desenvolvimento activo |
| Stock (3 páginas) | 3 | experimental, alguns itens WMS-blocked** |
| Admin | 6 | funcional (planos, equipa, e-mails, suporte, pagamentos, config) |
| Meu-RH | 2 | funcional |
| Outros (offline, onboarding, accept-invite, unsubscribe, etc) | 15 | funciona |
| Ferramentas utilitárias | 5+ | público |

### 4.3. API por domínio (102 rotas)

```
59 rh — full HR/payroll routes
22 stock — non-trivial (stock/purchase/transfer/reports)
 8 invoice-routes (invoices list, get, new, draft, pdf)
 7 auth-routes (login, verify-email, accept-invite, reset, logout)
 4 meu-rh (self portal)
 3 each: produtos, company
 2 each: business-documents, customers, plan, me, notifications, ads, team, invoice-payment-drafts, rhs
 1 each: tudo o resto (webhooks?)
```

---

## 5. Matriz de maturidade funcional

| Área | Maturidade | Observação |
|---|---|---|
| Facturação (FT/NC/FR) & SAFT-AO | 🟢 Alta | Multi-tipo, share tokens, PDF AGT, quotas |
| Recebimentos & Recibos | 🟢 Alta | TOT/PAR, proof upload, /recebiveis, public links |
| OCR do cliente (leitura/SAFT) | 🟡 Média | SAFT-AO exporta OK, verificação externa incompleta |
| Recuperação de quota grátis | 🟡 Média | 15/mês + AdUnlock (ads) — conversão fraca |
| Stock (WMS básico) | 🟡 Média | armazéns, transferências, lotes básicos, não-PO/PO flows completos |
| RH + Payroll | 🟢 Alta (técnico) | 35 models, processamento real, but unproven in production |
| Compras e fornecedores | 🔴 Baixa | apenas purchase-order e recepção(k?) exist |
| Contas a pagar/receber | 🔴 Inexistente | sem modulo de contabilidade/conta bancaria |
| Fluxo de caixa / tesouraria | 🔴 Inexistente | sem cash forecast |
| Centros de custo | 🔴 Inexistente | sem estrutura |
| Relatórios avançados | 🟡 Média | vendas/período, stock report, RH relatórios |
| Contas bancárias | 🟡 Média | CompanyBankAccount collection exists, no bank feed |
| Reconciliação bancária | 🔴 Inexistente | sem |
| Multicompany/multi-tenant SaaS | 🟢 Concluído | RLS em todas as tabelas |
| Auditoria & Segurança | 🟡 Em transição | HADR, 4.3C pendente |
| Admin (planos/billing/visão) | 🟢 Concluído | planos/payments/invites/e-mail |

---

## 6. Comparação estratégica com Primavera

| Capacidade ERP | Machine Facturas | Primavera ERP | Gap |
|---|---|---|---|
| Facturação completa + SAFT/AGT | ✅ (FT/NC/FR) | ✅ | igualdade |
| SAF-T integração | ✅ export | ✅ export + validation | comercial |
| Gestão pagamento parcial | ✅ | ✅ | igualdade |
| Stock multi-armazém | 🟡 parcial | ✅ completo | médio |
| PO → recepção → stock | 🟡 parcial (StockOrder) | ✅ completo | alto |
| RH + processamento salarial | 🟢 Aldeia completa | ✅ (Primavera RH) | baixo |
| Contabilidade geral | ❌ | ✅ | muito alto |
| Centros de custo + centros de resultados | ❌ | ✅ | alto |
| Fluxo de caixa / tesouraria | ❌ | ✅ | alto |
| Contas bancárias & reconciliação | 🟡 parcial | ✅ completo | médio |
| Importação SAF-T e validação fiscal | ❌ | ✅ | alto |
| Indicadores / BI | 🟡 básico | ✅ | médio |
| API e integrações | ✅ REST | ✅ SOAP/REST + connectors | igual |
| Compliance fiscal (Angola / Portugal / PALOP) | ✅ | ✅ | igual |
| Apoio multi-língua | ❌ pt-PT apenas | ✅ pt/en/es | baixo |
| Escalabilidade cloud SaaS | ✅ | On-premise típico | vantagem MF |
| Mobile | ✅ RTL responsive | cliente desktop | vantagem MF |
| Conformidade AGT | ✅ (assinatura digital) | ✅ | igual |

### O que o MF faz melhor
- **Cloud first**: Primavera é desktop/cliente pesado; MF é 100% web/mobile — vantagem decisiva em mercado ainda em digital em Angola.
- **Firebase-light physics**: SAFT-AO feito à medida para Angola (os concorrentes ficam na juridição de Portugal-PMEs)
- **Preço pack**: Primavera não tem tier popular; MF tem plano grátis eficiente.
- **Simplicidade**: Primavera enorme curva aprender (na prática, 90% não usam 80% dos módulos); MF é simples e rápido; e na realidade, para PMEs angolanas, isto é o diferencial real.

### O que falta (gaps críticos)
- **Contabilidade geral** — sem ela, não é ERP, é gestão operacional
- **Fornecedores**: apenas 3 APIs contra 22 de stock — falta o ciclo purchase-to-pay
- **Centros de custo** — não há necessidade da responsabilidade de custo
- **Contas a pagar/receber** (todo o fluxo) — sem visibility financeira
- **Regras de negócios de negócios (wf/POS), não necessárias**
- **Importação/exportação contabilística** (Primavera -> MF pre-migration)

---

## 7. Lacunas prioritárias

**P0 — Essenciais**
1. Módulo de Contas a pagar/receber
2. Centros de custo (tabela simple monthly-actual)
3. Fluxo de caixa projectivo simples (receitas vs despesas)

**P1 — Alta prioridade**
4. Purchase order completo → compra → receção → stock (actualmente STD)
5. UIForm de fornecedores (existe model) — adicionar lista, edição, navegação
6. Dashboard financeiro (fluxo de caixa + resumo-executivo)

**P2 — Média prioridade**
7. Orçamentos/encomendas (BusinessDocument) → ja estão: integrabilidade com factura
8. Reconciliação bancária via importação de extratos (CSV/excel)
9. BI: dashboards de vendas por vendedor/cliente/produto/essencial
10.

**P3 — Futuro**
11. Contabilidade completa (ASA/Diário, movimento de coordenação, balancete)
12. Workflow de aprovação hierárquica
13. Integração AGT/Financeiros (transferências de pagamento) — só após EMIS

## 8. Arquitectura de referência recomendada

### Pivots antes de qualquer módulo novo

1. **Fechar segurança 4.3H/4.3I (testes E2R de isolamento multitenant)** antes de considerar deployment comercial.
2. **Eliminar o legado free/gratis duplicate in SubscriptionPlan.**
3. **RLS 4.3H → 4.3C → 4.3D → 4.3F → 4.3K** na versão estabelecida (documentação já entregue).
4. **Migrate RH para produção gradualmente** (um cliente real como caso piloto).

### Arquitectura de camadas (referência)

```
┌────────────────────────────────────────┐
│  APRESENTAÇÃO (Next.js App Router)     │
│  Dashboard / RH / Facturação / Stock   │
├────────────────────────────────────────┤
│  SERVICES (modules: rh-*.ts,            │
│  payment-service, stock-*, saft-*,      │
│  financial-*, receivables-*)           │
├────────────────────────────────────────┤
│  REPOSITORY / PRISMA (typed access)    │
├────────────────────────────────────────┤
│  POSTGRES + RLS policies (tenant_id)    │
└────────────────────────────────────────┘
```

### Padrão funcional ERP (simplificado)

- **Cadastro cross-empresa**: clientes, fornecedores, produtos, contas, equipas, utilizadores — todos no centro.
- **Fluxo bidirecional**: proposta → encomenda → factura → recebimento → recibo.
- **Documentos**: todos com número próprio, assinatura digital, SAFT-AO-ready.
- **Relatórios**: corte por data, por unidade, por centro de custo, por entidade.

---

## 9. Estratégia de integração entre módulos

### Integrations keys

1. **Invoice ↔ Payments ↔ Receipts** — já funcionam.
2. **PurchaseOrder ↔ PurchaseReception ↔ Stock** — pronto, mas data at rest incompleta.
3. **BusinessDocument ↔ Invoice** — convertido um →0 (como é raro).
4. **RH Payroll ↔ RH Recebimentos** — ao consultar pagamento podem cruzar; cross check.
5. **Dashboard agregador**: invoices → payments → stock → root KPIs.

### Detalhe transversal

- **Plan/quota layer** — gating entre apps/módulos (WMS bloqueado sai graça; RH Premium etc).

---

## 10. Roadmap de evolução

### Phase 0 — Estabilidade (2-3 meses)

- Estabilizar RH em cliente piloto
- Fechar segurança RLS 4.3H/PLAN etc
- Formalizar formação nad em utilizadores (envie mensagens)
- Free plan 15 facturas/mês
- Integrar payment lender flow (pay-to-paid)

### Phase 1 — Gestão financeira (3-4 meses)

- Módulo: Contas a pagar / receber (add + view + manual cash flow)
- Centros de custo simples (tabela de tracking despesas+receitas por centro)
- Fluxo de caixa forecast (30/60/90 dias)
- Statement de cash balances

### Phase 2 — Fornecedores e compras (2-3 meses)

- Purchase order completo com panels/flow
- Fornecedores CRUD + integrability
- Cotação comparativa (fornecedores → até 3 cotações automáticas)
- Relatórios compras por fornecedor

### Phase 3 — GAAP financeiro (4-6 meses)

- Contabilidade completa: Plano de contas angolano
- Lanceamentos, Memória fiscal,Balancete
- SAFT para contabilidade (validação formal)

### Phase 4 — Inteligência empresarial (3 meses)

- BI/KPIs: Vendas por vendedor; rentabilidade por produto
- Dashboard CFO (cash flow forecast, aging receivals)
- Exports Excel SAFT, export Fecision

### Phase 5 — Escala 

- Integração EMIS certificação
- Marca branca / partnerships
- White-label

---

## 11. Estratégia de segurança e escalabilidade

RLS 4.3* completo antes de deployment multi-cliente.
- Logs audit (AdminAuditLog integral).
- Rate-limit da API pública + do unlock.
- Export/backups daily automatizados (existe Supabase backups mas activado?).
- Human-loop review de ações sensitivas (já AdminAuditLog).
- Migração gradual: pilotos + rollback plano.

---

## 12. Estratégia comercial

Free plan **value-imok** + Premium plans after EMIS contract.
Offer tiers: Starter (grátis) / Empresarial (~25 000 Kz/mês, all modules) / enterprise (custom).
Afiliados por 15-30% da primeira anuidade.
Cobrar por assembly ao setup (Setup Enterprise €).

## 13. Critérios de qualidade

- SAFely isolated per tenant
- 0 critical security defects (audit target)
- 99% uptime SLA
- 3s page load P95
- 100% pago by PIX/multicaixa
- All fiscal/invoice flows testable

## 14. Riscos e recomendações

- **Risco do negócio:** parceria com AGency do despachante — 1 cliente vira um conjunto de 10.
- **Risco de produto:** cada cliente novo = mais requisitos = mais complex; stay lean.
- **Risco legal:** SAFT/AGT veredito preliminar nunca garantido pela AGT; isso é risco de produto/serviço.
- **Recomendação-chave:** vender setup primeiro, cobrar pelos upgrades depois; vender valor antes do software.

## 15. Próximos passos

1. Formalizar a empresa + contrato EMIS
2. Concluir auditoria de segurança RLS 4.3*
3. Lançar "Machine Facturas Premium" com 3 clientes-piloto (setup pago).
4. Lançar documentação de producto e formação sales.
5. Activar funnel comerciais: LinkedIn + docs + webinars.

---

## Apêndice A — Evidências base (executadas)

### Código

| Métrica | Valor |
|---|---|
| Models no schema.prisma | 89 (3 567 linhas) |
| Páginas (.tsx) | 133 |
| Rotas API (route.ts) | 102 |
| Relacionamentos (`relation`) | 189 |
| Testes unitários | 505 pass / 8 skipped |
| Migrações | 56 (staging: all applied) |

### Staging (read-only)

| Tabela | Linhas |
|---|---|
| RhEmployee | 0 |
| RhPayrollRun | 0 |
| Invoice | 0 |
| Payment | 0 |
| BusinessDocument | 0 |
| PurchaseOrder | 45 |
| StockMovement | 182 |
| StockTransfer | 15 |
| StockReservation | 1 |
| Warehouse | 3 |
| Product | 3 |
| TenantSubscription | 0 |
| PlanPayment | 0 |
| Tenants (plan=PRO) | 2 |

**Interpretação:** o producto foi construído com força, mas não usado. Nenhum cliente real emitiu uma factura. Isto muda a narrativa de mercado: a base de clientes é apenas de testes. O próximo passo tem de ser pilotos controlados de produção.

**Impacto no roadmap:** fase P0 inclui necessariamente "piloto 3–5 empresas reais" e "rollout de RLS completo" — sem isto, qualquer venda é teórica.
